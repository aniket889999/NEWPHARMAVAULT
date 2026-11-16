'use strict';
// Independent development-only review probes; no held-out fixtures or provider calls.
const test = require('node:test'), assert = require('node:assert/strict');
const service = require('../../backend/services/trustRag/caseAssistantService.js');
const { makeSnapshot, clone, ACTOR } = require('../integration-v2/synthetic-snapshots.cjs');
const secret = 'synthetic-review-only-signing-key-at-least-32-characters';
const now = new Date('2026-11-16T13:00:00.000Z');
function issue(snapshot, message = 'Compare the recorded prescription and invoice medicine') {
  const draft = service.buildCaseAnswer({ snapshot, message, medicineItemId: snapshot.prescription.medicineItems[0].itemId });
  return service.finalizeCaseAnswer({ draft, snapshot, userId: ACTOR, secret, now });
}
function freshness(answer, snapshot) {
  return service.checkAnswerFreshness({ snapshot, receipts: [{ answerId: answer.answerId, bindingToken: answer.bindingToken }], userId: ACTOR, secret, now }).results[0];
}
test('comparison reads frozen row.status and row.checks, never nonexistent legacy properties', () => {
  const snapshot = makeSnapshot('mismatch'), answer = issue(snapshot);
  assert.doesNotMatch(answer.reply, /\bundefined\b/);
  assert.match(answer.reply, /strength check \*\*MISMATCH\*\*/);
  assert.match(answer.reply, /quantity check \*\*CONSISTENT\*\*/);
});
test('every global comparison assertion in an item-scoped answer has a freshness dependency', () => {
  const snapshot = makeSnapshot('pack'), answer = issue(snapshot);
  const changed = clone(snapshot);
  changed.comparison.rows[1].status = 'MISMATCH';
  changed.comparison.rows[1].checks.strength = 'MISMATCH';
  changed.comparison.rows[1].reasonCodes = ['STRENGTH_MISMATCH'];
  changed.comparison.status = 'MISMATCH';
  assert.equal(freshness(answer, changed).status, 'STALE', 'The answer states whole-case comparison status; it must not stay fresh when that assertion changes.');
});
test('comparison fingerprint includes actual check values even if status and reason codes are unchanged', () => {
  const snapshot = makeSnapshot(), answer = issue(snapshot), changed = clone(snapshot);
  changed.comparison.rows[0].checks.quantity = 'INSUFFICIENT_EVIDENCE';
  assert.equal(freshness(answer, changed).status, 'STALE');
});
test('explicit invoice item cannot silently answer a prescription-only strength question', () => {
  const snapshot = makeSnapshot(), draft = service.buildCaseAnswer({ snapshot, message: 'Show the recorded prescription strength', medicineItemId: snapshot.invoice.medicineItems[0].itemId });
  assert.equal(draft.mode, 'CLARIFY'); assert.equal(draft.sources.length, 0);
});
test('explicit one-item scope cannot silently drop another named medicine from a question', () => {
  const snapshot = makeSnapshot('pack'), draft = service.buildCaseAnswer({ snapshot, message: 'Show the recorded strength for Paracetamol and Metformin', medicineItemId: snapshot.prescription.medicineItems[0].itemId });
  assert.equal(draft.mode, 'CLARIFY'); assert.equal(draft.sources.length, 0);
});
test('a recorded unit without a quantity is honestly cited and satisfies the actual client contract', () => {
  const { loadScenarios } = require('../foundation-v2/fixtures.cjs');
  const support = require('./evaluation-support.cjs');
  const { parseCaseAnswer } = require('./load-client.cjs').loadClient('src/features/caseAssistant/contract.ts');
  const snapshot = support.snapshotFromFixture(loadScenarios('development').find(f => f.id === 'F01-03'));
  const answer = issue(snapshot);
  assert.match(answer.reply, /quantity missing, recorded unit/);
  assert.ok(parseCaseAnswer(answer, snapshot.caseId, snapshot.prescription.medicineItems[0].itemId));
});
