'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const { references } = backend('./services/chatReferenceRegistry');
const { resolveContext } = backend('./services/chatContextService');
const { buildPublicAnswerTask } = backend('./services/publicAnswerTaskService');
const { synthesize, validateSupportReview, buildEvidenceIndex, resolveAnswerSupport } = backend('./services/publicAnswerSynthesisService');
const { answer } = backend('./services/contextualChatService');
const { hasProviderCredential, createReadinessMonitor } = backend('./services/chatProviderReadinessService');
const source = references.find(value => value.key === 'nhs-metformin-effects');
const output = text => ({ paragraphs: [{ text, support: [{ sourceId: 'E1', quote: source.excerpt }] }] });
const supported = { verdict: 'SUPPORTED', checks: [{ index: 0, entailed: true, relevant: true, qualifiersPreserved: true }] };
const sse = value => new Response('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }) + '\n\n');
function environment(t, overrides = {}) {
  // Deliberately rejected provider outputs must not trip the shared circuit
  // before later cases can test their own fallback. Production defaults stay.
  const values = { NODE_ENV: 'test', CHAT_SOURCE_POLICY: 'ACADEMIC_DEMO', CHAT_TOOL_CIRCUIT_FAILURES: '10', CHAT_TOOL_REQUESTS_PER_MINUTE: '100', RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', RAG_CHAT_WEB_SYNTHESIS_ALLOWED: 'true', RAG_CHAT_ANSWER_STYLE: 'GROUNDED_PARAPHRASE', RAG_CHAT_WEB_ENABLED: 'false', GEMINI_API_KEY: 'synthetic-unused', ...overrides };
  const saved = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => Object.entries(saved).forEach(([key, value]) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; }));
}
const context = () => resolveContext('Can Metformin affect vitamin B12?');

