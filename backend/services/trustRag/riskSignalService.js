const RiskSignal = require('../../models/riskSignalModel');

/**
 * Risk Signal Service
 * Detects the 9 initial risk signals across extracted fields, consistency checks,
 * medicine resolutions, and document metadata.
 */
class RiskSignalService {
  /**
   * Evaluate and generate risk signals for a verification case
   * @param {Object} params
   * @param {string} params.caseId
   * @param {Array} params.documents
   * @param {Array} params.fields
   * @param {Array} params.checks
   * @param {Object} params.resolutions
   * @returns {Promise<Array>} Array of generated RiskSignal documents
   */
  async evaluateRiskSignals({ caseId, documents, fields, checks, resolutions = {} }) {
    // Clean previous risk signals for clean re-processing
    await RiskSignal.deleteMany({ caseId });

    const signals = [];

    // 1. LOW_OCR_CONFIDENCE
    const lowConfFields = fields.filter(f => f.extractionConfidence < 0.75);
    if (lowConfFields.length > 0) {
      const signal = new RiskSignal({
        caseId,
        signalType: 'LOW_OCR_CONFIDENCE',
        severity: 'MEDIUM',
        description: `${lowConfFields.length} field(s) have low extraction confidence (< 75%): ${lowConfFields.map(f => f.fieldType).join(', ')}.`,
        evidenceItemIds: [],
        detectedBy: 'FIELD_CONFIDENCE_MONITOR',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 2. MISSING_REQUIRED_FIELD
    const requiredPerDoc = {
      PRESCRIPTION: ['medicine_name', 'dosage_strength', 'quantity', 'prescription_date'],
      PHARMACY_INVOICE: ['medicine_name', 'quantity', 'total_amount', 'invoice_date'],
      CLAIM_FORM: ['medicine_name', 'claimed_amount']
    };

    const missingFieldList = [];
    for (const doc of documents) {
      const docFields = fields.filter(f => String(f.documentId) === String(doc._id));
      const required = requiredPerDoc[doc.type] || [];
      for (const req of required) {
        const found = docFields.find(f => f.fieldType === req && f.rawValue && f.rawValue.trim().length > 0);
        if (!found) {
          missingFieldList.push(`${doc.type}: ${req}`);
        }
      }
    }

    if (missingFieldList.length > 0) {
      const signal = new RiskSignal({
        caseId,
        signalType: 'MISSING_REQUIRED_FIELD',
        severity: 'HIGH',
        description: `Missing required clinical/financial fields: ${missingFieldList.join(', ')}.`,
        evidenceItemIds: [],
        detectedBy: 'FIELD_COMPLETENESS_VALIDATOR',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 3. MEDICINE_STRENGTH_MISMATCH
    const strengthFail = checks.find(c => c.checkType === 'DOSAGE_STRENGTH_CONSISTENCY' && c.status === 'FAIL');
    if (strengthFail) {
      const signal = new RiskSignal({
        caseId,
        signalType: 'MEDICINE_STRENGTH_MISMATCH',
        severity: 'HIGH',
        description: strengthFail.message,
        evidenceItemIds: strengthFail.evidenceItemIds || [],
        detectedBy: 'CROSS_DOC_CONSISTENCY_ENGINE',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 4. MEDICINE_NAME_MISMATCH
    const medNameFail = checks.find(c => c.checkType === 'MEDICINE_NAME_CONSISTENCY' && c.status === 'FAIL');
    if (medNameFail) {
      const signal = new RiskSignal({
        caseId,
        signalType: 'MEDICINE_NAME_MISMATCH',
        severity: 'HIGH',
        description: medNameFail.message,
        evidenceItemIds: medNameFail.evidenceItemIds || [],
        detectedBy: 'CROSS_DOC_CONSISTENCY_ENGINE',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 5. QUANTITY_MISMATCH
    const qtyFail = checks.find(c => c.checkType === 'QUANTITY_CONSISTENCY' && c.status === 'FAIL');
    if (qtyFail) {
      const signal = new RiskSignal({
        caseId,
        signalType: 'QUANTITY_MISMATCH',
        severity: 'HIGH',
        description: qtyFail.message,
        evidenceItemIds: qtyFail.evidenceItemIds || [],
        detectedBy: 'CROSS_DOC_CONSISTENCY_ENGINE',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 6. DATE_INCONSISTENCY
    const dateFail = checks.find(c => c.checkType === 'DATE_SEQUENCE_CONSISTENCY' && c.status === 'FAIL');
    if (dateFail) {
      const signal = new RiskSignal({
        caseId,
        signalType: 'DATE_INCONSISTENCY',
        severity: 'CRITICAL',
        description: dateFail.message,
        evidenceItemIds: dateFail.evidenceItemIds || [],
        detectedBy: 'CHRONOLOGY_AUDITOR',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 7. DUPLICATE_DOCUMENT_SIGNAL
    const hashes = documents.map(d => d.sha256).filter(Boolean);
    const hasDuplicateHash = new Set(hashes).size !== hashes.length;
    const types = documents.map(d => d.type);
    const hasDuplicateType = new Set(types).size !== types.length;

    if (hasDuplicateHash || hasDuplicateType) {
      const reason = hasDuplicateHash
        ? 'Identical SHA-256 document content detected in multiple uploads.'
        : 'Multiple documents of the same type uploaded to a single verification case.';
      const signal = new RiskSignal({
        caseId,
        signalType: 'DUPLICATE_DOCUMENT_SIGNAL',
        severity: 'MEDIUM',
        description: reason,
        evidenceItemIds: [],
        detectedBy: 'INTEGRITY_AUDITOR',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 8. UNRESOLVED_MEDICINE_IDENTITY
    const medNameInconclusive = checks.find(c => c.checkType === 'MEDICINE_NAME_CONSISTENCY' && c.status === 'INCONCLUSIVE');
    const hasUnresolvedMed = Object.values(resolutions).some(r => r && !r.resolved);
    if (medNameInconclusive || hasUnresolvedMed) {
      const signal = new RiskSignal({
        caseId,
        signalType: 'UNRESOLVED_MEDICINE_IDENTITY',
        severity: 'HIGH',
        description: medNameInconclusive
          ? medNameInconclusive.message
          : 'Extracted medicine name could not be safely resolved against curated academic catalogue. Human confirmation required.',
        evidenceItemIds: medNameInconclusive ? (medNameInconclusive.evidenceItemIds || []) : [],
        detectedBy: 'IDENTITY_RESOLUTION_SERVICE',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 9. DOSAGE_FORM_DISCREPANCY
    const formDiscrepancy = checks.find(c => c.checkType === 'DOSAGE_FORM_CONSISTENCY' && c.status === 'INCONCLUSIVE');
    if (formDiscrepancy) {
      const signal = new RiskSignal({
        caseId,
        signalType: 'DOSAGE_FORM_DISCREPANCY',
        severity: 'MEDIUM',
        description: formDiscrepancy.message,
        evidenceItemIds: formDiscrepancy.evidenceItemIds || [],
        detectedBy: 'CROSS_DOC_CONSISTENCY_ENGINE',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 10. AMBIGUOUS_MEDICINE_IDENTITY
    const hasAmbiguous = Object.values(resolutions).some(r => r && r.ambiguous === true);
    if (hasAmbiguous) {
      const signal = new RiskSignal({
        caseId,
        signalType: 'AMBIGUOUS_MEDICINE_IDENTITY',
        severity: 'HIGH',
        description: 'Medicine name resolves to multiple conflicting records in curated academic catalogue. Review candidate options.',
        evidenceItemIds: [],
        detectedBy: 'IDENTITY_RESOLUTION_SERVICE',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 9. INSUFFICIENT_EVIDENCE
    const hasUnresolved = Object.values(resolutions).some(r => r && !r.resolved);
    const incompleteTriangle = documents.length < 3;
    if (documents.length < 2 || hasUnresolved || incompleteTriangle) {
      const reason = documents.length < 2
        ? 'Fewer than 2 verification documents available; cannot substantiate cross-document evidence.'
        : incompleteTriangle
          ? `Case contains only ${documents.length} of 3 required documents (Prescription, Invoice, Claim).`
          : 'Failed to verify medicine against allow-listed canonical medical evidence.';
      const signal = new RiskSignal({
        caseId,
        signalType: 'INSUFFICIENT_EVIDENCE',
        severity: documents.length < 2 ? 'HIGH' : 'LOW',
        description: reason,
        evidenceItemIds: [],
        detectedBy: 'EVIDENCE_RETRIEVAL_GUARD',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 11. CONFLICTING_MULTI_PAGE_DATA
    // Detects when the same field type appears with conflicting values on different pages of a document
    for (const doc of documents) {
      const docFields = fields.filter(f => String(f.documentId) === String(doc._id));
      const fieldsByType = new Map();
      for (const f of docFields) {
        if (!fieldsByType.has(f.fieldType)) {
          fieldsByType.set(f.fieldType, []);
        }
        fieldsByType.get(f.fieldType).push(f);
      }

      for (const [fieldType, typeFields] of fieldsByType.entries()) {
        const pagesMap = new Map();
        for (const f of typeFields) {
          const val = (f.normalizedValue !== undefined && f.normalizedValue !== '' ? f.normalizedValue : f.rawValue || '').trim().toLowerCase();
          if (val) {
            const pageNum = f.pageNumber || 1;
            if (!pagesMap.has(pageNum)) {
              pagesMap.set(pageNum, { val, field: f });
            }
          }
        }

        const distinctPages = Array.from(pagesMap.keys());
        if (distinctPages.length > 1) {
          const first = pagesMap.get(distinctPages[0]);
          for (let i = 1; i < distinctPages.length; i++) {
            const current = pagesMap.get(distinctPages[i]);
            if (current.val !== first.val) {
              const signal = new RiskSignal({
                caseId,
                signalType: 'CONFLICTING_MULTI_PAGE_DATA',
                severity: 'HIGH',
                description: `Conflicting values for "${fieldType}" detected across pages in ${doc.type} (Page ${first.field.pageNumber || 1}: "${first.field.rawValue}" vs Page ${current.field.pageNumber || 1}: "${current.field.rawValue}"). Human reviewer correction required.`,
                evidenceItemIds: [first.field._id, current.field._id].filter(Boolean),
                detectedBy: 'MULTI_PAGE_INTEGRITY_AUDITOR',
                rulesetVersion: '1.0',
                reviewRequired: true
              });
              signals.push(await signal.save());
              break;
            }
          }
        }
      }
    }

    return signals;
  }
}

module.exports = new RiskSignalService();
