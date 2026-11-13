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
      const hasBrandGenericConflict = rows.some((r) =>
        (r.issueCodes || []).includes('BRAND_GENERIC_CONFLICT')
      );
      const hasMissingOrExtra = rows.some(
        (r) =>
          r.rowStatus === 'MISSING_INVOICE_ITEM' || r.rowStatus === 'EXTRA_INVOICE_ITEM'
      );
      const hasIdentityUncertainty = rows.some((r) =>
        (r.issueCodes || []).some((c) =>
          [
            'AMBIGUOUS_MEDICINE_IDENTITY',
            'UNKNOWN_MEDICINE_IDENTITY',
            'LOW_CONFIDENCE_EVIDENCE',
            'DOCUMENT_REVIEW_REQUIRED'
          ].includes(c)
        )
      );
      const allPairedAndResolved =
        rows.length > 0 &&
        rows.every(
          (r) =>
            r.prescriptionItemId !== null &&
            r.invoiceItemId !== null &&
            r.identity?.status === 'MATCH'
        );

      const rxSummary = rxMedFields.map((f) => f.normalizedValue || f.rawValue).join(', ');
      const invSummary = invMedFields.map((f) => f.normalizedValue || f.rawValue).join(', ');

      let checkStatus = 'INCONCLUSIVE';
      let checkSeverity = 'MEDIUM';
      let checkMessage = '';
      let evidenceText = '';
      let reviewRequired = true;

      if (hasBrandGenericConflict || hasMissingOrExtra) {
        checkStatus = 'FAIL';
        checkSeverity = 'HIGH';
        reviewRequired = true;
        checkMessage = `Medicine item mismatch between Prescription (${rxSummary}) and Pharmacy Invoice (${invSummary}).`;
        evidenceText = `Item-level medicine reconciliation detected a discrepancy between Prescription (${rxSummary}) and Pharmacy Invoice (${invSummary}): ${rows
          .map((r) => `${r.rowStatus} [${(r.issueCodes || []).join(', ')}]`)
          .join('; ')}.`;
      } else if (allPairedAndResolved && !hasIdentityUncertainty) {
        checkStatus = 'PASS';
        checkSeverity = 'INFO';
        reviewRequired = false;
        checkMessage = `Medicine items verified consistent across Prescription (${rxSummary}) and Pharmacy Invoice (${invSummary}).`;
        evidenceText = `Item-level medicine reconciliation aligned ${rows.length} medicine item(s) between Prescription (${rxSummary}) and Pharmacy Invoice (${invSummary}).`;
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
      const rows = Array.isArray(comparison?.rows) ? comparison.rows : [];
      const hasStrengthMismatchInRows = rows.some((r) =>
        (r.issueCodes || []).includes('STRENGTH_MISMATCH')
      );
      const normRxStr = String(rxStrengthFallback || '').toLowerCase().replace(/\s+/g, '');
      const normInvStr = String(invStrengthFallback || '').toLowerCase().replace(/\s+/g, '');
      const strengthMatch =
        rows.length > 0 && rows.some((r) => r.prescriptionItemId && r.invoiceItemId)
          ? !hasStrengthMismatchInRows
          : normRxStr === normInvStr;

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
          : `Strength discrepancy: Prescribed (${rxStrLabel}) vs Invoiced (${invStrLabel}).`,
        trustTier: 4
      });

      const check = new ConsistencyCheck({
        caseId,
        checkType: 'DOSAGE_STRENGTH_CONSISTENCY',
        status: strengthMatch ? 'PASS' : 'FAIL',
        severity: strengthMatch ? 'INFO' : 'HIGH',
        message: strengthMatch
          ? 'Dosage and strength aligned across prescription and invoice.'
          : `Dosage strength mismatch: Prescribed ${rxStrLabel} vs Invoiced ${invStrLabel}.`,
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
      const rows = Array.isArray(comparison?.rows) ? comparison.rows : [];
      const hasFormOrReleaseMismatch = rows.some((r) =>
        (r.issueCodes || []).some((c) =>
          ['DOSAGE_FORM_MISMATCH', 'RELEASE_TYPE_MISMATCH', 'RELEASE_TYPE_MISSING'].includes(c)
        )
      );
      const normRxForm = String(rxFormFallback || '').toLowerCase().trim();
      const normInvForm = String(invFormFallback || '').toLowerCase().trim();
      const formMatch =
        rows.length > 0 && rows.some((r) => r.prescriptionItemId && r.invoiceItemId)
          ? !hasFormOrReleaseMismatch
          : normRxForm === normInvForm;

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
          : `Dosage form or release discrepancy: Prescribed (${rxFormLabel}) vs Invoiced (${invFormLabel}). Requires clinical review.`,
        trustTier: 4
      });

      const check = new ConsistencyCheck({
        caseId,
        checkType: 'DOSAGE_FORM_CONSISTENCY',
        status: formMatch ? 'PASS' : 'INCONCLUSIVE',
        severity: formMatch ? 'INFO' : 'MEDIUM',
        message: formMatch
          ? 'Dosage form aligned across prescription and invoice.'
          : `Dosage form discrepancy: Prescribed ${rxFormLabel} vs Invoiced ${invFormLabel}. Requires clinical review.`,
        evidenceItemIds: [evidence._id],
        rulesetVersion: '2.0',
        reviewRequired: !formMatch
      });
      checks.push(await check.save());
    }

    // 4. Quantity Consistency Check (Item-level reconciliation with fallback for unitless legacy rows)
    const rxQtyFields = rxEntry ? rxEntry.fields.filter((f) => f.fieldType === 'quantity') : [];
    const invQtyFields = invEntry ? invEntry.fields.filter((f) => f.fieldType === 'quantity') : [];
    const rxQty = parseFloat(getVal('PRESCRIPTION', 'quantity'));
    const invQty = parseFloat(getVal('PHARMACY_INVOICE', 'quantity'));

    if ((rxQtyFields.length > 0 && invQtyFields.length > 0) || (!Number.isNaN(rxQty) && !Number.isNaN(invQty))) {
      const rows = Array.isArray(comparison?.rows) ? comparison.rows : [];
      const hasQtyExceedsInRows = rows.some(
        (r) =>
          (r.issueCodes || []).includes('QUANTITY_EXCEEDS_PRESCRIBED') ||
          r.quantityComparison?.status === 'INVOICE_EXCEEDS_PRESCRIPTION' ||
          (typeof r.quantityComparison?.prescriptionQuantity?.rawQuantity === 'number' &&
            typeof r.quantityComparison?.invoiceQuantity?.rawQuantity === 'number' &&
            !r.quantityComparison?.prescriptionQuantity?.quantityUnit &&
            !r.quantityComparison?.invoiceQuantity?.quantityUnit &&
            r.quantityComparison.invoiceQuantity.rawQuantity >
              r.quantityComparison.prescriptionQuantity.rawQuantity)
      );

      const qtyMatch =
        rows.length > 0 && rows.some((r) => r.prescriptionItemId && r.invoiceItemId)
          ? !hasQtyExceedsInRows
          : invQty <= rxQty;

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
          ? `Dispensed quantity (${invQtyLabel}) is within prescribed limit (${rxQtyLabel}).`
          : `Excessive dispensing: Prescribed (${rxQtyLabel}) but Invoiced (${invQtyLabel}).`,
        trustTier: 4
      });

      const check = new ConsistencyCheck({
        caseId,
        checkType: 'QUANTITY_CONSISTENCY',
        status: qtyMatch ? 'PASS' : 'FAIL',
        severity: qtyMatch ? 'INFO' : 'HIGH',
        message: qtyMatch
          ? `Quantity is valid (${invQtyLabel} dispensed <= ${rxQtyLabel} prescribed).`
          : `Quantity mismatch: ${invQtyLabel} invoiced exceeds ${rxQtyLabel} prescribed.`,
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

    // 6. Document Triangle Completeness Check
    const presentTypes = Object.keys(docTypeMap);
    const hasTriangle =
      presentTypes.includes('PRESCRIPTION') &&
      presentTypes.includes('PHARMACY_INVOICE') &&
      presentTypes.includes('CLAIM_FORM');

    if (!hasTriangle) {
      const missing = ['PRESCRIPTION', 'PHARMACY_INVOICE', 'CLAIM_FORM'].filter(
        (t) => !presentTypes.includes(t)
      );
      const check = new ConsistencyCheck({
        caseId,
        checkType: 'DOCUMENT_TRIANGLE_COMPLETENESS',
        status: 'INCONCLUSIVE',
        severity: 'MEDIUM',
        message: `Incomplete document set: Missing ${missing.join(', ')}.`,
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
