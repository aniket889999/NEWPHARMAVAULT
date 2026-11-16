const ConsistencyCheck = require('../../models/consistencyCheckModel');
const EvidenceItem = require('../../models/evidenceItemModel');
const { buildDocumentMedicineItems } = require('./medicineItemContract');
const { reconcileMedicineDocuments } = require('./medicineReconciliationService');
const { buildProposedGroupsFromPersistedFields } = require('./localMedicineRowExtractor');

/**
 * Consistency Check Service
 * Evaluates cross-document alignment across Prescription, Pharmacy Invoice, and Health Claim Form
 * using the Session 1 medicine-item contract and Session 2 medicine reconciliation service.
 */
class ConsistencyCheckService {
  // Project the frozen Session 2 result; absent/unknown dimensions never mean PASS.
  _comparisonStatus(comparison, dimensions) {
    const rows = Array.isArray(comparison?.rows) ? comparison.rows : [];
    if (!rows.length) return 'INCONCLUSIVE';
    if (dimensions.includes('identity') && rows.some(row =>
      (row.reasonCodes || []).some(code => ['MISSING_INVOICE_ITEM', 'EXTRA_INVOICE_ITEM'].includes(code)))) return 'FAIL';
    if (rows.some(row => dimensions.some(dimension => row.checks?.[dimension] === 'MISMATCH'))) return 'FAIL';
    if (!rows.every(row => row.prescriptionItemId && row.invoiceItemId)) return 'INCONCLUSIVE';
    return rows.every(row => dimensions.every(dimension =>
      row.checks?.[dimension] === 'CONSISTENT' ||
      (dimension === 'release' && row.checks?.[dimension] === 'NOT_APPLICABLE'))) ? 'PASS' : 'INCONCLUSIVE';
  }

  _buildDocEnvelope(doc, docFields) {
    if (!doc) return null;
    const storedGroups =
      doc.metadata?.medicineGrouping?.groups ||
      doc.metadata?.proposedMedicineGrouping?.groups ||
      buildProposedGroupsFromPersistedFields(docFields, {
        blockerCodes: doc.metadata?.extractionBlockers
      });

    if (Array.isArray(storedGroups) && storedGroups.length > 0) {
      const env = buildDocumentMedicineItems({
        document: doc,
        extractedFields: docFields,
        groups: storedGroups
      });
      if (env.groupingStatus === 'GROUPED') {
        return env;
      }
    }
    return buildDocumentMedicineItems({
      document: doc,
      extractedFields: docFields
    });
  }

