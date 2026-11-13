/**
 * Case Evidence Mutation Service
 *
 * Provides a per-case single-process concurrency guard, lifecycle mutability checks,
 * and evidenceRevision increments for all case-mutating operations:
 * - document upload
 * - extracted field correction
 * - staff medicine-group confirmation
 * - TrustRAG processing run
 * - human review decision submission
 * - case status / metadata patch
 *
 * Note: This lock is an in-memory per-process guard suitable for single-process deployment
 * and local standalone MongoDB without replica-set multi-document transactions.
 */

const FINALIZED_CASE_STATUSES = Object.freeze(['VERIFIED', 'REJECTED', 'CLOSED']);

const MUTABLE_EVIDENCE_STATUSES = Object.freeze([
  'DRAFT',
  'DOCUMENTS_PENDING',
  'READY_FOR_PROCESSING',
  'NEEDS_CORRECTION',
  'NEEDS_REVIEW',
  'FAILED'
]);

const REVIEWABLE_CASE_STATUSES = Object.freeze(['NEEDS_REVIEW', 'NEEDS_CORRECTION']);

const activeCaseLocks = new Set();

function createControlledError(statusCode, code, message, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  Object.assign(err, extra);
  return err;
}

/**
 * Acquire the in-process lock for a given caseId, or throw 409 CASE_BUSY immediately
 * if another mutation or review is already in flight for that case.
 *
 * @param {string|Object} caseId
 * @returns {Function} release callback
 */
function acquireCaseLock(caseId) {
  const key = String(caseId || '').trim();
  if (!key) {
    throw createControlledError(400, 'INVALID_CASE_ID', 'A valid caseId is required.');
  }
  if (activeCaseLocks.has(key)) {
    throw createControlledError(
      409,
      'CASE_BUSY',
      'Case is currently being modified or reviewed by another operation.'
    );
  }
  activeCaseLocks.add(key);
  let released = false;
  return () => {
    if (!released) {
      released = true;
      activeCaseLocks.delete(key);
    }
  };
}

/**
 * Execute an async operation under the per-case single-process mutation guard.
 *
 * @param {string|Object} caseId
 * @param {Function} fn
 */
async function withCaseMutationGuard(caseId, fn) {
  const release = acquireCaseLock(caseId);
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * Verify that a case is in a mutable state for source-evidence mutations
 * (document upload, field correction, grouping confirmation, or processing).
 * Rejects finalized cases (VERIFIED, REJECTED, CLOSED) and active PROCESSING with HTTP 409.
 *
 * @param {Object} vCase
 * @param {string} [operationLabel]
 */
function assertCaseMutableForEvidence(vCase, operationLabel = 'modify case evidence') {
  if (!vCase) {
    throw createControlledError(404, 'CASE_NOT_FOUND', 'Verification case not found or access denied');
  }
  if (FINALIZED_CASE_STATUSES.includes(vCase.status)) {
    throw createControlledError(
      409,
      'CASE_FINALIZED',
      `Cannot ${operationLabel} when case is in finalized "${vCase.status}" state.`
    );
  }
  if (!MUTABLE_EVIDENCE_STATUSES.includes(vCase.status)) {
    throw createControlledError(
      409,
      'CASE_NOT_MUTABLE',
      `Cannot ${operationLabel} when case is in "${vCase.status}" state.`
    );
  }
}

/**
 * Increment evidenceRevision on a VerificationCase instance and update legacy findings freshness metadata.
 *
 * @param {Object} vCase
 * @param {Object} [options]
 * @param {boolean} [options.markLegacyFindingsProcessed=false]
 */
function bumpCaseEvidenceRevision(vCase, options = {}) {
  const currentRev =
    typeof vCase.evidenceRevision === 'number' &&
    Number.isInteger(vCase.evidenceRevision) &&
    vCase.evidenceRevision >= 0
      ? vCase.evidenceRevision
      : 0;
  const nextRev = currentRev + 1;
  vCase.evidenceRevision = nextRev;

  const existingMeta =
    vCase.metadata && typeof vCase.metadata === 'object' && !Array.isArray(vCase.metadata)
      ? { ...vCase.metadata }
      : {};

  if (options.markLegacyFindingsProcessed === true) {
    existingMeta.legacyFindingsStale = false;
    existingMeta.processedEvidenceRevision = nextRev;
    existingMeta.lastProcessedAt = new Date().toISOString();
  } else {
    existingMeta.legacyFindingsStale = true;
    existingMeta.lastEvidenceMutationAt = new Date().toISOString();
  }

  vCase.metadata = existingMeta;
  if (typeof vCase.markModified === 'function') {
    vCase.markModified('metadata');
  }
  return nextRev;
}

function isCaseLocked(caseId) {
  return activeCaseLocks.has(String(caseId || '').trim());
}

module.exports = {
  FINALIZED_CASE_STATUSES,
  MUTABLE_EVIDENCE_STATUSES,
  REVIEWABLE_CASE_STATUSES,
  createControlledError,
  acquireCaseLock,
  withCaseMutationGuard,
  assertCaseMutableForEvidence,
  bumpCaseEvidenceRevision,
  isCaseLocked
};

