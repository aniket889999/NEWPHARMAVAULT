const VerificationCase = require('../../models/verificationCaseModel');
const Document = require('../../models/documentModel');
const ExtractedField = require('../../models/extractedFieldModel');
const EvidenceItem = require('../../models/evidenceItemModel');
const documentExtractorService = require('./documentExtractorService');
const identityResolutionService = require('./identityResolutionService');
const consistencyCheckService = require('./consistencyCheckService');
const riskSignalService = require('./riskSignalService');
const auditLoggerService = require('./auditLoggerService');
const evidenceRoutingService = require('./evidenceRoutingService');
const llmExplainabilityService = require('./llmExplainabilityService');

/**
 * TrustRAG Orchestrator
 * Coordinates extraction, identity resolution, controlled evidence routing,
 * consistency checks, risk signals, and explainability.
 *
 * Guarantees:
 * - Documents with omitted pages remain explicitly incomplete and require human review.
 * - Obsolete document correction flags are cleared ONLY after legitimate correction/reprocessing.
 * - Original extraction and correction history is preserved.
 * - Retries do not leave stale or duplicate findings/evidence.
 */
class TrustRagOrchestrator {
  /**
   * Helper to check if any field types still have conflicting normalized values across pages
   * @private
   */
  _hasActiveMultiPageConflict(docFields) {
    const byType = new Map();
    for (const f of docFields) {
      if (!byType.has(f.fieldType)) byType.set(f.fieldType, []);
      byType.get(f.fieldType).push(f);
    }

    for (const [, fields] of byType.entries()) {
      const pageValues = new Map();
      for (const f of fields) {
        const val = (f.normalizedValue !== undefined && f.normalizedValue !== '' ? f.normalizedValue : f.rawValue || '').trim().toLowerCase();
        if (val) {
          const p = f.pageNumber || 1;
          if (!pageValues.has(p)) pageValues.set(p, val);
        }
      }
      const pages = Array.from(pageValues.keys());
      if (pages.length > 1) {
        const firstVal = pageValues.get(pages[0]);
        for (let i = 1; i < pages.length; i++) {
          if (pageValues.get(pages[i]) !== firstVal) return true;
        }
      }
    }
    return false;
  }

