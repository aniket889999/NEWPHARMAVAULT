'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { loadScenarios } = require('../foundation-v2/fixtures.cjs');
const s = require('./evaluation-support.cjs');
const fixture = () => loadScenarios('development')[0];
test('implementation fingerprints hash actual source bytes, not a serialized Buffer wrapper', () => {
  const crypto = require('node:crypto'), bytes = Buffer.from('SYNTHETIC bytes');
  assert.equal(s.sha(bytes), crypto.createHash('sha256').update(bytes).digest('hex'));
});
test('evaluation snapshot adapter preserves actual IDs and invokes the real frozen engines', () => {
  const f = fixture(), snapshot = s.snapshotFromFixture(f);
  assert.equal(snapshot.caseId, f.caseId); assert.equal(snapshot.comparison.status, 'CONSISTENT');
  assert.equal(snapshot.prescription.medicineItems[0].fields.medicine_name.id, f.documents[0].extractedFields[0].id);
});
test('authored target uses the frozen expected pair, not candidate output', () => {
  const f = fixture(), snapshot = s.snapshotFromFixture(f), target = s.targetFromAuthoredInput(f, snapshot);
  assert.equal(target.relevantFieldIds.length, 2); assert.ok(target.allowedFieldIds.includes(target.primaryFieldId));
  snapshot.comparison.rows = []; assert.deepEqual(s.targetFromAuthoredInput(f, snapshot), target);
});
test('shared renderer is identical for equal sources across ablations', () => {
  const sources = s.privateCorpus(s.snapshotFromFixture(fixture())).slice(0, 2);
  assert.equal(s.renderSources(sources), s.renderSources(s.clone(sources))); assert.match(s.renderSources(sources), /\[S1\]/);
});
test('metrics retain real zero denominators as unmeasured, never a made-up perfect score', () => {
  assert.equal(s.ratio(0, 0).value, null); assert.deepEqual(s.ratio(1, 2), { numerator: 1, denominator: 2, value: 0.5 });
});
test('reference recall and wrong-entity attribution are separate measurements', () => {
  const target = { relevantFieldIds: ['a'], allowedFieldIds: ['a', 'b'] };
  assert.equal(s.sourceMetrics([{ fieldId: 'a' }, { fieldId: 'wrong' }], target).relevantRetrieved, 1);
  assert.equal(s.sourceMetrics([{ fieldId: 'a' }, { fieldId: 'wrong' }], target).wrongEntityOrSource, true);
  assert.equal(s.sourceMetrics([{ fieldId: 'b' }], target).exactRequestedReferenceFound, false);
  assert.equal(s.sourceMetrics([{ fieldId: null }], target).wrongEntityOrSource, true);
});
test('dependent counterfactual changes only the cited source field and revision, leaving original input immutable', () => {
  const f = fixture(), before = s.snapshotFromFixture(f), target = s.targetFromAuthoredInput(f, before), previous = JSON.stringify(before);
  const after = s.counterfactual(before, target, 'DEPENDENT');
  assert.equal(JSON.stringify(before), previous); assert.equal(after.evidenceRevision, before.evidenceRevision + 1);
  assert.equal(after.prescription.medicineItems[0].fields.dosage_strength.normalizedValue, '999 mg');
  assert.equal(after.prescription.medicineItems[0].fields.quantity.normalizedValue, before.prescription.medicineItems[0].fields.quantity.normalizedValue);
});
test('unrelated administrative mutation has an identical visible source corpus despite a new case revision', () => {
  const before = s.snapshotFromFixture(fixture()), after = s.counterfactual(before, {}, 'UNRELATED');
  assert.deepEqual(s.privateCorpus(before), s.privateCorpus(after)); assert.notEqual(before.evidenceRevision, after.evidenceRevision);
});
test('the evaluation support module does not read held-out labels or call providers/databases', () => {
  const fs = require('node:fs'), source = fs.readFileSync(require.resolve('./evaluation-support.cjs'), 'utf8');
  assert.doesNotMatch(source, /loadScenarios\(['"]heldout|mongoose\.connect|\bfetch\(|dotenv/);
});
