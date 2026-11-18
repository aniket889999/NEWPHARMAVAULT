'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), { createRequire } = require('node:module');
const Ajv = createRequire(require.resolve('ajv-cli/package.json'))('ajv/dist/2020');
const addFormats = require('ajv-formats');
const ajv = new Ajv({ allErrors: true, strict: true }); addFormats(ajv);
const validate = ajv.compile(require('../../contracts/schemas/chat-provider-readiness.schema.json'));
const { createReadinessMonitor } = require('../../backend/services/chatProviderReadinessService');
const env = () => ({ RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', GEMINI_API_KEY: 'SYNTHETIC_SCHEMA_KEY', RAG_CHAT_MODEL: 'gemini-2.5-flash' });
const result = () => ({ mode: 'GEMINI_RAG', model: 'gemini-2.5-flash', reply: 'Synthetic public reply [S1]', sources: [{ citation: 'S1' }] });
test('schema accepts actual local, misconfigured, unverified, recent, expired and degraded snapshots', () => {
  for (const setup of [m => {}, m => m.observePublicAnswer(m.beginPublicAttempt(), result()), m => m.observePublicAnswer(m.beginPublicAttempt(), { mode: 'LOCAL_EXTRACTIVE', fallbackReason: 'PROVIDER_RATE_LIMIT' })]) {
    let time = 1000000; const m = createReadinessMonitor({ environment: env, now: () => time }); setup(m);
    assert.equal(validate(m.snapshot()), true, JSON.stringify(validate.errors)); time += 300001; assert.equal(validate(m.snapshot()), true, JSON.stringify(validate.errors));
  }
  for (const config of [{}, { ...env(), GEMINI_API_KEY: '' }, { ...env(), RAG_CHAT_MODEL: 'bad://model' }]) {
    const m = createReadinessMonitor({ environment: () => config }); assert.equal(validate(m.snapshot()), true, JSON.stringify(validate.errors));
  }
});
test('schema refuses configuration-only success and sensitive extra metadata', () => {
  const m = createReadinessMonitor({ environment: env }); const unverified = m.snapshot();
  assert.equal(validate({ ...unverified, liveProviderVerified: true }), false);
  assert.equal(validate({ ...unverified, state: 'VERIFIED_RECENTLY' }), false);
  for (const property of ['apiKey', 'objectStorageKey', 'query', 'rawResponse', 'fingerprint']) assert.equal(validate({ ...unverified, [property]: 'MUST_NOT_EXPOSE' }), false);
  assert.equal(validate({ ...unverified, model: 'gemini-valid\n' }), false);
});
