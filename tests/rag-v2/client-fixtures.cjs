'use strict';
// Authored development DTOs only; not server signatures, clinical gold or held-out labels.
const CASE = 'a'.repeat(24), DOC = 'b'.repeat(24), FIELD = 'c'.repeat(24), ITEM = 'mi_' + 'd'.repeat(24);
function answer() {
  return {
    schemaVersion: '2.0.0-session4', caseId: CASE, answerId: '11111111-1111-4111-8111-111111111111',
    generatedAt: '2026-11-16T12:00:00.000Z', evidenceRevision: 4,
    reply: 'SYNTHETIC prescription records 650 mg. [S1]', mode: 'LOCAL_CASE_EVIDENCE', intent: 'STRENGTH', medicineItemId: ITEM,
    choices: [{ itemId: ITEM, label: 'SYNTHETIC Paracetamol', documentType: 'PRESCRIPTION' }],
    sources: [{ citation: 'S1', sourceId: 'field:' + FIELD, documentId: DOC, fieldId: FIELD, pageNumber: 1, itemId: ITEM,
      title: 'Prescription strength', excerpt: 'SYNTHETIC 650 mg', fingerprint: 'e'.repeat(64) }],
    warnings: [], dependencyKeys: ['field:' + FIELD], bindingToken: 'SYNTHETIC-UNSIGNED-CONSUMER-FIXTURE', disclaimer: 'Synthetic document evidence only; not medical advice.',
  };
}
function freshness(a = answer(), status = 'FRESH') {
  return { schemaVersion: '2.0.0-session4', caseId: a.caseId, checkedAt: '2026-11-16T12:01:00.000Z', evidenceRevision: 5,
    results: [{ answerId: a.answerId, status, changedDependencyKeys: status === 'STALE' ? a.dependencyKeys : [],
      reasonCode: status === 'STALE' ? 'EVIDENCE_CHANGED' : status === 'FRESH' ? 'UNCHANGED_DEPENDENCIES' : 'CASE_PROCESSING' }] };
}
module.exports = { CASE, DOC, FIELD, ITEM, answer, freshness };