  /**
   * Process a verification case
   * @param {string} caseId
   * @param {Object} actor User triggering the action
   */
  async processCase(caseId, actor) {
    const vCase = await VerificationCase.findById(caseId);
    if (!vCase) {
      const err = new Error('Verification case not found');
      err.statusCode = 404;
      throw err;
    }

    // Lifecycle transition validation
    const allowedSourceStates = ['READY_FOR_PROCESSING', 'DOCUMENTS_PENDING', 'NEEDS_CORRECTION'];
    if (!allowedSourceStates.includes(vCase.status)) {
      const err = new Error(`Cannot process case in current state '${vCase.status}'. Expected one of: ${allowedSourceStates.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const documents = await Document.find({ caseId });
    if (documents.length === 0) {
      const err = new Error('No documents uploaded for this case. Upload at least one document before processing.');
      err.statusCode = 400;
      throw err;
    }

    // Transition to PROCESSING
    vCase.status = 'PROCESSING';
    await vCase.save();

    await auditLoggerService.logEvent({
      caseId: vCase._id,
      actorId: actor._id,
      actorRole: actor.role,
      action: 'PROCESSING_TRIGGERED',
      targetType: 'VerificationCase',
      targetId: vCase._id,
      metadata: { documentCount: documents.length }
    });

    try {
      // Clean up derived/check/signal evidence items from previous runs to prevent duplicates on retry
      await EvidenceItem.deleteMany({
        caseId: vCase._id,
        $or: [
          { sourceType: 'CANONICAL_CATALOG' },
          { sourceType: 'OFFICIAL_REGISTRY' },
          {
            sourceType: 'CASE_DOCUMENT',
            claimSupported: /^(Missing required field|Document Completeness|Partial Page Coverage|Medicine Name Alignment|Dosage Strength Alignment|Dosage Form Alignment|Quantity Alignment|Date Sequence Alignment)/i
          }
        ]
      });

      // 1. Document field extraction (Real OCR only; preserves existing corrected fields on retry)
      const allFields = [];
      for (const doc of documents) {
        const fields = await documentExtractorService.extractFields(doc);
        allFields.push(...fields);
      }

      // Check and clear obsolete document correction flags ONLY IF legitimate correction resolved issues
      for (const doc of documents) {
        if (doc.metadata && (doc.metadata.needsCorrection || doc.metadata.hasMultiPageConflict || doc.metadata.needsHumanCorrection)) {
          const docFields = allFields.filter(f => String(f.documentId) === String(doc._id));
          const stillHasConflict = this._hasActiveMultiPageConflict(docFields);
          const stillHasUncorrected = docFields.some(f => f.needsCorrection === true);

          if (!stillHasConflict && !stillHasUncorrected && docFields.length > 0) {
            doc.metadata = {
              ...doc.metadata,
              hasMultiPageConflict: false,
              needsCorrection: false,
              needsHumanCorrection: false,
              correctionResolvedAt: new Date()
            };
            await doc.save();
          }
        }
      }

      // 2. Identity resolution for medicine names in documents
      const resolutions = {};
      for (const doc of documents) {
        const medField = allFields.find(f => String(f.documentId) === String(doc._id) && f.fieldType === 'medicine_name');
        if (medField) {
          const strengthField = allFields.find(f => String(f.documentId) === String(doc._id) && f.fieldType === 'dosage_strength');
          const res = await identityResolutionService.resolveMedicine(
            medField.normalizedValue || medField.rawValue,
            { strength: strengthField ? (strengthField.normalizedValue || strengthField.rawValue) : null }
          );
          resolutions[doc.type] = res;
          medField.resolution = res;
          if (!res.resolved || res.ambiguous) {
            medField.needsCorrection = true;
          }
          await medField.save();
        }
      }

      // 3. Controlled Evidence Routing across all 3 tiers:
      // a. Private case data (fields & documents)
      // b. Curated medicine knowledge (CanonicalMedicine)
      // c. Approved official sources (local registry)
      await evidenceRoutingService.routeAllEvidence({
        caseId: vCase._id,
        documents,
        fields: allFields,
        resolutions
      });

      // 4. Cross-document consistency checks
      const checks = await consistencyCheckService.runChecks({
        caseId: vCase._id,
        documents,
        fields: allFields,
        resolutions
      });

      // 5. Risk signal generation (with genuine same-case EvidenceItem IDs and coverage checks)
      const signals = await riskSignalService.evaluateRiskSignals({
        caseId: vCase._id,
        documents,
        fields: allFields,
        checks,
        resolutions
      });

      // Fetch all evidence items for this case
      const allEvidence = await EvidenceItem.find({ caseId: vCase._id });

      // 6. Generate grounded, explainable case summary
      const explanation = await llmExplainabilityService.generateExplanation({
        vCase,
        documents,
        fields: allFields,
        checks,
        signals,
        evidenceItems: allEvidence
      });

      // Check if any document has incomplete page coverage
      const hasIncompleteCoverage = documents.some(
        d => (d.omittedPageCount && d.omittedPageCount > 0) || (d.pageCoverage && d.pageCoverage.status === 'INCOMPLETE')
      );

      // If document is incomplete, never describe as fully analyzed in explanation
      if (hasIncompleteCoverage && explanation && explanation.summary) {
        if (!explanation.summary.toLowerCase().includes('incomplete') && !explanation.summary.toLowerCase().includes('omitted')) {
          explanation.summary += ' Document page coverage is incomplete (pages above the 3-page processing limit were omitted and require human reviewer inspection).';
        }
      }

      // 7. State Transition & Human-in-the-Loop Evaluation
      // RULE: The system NEVER automatically approves or rejects a case.
      const hasFieldsNeedingCorrection = allFields.some(f => f.needsCorrection === true);
      const hasDocNeedingCorrection = documents.some(d => d.metadata && (d.metadata.needsCorrection || d.metadata.needsHumanCorrection));
      const hasMultiPageConflictSignal = signals.some(s => s.signalType === 'CONFLICTING_MULTI_PAGE_DATA');

      if (hasFieldsNeedingCorrection || hasDocNeedingCorrection || hasMultiPageConflictSignal) {
        vCase.status = 'NEEDS_CORRECTION';
        vCase.reviewRequired = true;
      } else {
        vCase.status = 'NEEDS_REVIEW';
        vCase.reviewRequired = true;
      }

      vCase.metadata = {
        ...(vCase.metadata || {}),
        explanation,
        resolutions,
        hasIncompleteCoverage
      };

      await vCase.save();

      await auditLoggerService.logEvent({
        caseId: vCase._id,
        actorId: actor._id,
        actorRole: actor.role,
        action: 'PROCESSING_COMPLETED',
        targetType: 'VerificationCase',
        targetId: vCase._id,
        metadata: {
          nextStatus: vCase.status,
          checksCount: checks.length,
          signalsCount: signals.length,
          evidenceCount: allEvidence.length,
          needsCorrection: hasFieldsNeedingCorrection,
          hasIncompleteCoverage,
          explainedBy: explanation.generatedBy
        }
      });

      return {
        caseId: vCase._id,
        caseReference: vCase.caseReference,
        status: vCase.status,
        reviewRequired: vCase.reviewRequired,
        extractedFieldCount: allFields.length,
        checksCount: checks.length,
        riskSignalsCount: signals.length,
        evidenceCount: allEvidence.length,
        hasIncompleteCoverage,
        explanation,
        signals: signals.map(s => ({ signalType: s.signalType, severity: s.severity, description: s.description }))
      };
    } catch (procErr) {
      vCase.status = 'FAILED';
      await vCase.save();

      await auditLoggerService.logEvent({
        caseId: vCase._id,
        actorId: actor._id,
        actorRole: actor.role,
        action: 'PROCESSING_FAILED',
        targetType: 'VerificationCase',
        targetId: vCase._id,
        metadata: { error: procErr.message }
      });

      throw procErr;
    }
  }
}

module.exports = new TrustRagOrchestrator();
