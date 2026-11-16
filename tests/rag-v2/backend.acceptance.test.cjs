'use strict';
// Independent DEVELOPMENT counterfactuals. Do not tune against held-out labels.
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('node:path'), { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const service = backend('./services/trustRag/caseAssistantService.js');
const { makeSnapshot, clone, ACTOR } = require('../integration-v2/synthetic-snapshots.cjs');
const { loadClient } = require('./load-client.cjs');
const { parseCaseAnswer, parseFreshnessResponse } = loadClient('src/features/caseAssistant/contract.ts');
const secret = 'synthetic-independent-session4-secret-at-least-32-characters';
const now = new Date('2026-11-16T12:00:00.000Z');
function issued(snapshot = makeSnapshot(), message = 'Show the recorded prescription strength', itemId = snapshot.prescription.medicineItems[0].itemId) {
  const draft = service.buildCaseAnswer({ snapshot, message, medicineItemId: itemId });
  const answer = service.finalizeCaseAnswer({ draft, snapshot, userId: ACTOR, secret, now });
  return { snapshot, draft, answer };
}
function check(answer, snapshot, extra = {}) {
  return service.checkAnswerFreshness({ snapshot, receipts: [{ answerId: answer.answerId, bindingToken: answer.bindingToken }],
    userId: ACTOR, secret, now: new Date(now.getTime() + 60000), ...extra });
}
function editField(snapshot, id, changes) {
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value) && value.id === id && value.fieldType) Object.assign(value, changes);
    for (const child of Object.values(value)) walk(child);
  };
  walk(snapshot); snapshot.evidenceRevision++;
  snapshot.snapshotToken = 'rs_' + 'b'.repeat(64);
  return snapshot;
}
test('actual signed answer satisfies the independently frozen client DTO and exact source scope', () => {
  const { answer, snapshot } = issued();
  assert.equal(answer.mode, 'LOCAL_CASE_EVIDENCE');
  assert.ok(parseCaseAnswer(answer, snapshot.caseId, snapshot.prescription.medicineItems[0].itemId));
  const ids = new Set(snapshot.groupingDocuments.flatMap(d => d.fields.map(f => f.id)));
  assert.ok(answer.sources.every(s => s.fieldId === null || ids.has(s.fieldId)));
  assert.ok(answer.sources.some(s => s.fieldId === snapshot.prescription.medicineItems[0].fields.dosage_strength.id));
});
test('dependency index is stable and contains only content SHA256 values', () => {
  const snapshot = makeSnapshot(), index = service.buildDependencyIndex(snapshot);
  assert.ok(index instanceof Map); assert.ok(index.size > 0);
  assert.deepEqual([...index], [...service.buildDependencyIndex(clone(snapshot))]);
  assert.ok([...index].every(([key, value]) => typeof key === 'string' && key.length <= 160 && /^[a-f0-9]{64}$/.test(value)));
});
test('valid same-user receipt is fresh and decodes through the actual consumer', () => {
  const { answer, snapshot } = issued(), result = check(answer, snapshot);
  assert.equal(result.results[0].status, 'FRESH');
  assert.ok(parseFreshnessResponse(result, snapshot.caseId, [{ answerId: answer.answerId, bindingToken: answer.bindingToken }]));
});
test('case revision/token change alone does not invalidate a source-bound answer', () => {
  const { answer, snapshot } = issued(); snapshot.evidenceRevision += 25; snapshot.snapshotToken = 'rs_' + 'c'.repeat(64);
  assert.equal(check(answer, snapshot).results[0].status, 'FRESH');
});
test('cited strength correction invalidates the prior answer without rewriting it', () => {
  const { answer, snapshot } = issued(), original = answer.reply;
  const id = snapshot.prescription.medicineItems[0].fields.dosage_strength.id;
  editField(snapshot, id, { normalizedValue: '500 mg', correctedBy: ACTOR, correctedAt: '2026-11-16T12:00:30.000Z', needsCorrection: false });
  const result = check(answer, snapshot).results[0];
  assert.equal(result.status, 'STALE'); assert.ok(result.changedDependencyKeys.length > 0); assert.equal(answer.reply, original);
});
test('unrelated quantity edit does not invalidate a strength-only answer', () => {
  const { answer, snapshot } = issued();
  editField(snapshot, snapshot.prescription.medicineItems[0].fields.quantity.id, { normalizedValue: '17', correctedBy: ACTOR, correctedAt: '2026-11-16T12:00:30.000Z' });
  assert.equal(check(answer, snapshot).results[0].status, 'FRESH', 'Do not fingerprint the entire case or every value on the document');
});
test('changed medicine identity is a dependency even when the requested strength is unchanged', () => {
  const { answer, snapshot } = issued();
  editField(snapshot, snapshot.prescription.medicineItems[0].fields.medicine_name.id, { normalizedValue: 'Unknown medicine' });
  assert.equal(check(answer, snapshot).results[0].status, 'STALE');
});
test('changed source page invalidates the exact prior citation', () => {
  const { answer, snapshot } = issued();
  editField(snapshot, snapshot.prescription.medicineItems[0].fields.dosage_strength.id, { pageNumber: 2 });
  assert.equal(check(answer, snapshot).results[0].status, 'STALE');
});
test('deleted source cannot be substituted with a similar remaining medicine', () => {
  const { answer, snapshot } = issued(); snapshot.prescription = null; snapshot.groupingDocuments = snapshot.groupingDocuments.filter(d => d.documentType !== 'PRESCRIPTION');
  assert.equal(check(answer, snapshot).results[0].status, 'STALE');
});
test('reprocessed source IDs invalidate even if displayed strength still matches', () => {
  const { answer, snapshot } = issued(), old = snapshot.prescription.medicineItems[0].fields.dosage_strength.id, replacement = '1'.repeat(24);
  const replace = value => {
    if (!value || typeof value !== 'object') return;
    for (const key of Object.keys(value)) { if (value[key] === old) value[key] = replacement; else replace(value[key]); }
  };
  replace(snapshot);
  assert.equal(check(answer, snapshot).results[0].status, 'STALE');
});
test('changed grouping membership invalidates the medicine association', () => {
  const { answer, snapshot } = issued();
  snapshot.groupingDocuments[0].groups[0].fieldIds = snapshot.groupingDocuments[0].groups[0].fieldIds.filter(id => id !== snapshot.prescription.medicineItems[0].fields.dosage_strength.id);
  assert.equal(check(answer, snapshot).results[0].status, 'STALE');
});
test('forged receipt is unverifiable, never fresh', () => {
  const { answer, snapshot } = issued(); const bad = { ...answer, bindingToken: 'X' + answer.bindingToken.slice(1) };
  assert.equal(check(bad, snapshot).results[0].status, 'UNVERIFIABLE');
});
test('receipt is bound to its authorized user', () => {
  const { answer, snapshot } = issued(); assert.equal(check(answer, snapshot, { userId: 'f'.repeat(24) }).results[0].status, 'UNVERIFIABLE');
});
test('receipt is bound to its case and answer ID', () => {
  const { answer, snapshot } = issued(), foreign = clone(snapshot); foreign.caseId = 'f'.repeat(24);
  assert.equal(check(answer, foreign).results[0].status, 'UNVERIFIABLE');
  assert.equal(check({ ...answer, answerId: '22222222-2222-4222-8222-222222222222' }, snapshot).results[0].status, 'UNVERIFIABLE');
});
test('expired receipts and processing cases cannot claim current evidence', () => {
  const { answer, snapshot } = issued();
  assert.equal(check(answer, snapshot, { now: new Date(now.getTime() + 13 * 3600000) }).results[0].reasonCode, 'RECEIPT_EXPIRED');
  snapshot.caseStatus = 'PROCESSING'; assert.equal(check(answer, snapshot).results[0].status, 'UNVERIFIABLE');
});
test('wrong explicit medicine selection never produces a sourced answer for another item', () => {
  const snapshot = makeSnapshot();
  const draft = service.buildCaseAnswer({ snapshot, message: 'Show Paracetamol strength', medicineItemId: 'mi_' + 'f'.repeat(24) });
  assert.notEqual(draft.mode, 'LOCAL_CASE_EVIDENCE'); assert.equal(draft.sources.length, 0);
});
for (const message of ['Should I take 650 mg?', 'Approve this insurance claim', 'Write python code', 'I cannot breathe']) test('private assistant respects decision/domain boundary: ' + message, () => {
  const snapshot = makeSnapshot(), draft = service.buildCaseAnswer({ snapshot, message, medicineItemId: snapshot.prescription.medicineItems[0].itemId });
  assert.ok(['SAFETY', 'ABSTAIN', 'CLARIFY'].includes(draft.mode)); assert.equal(draft.sources.length, 0);
});
