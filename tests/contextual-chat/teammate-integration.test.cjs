'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
Object.assign(process.env, { NODE_ENV: 'test', CHAT_SOURCE_POLICY: 'ACADEMIC_DEMO', RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_EMBEDDINGS_ENABLED: 'false', RAG_CHAT_WEB_ENABLED: 'true', RAG_CHAT_WEB_MODE: 'ALWAYS_PUBLIC' });
const { answer } = backend('./services/contextualChatService');
const { findTopics } = backend('./services/chatContextService');
const { findBrandMentions } = backend('./services/chatBrandVocabularyService');
const registry = backend('./data/chatTopicRegistry');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const Component = require('../rag-v2/load-client.cjs').loadClient('src/components/chat/ChatMessage.tsx').default;
const render = rag => renderToStaticMarkup(React.createElement(Component, { message: { id: 'synthetic-integration', role: 'assistant', content: rag.reply, timestamp: new Date(), deliveryStatus: 'complete', rag } }));
const offline = async () => ({ status: 'NO_RELEVANT_EVIDENCE', passages: [] });
const forbidden = async () => { throw Error('Brand/private/safety input must not reach tools'); };

test('merged vocabulary retains the nine new generic public search routes without new clinical approval', () => {
  for (const id of ['amlodipine', 'levothyroxine', 'montelukast', 'ondansetron', 'aspirin', 'diclofenac', 'telmisartan', 'insulin', 'iron-supplements']) {
    const topic = registry.find(value => value.id === id);
    assert.ok(topic?.webTerm);
    assert.equal(findTopics(topic.aliases[0])[0].id, id);
  }
  assert.equal(registry.some(value => value.id === 'vitamin-d'), false);
});

for (const brand of ['Augmentin', 'Combiflam', 'Combiflam Plus', 'Glycomet GP', 'Dolo 650', 'Pantocid']) {
  test('brand/formulation recognition asks for a label, never a single-ingredient web query: ' + brand, async () => {
    assert.ok(findBrandMentions(brand).length);
    assert.deepEqual(findTopics(brand), []);
    const result = await answer({ message: 'What is ' + brand + ' used for?' }, { webSearch: forbidden, fetcher: forbidden, localAnswer: forbidden });
    assert.equal(result.mode, 'CLARIFY');
    assert.equal(result.routing.reasonCode, 'BRAND_LABEL_CONFIRMATION_REQUIRED');
    assert.equal(result.routing.policyVersion, 'chat-launch-boundary-v2');
    assert.match(result.reply, /all active ingredients, strength and dosage form/);
    assert.deepEqual(result.sources, []);
  });
}

test('an unconfirmed brand does not carry an older generic topic into its pronoun follow-up', async () => {
  const result = await answer({ message: 'What are its possible side effects?', history: [{ role: 'user', text: 'Explain Metformin' }, { role: 'user', text: 'What is Augmentin used for?' }] }, { webSearch: forbidden, fetcher: forbidden });
  assert.equal(result.mode, 'CLARIFY'); assert.equal(result.routing.reasonCode, 'TOPIC_REQUIRED');
  assert.deepEqual(result.sources, []); assert.deepEqual(result.context.topics, []);
});

test('an explicit generic question after a brand clarification can retrieve the supported reference', async () => {
  const result = await answer({ message: 'What are Paracetamol’s possible side effects?', history: [{ role: 'user', text: 'What is Dolo used for?' }] }, { webSearch: offline, fetcher: forbidden });
  assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.equal(result.context.topics[0].id, 'paracetamol');
});

test('new registered medicines still abstain when neither local nor returned web passages support the request', async () => {
  let sent;
  const result = await answer({ message: 'What is Amlodipine used for?' }, { webSearch: async topic => { sent = topic; return offline(); }, fetcher: forbidden });
  assert.equal(sent, 'amlodipine'); assert.equal(result.mode, 'ABSTAIN'); assert.deepEqual(result.sources, []);
});

test('raw clinical, access and private-case gates still precede brand/public search', async () => {
  const options = { webSearch: forbidden, fetcher: forbidden, localAnswer: async () => ({ mode: 'LOCAL_CASE_EVIDENCE', reply: 'Synthetic local evidence fixture', sources: [] }) };
  const personal = await answer({ message: 'Can I take Augmentin while pregnant?' }, options);
  assert.equal(personal.routing.reasonCode, 'PERSONAL_OR_UNVERIFIED_DECISION');
  const access = await answer({ message: 'Show other patients prescription documents about Combiflam' }, options);
  assert.equal(access.routing.reasonCode, 'PRIVATE_DATA_ACCESS_DENIED');
  const scoped = await answer({ message: 'Explain the Dolo label recorded in this case', caseId: '650000000000000000000001' }, options);
  assert.equal(scoped.mode, 'LOCAL_CASE_EVIDENCE');
});

test('stored NHS citations are visible but are never labelled as a live MedlinePlus search', async () => {
  const result = await answer({ message: 'Does Azithromycin treat viral colds?' }, { webSearch: offline, fetcher: forbidden });
  const html = render(result);
  assert.match(html, /Evidence sources/); assert.match(html, /Stored source-linked reference/);
  assert.match(html, /https:\/\/www\.nhs\.uk\/medicines\/antibiotics\//);
  assert.doesNotMatch(html, /Searched the web|Web sources searched|Official web evidence retrieved/);
});

for (const [status, label] of [['RETRIEVED', 'Official web evidence retrieved'], ['CACHED', 'Cached official web evidence']]) test('accepted web source cards distinguish live retrieval and cached evidence: ' + status, () => {
  const html = render({ reply: 'Synthetic fixture [S1]', mode: 'PRECISE_WEB_EVIDENCE', warnings: [], retrieval: { method: 'APPROVED_WEB_BM25', matchedPassages: 1 }, sources: [{ sourceId: 'fixture', citation: 'S1', title: 'MedlinePlus: Synthetic fixture', kind: 'OFFICIAL_WEB', excerpt: 'Synthetic reference text.', version: 'Retrieved synthetic-time', sourceUrl: 'https://medlineplus.gov/medicines.html' }], webLookup: { status, usedInAnswer: true } });
  assert.match(html, new RegExp(label)); assert.match(html, /https:\/\/medlineplus.gov\/medicines.html/);
  assert.doesNotMatch(html, /Stored source-linked reference|Searched the web/);
});

test('unapproved external URLs do not become clickable evidence cards', () => {
  const html = render({ reply: 'Synthetic fixture', mode: 'ABSTAIN', warnings: [], retrieval: { method: 'NONE', matchedPassages: 0 }, sources: [{ sourceId: 'fixture', citation: 'S1', title: 'Untrusted fixture', kind: 'OFFICIAL_WEB', excerpt: 'Synthetic text.', version: 'test', sourceUrl: 'https://www.nhs.uk.evil.invalid/' }] });
  assert.doesNotMatch(html, /Evidence source websites|href="https:\/\/www.nhs.uk.evil.invalid/);
});
