const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const rag = require('../services/chatRagService');
const { runPublicProbe, OUTPUT_TOKEN_LIMIT } = require('../services/publicProviderProbeService');
const keys = ['GEMINI_API_KEY', 'RAG_CHAT_LLM_ENABLED', 'RAG_CHAT_PUBLIC_EXPORT_ALLOWED', 'RAG_CHAT_MODEL', 'RAG_CHAT_EMBEDDINGS_ENABLED'];
function setup(t) {
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  Object.assign(process.env, { GEMINI_API_KEY: 'SYNTHETIC_PROBE_KEY', RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', RAG_CHAT_MODEL: 'gemini-2.5-flash', RAG_CHAT_EMBEDDINGS_ENABLED: 'true' });
}
function generatedResponse() {
  const source = rag.publicChunks.find(p => p.key === 'human-review');
  const text = JSON.stringify({ paragraphs: [{ text: 'An authorized human reviews the evidence and records a reason for the decision.', support: [{ sourceId: 'E1', quote: source.excerpt }] }] });
  return new Response('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) + '\n\n', { status: 200 });
}
test('configuration-only mode makes zero provider calls even with credentials and flags', async t => {
  setup(t); let calls = 0; const result = await runPublicProbe({ fetcher: async () => { calls++; throw Error('No call expected'); } });
  assert.equal(result.status, 'CONFIGURATION_ONLY'); assert.equal(result.networkCalls, 0); assert.equal(calls, 0); assert.equal(result.liveProviderVerified, false);
});
test('live opt-in cannot override missing credential or public export permission', async t => {
  setup(t); let calls = 0;
  process.env.RAG_CHAT_PUBLIC_EXPORT_ALLOWED = 'false';
  assert.equal((await runPublicProbe({ allowProviderCall: true, fetcher: async () => calls++ })).status, 'NOT_RUN');
  process.env.RAG_CHAT_PUBLIC_EXPORT_ALLOWED = 'true'; delete process.env.GEMINI_API_KEY;
  assert.equal((await runPublicProbe({ allowProviderCall: true, fetcher: async () => calls++ })).readiness.reasonCode, 'MISSING_CREDENTIAL');
  assert.equal(calls, 0);
});
test('mocked adapter success proves request bounds and sanitized output, not live acceptance', async t => {
  setup(t); let captured, url;
  const result = await runPublicProbe({ allowProviderCall: true, fetcher: async (endpoint, options) => { url = endpoint; captured = options; return generatedResponse(); } });
  assert.equal(result.status, 'VERIFIED'); assert.equal(result.networkCalls, 1); assert.equal(result.embeddingCalls, 0);
  assert.match(url, /^https:\/\/generativelanguage.googleapis.com\/v1beta\/models\/gemini-2.5-flash:streamGenerateContent\?alt=sse$/);
  const body = JSON.parse(captured.body), context = JSON.parse(body.contents[0].parts[0].text);
  assert.equal(body.generationConfig.maxOutputTokens, OUTPUT_TOKEN_LIMIT); assert.equal(captured.redirect, 'error');
  assert.equal(context.passages.length, 1); assert.equal(context.passages[0].sourceId, 'E1');
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PROBE_KEY|paragraphs|Recorded item|support|fingerprint/);
});
test('429 is sanitized, unavailable and never retried', async t => {
  setup(t); let calls = 0;
  const result = await runPublicProbe({ allowProviderCall: true, fetcher: async () => { calls++; return new Response('SECRET_UPSTREAM_MESSAGE', { status: 429 }); } });
  assert.equal(calls, 1); assert.equal(result.status, 'UNAVAILABLE'); assert.equal(result.providerHttpStatus, 429);
  assert.equal(result.readiness.reasonCode, 'PROVIDER_RATE_LIMIT'); assert.equal(result.liveProviderVerified, false);
  assert.doesNotMatch(JSON.stringify(result), /SECRET_UPSTREAM_MESSAGE|SYNTHETIC_PROBE_KEY/);
});
test('invalid generated content is not reported as provider verification', async t => {
  setup(t); const text = JSON.stringify({ paragraphs: [{ text: 'An unsupported answer', support: [{ sourceId: 'E1', quote: 'Fabricated content not in evidence' }] }] });
  const result = await runPublicProbe({ allowProviderCall: true, fetcher: async () => new Response('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) + '\n\n', { status: 200 }) });
  assert.equal(result.status, 'UNAVAILABLE'); assert.equal(result.readiness.reasonCode, 'ANSWER_VALIDATION_FAILED');
});
test('transport timeout is bounded and does not expose raw exception details', async t => {
  setup(t); const result = await runPublicProbe({ allowProviderCall: true, fetcher: async () => { throw Object.assign(new Error('SECRET_PATH_AND_KEY'), { name: 'TimeoutError' }); } });
  assert.equal(result.status, 'UNAVAILABLE'); assert.equal(result.readiness.reasonCode, 'PROVIDER_TIMEOUT');
  assert.doesNotMatch(JSON.stringify(result), /SECRET_PATH_AND_KEY/);
});
test('CLI defaults to configuration-only and rejects unsupported raw query arguments safely', () => {
  const script = path.resolve(__dirname, '../scripts/checkChatProvider.js');
  const env = { ...process.env, RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'false' };
  const config = spawnSync(process.execPath, [script], { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(config.status, 0); assert.equal(JSON.parse(config.stdout).networkCalls, 0);
  const rejected = spawnSync(process.execPath, [script, '--question=PRIVATE_RAW_QUERY'], { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(rejected.status, 2); assert.doesNotMatch(rejected.stdout + rejected.stderr, /PRIVATE_RAW_QUERY/);
});