  /**
   * Run all consistency checks for a case given documents and extracted fields
   * @param {Object} params
   * @param {string} params.caseId
   * @param {Array} params.documents
   * @param {Array} params.fields
   * @param {Object} [params.resolutions]
   * @param {Object} [params.reconciliationSnapshot]
   * @returns {Promise<Array>} Array of ConsistencyCheck documents
   */
  async runChecks({
    caseId,
    documents,
    fields,
    resolutions = {},
    reconciliationSnapshot = null
  }) {
    await ConsistencyCheck.deleteMany({ caseId });

    const docTypeMap = {};
    for (const doc of documents) {
      docTypeMap[doc.type] = {
        doc,
        docId: doc._id,
        fields: fields.filter((f) => String(f.documentId) === String(doc._id))
      };
    }

    const checks = [];

    const getVal = (type, fieldName) => {
      if (!docTypeMap[type]) return null;
      const found = docTypeMap[type].fields.find((f) => f.fieldType === fieldName);
      return found ? found.normalizedValue || found.rawValue : null;
    };

    const getFieldObj = (type, fieldName) => {
      if (!docTypeMap[type]) return null;
      return docTypeMap[type].fields.find((f) => f.fieldType === fieldName) || null;
    };

    const rxEntry = docTypeMap['PRESCRIPTION'] || null;
    const invEntry = docTypeMap['PHARMACY_INVOICE'] || null;

    const rxEnvelope =
      reconciliationSnapshot?.prescription ||
      (rxEntry ? this._buildDocEnvelope(rxEntry.doc, rxEntry.fields) : null);
    const invEnvelope =
      reconciliationSnapshot?.invoice ||
      (invEntry ? this._buildDocEnvelope(invEntry.doc, invEntry.fields) : null);
    const comparison =
      reconciliationSnapshot?.comparison ||
      (rxEnvelope || invEnvelope
        ? reconcileMedicineDocuments({
            caseId: String(caseId),
            prescription: rxEnvelope,
            invoice: invEnvelope
          })
        : null);

    const rxMedFields = rxEntry
      ? rxEntry.fields.filter((f) => f.fieldType === 'medicine_name')
      : [];
    const invMedFields = invEntry
      ? invEntry.fields.filter((f) => f.fieldType === 'medicine_name')
      : [];

    // 1. Medicine Name Consistency Check (Item-level reconciliation across Rx and Invoice)
    if (rxMedFields.length > 0 && invMedFields.length > 0 && comparison) {
      const rows = Array.isArray(comparison.rows) ? comparison.rows : [];
      const identityStatus = this._comparisonStatus(comparison, ['identity']);

      const rxSummary = rxMedFields.map((f) => f.normalizedValue || f.rawValue).join(', ');
      const invSummary = invMedFields.map((f) => f.normalizedValue || f.rawValue).join(', ');

      let checkStatus = 'INCONCLUSIVE';
      let checkSeverity = 'MEDIUM';
      let checkMessage = '';
      let evidenceText = '';
      let reviewRequired = true;

      if (identityStatus === 'FAIL') {
        checkStatus = 'FAIL';
        checkSeverity = 'HIGH';
        reviewRequired = true;
        checkMessage = `Medicine item mismatch between Prescription (${rxSummary}) and Pharmacy Invoice (${invSummary}).`;
        evidenceText = `Item-level medicine reconciliation detected a discrepancy between Prescription (${rxSummary}) and Pharmacy Invoice (${invSummary}): ${rows
          .map((r) => `${r.status} [${(r.reasonCodes || []).join(', ')}]`)
          .join('; ')}.`;
      } else if (identityStatus === 'PASS') {
        checkStatus = 'PASS';
        checkSeverity = 'INFO';
        reviewRequired = false;
        const generics = [...new Set(rows.map(row => row.genericName).filter(Boolean))].join(', ');
        checkMessage = `Medicine identities align with the academic generic record (${generics}): Prescription (${rxSummary}), Invoice (${invSummary}).`;
        evidenceText = `OCR document evidence: Prescription (${rxSummary}), Invoice (${invSummary}). Curated local medicine catalogue: ${generics}. Item-level reconciliation aligned ${rows.length} medicine item(s); this academic identity reference is not live regulatory verification.`;
      } else {
        checkStatus = 'INCONCLUSIVE';
        checkSeverity = 'MEDIUM';
        reviewRequired = true;
        checkMessage = `Medicine identity cannot be resolved safely between Prescription ("${rxSummary}") and Pharmacy Invoice ("${invSummary}"). Requires human confirmation.`;
        evidenceText = `Item-level medicine reconciliation requires human review between Prescription ("${rxSummary}") and Pharmacy Invoice ("${invSummary}"). Source note: Curated academic reference catalogue — not live regulatory verification.`;
      }

      const evidence = await this._createEvidence({
        caseId,
        sourceId: rxMedFields[0]._id,
        documentId: rxEntry.docId,
        claimSupported: `Medicine Name Alignment: Rx (${rxSummary}) vs Invoice (${invSummary})`,
        evidenceText,
        trustTier: 4
      });

      const check = new ConsistencyCheck({
        caseId,
        checkType: 'MEDICINE_NAME_CONSISTENCY',
        status: checkStatus,
        severity: checkSeverity,
        message: checkMessage,
        evidenceItemIds: [evidence._id],
        rulesetVersion: '2.0',
        reviewRequired
      });
      checks.push(await check.save());
    }

    // 2. Dosage Strength Consistency Check (Item-level reconciliation)
    const rxStrengthFields = rxEntry
      ? rxEntry.fields.filter((f) => f.fieldType === 'dosage_strength')
      : [];
    const invStrengthFields = invEntry
      ? invEntry.fields.filter((f) => f.fieldType === 'dosage_strength')
      : [];
    const rxStrengthFallback =
      getVal('PRESCRIPTION', 'dosage_strength') ||
      resolutions['PRESCRIPTION']?.canonical?.strength;
    const invStrengthFallback =
      getVal('PHARMACY_INVOICE', 'dosage_strength') ||
      resolutions['PHARMACY_INVOICE']?.canonical?.strength;

    if ((rxStrengthFields.length > 0 && invStrengthFields.length > 0) || (rxStrengthFallback && invStrengthFallback)) {
      const strengthStatus = this._comparisonStatus(comparison, ['strength']);
      const strengthMatch = strengthStatus === 'PASS';

      const rxStrLabel =
        rxStrengthFields.map((f) => f.normalizedValue || f.rawValue).join(', ') ||
        rxStrengthFallback;
      const invStrLabel =
        invStrengthFields.map((f) => f.normalizedValue || f.rawValue).join(', ') ||
        invStrengthFallback;

      const evidence = await this._createEvidence({
        caseId,
        sourceId: rxStrengthFields[0]?._id || rxEntry?.docId,
        documentId: rxEntry?.docId,
        claimSupported: `Dosage Strength Alignment: Rx (${rxStrLabel}) vs Invoice (${invStrLabel})`,
        evidenceText: strengthMatch
          ? `OCR document evidence: Prescribed strength (${rxStrLabel}) matches invoiced strength (${invStrLabel}).`
          : strengthStatus === 'FAIL'
            ? `Strength discrepancy: Prescribed (${rxStrLabel}) vs Invoiced (${invStrLabel}).`
            : `Strength comparison is inconclusive for the current item evidence: Prescription (${rxStrLabel}), Invoice (${invStrLabel}).`,
        trustTier: 4
      });

      const check = new ConsistencyCheck({
        caseId,
        checkType: 'DOSAGE_STRENGTH_CONSISTENCY',
        status: strengthStatus,
        severity: strengthMatch ? 'INFO' : strengthStatus === 'FAIL' ? 'HIGH' : 'MEDIUM',
        message: strengthMatch
          ? 'Dosage and strength aligned across prescription and invoice.'
          : strengthStatus === 'FAIL'
            ? `Dosage strength mismatch: Prescribed ${rxStrLabel} vs Invoiced ${invStrLabel}.`
            : 'Strength evidence is insufficient for a safe item-level comparison.',
        evidenceItemIds: [evidence._id],
        rulesetVersion: '2.0',
        reviewRequired: !strengthMatch
      });
      checks.push(await check.save());
    }

    // 3. Dosage Form & Release Type Consistency Check
    const rxFormFields = rxEntry
      ? rxEntry.fields.filter((f) => f.fieldType === 'dosage_form')
      : [];
    const invFormFields = invEntry
      ? invEntry.fields.filter((f) => f.fieldType === 'dosage_form')
      : [];
    const rxFormFallback =
      getVal('PRESCRIPTION', 'dosage_form') ||
      resolutions['PRESCRIPTION']?.canonical?.dosageForm;
    const invFormFallback =
      getVal('PHARMACY_INVOICE', 'dosage_form') ||
      resolutions['PHARMACY_INVOICE']?.canonical?.dosageForm;

    if ((rxFormFields.length > 0 && invFormFields.length > 0) || (rxFormFallback && invFormFallback)) {
      const formStatus = this._comparisonStatus(comparison, ['form', 'release']);
      const formMatch = formStatus === 'PASS';

      const rxFormLabel =
        rxFormFields.map((f) => f.normalizedValue || f.rawValue).join(', ') || rxFormFallback;
      const invFormLabel =
        invFormFields.map((f) => f.normalizedValue || f.rawValue).join(', ') || invFormFallback;

      const evidence = await this._createEvidence({
        caseId,
        sourceId: rxFormFields[0]?._id || rxEntry?.docId,
        documentId: rxEntry?.docId,
        claimSupported: `Dosage Form Alignment: Rx (${rxFormLabel}) vs Invoice (${invFormLabel})`,
        evidenceText: formMatch
          ? `Dosage form (${rxFormLabel}) matches invoice dosage form (${invFormLabel}).`
          : `Dosage form or release comparison is ${formStatus === 'FAIL' ? 'inconsistent' : 'inconclusive'}: Prescription (${rxFormLabel}), Invoice (${invFormLabel}). Requires human review.`,
        trustTier: 4
      });

      const check = new ConsistencyCheck({
        caseId,
        checkType: 'DOSAGE_FORM_CONSISTENCY',
        status: formStatus,
        severity: formMatch ? 'INFO' : formStatus === 'FAIL' ? 'HIGH' : 'MEDIUM',
        message: formMatch
          ? 'Dosage form aligned across prescription and invoice.'
          : `Dosage form/release evidence is ${formStatus === 'FAIL' ? 'inconsistent' : 'inconclusive'}. Requires human review.`,
        evidenceItemIds: [evidence._id],
        rulesetVersion: '2.0',
        reviewRequired: !formMatch
      });
      checks.push(await check.save());
    }

    // 4. Quantity comparison uses explicit Session 2 units/pack arithmetic; never infer from unitless numbers.
    const rxQtyFields = rxEntry ? rxEntry.fields.filter((f) => f.fieldType === 'quantity') : [];
    const invQtyFields = invEntry ? invEntry.fields.filter((f) => f.fieldType === 'quantity') : [];
    const rxQty = parseFloat(getVal('PRESCRIPTION', 'quantity'));
    const invQty = parseFloat(getVal('PHARMACY_INVOICE', 'quantity'));

    if ((rxQtyFields.length > 0 && invQtyFields.length > 0) || (!Number.isNaN(rxQty) && !Number.isNaN(invQty))) {
      const quantityStatus = this._comparisonStatus(comparison, ['quantity']);
      const qtyMatch = quantityStatus === 'PASS';

      const rxQtyLabel =
        rxQtyFields.map((f) => f.normalizedValue || f.rawValue).join(', ') || String(rxQty);
      const invQtyLabel =
        invQtyFields.map((f) => f.normalizedValue || f.rawValue).join(', ') || String(invQty);

      const evidence = await this._createEvidence({
        caseId,
        sourceId: rxQtyFields[0]?._id || getFieldObj('PRESCRIPTION', 'quantity')?._id || rxEntry?.docId,
        documentId: rxEntry?.docId,
        claimSupported: `Quantity Consistency: Prescribed (${rxQtyLabel}) vs Invoiced (${invQtyLabel})`,
        evidenceText: qtyMatch
          ? `The explicitly normalized item quantities agree: Prescription (${rxQtyLabel}), Invoice (${invQtyLabel}).`
          : quantityStatus === 'FAIL'
            ? `Documented quantity discrepancy: Prescription (${rxQtyLabel}), Invoice (${invQtyLabel}).`
            : `Quantity comparison requires explicit compatible units and complete item evidence: Prescription (${rxQtyLabel}), Invoice (${invQtyLabel}).`,
        trustTier: 4
      });

      const check = new ConsistencyCheck({
        caseId,
        checkType: 'QUANTITY_CONSISTENCY',
        status: quantityStatus,
        severity: qtyMatch ? 'INFO' : quantityStatus === 'FAIL' ? 'HIGH' : 'MEDIUM',
        message: qtyMatch
          ? 'Documented item quantities agree after explicit unit/pack normalization.'
          : quantityStatus === 'FAIL'
            ? `Quantity mismatch: Prescription (${rxQtyLabel}) vs Invoice (${invQtyLabel}).`
            : 'Quantity evidence is incomplete or units cannot be compared; no numeric limit was inferred.',
        evidenceItemIds: [evidence._id],
        rulesetVersion: '2.0',
        reviewRequired: !qtyMatch
      });
      checks.push(await check.save());
    }

    // 5. Date Sequence Consistency Check
    const rxDate = getVal('PRESCRIPTION', 'prescription_date');
    const invDate = getVal('PHARMACY_INVOICE', 'invoice_date');

    if (rxDate && invDate) {
      const dRx = new Date(rxDate);
      const dInv = new Date(invDate);
      const validSequence = dRx <= dInv;

      const evidence = await this._createEvidence({
        caseId,
        sourceId: getFieldObj('PRESCRIPTION', 'prescription_date')._id,
        documentId: docTypeMap['PRESCRIPTION'].docId,
        claimSupported: `Chronological Date Sequence: Rx (${rxDate}) <= Invoice (${invDate})`,
        evidenceText: validSequence
          ? `Prescription date (${rxDate}) precedes or equals invoice date (${invDate}).`
          : `Anachronistic date: Invoice date (${invDate}) is before prescription date (${rxDate}).`,
        trustTier: 4
      });

      const check = new ConsistencyCheck({
        caseId,
        checkType: 'DATE_SEQUENCE_CONSISTENCY',
        status: validSequence ? 'PASS' : 'FAIL',
        severity: validSequence ? 'INFO' : 'CRITICAL',
        message: validSequence
          ? 'Document dates follow chronological treatment order.'
          : `Date sequence invalid: Invoice date (${invDate}) is prior to prescription date (${rxDate}).`,
        evidenceItemIds: [evidence._id],
        rulesetVersion: '2.0',
        reviewRequired: !validSequence
      });
      checks.push(await check.save());
    }

    // 6. Required medicine pair; preserve the legacy checkType only for API compatibility.
    const presentTypes = Object.keys(docTypeMap);
    const hasRequiredMedicinePair =
      presentTypes.includes('PRESCRIPTION') &&
      presentTypes.includes('PHARMACY_INVOICE');

    if (!hasRequiredMedicinePair) {
      const missing = ['PRESCRIPTION', 'PHARMACY_INVOICE'].filter(
        (t) => !presentTypes.includes(t)
      );
      const check = new ConsistencyCheck({
        caseId,
        checkType: 'DOCUMENT_TRIANGLE_COMPLETENESS',
        status: 'INCONCLUSIVE',
        severity: 'MEDIUM',
        message: `Missing required medicine document(s): ${missing.join(', ')}. Claim form is optional.`,
        evidenceItemIds: [],
        rulesetVersion: '2.0',
        reviewRequired: true
      });
      checks.push(await check.save());
    }

    return checks;
  }

  async _createEvidence({
    caseId,
    sourceId,
    documentId,
    claimSupported,
    evidenceText,
    trustTier = 4
  }) {
    const ev = new EvidenceItem({
      caseId,
      sourceId,
      documentId,
      claimSupported,
      evidenceText,
      trustTier
    });
    return await ev.save();
  }
}

module.exports = new ConsistencyCheckService();
