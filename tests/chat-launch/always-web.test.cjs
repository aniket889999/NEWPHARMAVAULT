'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { createRequire } = require('node:module'), backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const { answer } = backend('./services/contextualChatService');
const { parseResults, webLookupPolicy } = backend('./services/approvedHealthSearchService');
Object.assign(process.env, { NODE_ENV: 'test', CHAT_SOURCE_POLICY: 'ACADEMIC_DEMO', RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_WEB_ENABLED: 'true', RAG_CHAT_WEB_MODE: 'ALWAYS_PUBLIC' });
const fixture = () => parseResults('<nlmSearchResult><list><document url="https://medlineplus.gov/antibioticresistance.html"><content name="title">Antibiotic resistance synthetic fixture</content><content name="FullSummary">Antibiotic resistance is the topic of this synthetic transport fixture. This is not clinical advice and contains no medical reference labels.</content></document></list></nlmSearchResult>', { webTerm: 'antibiotic resistance' }, new Date().toISOString());
test('a small official result needs an exact registered phrase, not scattered query words', () => {
  assert.equal(fixture().length, 1);
  const unrelated = '<nlmSearchResult><list><document url="https://medlineplus.gov/synthetic.html"><content name="title">Synthetic unrelated fixture</content><content name="FullSummary">Medicine is a word in this synthetic fixture with many unrelated filler words before storage. No clinical assertions are provided here.</content></document></list></nlmSearchResult>';
  assert.equal(parseResults(unrelated, { webTerm: 'medicine storage' }, new Date().toISOString()).length, 0);
});
test('eligible public question checks web even when a local answer exists', async () => {
  let calls = 0;
  const result = await answer({ message: 'What is Paracetamol used for?' }, { webSearch: async topic => { calls++; assert.equal(topic, 'paracetamol'); return { status: 'NO_RELEVANT_EVIDENCE', passages: [] }; } });
  assert.equal(calls, 1); assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.equal(result.webLookup.usedInAnswer, false);
});
test('supporting official evidence is cited, attributed and honestly labelled', async () => {
  const result = await answer({ message: 'What is antibiotic resistance?' }, { webSearch: async () => ({ status: 'RETRIEVED', passages: fixture() }) });
  assert.equal(result.mode, 'PRECISE_WEB_EVIDENCE'); assert.equal(result.webLookup.usedInAnswer, true);
  assert.match(result.sources[0].attribution, /MedlinePlus/); assert.equal(result.sources[0].reviewStatus, 'NOT_CLINICALLY_APPROVED');
});
test('an unrelated official page cannot replace a supported medicine answer', async () => {
  const result = await answer({ message: 'What is Metformin used for?' }, { webSearch: async () => ({ status: 'RETRIEVED', passages: fixture() }) });
  assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.equal(result.webLookup.relevantSources, 0); assert.equal(result.webLookup.usedInAnswer, false);
});
test('safety, personal/private/unknown/off-topic and project questions never search publicly', async () => {
  let calls = 0;
  const options = { webSearch: async () => { calls++; throw new Error('Must not search.'); }, localAnswer: async () => ({ mode: 'LOCAL_CASE_EVIDENCE', reply: 'Synthetic local-case fixture', sources: [] }) };
  for (const input of [{ message: 'I cannot breathe' }, { message: 'Can I take Metformin while pregnant?' }, { message: 'Why is my invoice different?' }, { message: 'What is UnknownDrug used for?' }, { message: 'Write a Python poem' }, { message: 'Explain human-in-the-loop validation' }, { message: 'Explain Metformin', caseId: '650000000000000000000001' }]) await answer(input, options);
  assert.equal(calls, 0);
});
test('fallback mode keeps its existing local-first behaviour', async t => {
  process.env.RAG_CHAT_WEB_MODE = 'FALLBACK'; t.after(() => { process.env.RAG_CHAT_WEB_MODE = 'ALWAYS_PUBLIC'; });
  let calls = 0; const result = await answer({ message: 'What is Paracetamol used for?' }, { webSearch: async () => { calls++; } });
  assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.equal(calls, 0); assert.equal(webLookupPolicy(), 'FALLBACK');
});
test('production lookup does not manufacture clinical review approval', async t => {
  process.env.NODE_ENV = 'production'; t.after(() => { process.env.NODE_ENV = 'test'; });
  const result = await answer({ message: 'What is antibiotic resistance?' }, { webSearch: async () => ({ status: 'RETRIEVED', passages: fixture() }) });
  assert.equal(result.mode, 'ABSTAIN'); assert.equal(result.webLookup.status, 'SOURCE_REVIEW_REQUIRED'); assert.equal(result.webLookup.usedInAnswer, false); assert.deepEqual(result.sources, []);
});
test('web outages preserve local evidence and are visible rather than falsely called web answers', async () => {
  const result = await answer({ message: 'What is Paracetamol used for?' }, { webSearch: async () => { throw new Error('Synthetic outage'); } });
  assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.equal(result.webLookup.status, 'UNAVAILABLE'); assert.equal(result.webLookup.usedInAnswer, false);
});
test('missing exact evidence performs one lookup, never a duplicate request or unrelated answer', async () => {
  let calls = 0;
  const result = await answer({ message: 'How should I store Paracetamol?' }, { webSearch: async () => { calls++; return { status: 'CACHED', passages: fixture() }; } });
  assert.equal(calls, 1); assert.equal(result.mode, 'ABSTAIN'); assert.equal(result.webLookup.usedInAnswer, false); assert.doesNotMatch(result.reply, /relieve pain|synthetic transport fixture/);
});
