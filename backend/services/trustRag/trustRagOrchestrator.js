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
const { RECOGNIZED_MEDICINE_SLOTS } = require('./medicineItemContract');
const { buildCaseReconciliationSnapshot } = require('./caseReconciliationService');
const { bumpCaseEvidenceRevision } = require('./caseEvidenceMutationService');

/**
 * TrustRAG Orchestrator
 * Coordinates extraction, identity resolution, controlled evidence routing,
 * Session 1/2 medicine reconciliation, consistency checks, risk signals, and explainability.
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
   * scoped by medicine row or document level.
   * @private
   */
  _hasActiveMultiPageConflict(docFields) {
    const rowMedMap = new Map();
    for (const f of docFields) {
      if (f.fieldType === 'medicine_name' && f.candidateRowKey) {
        rowMedMap.set(
          f.candidateRowKey,
          (f.normalizedValue || f.rawValue || '').trim().toLowerCase()
        );
      }
    }

    const byScopeAndType = new Map();
    for (const f of docFields) {
      let scopeKey = 'doc';
      if (RECOGNIZED_MEDICINE_SLOTS.includes(f.fieldType)) {
        const medName = f.candidateRowKey ? rowMedMap.get(f.candidateRowKey) : null;
        scopeKey = medName ? `med:${medName}` : `row:${f.candidateRowKey || 'ungrouped'}`;
      }
      const key = `${scopeKey}::${f.fieldType}`;
      if (!byScopeAndType.has(key)) byScopeAndType.set(key, []);
      byScopeAndType.get(key).push(f);
    }

    for (const [, fields] of byScopeAndType.entries()) {
      const pageValues = new Map();
      for (const f of fields) {
        const rawVal = (
          f.normalizedValue !== undefined && f.normalizedValue !== ''
            ? f.normalizedValue
            : f.rawValue || ''
        )
          .trim()
          .toLowerCase();
        const val =
          f.fieldType === 'dosage_strength'
            ? rawVal.replace(/\s+/g, '')
            : rawVal.replace(/\s+/g, ' ');
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
    const allowedSourceStates = [
      'READY_FOR_PROCESSING',
      'DOCUMENTS_PENDING',
      'NEEDS_CORRECTION',
      'NEEDS_REVIEW',
      'FAILED'
    ];
    if (!allowedSourceStates.includes(vCase.status)) {
      const err = new Error(
        `Cannot process case in current state '${vCase.status}'. Expected one of: ${allowedSourceStates.join(', ')}`
      );
      err.statusCode = 400;
      throw err;
    }

    const documents = await Document.find({ caseId });
    if (documents.length === 0) {
      const err = new Error(
        'No documents uploaded for this case. Upload at least one document before processing.'
      );
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
            claimSupported:
              /^(Missing required field|Document Completeness|Partial Page Coverage|Medicine Name Alignment|Dosage Strength Alignment|Dosage Form Alignment|Quantity Alignment|Quantity Consistency|Chronological Date Sequence|Date Sequence Alignment)/i
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
        if (
          doc.metadata &&
          (doc.metadata.needsCorrection ||
            doc.metadata.hasMultiPageConflict ||
            doc.metadata.needsHumanCorrection)
        ) {
          const docFields = allFields.filter((f) => String(f.documentId) === String(doc._id));
          const stillHasConflict = this._hasActiveMultiPageConflict(docFields);
          const stillHasUncorrected = docFields.some((f) => f.needsCorrection === true);
          const hasLayoutBlocker = Array.isArray(doc.metadata?.extractionBlockers)
            ? doc.metadata.extractionBlockers.length > 0
            : false;

          if (!stillHasConflict && !stillHasUncorrected && !hasLayoutBlocker && docFields.length > 0) {
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

      // 2. Identity resolution for medicine names in prescription and invoice documents (all rows)
      const resolutions = {};
      for (const doc of documents) {
        if (doc.type === 'CLAIM_FORM') continue;
        const docFields = allFields.filter((f) => String(f.documentId) === String(doc._id));
        const medFields = docFields.filter((f) => f.fieldType === 'medicine_name');

        for (const medField of medFields) {
          const strengthField = docFields.find(
            (f) =>
              f.fieldType === 'dosage_strength' &&
              (medField.candidateRowKey
                ? f.candidateRowKey === medField.candidateRowKey
                : true)
          );
          const res = await identityResolutionService.resolveMedicine(
            medField.normalizedValue || medField.rawValue,
            {
              strength: strengthField
                ? strengthField.normalizedValue || strengthField.rawValue
                : null
            }
          );
          if (!resolutions[doc.type]) {
            resolutions[doc.type] = res;
          }
          medField.resolution = res;
          const hasHumanCorrection = Boolean(
            medField.correctedBy && medField.correctedAt && medField.needsCorrection === false
          );
          if ((!res.resolved || res.ambiguous) && !hasHumanCorrection) {
            medField.needsCorrection = true;
          }
          await medField.save();
        }
      }

      // 3. Controlled Evidence Routing across all 3 tiers
      await evidenceRoutingService.routeAllEvidence({
        caseId: vCase._id,
        documents,
        fields: allFields,
        resolutions
      });

      // Build provisional reconciliation snapshot for item-level checks & signals
      const provisionalSnapshot = await buildCaseReconciliationSnapshot({
        vCase,
        user: actor
      });

      // 4. Cross-document consistency checks (using Session 1/2 reconciliation)
      const checks = await consistencyCheckService.runChecks({
        caseId: vCase._id,
        documents,
        fields: allFields,
        resolutions,
        reconciliationSnapshot: provisionalSnapshot
      });

      // 5. Risk signal generation
      const signals = await riskSignalService.evaluateRiskSignals({
        caseId: vCase._id,
        documents,
        fields: allFields,
        checks,
        resolutions,
        reconciliationSnapshot: provisionalSnapshot
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
        (d) =>
          (d.omittedPageCount && d.omittedPageCount > 0) ||
          (d.pageCoverage && d.pageCoverage.status === 'INCOMPLETE')
      );

      // If document is incomplete, never describe as fully analyzed in explanation
      if (hasIncompleteCoverage && explanation && explanation.summary) {
        if (
          !explanation.summary.toLowerCase().includes('incomplete') &&
          !explanation.summary.toLowerCase().includes('omitted')
        ) {
          explanation.summary +=
            ' Document page coverage is incomplete (pages above the 3-page processing limit were omitted and require human reviewer inspection).';
        }
      }

      // 7. State Transition & Human-in-the-Loop Evaluation
      // RULE: The system NEVER automatically approves or rejects a case.
      const hasFieldsNeedingCorrection = allFields.some((f) => f.needsCorrection === true);
      const hasDocNeedingCorrection = documents.some(
        (d) =>
          d.metadata &&
          (d.metadata.needsCorrection ||
            d.metadata.needsHumanCorrection ||
            (Array.isArray(d.metadata.extractionBlockers) &&
              d.metadata.extractionBlockers.length > 0))
      );
      const hasMultiPageConflictSignal = signals.some(
        (s) => s.signalType === 'CONFLICTING_MULTI_PAGE_DATA'
      );

      if (hasFieldsNeedingCorrection || hasDocNeedingCorrection || hasMultiPageConflictSignal) {
        vCase.status = 'NEEDS_CORRECTION';
        vCase.reviewRequired = true;
      } else {
        vCase.status = 'NEEDS_REVIEW';
        vCase.reviewRequired = true;
      }

      const reconciliationSummary = provisionalSnapshot.comparison
        ? {
            status: provisionalSnapshot.comparison.status,
            reviewRequired: provisionalSnapshot.comparison.reviewRequired,
            hasInsufficientEvidence: provisionalSnapshot.comparison.hasInsufficientEvidence,
            summary: provisionalSnapshot.comparison.summary
          }
        : null;

      vCase.metadata = {
        ...(vCase.metadata || {}),
        explanation,
        resolutions,
        reconciliationSummary,
        hasIncompleteCoverage
      };

      bumpCaseEvidenceRevision(vCase, { markLegacyFindingsProcessed: true });
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
          evidenceRevision: vCase.evidenceRevision,
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
        evidenceRevision: vCase.evidenceRevision,
        extractedFieldCount: allFields.length,
        checksCount: checks.length,
        riskSignalsCount: signals.length,
        evidenceCount: allEvidence.length,
        explanation,
        message: 'Case processed. Human review required.'
      };
    } catch (procError) {
      vCase.status = 'FAILED';
      vCase.metadata = { ...(vCase.metadata || {}), lastError: procError.message };
      await vCase.save();
      throw procError;
    }
  }
}

module.exports = new TrustRagOrchestrator();
