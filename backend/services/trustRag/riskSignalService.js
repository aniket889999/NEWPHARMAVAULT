const RiskSignal = require('../../models/riskSignalModel');
const EvidenceItem = require('../../models/evidenceItemModel');

/**
 * Risk Signal Service
 * Detects risk signals across extracted fields, consistency checks,
 * medicine resolutions, and document coverage metadata.
 *
 * Guarantees:
 * - RiskSignal.evidenceItemIds reference actual EvidenceItem records belonging to the SAME case,
 *   never ExtractedField IDs.
 * - Missing-information evidence identifies the missing requirement and inspected coverage
 *   without inventing source text or coordinates.
 * - Documents with omitted pages emit high-severity risk signals requiring human review.
 */
class RiskSignalService {
  /**
   * Helper to verify that evidenceItemIds belong strictly to EvidenceItem records in the same case.
   * @private
   */
  async _filterSameCaseEvidence(caseId, candidateIds = []) {
    if (!Array.isArray(candidateIds) || candidateIds.length === 0) return [];
    const validItems = await EvidenceItem.find({
      caseId,
      _id: { $in: candidateIds }
    });
    return validItems.map(item => item._id);
  }

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
      // Find actual EvidenceItems referencing these fields
      const lowConfFieldIds = lowConfFields.map(f => f._id);
      const evItems = await EvidenceItem.find({
        caseId,
        sourceId: { $in: lowConfFieldIds }
      });

