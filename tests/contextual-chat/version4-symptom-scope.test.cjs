'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
Object.assign(process.env, { NODE_ENV: 'test', CHAT_SOURCE_POLICY: 'ACADEMIC_DEMO', RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_EMBEDDINGS_ENABLED: 'false', RAG_CHAT_WEB_ENABLED: 'true', RAG_CHAT_WEB_MODE: 'ALWAYS_PUBLIC' });
const { answer } = backend('./services/contextualChatService');
const { resolveContext } = backend('./services/chatContextService');
const { supportsRequest } = backend('./services/chatQuestionService');
const { parseResults } = backend('./services/approvedHealthSearchService');
const registry = backend('./data/chatTopicRegistry');
const xmlDocument = (slug, title, text) => '<document url="https://medlineplus.gov/' + slug + '.html"><content name="title">' + title + '</content><content name="FullSummary">' + text + '</content></document>';
const fixture = () => parseResults('<nlmSearchResult><list>'
  + xmlDocument('fever', 'Fever', 'A fever is a synthetic definition fixture, not medical advice. Your provider may recommend a synthetic medicine; this sentence is a scope-test distractor. A fever is not a disease in this synthetic test fixture.')
  + xmlDocument('hemorrhagicfevers', 'Hemorrhagic Fevers', 'Hemorrhagic fevers are a synthetic related-topic distractor containing the word fever. This fixture must not define the selected general topic.')
  + '</list></nlmSearchResult>', registry.find(value => value.id === 'fever'), new Date().toISOString());

test('v4 general symptom topics reject related disease pages even when their body mentions the topic', () => {
  for (const topic of registry.filter(value => value.strictWebTopic)) {
    const context = resolveContext('What is ' + topic.aliases[0] + '?');
    const source = { kind: 'OFFICIAL_WEB', title: 'MedlinePlus: Other condition', excerpt: topic.label + ' is mentioned in this synthetic unrelated condition fixture.' };
    assert.equal(supportsRequest(source, context), false, topic.id);
    assert.equal(supportsRequest({ ...source, title: 'MedlinePlus: ' + topic.aliases[0] }, context), true, topic.id);
  }
});

test('v4 a definition answer cites the matching page without disease drift or treatment distractors', async () => {
  let calls = 0;
  const result = await answer({ message: 'What is fever?' }, { webSearch: async topic => { calls++; assert.equal(topic, 'fever'); return { status: 'RETRIEVED', passages: fixture() }; } });
  assert.equal(result.mode, 'PRECISE_WEB_EVIDENCE'); assert.equal(calls, 1);
  assert.equal(result.sources.length, 1); assert.equal(result.sources[0].sourceUrl, 'https://medlineplus.gov/fever.html');
  assert.match(result.reply, /synthetic definition fixture/);
  assert.doesNotMatch(result.reply, /Hemorrhagic|provider may recommend|scope-test distractor/);
});

test('v4 a related page alone leaves an explicit gap rather than an answer about another condition', async () => {
  const result = await answer({ message: 'What is fever?' }, { webSearch: async () => ({ status: 'RETRIEVED', passages: fixture().filter(value => value.sourceUrl.endsWith('/hemorrhagicfevers.html')) }) });
  assert.equal(result.mode, 'ABSTAIN'); assert.equal(result.webLookup.usedInAnswer, false); assert.deepEqual(result.sources, []);
});

test('v4 fever treatment requests still refer before any public lookup', async () => {
  const result = await answer({ message: 'Recommend the best medicine for my fever' }, { webSearch: async () => { throw Error('Personal treatment request must not search publicly'); } });
  assert.equal(result.mode, 'ABSTAIN'); assert.equal(result.routing.reasonCode, 'PERSONAL_OR_UNVERIFIED_DECISION'); assert.deepEqual(result.sources, []);
});
