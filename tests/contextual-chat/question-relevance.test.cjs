'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs'), crypto = require('node:crypto');
const { createRequire } = require('node:module'), backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
Object.assign(process.env, { RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_EMBEDDINGS_ENABLED: 'false', RAG_CHAT_WEB_ENABLED: 'false' });
const { answer } = backend('./services/contextualChatService'), { resolveContext } = backend('./services/chatContextService');
const { retrievePrecise, composePrecise } = backend('./services/preciseAnswerService');
const { references } = backend('./services/chatReferenceRegistry');
const { parseResults } = backend('./services/approvedHealthSearchService');
const { supportsRequest, projection } = backend('./services/chatQuestionService');
const artifact = path.resolve(__dirname, '../../backend/data/precisionRanker.v1.json');
const modelHash = () => crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex');
const before = modelHash();
const noWeb = async () => ({ status: 'DISABLED', passages: [] });
for (const message of ['Can Metformin affect vitamin B12?', 'Does Metformin cause vitamin B12 deficiency?', 'Tell me about B12 deficiency with Metformin.']) test('specific detail is answered from the relevant existing passage: ' + message, async () => {
  const result = await answer({ message }, { webSearch: async () => { throw new Error('local evidence sufficient'); } });
  assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.match(result.reply, /Vitamin B12 deficiency/); assert.match(result.reply, /Metformin/); assert.doesNotMatch(result.reply, /commonly used for type 2 diabetes|helps lower blood/); assert.equal(result.sources[0].title, 'Metformin: possible side effects'); assert.equal(result.context.request.evidenceStatus, 'MATCHED_TEXT');
});
for (const [message, pattern] of [['Does Cetirizine cause drowsiness?', /sleepiness|sleepy/i], ['Does Metformin cause nausea?', /nausea/], ['What is Paracetamol used for?', /relieve pain|high temperature/], ['How does Metformin work?', /lower blood glucose/]]) test('attribute and detail variants preserve a supporting sentence: ' + message, async () => {
  const result = await answer({ message }, { webSearch: noWeb }); assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.match(result.reply, pattern); assert.ok(result.sources.length);
});
for (const message of ['How should I store Paracetamol?', 'What storage temperature is listed for Metformin?', 'Can I freeze Cetirizine?', 'Can Cetirizine affect vitamin D?', 'Why does Metformin cause a metallic taste?']) test('missing specific evidence does not become a generic overview: ' + message, async () => {
  let calls = 0; const result = await answer({ message }, { webSearch: async () => { calls++; return noWeb(); } });
  assert.equal(result.mode, 'ABSTAIN'); assert.equal(result.sources.length, 0); assert.equal(result.context.request.evidenceStatus, 'MISSING'); assert.equal(calls, 1); assert.doesNotMatch(result.reply, /relieve pain|type 2 diabetes|\b25\b|metallic taste is caused/);
});
test('specific fact and its qualifiers survive a simpler follow-up', async () => {
  const result = await answer({ message: 'Explain it more simply', history: [{ role: 'user', text: 'Can Metformin affect vitamin B12?' }] }, { webSearch: noWeb });
  assert.equal(result.context.followupResolved, true); assert.equal(result.context.request.attribute, 'SPECIFIC_FACT'); assert.match(result.reply, /Vitamin B12/); assert.ok(result.answerQuality.words <= 90); assert.doesNotMatch(result.reply, /used for type 2 diabetes/);
});
test('storage follow-up keeps the medicine but reports missing evidence', async () => {
  const result = await answer({ message: 'How should I store it?', history: [{ role: 'user', text: 'What is Paracetamol?' }] }, { webSearch: noWeb });
  assert.equal(result.context.topics[0].id, 'paracetamol'); assert.equal(result.context.request.attribute, 'STORAGE'); assert.equal(result.mode, 'ABSTAIN');
});
for (const message of ['I was asking about Paracetamol. Now explain Metformin.', 'Earlier: Paracetamol. Instead explain Metformin.', 'Paracetamol was my old question; switch topic to Metformin.']) test('explicit same-turn topic switch selects the new topic: ' + message, async () => {
  const result = await answer({ message }, { webSearch: noWeb }); assert.equal(result.context.topics.length, 1); assert.equal(result.context.topics[0].id, 'metformin'); assert.equal(result.context.topicSwitchResolved, true); assert.match(result.reply, /Metformin/); assert.doesNotMatch(result.reply, /Paracetamol/);
});
test('negated switches and genuine two-medicine references cannot silently pick one', () => {
  for (const message of ["Don't switch to Metformin; explain Paracetamol.", 'Now compare Paracetamol and Metformin.']) assert.equal(resolveContext(message).ambiguous, true);
});
for (const message of ['Explain Paracetamol in Marathi.', 'Paracetamol Hindi mein samjhao.', 'Translate Metformin into Tamil.', 'Marathi']) test('unsupported language requests are explicit and invoke no tools: ' + message, async () => {
  let calls = 0; const result = await answer({ message }, { webSearch: async () => { calls++; throw new Error('must not call'); }, fetcher: async () => { calls++; } });
  assert.equal(result.mode, 'CLARIFY'); assert.equal(result.routing.reasonCode, 'UNSUPPORTED_ANSWER_LANGUAGE'); assert.match(result.reply, /English only|verified translation/); assert.equal(result.sources.length, 0); assert.equal(calls, 0);
});
test('English opt-in after a language refusal retains the original medicine', async () => {
  const result = await answer({ message: 'English please', history: [{ role: 'user', text: 'Explain Paracetamol in Marathi.' }] }, { webSearch: noWeb });
  assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.equal(result.context.topics[0].id, 'paracetamol'); assert.equal(result.context.request.language, 'ENGLISH');
});
test('urgent safety and private-case boundaries still precede language/topic formatting', async () => {
  let calls = 0; const options = { webSearch: async () => { calls++; }, localAnswer: async () => { calls++; return { mode: 'LOCAL_CASE_EVIDENCE', reply: 'Local only', sources: [] }; } };
  const urgent = await answer({ message: 'I have chest pain. Explain in Marathi.' }, options); assert.equal(urgent.mode, 'SAFETY'); assert.equal(calls, 0);
  const personal = await answer({ message: 'Explain it simply', history: [{ role: 'user', text: 'Can I take Paracetamol while pregnant?' }] }, options); assert.equal(personal.mode, 'ABSTAIN'); assert.equal(calls, 0);
  const privateResult = await answer({ message: 'storage in Marathi', caseId: '650000000000000000000001' }, options); assert.equal(privateResult.mode, 'LOCAL_CASE_EVIDENCE'); assert.equal(calls, 1);
});
const webFixture = (title, text) => parseResults('<nlmSearchResult><list><document url="https://medlineplus.gov/medicines.html"><content name="title">' + title + '</content><content name="FullSummary">' + text + '</content></document></list></nlmSearchResult>', { webTerm: 'paracetamol' }, '2026-11-17');
test('a covered medicine with an uncovered attribute can use approved web fallback without exporting raw question/history', async () => {
  const calls = []; const passages = webFixture('Paracetamol storage synthetic fixture', 'Paracetamol storage information in this synthetic fixture refers the reader to the printed product instructions. This is a routing test fixture, not validated medical guidance.');
  const result = await answer({ message: 'How should I store Paracetamol?', history: [{ role: 'assistant', text: 'PRIVATE_MARKER' }] }, { webSearch: async (topic, options) => { calls.push({ topic, keys: Object.keys(options) }); return { status: 'RETRIEVED', passages }; } });
  assert.equal(result.mode, 'PRECISE_WEB_EVIDENCE'); assert.equal(calls[0].topic, 'paracetamol'); assert.deepEqual(calls[0].keys, ['signal']); assert.doesNotMatch(JSON.stringify(calls), /PRIVATE_MARKER|How should/); assert.equal(result.sources[0].kind, 'OFFICIAL_WEB');
});
test('an official but irrelevant page cannot fill a storage gap', async () => {
  const passages = webFixture('Paracetamol synthetic overview', 'Paracetamol is the topic of this synthetic overview reference. This reference fixture provides no product storage instructions and is not medical advice.');
  const result = await answer({ message: 'How should I store Paracetamol?' }, { webSearch: async () => ({ status: 'RETRIEVED', passages }) }); assert.equal(result.mode, 'ABSTAIN'); assert.equal(result.sources.length, 0);
});
test('broad web references must identify the selected medicine, not just mention the requested attribute', () => {
  const context = resolveContext('Can Metformin affect vitamin B12?');
  assert.equal(supportsRequest({ kind: 'OFFICIAL_WEB', title: 'General vitamins', excerpt: 'Vitamin B12 is discussed in this generic nutrition fixture.' }, context), false);
});
test('reviewer preferences cannot override question-support filtering', () => {
  const context = resolveContext('Can Metformin affect vitamin B12?'), wrong = references.find(value => value.key === 'nhs-metformin-overview');
  const result = retrievePrecise(context.localQuestion, context, { preferredSourceIds: [wrong.id] }); assert.ok(result.passages.length); assert.equal(result.passages[0].key, 'nhs-metformin-effects'); assert.ok(!result.passages.some(value => value.id === wrong.id));
});
test('detailed answers stay local/extractive even if optional generation is configured', async t => {
  const names = ['RAG_CHAT_LLM_ENABLED', 'RAG_CHAT_PUBLIC_EXPORT_ALLOWED', 'GEMINI_API_KEY'], saved = names.map(name => process.env[name]); t.after(() => names.forEach((name, index) => { if (saved[index] === undefined) delete process.env[name]; else process.env[name] = saved[index]; }));
  Object.assign(process.env, { RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', GEMINI_API_KEY: 'synthetic-unused' });
  let calls = 0; const result = await answer({ message: 'Can Metformin affect vitamin B12?' }, { fetcher: async () => { calls++; throw new Error('must not export a lossy question'); }, webSearch: noWeb }); assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.equal(calls, 0);
});
test('public projections exclude raw local anchors, user history and private identifiers', () => {
  const value = projection(resolveContext('Can Metformin affect PRIVATE_PERSON_123?').questionPlan); assert.doesNotMatch(JSON.stringify(value), /PRIVATE_PERSON|anchors|history/); assert.equal(value.method, 'CONSERVATIVE_TEXT_MATCH_NOT_SEMANTIC_PROOF');
});
test('composition cannot emit unrelated supplied passages and no model weights were changed', () => {
  const context = resolveContext('How should I store Paracetamol?'); assert.equal(composePrecise(context.localQuestion, context, [references.find(value => value.key === 'nhs-paracetamol-overview')]), null); assert.equal(modelHash(), before);
});
test('same-turn switch discards the old topic intent, not just its medicine name', async () => {
  const result = await answer({ message: 'Earlier I asked about Paracetamol side effects. Now explain Metformin.' }, { webSearch: noWeb });
  assert.equal(result.context.intent, 'OVERVIEW'); assert.match(result.reply, /commonly used for type 2 diabetes/); assert.doesNotMatch(result.reply, /nausea|Paracetamol/);
});
test('multiple requested attributes are clarified instead of silently answering only one', async () => {
  const result = await answer({ message: 'What are Metformin uses and side effects?' }, { webSearch: async () => { throw new Error('must clarify first'); } });
  assert.equal(result.mode, 'CLARIFY'); assert.equal(result.routing.reasonCode, 'MULTIPLE_DETAILS_NEED_SCOPE');
});
test('a caveat cannot stand in for an over-budget supporting sentence', () => {
  const context = resolveContext('Can Metformin affect vitamin B12?');
  const source = { ...references.find(value => value.key === 'nhs-metformin-effects'), excerpt: 'Vitamin B12 ' + 'synthetic '.repeat(150) + 'detail. Ask a pharmacist when unsure.' };
  assert.equal(composePrecise(context.localQuestion, context, [source]), null);
});
test('answer cards show missing evidence and resolved switches without claiming clinical accuracy', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const Component = require('../rag-v2/load-client.cjs').loadClient('src/components/chat/ChatMessage.tsx').default;
  const rag = { reply: 'No supported storage answer.', mode: 'ABSTAIN', sources: [], warnings: [], disclaimer: 'Educational only', retrieval: { method: 'BM25', matchedPassages: 0 }, context: { version: 'test', topics: [{ id: 'metformin', label: 'Metformin' }], intent: 'OVERVIEW', style: 'STANDARD', followupResolved: false, topicSwitchResolved: true, request: { attribute: 'STORAGE', language: 'ENGLISH', evidenceStatus: 'MISSING', method: 'CONSERVATIVE_TEXT_MATCH_NOT_SEMANTIC_PROOF' } } };
  const html = renderToStaticMarkup(React.createElement(Component, { message: { id: 'synthetic', role: 'assistant', content: rag.reply, timestamp: new Date(), rag } }));
  assert.match(html, /No supporting passage found/); assert.match(html, /Switched to your new topic/); assert.doesNotMatch(html, /clinically verified|100%|clinical accuracy:|CONSERVATIVE_TEXT_MATCH/);
});
test('project risk signals are not misclassified as medicine side effects', async () => {
  const result = await answer({ message: 'What are risk signals?' }, { webSearch: async () => { throw new Error('project facts must stay local'); } });
  assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.equal(result.context.request.attribute, 'GENERAL'); assert.match(result.reply, /Risk signals|risk signal/); assert.doesNotMatch(result.reply, /nausea|side effects/);
});