      const signal = new RiskSignal({
        caseId,
        signalType: 'LOW_OCR_CONFIDENCE',
        severity: 'MEDIUM',
        description: `${lowConfFields.length} field(s) have low extraction confidence (< 75%): ${lowConfFields.map(f => f.fieldType).join(', ')}.`,
        evidenceItemIds: evItems.map(e => e._id),
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
    const missingEvidenceIds = [];

    for (const doc of documents) {
      const docFields = fields.filter(f => String(f.documentId) === String(doc._id));
      const required = requiredPerDoc[doc.type] || [];
      const inspectedCoverageText = `${doc.processedPageCount || Math.min(doc.pageCount || 1, 3)} of ${doc.pageCount || 1} page(s)`;

      for (const req of required) {
        const found = docFields.find(f => f.fieldType === req && f.rawValue && f.rawValue.trim().length > 0);
        if (!found) {
          missingFieldList.push(`${doc.type}: ${req}`);

          // Missing-information evidence: identifies missing requirement and inspected coverage
          // without inventing source text or coordinates
          const missingEvidence = new EvidenceItem({
            caseId,
            sourceId: doc._id,
            documentId: doc._id,
            claimSupported: `Missing required field: ${doc.type} ${req}`,
            evidenceText: `Inspected ${doc.type} (${doc.originalFilename || 'upload'}, ${inspectedCoverageText} analyzed). Required clinical/financial field "${req}" was not detected.`,
            pageNumber: 1,
            boundingBox: [0, 0, 0, 0],
            trustTier: 4,
            sourceType: 'CASE_DOCUMENT',
            sourceLabel: `${doc.type} Completeness Audit`,
            relevanceReason: `Identifies that required field "${req}" was absent during inspection of ${inspectedCoverageText}.`,
            retrievedAt: new Date(),
            sourceVersion: '1.0'
          });
          const savedMissingEv = await missingEvidence.save();
          missingEvidenceIds.push(savedMissingEv._id);
        }
      }
    }

    if (missingFieldList.length > 0) {
      const signal = new RiskSignal({
        caseId,
        signalType: 'MISSING_REQUIRED_FIELD',
        severity: 'HIGH',
        description: `Missing required clinical/financial fields: ${missingFieldList.join(', ')}.`,
        evidenceItemIds: missingEvidenceIds,
        detectedBy: 'FIELD_COMPLETENESS_VALIDATOR',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 3. MEDICINE_STRENGTH_MISMATCH
    const strengthFail = checks.find(c => c.checkType === 'DOSAGE_STRENGTH_CONSISTENCY' && c.status === 'FAIL');
    if (strengthFail) {
      const validEvidenceIds = await this._filterSameCaseEvidence(caseId, strengthFail.evidenceItemIds);
      const signal = new RiskSignal({
        caseId,
        signalType: 'MEDICINE_STRENGTH_MISMATCH',
        severity: 'HIGH',
        description: strengthFail.message,
        evidenceItemIds: validEvidenceIds,
        detectedBy: 'CROSS_DOC_CONSISTENCY_ENGINE',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 4. MEDICINE_NAME_MISMATCH
    const medNameFail = checks.find(c => c.checkType === 'MEDICINE_NAME_CONSISTENCY' && c.status === 'FAIL');
    if (medNameFail) {
      const validEvidenceIds = await this._filterSameCaseEvidence(caseId, medNameFail.evidenceItemIds);
      const signal = new RiskSignal({
        caseId,
        signalType: 'MEDICINE_NAME_MISMATCH',
        severity: 'HIGH',
        description: medNameFail.message,
        evidenceItemIds: validEvidenceIds,
        detectedBy: 'CROSS_DOC_CONSISTENCY_ENGINE',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 5. QUANTITY_MISMATCH
    const qtyFail = checks.find(c => c.checkType === 'QUANTITY_CONSISTENCY' && c.status === 'FAIL');
    if (qtyFail) {
      const validEvidenceIds = await this._filterSameCaseEvidence(caseId, qtyFail.evidenceItemIds);
      const signal = new RiskSignal({
        caseId,
        signalType: 'QUANTITY_MISMATCH',
        severity: 'HIGH',
        description: qtyFail.message,
        evidenceItemIds: validEvidenceIds,
        detectedBy: 'CROSS_DOC_CONSISTENCY_ENGINE',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 6. DATE_INCONSISTENCY
    const dateFail = checks.find(c => c.checkType === 'DATE_SEQUENCE_CONSISTENCY' && c.status === 'FAIL');
    if (dateFail) {
      const validEvidenceIds = await this._filterSameCaseEvidence(caseId, dateFail.evidenceItemIds);
      const signal = new RiskSignal({
        caseId,
        signalType: 'DATE_INCONSISTENCY',
        severity: 'CRITICAL',
        description: dateFail.message,
        evidenceItemIds: validEvidenceIds,
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

      const docEvidence = await EvidenceItem.find({
        caseId,
        documentId: { $in: documents.map(d => d._id) }
      });

      const signal = new RiskSignal({
        caseId,
        signalType: 'DUPLICATE_DOCUMENT_SIGNAL',
        severity: 'MEDIUM',
        description: reason,
        evidenceItemIds: docEvidence.map(e => e._id),
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
      let evIds = [];
      if (medNameInconclusive?.evidenceItemIds?.length) {
        evIds = await this._filterSameCaseEvidence(caseId, medNameInconclusive.evidenceItemIds);
      }
      if (evIds.length === 0) {
        const medEv = await EvidenceItem.find({
          caseId,
          claimSupported: /medicine_name|Medicine Name/i
        });
        evIds = medEv.map(e => e._id);
      }

      const signal = new RiskSignal({
        caseId,
        signalType: 'UNRESOLVED_MEDICINE_IDENTITY',
        severity: 'HIGH',
        description: medNameInconclusive
          ? medNameInconclusive.message
          : 'Extracted medicine name could not be safely resolved against curated academic catalogue. Human confirmation required.',
        evidenceItemIds: evIds,
        detectedBy: 'IDENTITY_RESOLUTION_SERVICE',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 9. DOSAGE_FORM_DISCREPANCY
    const formDiscrepancy = checks.find(c => c.checkType === 'DOSAGE_FORM_CONSISTENCY' && c.status === 'INCONCLUSIVE');
    if (formDiscrepancy) {
      const validEvidenceIds = await this._filterSameCaseEvidence(caseId, formDiscrepancy.evidenceItemIds);
      const signal = new RiskSignal({
        caseId,
        signalType: 'DOSAGE_FORM_DISCREPANCY',
        severity: 'MEDIUM',
        description: formDiscrepancy.message,
        evidenceItemIds: validEvidenceIds,
        detectedBy: 'CROSS_DOC_CONSISTENCY_ENGINE',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 10. AMBIGUOUS_MEDICINE_IDENTITY
    const hasAmbiguous = Object.values(resolutions).some(r => r && r.ambiguous === true);
    if (hasAmbiguous) {
      const medEv = await EvidenceItem.find({
        caseId,
        claimSupported: /medicine_name|Medicine Name/i
      });

      const signal = new RiskSignal({
        caseId,
        signalType: 'AMBIGUOUS_MEDICINE_IDENTITY',
        severity: 'HIGH',
        description: 'Medicine name resolves to multiple conflicting records in curated academic catalogue. Review candidate options.',
        evidenceItemIds: medEv.map(e => e._id),
        detectedBy: 'IDENTITY_RESOLUTION_SERVICE',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 11. INSUFFICIENT_EVIDENCE (Missing documents or incomplete triangle)
    const hasUnresolved = Object.values(resolutions).some(r => r && !r.resolved);
    const incompleteTriangle = documents.length < 3;
    if (documents.length < 2 || hasUnresolved || incompleteTriangle) {
      const reason = documents.length < 2
        ? 'Fewer than 2 verification documents available; cannot substantiate cross-document evidence.'
        : incompleteTriangle
          ? `Case contains only ${documents.length} of 3 required documents (Prescription, Invoice, Claim).`
          : 'Failed to verify medicine against allow-listed canonical medical evidence.';

      const insEvidence = new EvidenceItem({
        caseId,
        sourceId: documents[0] ? documents[0]._id : new (require('mongoose').Types.ObjectId)(),
        documentId: documents[0] ? documents[0]._id : null,
        claimSupported: 'Document Completeness and Verification Coverage',
        evidenceText: `Inspected case document coverage: ${documents.length} document(s) uploaded (${documents.map(d => `${d.type}: ${d.processedPageCount || 1}/${d.pageCount || 1} pages`).join(', ')}). ${reason}`,
        pageNumber: 1,
        boundingBox: [0, 0, 0, 0],
        trustTier: 4,
        sourceType: 'CASE_DOCUMENT',
        sourceLabel: 'Case Document Coverage Audit',
        relevanceReason: 'Identifies document coverage gap or missing verification documents.',
        retrievedAt: new Date(),
        sourceVersion: '1.0'
      });
      const savedInsEv = await insEvidence.save();

      const signal = new RiskSignal({
        caseId,
        signalType: 'INSUFFICIENT_EVIDENCE',
        severity: documents.length < 2 ? 'HIGH' : 'LOW',
        description: reason,
        evidenceItemIds: [savedInsEv._id],
        detectedBy: 'EVIDENCE_RETRIEVAL_GUARD',
        rulesetVersion: '1.0',
        reviewRequired: true
      });
      signals.push(await signal.save());
    }

    // 12. INSUFFICIENT_EVIDENCE for Incomplete Page Coverage (Requirement 4)
    // PDFs above the processing limit must remain explicitly incomplete and require human review
    for (const doc of documents) {
      if (doc.omittedPageCount > 0 || (doc.pageCount > (doc.processedPageCount || 3))) {
        const coverageEvidence = new EvidenceItem({
          caseId,
          sourceId: doc._id,
          documentId: doc._id,
          claimSupported: `Partial Page Coverage Limit: ${doc.type}`,
          evidenceText: `Document "${doc.originalFilename || doc.type}" has ${doc.pageCount} pages. Only ${doc.processedPageCount || 3} pages were analyzed; ${doc.omittedPageCount || (doc.pageCount - 3)} page(s) were omitted under processing limits. Human review is required.`,
          pageNumber: 1,
          boundingBox: [0, 0, 0, 0],
          trustTier: 4,
          sourceType: 'CASE_DOCUMENT',
          sourceLabel: 'Document Page Coverage Boundary',
          relevanceReason: 'Identifies uninspected pages exceeding processing capacity.',
          retrievedAt: new Date(),
          sourceVersion: '1.0'
        });
        const savedCovEv = await coverageEvidence.save();

        const signal = new RiskSignal({
          caseId,
          signalType: 'INSUFFICIENT_EVIDENCE',
          severity: 'HIGH',
          description: `Document "${doc.originalFilename || doc.type}" contains ${doc.pageCount} pages, exceeding the 3-page processing limit. Only ${doc.processedPageCount || 3} pages were analyzed; ${doc.omittedPageCount || (doc.pageCount - 3)} page(s) were omitted. Document cannot be considered fully analyzed without human review.`,
          evidenceItemIds: [savedCovEv._id],
          detectedBy: 'COVERAGE_LIMIT_VALIDATOR',
          rulesetVersion: '1.0',
          reviewRequired: true
        });
        signals.push(await signal.save());
      }
    }

    // 13. CONFLICTING_MULTI_PAGE_DATA
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
              // Retrieve actual EvidenceItem records for these fields in this case
              // NEVER pass ExtractedField IDs to evidenceItemIds!
              const conflictFieldIds = [first.field._id, current.field._id].filter(Boolean);
              const conflictEvItems = await EvidenceItem.find({
                caseId,
                sourceId: { $in: conflictFieldIds }
              });

              const signal = new RiskSignal({
                caseId,
                signalType: 'CONFLICTING_MULTI_PAGE_DATA',
                severity: 'HIGH',
                description: `Conflicting values for "${fieldType}" detected across pages in ${doc.type} (Page ${first.field.pageNumber || 1}: "${first.field.rawValue}" vs Page ${current.field.pageNumber || 1}: "${current.field.rawValue}"). Human reviewer correction required.`,
                evidenceItemIds: conflictEvItems.map(e => e._id),
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
