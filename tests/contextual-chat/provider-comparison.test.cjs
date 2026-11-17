'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createRequire } = require('node:module'), backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const { prepareTask, schema, mechanicalScore, normalizeOutput, hash } = backend('./benchmark/comparisonContract');
const { getTasks, datasetHash } = backend('./benchmark/publicComparisonTasks');
const { generate, requestFor, ENDPOINTS } = backend('./benchmark/providerAdapters');
const { createLedger } = backend('./benchmark/approvalLedger');
const { read } = backend('./benchmark/localEvidenceReader');
const { runComparison, reviewPacket, fingerprints, COMPONENT, canRun } = backend('./benchmark/runComparison');
const config = { OPENAI_API_KEY: 'SYNTHETIC_OPENAI_NOT_A_REAL_KEY', OPENAI_BENCHMARK_MODEL: 'gpt-test', ANTHROPIC_API_KEY: 'SYNTHETIC_CLAUDE_NOT_A_REAL_KEY', ANTHROPIC_BENCHMARK_MODEL: 'claude-test', BENCHMARK_LIVE_ALLOWED: 'true' };
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const gpt = (answer, extras = {}) => ({ status: 'completed', model: 'gpt-test', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }], usage: { input_tokens: 100, output_tokens: 50 }, ...extras });
const claude = (answer, extras = {}) => ({ stop_reason: 'end_turn', model: 'claude-test', content: [{ type: 'text', text: JSON.stringify(answer) }], usage: { input_tokens: 100, output_tokens: 50 }, ...extras });
function ledger(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pharmavault-comparison-test-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); const file = path.join(dir, 'approval.local'); const value = createLedger(file, { runId: 'SYNTHETIC_TEST_NOT_LIVE', datasetHash }); return { ...value, file }; }
test('fixed pilot inputs contain no expected actions/labels and cannot be replaced with private text', () => {
  for (const task of getTasks()) {
    const prepared = prepareTask(task.id); const input = JSON.parse(prepared.input);
    assert.deepEqual(Object.keys(input).sort(), ['passages', 'question', 'userHistory', 'wordLimit']); assert.doesNotMatch(prepared.input, /expectedAction|requiredPatterns|forbiddenPatterns|API_KEY/);
    assert.ok(Object.isFrozen(prepared.schema.properties)); assert.ok(Object.isFrozen(prepared));
    assert.throws(() => requestFor('GPT', { ...prepared, input: 'PRIVATE_PATIENT' }, config));
  }
  assert.throws(() => prepareTask('PRIVATE_PATIENT'));
  assert.throws(() => { schema.properties.action.enum.push('UNSAFE'); });
});
test('both request shapes use identical fixed evidence/instructions, 1024 token caps, no tools and fixed HTTPS destinations', () => {
  for (const task of getTasks()) {
    const input = prepareTask(task.id), a = requestFor('GPT', input, config), b = requestFor('CLAUDE', input, config);
    const first = JSON.parse(a.body), second = JSON.parse(b.body);
    assert.equal(a.endpoint, ENDPOINTS.GPT); assert.equal(b.endpoint, ENDPOINTS.CLAUDE); assert.equal(first.input, second.messages[0].content); assert.equal(first.instructions, second.system);
    assert.equal(first.max_output_tokens, 1024); assert.equal(second.max_tokens, 1024); assert.equal(first.store, false); assert.deepEqual(first.tools, []); assert.deepEqual(second.tools, []);
    assert.deepEqual(first.text.format.schema, second.output_config.format.schema); assert.ok(a.body.length <= 8000 && b.body.length <= 8000);
    assert.doesNotMatch(a.body + b.body, /SYNTHETIC_OPENAI|SYNTHETIC_CLAUDE/); assert.equal(b.headers['anthropic-version'], '2026-10-21');
  }
});
test('unconfigured/unsafe model names, credentials and workspace identifiers fail before egress', () => {
  const task = prepareTask('definition');
  for (const changes of [{ OPENAI_API_KEY: '' }, { OPENAI_API_KEY: 'bad\nkey' }, { OPENAI_BENCHMARK_MODEL: 'https://evil.invalid' }, { OPENAI_BENCHMARK_MODEL: 'gpt-test\n' }]) assert.throws(() => requestFor('GPT', task, { ...config, ...changes }), { code: 'NOT_CONFIGURED' });
  assert.throws(() => requestFor('CLAUDE', task, { ...config, ANTHROPIC_WORKSPACE_ID: 'evil\nheader' }));
  assert.equal(canRun({}), false); assert.equal(canRun({ ...config, BENCHMARK_LIVE_ALLOWED: 'false' }), false);
});
for (const provider of ['GPT', 'CLAUDE']) test(provider + ' adapter extracts only answer text and usage; logs no credential or reasoning', async () => {
  const task = prepareTask('definition'), answer = read(getTasks()[0]); let reserved = 0, called = 0;
  const result = await generate(provider, task, config, { beforeRequest: () => { reserved++; }, fetcher: async (url, options) => {
    called++; assert.equal(reserved, 1); assert.equal(options.redirect, 'error'); assert.ok(options.signal); assert.equal(url, ENDPOINTS[provider]);
    return json(provider === 'GPT' ? gpt(answer, { output: [{ type: 'reasoning', summary: [{ text: 'HIDDEN_REASONING_MUST_NOT_EXPORT' }] }, ...gpt(answer).output] }) : claude(answer));
  } });
  assert.equal(called, 1); assert.deepEqual(result.answer, answer); assert.equal(result.usage.inputTokens, 100); assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_OPENAI|SYNTHETIC_CLAUDE|HIDDEN_REASONING/);
});
test('a durable exclusive ledger reserves before fetch and blocks a 13th request or 7th per provider', t => {
  const budget = ledger(t); t.after(() => budget.close('TEST_COMPLETE'));
  for (const provider of ['GPT', 'CLAUDE']) for (let count = 0; count < 6; count++) budget.reserve(provider, { model: 'synthetic-test', inputCharacters: 2500, maxOutputTokens: 1024 });
  assert.deepEqual(budget.snapshot(), { GPT: 6, CLAUDE: 6, total: 12 });
  assert.throws(() => budget.reserve('GPT', { inputCharacters: 2500, maxOutputTokens: 1024 }), { code: 'APPROVED_BUDGET_EXCEEDED' });
  assert.throws(() => createLedger(budget.file, { runId: 'DUPLICATE', datasetHash }), { code: 'APPROVAL_ALREADY_CLAIMED_OR_UNAVAILABLE' });
  assert.equal(fs.readFileSync(budget.file, 'utf8').split('\n').filter(Boolean).length, 13); assert.equal(fs.statSync(budget.file).mode & 0o077, 0);
});
test('input/output bounds and missing budgets block before any paid request', async t => {
  const budget = ledger(t); t.after(() => budget.close('TEST_COMPLETE'));
  assert.throws(() => budget.reserve('GPT', { inputCharacters: 8001, maxOutputTokens: 1024 })); assert.throws(() => budget.reserve('GPT', { inputCharacters: 10, maxOutputTokens: 1025 }));
  let calls = 0; await assert.rejects(generate('GPT', prepareTask('definition'), config, { fetcher: async () => { calls++; } }), { code: 'BUDGET_REQUIRED' });
  const controller = new AbortController(); controller.abort(); await assert.rejects(generate('GPT', prepareTask('definition'), config, { signal: controller.signal, beforeRequest: () => { calls++; } })); assert.equal(calls, 0); assert.equal(budget.snapshot().total, 0);
});
test('HTTP errors, rate limits, refusals, truncation, oversized and malformed responses never retry or reveal upstream secrets', async () => {
  const answer = read(getTasks()[0]);
  const fixtures = [
    [() => new Response('SECRET_KEY_UPSTREAM', { status: 401 }), 'PROVIDER_AUTH_FAILED'],
    [() => new Response('SECRET_KEY_UPSTREAM', { status: 429 }), 'PROVIDER_RATE_LIMIT'],
    [() => json(gpt(answer, { status: 'incomplete' })), 'INCOMPLETE_OUTPUT'],
    [() => json(gpt(answer, { output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'PRIVATE_UPSTREAM' }] }] })), 'PROVIDER_REFUSAL'],
    [() => new Response('x'.repeat(131073), { headers: { 'content-type': 'application/json' } }), 'RESPONSE_LIMIT'],
    [() => new Response('{bad', { headers: { 'content-type': 'application/json' } }), 'INVALID_PROVIDER_JSON'],
    [() => { throw Object.assign(new Error('SECRET_KEY_UPSTREAM'), { code: 'ECONNRESET' }); }, 'NETWORK_OR_FORMAT_FAILURE'],
    [() => json(gpt({ action: 'ABSTAIN', paragraphs: [{ text: config.OPENAI_API_KEY, support: [] }] })), 'CREDENTIAL_ECHO_DENIED']
  ];
  for (const [fixture, code] of fixtures) { let calls = 0, reserves = 0; await assert.rejects(generate('GPT', prepareTask('definition'), config, { beforeRequest: () => { reserves++; }, fetcher: async () => { calls++; return fixture(); } }), error => { assert.equal(error.code, code); assert.doesNotMatch(error.message, /SECRET_KEY|PRIVATE_UPSTREAM|SYNTHETIC_OPENAI/); return true; }); assert.equal(calls, 1); assert.equal(reserves, 1); }
});
test('blatant fabricated quotations fail mechanical traceability, but valid quotations do not become clinical proof', () => {
  const task = getTasks()[0], good = read(task), wrong = { action: 'ANSWER', paragraphs: [{ text: 'A plausible answer that has an invented supporting quote.', support: [{ sourceId: 'E1', quote: 'Invented source support which is absent' }] }] };
  assert.equal(mechanicalScore(task, wrong).citationTraceability, false); assert.equal(mechanicalScore(task, good).citationTraceability, true); assert.equal(mechanicalScore(task, good).clinicalCorrectness, 'NOT_GRADED');
  assert.equal(mechanicalScore(getTasks()[4], read(getTasks()[4])).citationTraceability, null);
  assert.throws(() => normalizeOutput({ ...good, extraClinicalScore: 100 }));
});
test('offline run makes zero external requests and unavailable comparators have null scores, never fake zeros or wins', async () => {
  const report = await runComparison({ fetcher: async () => { throw new Error('MUST_NOT_CALL'); } });
  assert.equal(report.attempts.total, 0); assert.equal(report.summary[COMPONENT].developerActionChecksPassed, 6);
  assert.equal(report.summary.GPT.notRun, 6); assert.equal(report.summary.CLAUDE.developerActionChecksPassed, null); assert.equal(report.superiorityEstablished, false); assert.equal(report.conclusion, 'NOT_ESTABLISHED');
  assert.ok(Object.keys(report.candidateSha256).length >= 20); assert.equal(hash(Buffer.from('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('mocked full run keeps both failed responses, persists rows, counterbalances order and respects the 12-call ceiling', async t => {
  const budget = ledger(t); t.after(() => budget.close('TEST_COMPLETE')); const order = [], saved = []; let calls = 0;
  const report = await runComparison({ live: true, config, budget, onRow: row => saved.push(row), fetcher: async (url, options) => {
    calls++; order.push(url === ENDPOINTS.GPT ? 'GPT' : 'CLAUDE');
    const body = JSON.parse(options.body), input = JSON.parse(body.input || body.messages[0].content); const task = getTasks().find(value => value.question === input.question);
    if (task.id === 'followup') return new Response('DO_NOT_LOG_UPSTREAM_KEY', { status: 429 });
    const answer = read(task); return json(url === ENDPOINTS.GPT ? gpt(answer) : claude(answer));
  } });
  assert.equal(calls, 12); assert.equal(saved.length, 18); assert.deepEqual(order.slice(0, 4), ['GPT', 'CLAUDE', 'CLAUDE', 'GPT']);
  assert.equal(report.summary.GPT.failed, 1); assert.equal(report.summary.CLAUDE.failed, 1); assert.equal(report.summary.GPT.planned, 6); assert.equal(report.summary.GPT.developerActionChecksPassed, 5); assert.equal(report.transport, 'INJECTED_TEST_DOUBLE_NOT_LIVE_ATTESTATION'); assert.equal(report.superiorityEstablished, false);
  assert.doesNotMatch(JSON.stringify(report), /SYNTHETIC_OPENAI|SYNTHETIC_CLAUDE|DO_NOT_LOG_UPSTREAM/);
  const packet = reviewPacket(report, 'SYNTHETIC_REVIEW'); assert.equal(packet.packet.completeThreeSystemComparison, false); assert.equal(packet.packet.reviewer.id, null);
  assert.doesNotMatch(JSON.stringify(packet.packet), /PHARMAVAULT_EVIDENCE_READER|gpt-test|claude-test|expectedAction|forbiddenPatterns/); assert.ok(Object.keys(packet.mapping.mapping).length === 16);
});
test('candidate mutation stops remaining network calls and preserves already completed rows', async t => {
  const budget = ledger(t); t.after(() => budget.close('TEST_COMPLETE')); const saved = []; let calls = 0;
  await assert.rejects(runComparison({ live: true, config, budget, onRow: row => saved.push(row), fingerprint: () => ({ candidate: calls ? 'CHANGED' : 'BEFORE' }), fetcher: async () => { calls++; return json(gpt(read(getTasks()[0]))); } }), /candidate changed/i);
  assert.equal(calls, 1); assert.equal(budget.snapshot().total, 1); assert.equal(saved.length, 2);
});
test('current candidate fingerprint records byte hashes without credentials or private files', () => {
  const value = fingerprints(); assert.ok(Object.values(value).every(item => /^[a-f0-9]{64}$/.test(item))); assert.doesNotMatch(JSON.stringify(value), /\.env|API_KEY|patientData/);
});
test('live CLI fails closed with the execution flag disabled, even if credentials exist privately', () => {
  const result = require('node:child_process').spawnSync(process.execPath, [path.resolve(__dirname, '../../backend/scripts/runProviderComparison.js'), '--live-approved'], { encoding: 'utf8', env: { ...process.env, BENCHMARK_LIVE_ALLOWED: 'false' } });
  assert.equal(result.status, 2); const output = JSON.parse(result.stdout); assert.equal(output.status, 'BLOCKED_CONFIGURATION'); assert.equal(output.requestsMade, 0); assert.equal(output.reportDirectory, undefined); assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_OPENAI|SYNTHETIC_CLAUDE|Bearer /);
});
