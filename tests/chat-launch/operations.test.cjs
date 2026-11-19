'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const { createToolControls } = backend('./services/chatRuntimeControlService');
const { createChatMetrics } = backend('./services/chatOperationMetricsService');
const { answer } = backend('./services/contextualChatService');
const { createApprovedHealthSearch } = backend('./services/approvedHealthSearchService');
const { createReadinessMonitor } = backend('./services/chatProviderReadinessService');
const { issueReceiptDurably, receiptPersistence } = backend('./services/chatFeedbackService');
const { buildLaunchReport } = backend('./scripts/checkChatLaunchReadiness');
const configuration = () => ({ concurrency: 1, requestsPerMinute: 2, failuresToOpen: 2, cooldownMs: 1000 });
const sample = { reply: 'Synthetic source note.', sources: [{ sourceId: 'synthetic-source', version: 'v1', kind: 'PROJECT_GUIDE' }], warnings: [] };

test('spelling suggestion is clarification, never automatic identity/retrieval/web', async () => {
  let calls = 0;
  const result = await answer({ message: 'What is Paracetmol used for?' }, { webSearch: async () => { calls++; }, localAnswer: async () => { calls++; } });
  assert.equal(result.mode, 'CLARIFY'); assert.equal(result.routing.reasonCode, 'MEDICINE_NAME_CONFIRMATION_REQUIRED');
  assert.match(result.reply, /Paracetamol|retype/); assert.deepEqual(result.sources, []); assert.equal(calls, 0);
});
test('an unsupported name cannot inherit a supported medicine from earlier context', async () => {
  const result = await answer({ message: 'What is Paracetmol used for?', history: [{ role: 'user', text: 'What is Metformin?' }] });
  assert.equal(result.mode, 'CLARIFY'); assert.doesNotMatch(result.reply, /diabetes|lower blood/);
});
test('tool concurrency is bounded and released after completion', async () => {
  const controls = createToolControls({ configuration }); let release;
  const first = controls.run('MODEL', () => new Promise(resolve => { release = resolve; }));
  await assert.rejects(controls.run('MODEL', async () => 'blocked'), error => error.fallbackReason === 'LOCAL_TOOL_BUSY');
  release('ok'); assert.equal(await first, 'ok'); assert.equal(controls.snapshot().tools.MODEL.active, 0);
});
test('request budget resets on a new minute and never starts a blocked provider call', async () => {
  let clock = 0, calls = 0;
  const controls = createToolControls({ configuration, now: () => clock });
  for (let index = 0; index < 2; index++) await controls.run('MODEL', async () => { calls++; });
  await assert.rejects(controls.run('MODEL', async () => { calls++; }), error => error.fallbackReason === 'LOCAL_TOOL_BUDGET_EXCEEDED');
  assert.equal(calls, 2); clock = 60001; await controls.run('MODEL', async () => { calls++; }); assert.equal(calls, 3);
});
test('repeated failures open a circuit and recovery is attempted only after cooldown', async () => {
  let clock = 0;
  const controls = createToolControls({ configuration: () => ({ ...configuration(), requestsPerMinute: 10 }), now: () => clock });
  for (let index = 0; index < 2; index++) await assert.rejects(controls.run('WEB', async () => { throw new Error('synthetic failure'); }));
  await assert.rejects(controls.run('WEB', async () => 'wrong'), error => error.fallbackReason === 'LOCAL_TOOL_CIRCUIT_OPEN');
  clock = 1001; assert.equal(await controls.run('WEB', async () => 'recovered'), 'recovered'); assert.equal(controls.snapshot().tools.WEB.circuitOpen, false);
});
test('an older in-flight success cannot erase an open circuit', async () => {
  const controls = createToolControls({ configuration: () => ({ concurrency: 2, requestsPerMinute: 10, failuresToOpen: 1, cooldownMs: 1000 }) });
  let finish; const old = controls.run('MODEL', () => new Promise(resolve => { finish = resolve; }));
  await assert.rejects(controls.run('MODEL', async () => { throw new Error('synthetic failure'); })); finish('old success'); await old;
  assert.equal(controls.snapshot().tools.MODEL.circuitOpen, true);
});
test('aborted work never starts; failures do not leak sensitive error text into metrics', async () => {
  const controls = createToolControls({ configuration }); const controller = new AbortController(); controller.abort();
  let calls = 0;
  await assert.rejects(controls.run('MODEL', async () => { calls++; }, { signal: controller.signal })); assert.equal(calls, 0);
  await assert.rejects(controls.run('MODEL', async () => { throw new Error('PRIVATE_SENTINEL'); }));
  assert.doesNotMatch(JSON.stringify(controls.snapshot()), /PRIVATE_SENTINEL/);
});
test('operational counters are bounded, metadata-only and finish once', () => {
  let clock = 0; const metrics = createChatMetrics({ now: () => clock }); const finish = metrics.begin(); clock = 120;
  finish({ mode: 'PRIVATE_SENTINEL', reply: 'PRIVATE_BODY' }); finish({ mode: 'SAFETY' });
  const result = metrics.snapshot(); assert.equal(result.total, 1); assert.equal(result.modes.OTHER, 1);
  assert.equal(result.latencyBucketsMs.le500, 1); assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SENTINEL|PRIVATE_BODY/);
});
test('local budget failure is degraded readiness, not false live-provider verification', () => {
  const monitor = createReadinessMonitor({ environment: () => ({ RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', GEMINI_API_KEY: 'synthetic-unused' }) });
  monitor.observePublicAnswer(monitor.beginPublicAttempt(), { mode: 'LOCAL_EXTRACTIVE', fallbackReason: 'LOCAL_TOOL_BUSY' });
  const result = monitor.snapshot(); assert.equal(result.state, 'DEGRADED'); assert.equal(result.liveProviderVerified, false); assert.equal(result.reasonCode, 'LOCAL_TOOL_BUSY');
});
test('production receipts cannot be forced back to an in-memory store', () => assert.equal(receiptPersistence({ NODE_ENV: 'production', CHAT_RECEIPT_STORE: 'memory' }), 'mongo'));
test('durable receipts store only hashes and bounded reference metadata', async t => {
  const saved = process.env.CHAT_RECEIPT_STORE; process.env.CHAT_RECEIPT_STORE = 'mongo';
  t.after(() => { if (saved === undefined) delete process.env.CHAT_RECEIPT_STORE; else process.env.CHAT_RECEIPT_STORE = saved; });
  let record;
  const result = await issueReceiptDurably('650000000000000000000001', sample, { saveReceipt: async value => { record = value; } });
  assert.ok(result.feedbackReceipt); assert.match(record._id, /^[a-f0-9]{64}$/); assert.doesNotMatch(JSON.stringify(record), /Synthetic source note|feedbackReceipt/);
  const privateAnswer = await issueReceiptDurably('650000000000000000000001', { ...sample, sources: [{ kind: 'CASE_RECORD', documentId: '650000000000000000000002' }] }, { saveReceipt: async () => { throw new Error('must not persist private sources'); } });
  assert.equal(privateAnswer.feedbackReceipt, undefined);
});
test('receipt persistence failure preserves the answer but does not mint a fake feedback receipt', async t => {
  const saved = process.env.CHAT_RECEIPT_STORE; process.env.CHAT_RECEIPT_STORE = 'mongo';
  t.after(() => { if (saved === undefined) delete process.env.CHAT_RECEIPT_STORE; else process.env.CHAT_RECEIPT_STORE = saved; });
  const result = await issueReceiptDurably('650000000000000000000001', sample, { saveReceipt: async () => { throw new Error('PRIVATE_DB_ERROR'); } });
  assert.equal(result.reply, sample.reply); assert.equal(result.feedbackReceipt, undefined); assert.match(result.warnings[0], /unavailable/); assert.doesNotMatch(JSON.stringify(result), /PRIVATE_DB_ERROR/);
});
test('same-topic web work coalesces and one cancelled caller does not cancel another', async () => {
  let resolveFetch, calls = 0, sharedSignal;
  const controls = createToolControls();
  const search = createApprovedHealthSearch({ enabled: () => true, controls, fetcher: async (url, options) => {
    calls++; sharedSignal = options.signal; assert.equal(new URL(url).searchParams.get('term'), 'ibuprofen');
    return new Promise(resolve => { resolveFetch = resolve; });
  } });
  const controller = new AbortController(); const first = search('ibuprofen', { signal: controller.signal }); const second = search('ibuprofen');
  controller.abort(); await assert.rejects(first); assert.equal(sharedSignal.aborted, false);
  resolveFetch(new Response('<nlmSearchResult><list><document url="https://medlineplus.gov/medicines.html"><content name="title">Ibuprofen synthetic fixture</content><content name="FullSummary">Ibuprofen is named in this synthetic public topic fixture. This tests transport and ranking only, and does not contain clinical guidance.</content></document></list></nlmSearchResult>', { headers: { 'content-type': 'application/xml' } }));
  assert.equal((await second).status, 'RETRIEVED'); assert.equal((await search('ibuprofen')).status, 'CACHED'); assert.equal(calls, 1);
});
test('offline release inventory never invents clinical approval or prints secrets', () => {
  const report = buildLaunchReport({ NODE_ENV: 'production', CHAT_RECEIPT_STORE: 'mongo', RATE_LIMIT_STORE: 'mongo', CASE_LOCK_BACKEND: 'mongo', CORS_ALLOWED_ORIGINS: 'https://staging.example.invalid', JWT_SECRET: 'PRIVATE_SENTINEL'.repeat(4) });
  assert.equal(report.publicMedicalLaunchApproved, false); assert.equal(report.checks.currentMedicalReviewRecords, false);
  assert.equal(report.checks.httpsOriginConfigured, true); assert.doesNotMatch(JSON.stringify(report), /PRIVATE_SENTINEL/);
});
test('embedding budget exhaustion preserves local keyword evidence instead of failing chat', async t => {
  const values = { NODE_ENV: 'test', CHAT_SOURCE_POLICY: 'ACADEMIC_DEMO', RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', RAG_CHAT_EMBEDDINGS_ENABLED: 'true', GEMINI_API_KEY: 'synthetic-unused', CHAT_TOOL_REQUESTS_PER_MINUTE: '1' };
  const old = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]])); Object.assign(process.env, values);
  t.after(() => Object.entries(old).forEach(([key, value]) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; }));
  const { toolControls } = backend('./services/chatRuntimeControlService');
  await toolControls.run('EMBEDDING', async () => undefined);
  let network = 0;
  // The v2 brand guard correctly stops Dolo before tools. Use an explicitly
  // generic identity fixture to continue testing the legacy embedding fallback.
  const result = await answer({ message: 'What is the generic name of Paracetamol 500 mg Tablet?' }, {
    fetcher: async () => { network++; throw new Error('Must not call an external provider.'); },
    generate: async () => { throw new Error('Synthetic generation failure; preserve retrieved notes.'); }
  });
  assert.equal(result.retrieval.method, 'BM25'); assert.ok(result.sources.length > 0); assert.equal(network, 0);
});