test('public task preserves supported detail and canonical topic, not raw question/history/labels', () => {
  const value = context(); value.topics[0].label = 'PRIVATE_LABEL'; value.rawHistory = 'PRIVATE_HISTORY'; value.localQuestion += ' PRIVATE_QUERY';
  const task = buildPublicAnswerTask({ context: value, focus: 'EXPLAIN', passages: [source] });
  assert.equal(task.topic.label, 'Metformin'); assert.match(task.question, /vitamin.*b12/);
  assert.doesNotMatch(JSON.stringify(task), /PRIVATE|rawHistory|localQuestion/);
});
test('private, personal, unknown detail, unknown topic and ambiguous tasks fail closed', () => {
  for (const change of [ { privateReference: true }, { personalContext: true }, { ambiguous: true }, { topics: [{ id: 'unknown' }] }, { questionPlan: { attribute: 'SPECIFIC_FACT', anchors: ['private_person_123'], language: 'ENGLISH' } } ]) {
    assert.equal(buildPublicAnswerTask({ context: { ...context(), ...change }, passages: [source] }), null);
  }
});
test('follow-up task retains the previous medicine and requested fact without exporting history', () => {
  const value = resolveContext('Explain it simply', [{ role: 'user', text: 'Can Metformin affect vitamin B12?' }]);
  const task = buildPublicAnswerTask({ context: value, passages: [source] });
  assert.equal(task.topic.id, 'metformin'); assert.equal(task.style, 'CONCISE'); assert.match(task.question, /b12/);
});
test('preview placeholder is not advertised as configured generation', () => {
  assert.equal(hasProviderCredential('unused-local-preview-no-provider-access'), false);
  const monitor = createReadinessMonitor({ environment: () => ({ RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', GEMINI_API_KEY: 'unused-local-preview-no-provider-access' }) });
  assert.equal(monitor.snapshot().reasonCode, 'MISSING_CREDENTIAL'); assert.equal(monitor.snapshot().configured, false);
});
test('changing synthesis mode invalidates previously observed provider readiness', () => {
  const env = { RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', GEMINI_API_KEY: 'synthetic-unused' };
  const monitor = createReadinessMonitor({ environment: () => env });
  monitor.observePublicAnswer(monitor.beginPublicAttempt(), { mode: 'GEMINI_RAG', model: monitor.snapshot().model, reply: 'Synthetic observed reply', sources: [{ sourceId: 'synthetic' }] });
  assert.equal(monitor.snapshot().liveProviderVerified, true);
  env.RAG_CHAT_ANSWER_STYLE = 'GROUNDED_PARAPHRASE';
  assert.equal(monitor.snapshot().liveProviderVerified, false); assert.equal(monitor.snapshot().state, 'CONFIGURED_UNVERIFIED');
});
test('sentence IDs resolve to exact server evidence and cannot cross source boundaries', () => {
  const indexed = buildEvidenceIndex([source]);
  const resolved = resolveAnswerSupport({ text: 'Synthetic answer', support: [{ sourceId: 'E1', sentenceId: 'E1T1' }] }, new Map([['E1', source.id]]), indexed.index);
  assert.equal(resolved.support[0].quote, indexed.evidence[0].sentences[0].text);
  assert.equal(resolved.support[0].sourceId, source.id);
  for (const support of [[{ sourceId: 'E2', sentenceId: 'E1T1' }], [{ sourceId: 'E1', sentenceId: 'invented' }]]) assert.throws(() => resolveAnswerSupport({ support }, new Map(), indexed.index));
});
test('faithful paraphrase is emitted only after generation and support review complete', async t => {
  environment(t); const bodies = []; let emitted = 0;
  const text = 'The reference links Metformin with low vitamin B12 levels; a pharmacist can explain the reported effects.';
  const result = await synthesize({ passages: [source], context: context(), focus: 'SIDE_EFFECTS' }, {
    fetcher: async (_url, options) => { bodies.push(JSON.parse(options.body)); assert.equal(emitted, 0); return sse(bodies.length === 1 ? output(text) : supported); },
    onParagraph: () => { emitted++; }
  });
  assert.equal(bodies.length, 2); assert.equal(emitted, 1); assert.equal(result.paragraphs[0].text, text);
  assert.equal(result.supportMethod, 'MODEL_CHECKED_EVIDENCE_SUPPORT_NOT_CLINICAL_VALIDATION');
  assert.match(bodies[0].systemInstruction.parts[0].text, /paraphrasing is allowed/);
  assert.match(bodies[0].contents[0].parts[0].text, /b12/);
  assert.equal(bodies[0].generationConfig.maxOutputTokens, 1024); assert.equal(bodies[1].generationConfig.maxOutputTokens, 512);
});
test('negative review never emits candidate text and makes no retry', async t => {
  environment(t); let calls = 0, emitted = 0;
  await assert.rejects(synthesize({ passages: [source], context: context() }, {
    fetcher: async () => { calls++; return sse(calls === 1 ? output('Metformin improves vitamin B12 levels in every person.') : { ...supported, verdict: 'UNSUPPORTED' }); },
    onParagraph: () => { emitted++; }
  }), /evidence review/);
  assert.equal(calls, 2); assert.equal(emitted, 0);
});
test('missing, duplicate, contradictory or incomplete support checks are rejected', () => {
  for (const value of [{ verdict: 'SUPPORTED', checks: [] }, { ...supported, checks: [{ ...supported.checks[0], entailed: false }] }, { ...supported, checks: [supported.checks[0], supported.checks[0]] }, { ...supported, checks: [{ ...supported.checks[0], index: 9 }] }]) assert.throws(() => validateSupportReview(value, 1));
});
test('fabricated quote or number fails before a support-review request', async t => {
  environment(t);
  for (const value of [ { paragraphs: [{ text: 'Metformin is associated with 876543 unexpected effects.', support: [{ sourceId: 'E1', quote: source.excerpt }] }] }, { paragraphs: [{ text: 'Metformin has effects according to this source.', support: [{ sourceId: 'E1', quote: 'This fabricated quote is not present in the original evidence.' }] }] } ]) {
    let calls = 0;
    await assert.rejects(synthesize({ passages: [source], context: context() }, { fetcher: async () => { calls++; return sse(value); } }));
    assert.equal(calls, 1);
  }
});
test('detailed contextual route now reaches generation; model failure keeps cited local fallback', async t => {
  environment(t); let calls = 0;
  const result = await answer({ message: 'Can Metformin affect vitamin B12?' }, { webSearch: async () => ({ status: 'DISABLED', passages: [] }), fetcher: async () => { calls++; return new Response('', { status: 429 }); } });
  assert.equal(calls, 1); assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.equal(result.fallbackReason, 'PROVIDER_RATE_LIMIT'); assert.ok(result.sources.length); assert.match(result.reply, /B12/);
});
test('contextual route returns cited generated text while keeping incidental personal text local', async t => {
  environment(t); let calls = 0;
  const result = await answer({ message: 'What is Metformin used for? My name is PRIVATE_SENTINEL and record ID 123456.' }, {
    webSearch: async () => ({ status: 'DISABLED', passages: [] }),
    fetcher: async (_url, options) => {
      calls++; assert.doesNotMatch(options.body, /PRIVATE_SENTINEL|123456|My name/);
      const payload = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
      const sentence = calls === 1 ? payload.passages[0].sentences.find(value => /type 2 diabetes/i.test(value.text)) : null;
      return sse(calls === 1 ? { paragraphs: [{ text: 'Metformin helps control type 2 diabetes according to this reference.', support: [{ sourceId: 'E1', sentenceId: sentence.sentenceId }] }] } : supported);
    }
  });
  assert.equal(calls, 2); assert.equal(result.mode, 'GEMINI_RAG'); assert.match(result.reply, /\[S1\]/);
  assert.equal(result.answerQuality.assessment, 'MODEL_CHECKED_EVIDENCE_SUPPORT_NOT_CLINICAL_VALIDATION');
});
test('public question with unknown detail and private case never invokes public provider', async t => {
  environment(t); let calls = 0;
  const options = { fetcher: async () => { calls++; throw new Error('unexpected egress'); }, webSearch: async () => ({ status: 'DISABLED', passages: [] }) };
  const result = await answer({ message: 'Does Metformin affect PRIVATE_PERSON_123?' }, options);
  assert.notEqual(result.mode, 'GEMINI_RAG'); assert.equal(calls, 0);
  const privateResult = await answer({ message: 'Explain the evidence', caseId: 'synthetic-case' }, { ...options, localAnswer: async () => ({ mode: 'LOCAL_CASE_EVIDENCE', reply: 'Local only', sources: [] }) });
  assert.equal(privateResult.mode, 'LOCAL_CASE_EVIDENCE'); assert.equal(calls, 0);
});
test('second-stage provider failure falls back without displaying candidate content', async t => {
  environment(t); let calls = 0; const events = [];
  const result = await answer({ message: 'Can Metformin affect vitamin B12?' }, {
    emit: (type, data) => events.push({ type, data }), webSearch: async () => ({ status: 'DISABLED', passages: [] }),
    fetcher: async () => { calls++; return calls === 1 ? sse(output('Unique synthetic paraphrase candidate must not appear.')) : new Response('', { status: 503 }); }
  });
  assert.equal(calls, 2); assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE');
  assert.doesNotMatch(JSON.stringify(events), /Unique synthetic/);
});
