'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const runner = require('./run-evaluation.cjs');
test('held-out split is opt-in and cannot be selected accidentally', () => {
  assert.throws(() => runner.parseOptions([])); assert.throws(() => runner.parseOptions(['--split=heldout']));
  assert.throws(() => runner.parseOptions(['--split=development', '--split=heldout']));
  assert.throws(() => runner.parseOptions(['--split=development', '--out=/private']));
  assert.deepEqual(runner.parseOptions(['--split=heldout', '--accept-frozen-heldout']), { split: 'heldout' });
});
test('implementation freeze requires exact approved bytes for every fixed allow-listed path', () => {
  const hashes = Object.fromEntries(runner.CANDIDATE_FILES.map(p => [p, 'a'.repeat(64)]));
  const freeze = { schemaVersion: 'session4-implementation-freeze/1.0.0', acceptance: 'ACCEPTED_OFFLINE_AND_HTTP', reviewedSha256: { ...hashes } };
  assert.equal(runner.validateFreeze(freeze, hashes), true);
  freeze.reviewedSha256[runner.CANDIDATE_FILES[0]] = 'b'.repeat(64); assert.equal(runner.validateFreeze(freeze, hashes), false);
  freeze.reviewedSha256 = { ...hashes, '../.env': 'a'.repeat(64) }; assert.equal(runner.validateFreeze(freeze, hashes), false);
});
test('temporal score keeps dependent misses and unrelated false invalidations distinct', () => {
  const records = [{ temporal: [
    { kind: 'DEPENDENT', results: { policy: 'FRESH' } }, { kind: 'UNRELATED', results: { policy: 'STALE' } }
  ] }];
  const m = runner.temporalSummary(records, 'policy');
  assert.equal(m.falseFreshAfterDependentEdit.value, 1); assert.equal(m.exactStaleDetection.value, 0);
  assert.equal(m.falseStaleAfterUnrelatedEdit.value, 1);
  assert.equal(runner.temporalSummary([], 'policy').exactStaleDetection.value, null);
});
test('offline runner blocks and counts network attempts instead of silently claiming local evaluation', async () => {
  const guard = runner.installNetworkGuard();
  try {
    await assert.rejects(fetch('https://synthetic.invalid'), /prohibited/);
    assert.throws(() => require('node:https').get('https://synthetic.invalid'), /prohibited/);
    assert.equal(guard.attempts, 2);
  } finally { guard.restore(); }
});
