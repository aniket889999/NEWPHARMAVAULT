const ConsistencyCheck = require('../../models/consistencyCheckModel');
const EvidenceItem = require('../../models/evidenceItemModel');

/**
 * Consistency Check Service
 * Evaluates cross-document alignment across Prescription, Pharmacy Invoice, and Health Claim Form.
 */
class ConsistencyCheckService {
  /**
   * Run all consistency checks for a case given documents and extracted fields
   * @param {Object} params
   * @param {string} params.caseId
   * @param {Array} params.documents
   * @param {Array} params.fields
   * @param {Object} params.resolutions Map of documentId/medicine to canonical resolution
   * @returns {Promise<Array>} Array of ConsistencyCheck documents
   */
  async runChecks({ caseId, documents, fields, resolutions = {} }) {
    // Clean up old checks for re-runs
    await ConsistencyCheck.deleteMany({ caseId });

    // Group fields by document type
    const docTypeMap = {};
    for (const doc of documents) {
      docTypeMap[doc.type] = {
        docId: doc._id,
        fields: fields.filter(f => String(f.documentId) === String(doc._id))
      };
    }

    const checks = [];

    // Helper to get field normalized or raw value
    const getVal = (type, fieldName) => {
      if (!docTypeMap[type]) return null;
      const found = docTypeMap[type].fields.find(f => f.fieldType === fieldName);
      return found ? (found.normalizedValue || found.rawValue) : null;
    };

    const getFieldObj = (type, fieldName) => {
      if (!docTypeMap[type]) return null;
      return docTypeMap[type].fields.find(f => f.fieldType === fieldName) || null;
    };

    // 1. Medicine Name Consistency Check
    const rxMed = getVal('PRESCRIPTION', 'medicine_name');
    const invMed = getVal('PHARMACY_INVOICE', 'medicine_name');
    const clmMed = getVal('CLAIM_FORM', 'medicine_name');

    if (rxMed && invMed) {
      const rxRes = resolutions['PRESCRIPTION'] || null;
      const invRes = resolutions['PHARMACY_INVOICE'] || null;
      const rxCanonical = rxRes?.canonical?.genericName || null;
      const invCanonical = invRes?.canonical?.genericName || null;

      const isExactMatch = rxMed.toLowerCase().trim() === invMed.toLowerCase().trim();
      const isCanonicalMatch = Boolean(
        rxRes?.resolved &&
        invRes?.resolved &&
        rxCanonical &&
        invCanonical &&
        rxCanonical.toLowerCase().trim() === invCanonical.toLowerCase().trim()
      );

      // Definite mismatch only when BOTH resolve confidently to DIFFERENT generic names
      const isCanonicalMismatch = Boolean(
        rxRes?.resolved &&
        invRes?.resolved &&
        rxCanonical &&
        invCanonical &&
        rxCanonical.toLowerCase().trim() !== invCanonical.toLowerCase().trim()
      );

      let checkStatus = 'INCONCLUSIVE';
      let checkSeverity = 'MEDIUM';
      let checkMessage = '';
      let evidenceText = '';
      let reviewRequired = true;

      if (isExactMatch || isCanonicalMatch) {
        checkStatus = 'PASS';
        checkSeverity = 'INFO';
        reviewRequired = false;
        checkMessage = isCanonicalMatch && !isExactMatch
          ? `Cross-brand medicine alignment verified: Prescription ("${rxMed}") and Invoice ("${invMed}") resolve to generic "${rxCanonical}".`
          : 'Medicine name verified consistent between Prescription and Pharmacy Invoice.';
        evidenceText = `OCR document evidence: Prescription mentions "${rxMed}", Pharmacy Invoice mentions "${invMed}". ` +
          `Curated local medicine catalogue: ${
            isCanonicalMatch
              ? `Prescription resolved to generic "${rxCanonical}" (${rxRes.matchBasis}, ${(rxRes.matchScore * 100).toFixed(0)}% match); Invoice resolved to generic "${invCanonical}" (${invRes.matchBasis}, ${(invRes.matchScore * 100).toFixed(0)}% match).`
              : `Direct verbatim brand alignment.`
          }`;
      } else if (isCanonicalMismatch) {
        checkStatus = 'FAIL';
        checkSeverity = 'HIGH';
        reviewRequired = true;
        checkMessage = `Medicine name mismatch between Prescription ("${rxMed}" -> ${rxCanonical}) and Pharmacy Invoice ("${invMed}" -> ${invCanonical}).`;
        evidenceText = `OCR document evidence: Prescription specifies "${rxMed}", Pharmacy Invoice specifies "${invMed}". ` +
          `Curated local medicine catalogue: Conflicting generic medicines resolved. Prescribed generic "${rxCanonical}" (${rxRes.matchBasis}) vs Invoiced generic "${invCanonical}" (${invRes.matchBasis}).`;
      } else {
        // Unresolved, ambiguous, or low-confidence medicine text
        checkStatus = 'INCONCLUSIVE';
        checkSeverity = 'MEDIUM';
        reviewRequired = true;
        checkMessage = `Medicine identity cannot be resolved safely between Prescription ("${rxMed}") and Pharmacy Invoice ("${invMed}"). Requires human confirmation.`;
        evidenceText = `OCR document evidence: Prescription text "${rxMed}", Pharmacy Invoice text "${invMed}". ` +
          `Curated local medicine catalogue: ${
            !rxRes?.resolved
              ? `Prescription identity unresolved (${rxRes?.matchBasis || 'no match in catalogue'})`
              : `Prescription resolved to generic ${rxCanonical}`
          }; ${
            !invRes?.resolved
              ? `Invoice identity unresolved (${invRes?.matchBasis || 'no match in catalogue'})`
              : `Invoice resolved to generic ${invCanonical}`
          }. Source note: Curated academic reference catalogue — not live regulatory verification. Never classified as a confirmed mismatch without conclusive evidence.`;
      }

      const evidence = await this._createEvidence({
        caseId,
        sourceId: getFieldObj('PRESCRIPTION', 'medicine_name')._id,
        documentId: docTypeMap['PRESCRIPTION'].docId,
        claimSupported: `Medicine Name Alignment: Rx (${rxMed}) vs Invoice (${invMed})`,
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
        rulesetVersion: '1.0',
        reviewRequired
      });
      checks.push(await check.save());
    }

    // 2. Dosage Strength Consistency Check (Independent check)
    const rxStrength = getVal('PRESCRIPTION', 'dosage_strength') || resolutions['PRESCRIPTION']?.canonical?.strength;
    const invStrength = getVal('PHARMACY_INVOICE', 'dosage_strength') || resolutions['PHARMACY_INVOICE']?.canonical?.strength;

    if (rxStrength && invStrength) {
      const normRxStr = String(rxStrength).toLowerCase().replace(/\s+/g, '');
      const normInvStr = String(invStrength).toLowerCase().replace(/\s+/g, '');
      const strengthMatch = normRxStr === normInvStr;

      const evidence = await this._createEvidence({
        caseId,
        sourceId: getFieldObj('PRESCRIPTION', 'dosage_strength')?._id || docTypeMap['PRESCRIPTION'].docId,
        documentId: docTypeMap['PRESCRIPTION'].docId,
        claimSupported: `Dosage Strength Alignment: Rx (${rxStrength}) vs Invoice (${invStrength})`,
        evidenceText: `OCR document evidence: Prescribed strength "${rxStrength}", Invoiced strength "${invStrength}". ` +
          `Curated local medicine catalogue: ${
            strengthMatch
              ? `Dosage strength "${rxStrength}" matches invoice strength "${invStrength}".`
              : `Strength discrepancy: Prescribed "${rxStrength}" vs Invoiced "${invStrength}".`
          }`,
        trustTier: 4
      });

      const check = new ConsistencyCheck({
        caseId,
        checkType: 'DOSAGE_STRENGTH_CONSISTENCY',
        status: strengthMatch ? 'PASS' : 'FAIL',
        severity: strengthMatch ? 'INFO' : 'HIGH',
        message: strengthMatch
          ? 'Dosage and strength aligned across prescription and invoice.'
          : `Dosage strength mismatch: Prescribed ${rxStrength} vs Invoiced ${invStrength}.`,
        evidenceItemIds: [evidence._id],
        rulesetVersion: '1.0',
        reviewRequired: !strengthMatch
      });
      checks.push(await check.save());
    }

    // 3. Dosage Form Consistency Check (Independent check)
    const rxForm = getVal('PRESCRIPTION', 'dosage_form') || resolutions['PRESCRIPTION']?.canonical?.dosageForm;
    const invForm = getVal('PHARMACY_INVOICE', 'dosage_form') || resolutions['PHARMACY_INVOICE']?.canonical?.dosageForm;

    if (rxForm && invForm) {
      const normRxForm = String(rxForm).toLowerCase().trim();
      const normInvForm = String(invForm).toLowerCase().trim();
      const formMatch = normRxForm === normInvForm;

      const evidence = await this._createEvidence({
        caseId,
        sourceId: getFieldObj('PRESCRIPTION', 'dosage_form')?._id || docTypeMap['PRESCRIPTION'].docId,
        documentId: docTypeMap['PRESCRIPTION'].docId,
        claimSupported: `Dosage Form Alignment: Rx (${rxForm}) vs Invoice (${invForm})`,
        evidenceText: `OCR document evidence: Prescribed dosage form "${rxForm}", Invoiced dosage form "${invForm}". ` +
          `Curated local medicine catalogue: ${
            formMatch
              ? `Dosage form "${rxForm}" matches invoice dosage form "${invForm}".`
              : `Dosage form substitution detected: Prescribed "${rxForm}" vs Invoiced "${invForm}". Requires clinical review.`
          }`,
        trustTier: 4
      });

      const check = new ConsistencyCheck({
        caseId,
        checkType: 'DOSAGE_FORM_CONSISTENCY',
        status: formMatch ? 'PASS' : 'INCONCLUSIVE',
        severity: formMatch ? 'INFO' : 'MEDIUM',
        message: formMatch
          ? 'Dosage form aligned across prescription and invoice.'
          : `Dosage form discrepancy: Prescribed ${rxForm} vs Invoiced ${invForm}. Requires clinical review.`,
        evidenceItemIds: [evidence._id],
        rulesetVersion: '1.0',
        reviewRequired: !formMatch
      });
      checks.push(await check.save());
    }

    // 3. Quantity Consistency Check
    const rxQty = parseFloat(getVal('PRESCRIPTION', 'quantity'));
    const invQty = parseFloat(getVal('PHARMACY_INVOICE', 'quantity'));
    const clmQty = parseFloat(getVal('CLAIM_FORM', 'quantity'));

    if (!isNaN(rxQty) && !isNaN(invQty)) {
      const qtyMatch = invQty <= rxQty; // Dispensed should not exceed prescribed
      const evidence = await this._createEvidence({
        caseId,
        sourceId: getFieldObj('PRESCRIPTION', 'quantity')._id,
        documentId: docTypeMap['PRESCRIPTION'].docId,
        claimSupported: `Quantity Consistency: Prescribed (${rxQty}) vs Invoiced (${invQty})`,
        evidenceText: qtyMatch
          ? `Dispensed quantity ${invQty} is within prescribed limit of ${rxQty}.`
          : `Excessive dispensing: Prescribed ${rxQty} but Invoiced ${invQty}.`,
        trustTier: 4
      });

      const check = new ConsistencyCheck({
        caseId,
        checkType: 'QUANTITY_CONSISTENCY',
        status: qtyMatch ? 'PASS' : 'FAIL',
        severity: qtyMatch ? 'INFO' : 'HIGH',
        message: qtyMatch
          ? `Quantity is valid (${invQty} dispensed <= ${rxQty} prescribed).`
          : `Quantity mismatch: ${invQty} invoiced exceeds ${rxQty} prescribed.`,
        evidenceItemIds: [evidence._id],
        rulesetVersion: '1.0',
        reviewRequired: !qtyMatch
      });
      checks.push(await check.save());
    }

    // 4. Date Sequence Consistency Check
    const rxDate = getVal('PRESCRIPTION', 'prescription_date');
    const invDate = getVal('PHARMACY_INVOICE', 'invoice_date');
    const clmDate = getVal('CLAIM_FORM', 'claim_date');

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
        rulesetVersion: '1.0',
        reviewRequired: !validSequence
      });
      checks.push(await check.save());
    }

    // 5. Document Triangle Completeness Check
    const presentTypes = Object.keys(docTypeMap);
    const hasTriangle = presentTypes.includes('PRESCRIPTION') &&
                        presentTypes.includes('PHARMACY_INVOICE') &&
                        presentTypes.includes('CLAIM_FORM');

    if (!hasTriangle) {
      const missing = ['PRESCRIPTION', 'PHARMACY_INVOICE', 'CLAIM_FORM'].filter(t => !presentTypes.includes(t));
      const check = new ConsistencyCheck({
        caseId,
        checkType: 'DOCUMENT_TRIANGLE_COMPLETENESS',
        status: 'INCONCLUSIVE',
        severity: 'MEDIUM',
        message: `Incomplete document set: Missing ${missing.join(', ')}.`,
        evidenceItemIds: [],
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      checks.push(await check.save());
    }

    return checks;
  }

  async _createEvidence({ caseId, sourceId, documentId, claimSupported, evidenceText, trustTier = 4 }) {
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
