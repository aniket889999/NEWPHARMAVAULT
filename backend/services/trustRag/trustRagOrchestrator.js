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
 */
class TrustRagOrchestrator {
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
      // 1. Document field extraction (Real OCR only; client options & metadata overrides prohibited)
      const allFields = [];
      for (const doc of documents) {
        const fields = await documentExtractorService.extractFields(doc);
        allFields.push(...fields);
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

      // 5. Risk signal generation
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
        resolutions
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
