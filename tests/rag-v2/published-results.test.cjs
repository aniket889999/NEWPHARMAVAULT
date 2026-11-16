'use strict';
// Checks already-published aggregate provenance, not unseen label scoring.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const crypto = require('node:crypto');
const summary = require('../../docs/rag-v2/results/SESSION_5_SYNTHETIC_SUMMARY.json');
const freeze = require('../../docs/rag-v2/SESSION_4_IMPLEMENTATION_FREEZE.json');
const runner = require('./run-evaluation.cjs');
test('held-out published aggregate belongs to the exact pre-scoring accepted implementation', () => {
  assert.equal(summary.synthetic, true); assert.equal(summary.results.heldout.status, 'COMPLETED');
  assert.ok(runner.validateFreeze(freeze, runner.codeHashes()));
  assert.deepEqual(summary.results.heldout.codeSha256, freeze.reviewedSha256);
  assert.equal(summary.implementationCommit, freeze.reviewedCommit);
});
test('the retained development fingerprint differs only by the disclosed extra EOF newline', () => {
  const development = summary.results.development.codeSha256, expected = freeze.reviewedSha256;
  const changed = Object.keys(expected).filter(p => development[p] !== expected[p]);
  assert.deepEqual(changed, ['backend/routes/caseAssistantRoutes.js']);
  const bytes = fs.readFileSync(require('node:path').resolve(__dirname, '../..', changed[0]));
  assert.equal(crypto.createHash('sha256').update(Buffer.concat([bytes, Buffer.from('\n')])).digest('hex'), development[changed[0]]);
});
test('published metrics keep finite counts, real denominators and the registered family split', () => {
  assert.equal(summary.results.development.dataset.scenarios, 24);
  assert.equal(summary.results.heldout.dataset.scenarios, 16);
  assert.equal(summary.results.development.dataset.families, 6);
  assert.equal(summary.results.heldout.dataset.families, 4);
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if ('numerator' in value && 'denominator' in value) {
      assert.ok(Number.isInteger(value.numerator) && Number.isInteger(value.denominator));
      assert.ok(value.numerator >= 0 && value.numerator <= value.denominator);
      assert.equal(value.value, value.denominator ? value.numerator / value.denominator : null);
    }
    Object.values(value).forEach(walk);
  };
  walk(summary.results);
  for (const result of Object.values(summary.results)) assert.equal(result.observedNetworkAttempts, 0);
});
