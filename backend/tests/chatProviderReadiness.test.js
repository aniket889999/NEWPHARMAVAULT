const test = require('node:test');
const assert = require('node:assert/strict');
const { createReadinessMonitor, OBSERVATION_TTL_MS } = require('../services/chatProviderReadinessService');
const enabled = () => ({ RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', GEMINI_API_KEY: 'synthetic-readiness-key', RAG_CHAT_MODEL: 'gemini-2.5-flash' });
const answer = () => ({ mode: 'GEMINI_RAG', model: 'gemini-2.5-flash', reply: 'Synthetic validated public response. [S1]', sources: [{ citation: 'S1' }] });
function setup(env = enabled()) { let time = 1000000; const monitor = createReadinessMonitor({ environment: () => env, now: () => time }); return { env, monitor, advance: ms => { time += ms; } }; }

test('public generation disabled means local-only, not a provider failure', () => {
  for (const env of [{}, { ...enabled(), RAG_CHAT_LLM_ENABLED: 'false' }, { ...enabled(), RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'false' }]) {
    const { monitor } = setup(env); assert.equal(monitor.snapshot().state, 'LOCAL_ONLY'); assert.equal(monitor.beginPublicAttempt(), null);
  }
});
test('private export permission cannot enable public generation', () => {
  const { monitor } = setup({ ...enabled(), RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'false', TRUSTRAG_LLM_EXPORT_ALLOWED: 'true' });
  assert.equal(monitor.snapshot().reasonCode, 'PUBLIC_EXPORT_NOT_ALLOWED');
});
test('missing/blank credential and unsafe model are misconfigured without reflection', () => {
  for (const credential of ['', '   ']) {
    const { monitor } = setup({ ...enabled(), GEMINI_API_KEY: credential });
    assert.equal(monitor.snapshot().reasonCode, 'MISSING_CREDENTIAL'); assert.equal(monitor.snapshot().state, 'MISCONFIGURED');
  }
  for (const model of ['https://secret.invalid/key', 'gemini-safe?key=SECRET', 'gemini-2.5-flash\n', 'gemini-' + 'x'.repeat(100)]) {
    const { monitor } = setup({ ...enabled(), RAG_CHAT_MODEL: model });
    assert.equal(monitor.snapshot().model, null); assert.equal(monitor.snapshot().reasonCode, 'INVALID_MODEL');
    assert.doesNotMatch(JSON.stringify(monitor.snapshot()), /secret|SECRET|fingerprint|synthetic-readiness-key/);
  }
});
test('configured credential/flags never imply a live successful response', () => {
  const { monitor } = setup(); const status = monitor.snapshot();
  assert.equal(status.state, 'CONFIGURED_UNVERIFIED'); assert.equal(status.liveProviderVerified, false); assert.equal(status.checkedAt, null);
  assert.equal(status.statusDoesNotProbe, true); assert.equal(status.privateCasePolicy, 'LOCAL_ONLY');
});
test('an observed public generated response produces recent scoped evidence, not a clinical guarantee', () => {
  const { monitor } = setup(); assert.equal(monitor.observePublicAnswer(monitor.beginPublicAttempt(), answer()), true);
  const status = monitor.snapshot(); assert.equal(status.state, 'VERIFIED_RECENTLY'); assert.equal(status.liveProviderVerified, true);
  assert.equal(status.verificationScope, 'PUBLIC_REFERENCE_GENERATION'); assert.equal(status.reasonCode, 'LIVE_RESPONSE_VALIDATED');
  assert.doesNotMatch(JSON.stringify(status), /Synthetic validated|S1|synthetic-readiness-key|fingerprint/);
});
test('all recognized public fallbacks report degraded instead of successful generation', () => {
  for (const reason of ['PROVIDER_RATE_LIMIT', 'PROVIDER_UNAVAILABLE', 'PROVIDER_TIMEOUT', 'ANSWER_VALIDATION_FAILED']) {
    const { monitor } = setup(); monitor.observePublicAnswer(monitor.beginPublicAttempt(), { mode: 'LOCAL_EXTRACTIVE', fallbackReason: reason });
    assert.equal(monitor.snapshot().state, 'DEGRADED'); assert.equal(monitor.snapshot().reasonCode, reason); assert.equal(monitor.snapshot().liveProviderVerified, false);
  }
});
test('greeting, clarification, safety, refusal and ordinary local notes establish no proof', () => {
  const { monitor } = setup();
  for (const mode of ['CONVERSATIONAL_HELP', 'CLARIFY', 'SAFETY', 'ABSTAIN', 'LOCAL_EXTRACTIVE']) assert.equal(monitor.observePublicAnswer(monitor.beginPublicAttempt(), { ...answer(), mode }), false);
  assert.equal(monitor.snapshot().state, 'CONFIGURED_UNVERIFIED');
});
test('private and aborted requests never update public readiness', () => {
  const { monitor } = setup();
  assert.equal(monitor.observePublicAnswer(monitor.beginPublicAttempt(), answer(), { privateScope: true }), false);
  assert.equal(monitor.observePublicAnswer(monitor.beginPublicAttempt(), answer(), { aborted: true }), false);
  assert.equal(monitor.snapshot().verificationScope, 'NONE');
});
test('empty responses, wrong model and unknown errors cannot establish verification', () => {
  const { monitor } = setup();
  for (const result of [null, {}, { ...answer(), model: 'gemini-other' }, { ...answer(), sources: [] }, { ...answer(), reply: '  ' }, { mode: 'LOCAL_EXTRACTIVE', fallbackReason: 'RAW_SECRET_ERROR' }]) assert.equal(monitor.observePublicAnswer(monitor.beginPublicAttempt(), result), false);
  assert.equal(monitor.snapshot().state, 'CONFIGURED_UNVERIFIED');
});
test('success expires exactly at the bounded lifetime and cannot reappear after clock rollback', () => {
  const { monitor, advance } = setup(); monitor.observePublicAnswer(monitor.beginPublicAttempt(), answer());
  advance(OBSERVATION_TTL_MS - 1); assert.equal(monitor.snapshot().liveProviderVerified, true);
  advance(1); assert.equal(monitor.snapshot().state, 'CONFIGURED_UNVERIFIED'); assert.equal(monitor.snapshot().reasonCode, 'CHECK_EXPIRED');
  advance(-OBSERVATION_TTL_MS / 2); assert.equal(monitor.snapshot().liveProviderVerified, false);
  advance(-OBSERVATION_TTL_MS - 1); assert.equal(monitor.snapshot().liveProviderVerified, false);
});
test('configuration changes/reverts invalidate proof and in-flight results', () => {
  for (const [key, value] of [['GEMINI_API_KEY', 'other-synthetic'], ['RAG_CHAT_MODEL', 'gemini-other'], ['RAG_CHAT_PUBLIC_EXPORT_ALLOWED', 'false']]) {
    const { monitor, env } = setup(); const oldValue = env[key], attempt = monitor.beginPublicAttempt();
    monitor.observePublicAnswer(attempt, answer()); env[key] = value; assert.equal(monitor.snapshot().liveProviderVerified, false);
    env[key] = oldValue; assert.equal(monitor.snapshot().state, 'CONFIGURED_UNVERIFIED'); assert.equal(monitor.snapshot().checkedAt, null);
    // A result from an attempt begun before a config cycle must not resurrect proof.
    assert.equal(monitor.observePublicAnswer(attempt, answer()), false);
  }
});
test('a later failed observation retains historical success but is not currently verified', () => {
  const { monitor, advance } = setup(); monitor.observePublicAnswer(monitor.beginPublicAttempt(), answer()); const success = monitor.snapshot().lastSuccessAt;
  advance(100); monitor.observePublicAnswer(monitor.beginPublicAttempt(), { mode: 'LOCAL_EXTRACTIVE', fallbackReason: 'PROVIDER_RATE_LIMIT' });
  assert.equal(monitor.snapshot().lastSuccessAt, success); assert.equal(monitor.snapshot().liveProviderVerified, false);
});
test('unbounded observation lifetime is rejected', () => {
  for (const ttlMs of [0, -1, 1.5, Infinity, OBSERVATION_TTL_MS + 1]) assert.throws(() => createReadinessMonitor({ ttlMs }), /bounded/);
});
