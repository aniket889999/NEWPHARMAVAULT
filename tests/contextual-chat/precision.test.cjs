const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { createRequire } = require('node:module'), backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const { references, corpusHash } = backend('./services/chatReferenceRegistry');
const { trainCandidate } = backend('./scripts/trainPrecisionRanker');
const { retrievePrecise } = backend('./services/preciseAnswerService');
const { resolveContext } = backend('./services/chatContextService');
const { answer } = backend('./services/contextualChatService');
const { synthesize, validateAnswerParagraph } = backend('./services/publicAnswerSynthesisService');
const artifact = backend('./data/precisionRanker.v1.json');
test('historical ranker reproduces on its original corpus and is not relabelled trained for the expanded corpus', () => {
  const originalSources = references.filter(value => !value.key.startsWith('academic-'));
  const trained = trainCandidate({ sources: originalSources }); assert.deepEqual(trained.weights, artifact.weights); assert.equal(trained.corpusHash, artifact.corpusHash); assert.notEqual(trained.corpusHash, corpusHash); assert.equal(trained.trainingQueries, 42); assert.equal(trained.pairCount, 966); assert.ok(trained.lossAfter < trained.lossBefore); assert.match(trained.kind, /NOT_LLM/);
});
test('source registry versions and current routing guide replace stale project claims', () => {
  assert.ok(references.every(value => value.id && value.version && value.private === false)); assert.ok(!references.some(value => value.key === 'rag')); assert.ok(references.some(value => value.key === 'project-routing-current-v2'));
});
for (const [message, key] of [['What is antibiotic resistance?', 'reference-antibiotic-resistance-definition'], ['How to prevent antibiotic resistance?', 'reference-antibiotic-resistance-prevention'], ['What are Metformin side effects?', 'nhs-metformin-effects'], ['What is Paracetamol used for?', 'nhs-paracetamol-overview'], ['What is answer freshness?', 'project-answer-freshness-v2']]) test('focused ranking: ' + message, () => {
  const context = resolveContext(message); const result = retrievePrecise(context.localQuestion, context); assert.equal(result.trained, false); assert.equal(result.passages[0].key, key);
});
test('short follow-up retains side-effect focus and includes an important safety qualification', async () => {
  const result = await answer({ message: 'Explain it more simply', history: [{ role: 'user', text: 'What are Metformin side effects?' }] });
  assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.equal(result.answerQuality.focus, 'SIDE_EFFECTS'); assert.ok(result.answerQuality.words <= 90); assert.match(result.reply, /serious|urgent|severe|not a complete/i); assert.doesNotMatch(result.reply, /Paracetamol|Atorvastatin/); assert.equal(result.sources[0].title, 'Metformin: possible side effects');
});
test('unknown or personalized questions never become invented precise answers', async () => {
  for (const message of ['Can I take Ibuprofen while pregnant?', 'What dose should I take?', 'I have chest pain']) { const result = await answer({ message, history: [] }, { webSearch: async () => { throw new Error('must not call web'); } }); assert.ok(['ABSTAIN', 'SAFETY'].includes(result.mode)); }
});
test('public synthesis exports only registered evidence and fixed topic/focus, not raw history', async t => {
  const saved = { ...process.env }; t.after(() => { for (const key of ['RAG_CHAT_LLM_ENABLED', 'RAG_CHAT_PUBLIC_EXPORT_ALLOWED', 'GEMINI_API_KEY']) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });
  Object.assign(process.env, { RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', GEMINI_API_KEY: 'synthetic-unused' });
  const passage = references.find(value => value.key === 'human-review'); let calls = 0;
  // The launch support contract now requires complete source sentences rather
  // than treating a real quotation as proof of an arbitrary paraphrase.
  const generated = { paragraphs: [{ text: passage.excerpt, support: [{ sourceId: 'E1', quote: passage.excerpt }] }] };
  const result = await synthesize({ passages: [passage], context: { topics: [{ label: 'Human-in-the-loop validation' }], style: 'CONCISE', rawHistory: 'PRIVATE_MARKER' }, focus: 'DEFINITION' }, { fetcher: async (url, options) => { calls++; const body = JSON.parse(options.body); assert.match(url, /:streamGenerateContent/); assert.equal(body.generationConfig.maxOutputTokens, 1024); assert.doesNotMatch(options.body, /PRIVATE_MARKER/); return new Response('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }] }) + '\n\n'); } });
  assert.equal(calls, 1); assert.equal(result.paragraphs.length, 1);
  await assert.rejects(synthesize({ passages: [{ ...passage, excerpt: 'PRIVATE_MARKER' }], context: { topics: [], style: 'CONCISE' }, focus: 'OVERVIEW' }, { fetcher: async () => { calls++; } })); assert.equal(calls, 1);
});
test('unsupported numbers, guarantees and fabricated quotations fail validation', () => {
  const passage = references.find(value => value.key === 'human-review');
  const make = text => ({ text, support: [{ sourceId: passage.id, quote: passage.excerpt }] });
  assert.throws(() => validateAnswerParagraph(make('The system guarantees medical safety.'), [passage]));
  assert.throws(() => validateAnswerParagraph(make('The system approves 99 claims.'), [passage]));
  assert.throws(() => validateAnswerParagraph({ text: 'A reviewer checks the evidence.', support: [{ sourceId: passage.id, quote: 'Invented quote without support' }] }, [passage]));
});
test('current context-scoped retrieval discloses its strong-baseline tie and inactive historical ranker', () => {
  const result = backend('./scripts/evaluatePrecision').evaluate();
  assert.deepEqual(result.totals.bareBM25, { correct: 11, total: 16 });
  assert.deepEqual(result.totals.ruleScopedBM25, { correct: 16, total: 16 });
  assert.deepEqual(result.totals.currentContext, { correct: 16, total: 16 }); assert.equal(result.trainedRerankerActive, false);
  assert.equal(result.canClaimSuperiority, false); assert.equal(result.externalComparators.GPT, 'NOT_RUN'); assert.deepEqual(result.ruleRegressions, []);
});
test('unvalidated generated text never streams and falls back to source-supported notes', async t => {
  const names = ['RAG_CHAT_LLM_ENABLED', 'RAG_CHAT_PUBLIC_EXPORT_ALLOWED', 'GEMINI_API_KEY']; const saved = names.map(name => process.env[name]);
  t.after(() => names.forEach((name, index) => { if (saved[index] === undefined) delete process.env[name]; else process.env[name] = saved[index]; }));
  Object.assign(process.env, { RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', GEMINI_API_KEY: 'synthetic-unused' });
  const events = []; let calls = 0;
  const result = await answer({ message: 'Explain human-in-the-loop validation' }, { emit: (event, value) => events.push({ event, value }), fetcher: async () => {
    calls++; return new Response('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ paragraphs: [{ text: 'The system approves 99 claims with guaranteed safety.', support: [{ sourceId: 'E1', quote: 'Invented quotation without support' }] }] }) }] } }] }) + '\n\n');
  } });
  assert.equal(calls, 1); assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.equal(result.fallbackReason, 'ANSWER_VALIDATION_FAILED');
  assert.equal(events.filter(value => value.event === 'delta').length, 0); assert.ok(events.some(value => value.event === 'reset')); assert.doesNotMatch(result.reply, /99|guaranteed/);
});
