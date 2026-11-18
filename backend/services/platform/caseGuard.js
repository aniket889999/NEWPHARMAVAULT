'use strict';

/**
 * Case mutation guard used by HTTP controllers.
 *
 * The in-process guard lives in services/trustRag/caseEvidenceMutationService.js,
 * which is part of the frozen Session 4 research implementation (its bytes are
 * hash-checked by tests/rag-v2), so it must not change. Multi-instance
 * deployments (CASE_LOCK_BACKEND=mongo) add a MongoDB lease around it here.
 * Known limit: the case-assistant correction path calls the in-process guard directly.
 */
const { withCaseMutationGuard: inProcessGuard } = require('../trustRag/caseEvidenceMutationService');
const { distributedLocksEnabled, mongoCaseLock } = require('./distributedLock');

async function withCaseMutationGuard(caseId, fn) {
  if (!distributedLocksEnabled()) return inProcessGuard(caseId, fn);
  return mongoCaseLock().withLock(`case:${String(caseId)}`, () => inProcessGuard(caseId, fn));
}

module.exports = { withCaseMutationGuard };
