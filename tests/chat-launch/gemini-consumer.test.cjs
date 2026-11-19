'use strict';
// Independent execution of Gemini's visible development inputs. This is not a
// held-out/clinical study and does not turn fixture-format tests into acceptance.
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
Object.assign(process.env, { RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_EMBEDDINGS_ENABLED: 'false', RAG_CHAT_WEB_ENABLED: 'false' });
const { answer } = backend('./services/contextualChatService');
const cases = require('./gemini-routing-cases.json');
for (const fixture of cases) test('G1 runtime consumer: ' + fixture.id, async () => {
  let calls = 0;
  const result = await answer({ message: fixture.message, history: fixture.history }, {
    webSearch: async () => { calls++; throw new Error('These fixtures must not call external tools.'); },
    fetcher: async () => { calls++; throw new Error('No provider calls.'); }
  });
  const expected = fixture.expected.outcome;
  if (expected === 'REFUSE') { assert.equal(result.mode, 'ABSTAIN'); assert.match(result.routing.reasonCode, /^(?:PRIVATE_DATA_ACCESS_DENIED|CREDENTIAL_REQUEST_DENIED|SECURITY_BYPASS_DENIED)$/); }
  if (expected === 'COVERAGE_GAP') { assert.equal(result.mode, 'ABSTAIN'); assert.equal(result.routing.reasonCode, 'UNSUPPORTED_MEDICINE_REFERENCE'); assert.equal(result.context.request.evidenceStatus, 'MISSING'); }
  if (expected === 'SUPPORTED') { assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.ok(result.sources.length > 0); }
  if (expected === 'CLINICAL_REFERRAL') { assert.equal(result.mode, 'ABSTAIN'); assert.equal(result.routing.reasonCode, 'PERSONAL_OR_UNVERIFIED_DECISION'); }
  if (expected === 'URGENT') { assert.equal(result.mode, 'SAFETY'); assert.equal(result.routing.reasonCode, 'URGENT_SYMPTOMS'); }
  if (expected !== 'SUPPORTED') assert.deepEqual(result.sources, []);
  assert.equal(calls, 0);
});

test('cookie policy is relaxed only in explicit local development', t => {
  const { setBrowserSession } = backend('./config/browserSession');
  const previous = process.env.NODE_ENV;
  t.after(() => { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; });
  for (const [environment, sameSite, secure] of [['development', 'lax', false], ['test', 'strict', false], ['production', 'strict', true], [undefined, 'strict', false]]) {
    if (environment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = environment;
    let options;
    setBrowserSession({ cookie: (_name, _token, value) => { options = value; } }, 'synthetic-not-a-token');
    assert.equal(options.sameSite, sameSite); assert.equal(options.secure, secure); assert.equal(options.httpOnly, true);
  }
});
