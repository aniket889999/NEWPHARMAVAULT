'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), { createRequire } = require('node:module');
const Ajv = createRequire(require.resolve('ajv-cli/package.json'))('ajv/dist/2020');
const addFormats = require('ajv-formats');
const f = require('./client-fixtures.cjs');
const ajv = new Ajv({ allErrors: true, strict: true }); addFormats(ajv);
const answer = ajv.compile(require('../../contracts/schemas/case-assistant-answer.schema.json'));
const freshness = ajv.compile(require('../../contracts/schemas/case-assistant-freshness.schema.json'));
test('strict JSON Schema accepts the frozen authored answer/freshness DTO examples', () => {
  assert.equal(answer(f.answer()), true, JSON.stringify(answer.errors));
  assert.equal(freshness(f.freshness()), true, JSON.stringify(freshness.errors));
});
test('schema refuses extra storage identifiers and a sourced answer without a receipt', () => {
  const a = f.answer(); a.localPath = '/private'; assert.equal(answer(a), false);
  delete a.localPath; a.bindingToken = null; assert.equal(answer(a), false);
});
test('schema prevents clarification from carrying signed evidence', () => {
  const a = f.answer(); a.mode = 'CLARIFY'; assert.equal(answer(a), false);
  Object.assign(a, { sources: [], dependencyKeys: [], bindingToken: null }); assert.equal(answer(a), true);
});
test('schema prevents processing or changed evidence from declaring FRESH', () => {
  const r = f.freshness(); r.results[0].reasonCode = 'CASE_PROCESSING'; assert.equal(freshness(r), false);
  r.results[0].reasonCode = 'UNCHANGED_DEPENDENCIES'; r.results[0].changedDependencyKeys = ['changed']; assert.equal(freshness(r), false);
});
