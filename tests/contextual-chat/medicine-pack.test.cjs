'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
Object.assign(process.env, { NODE_ENV: 'test', CHAT_SOURCE_POLICY: 'ACADEMIC_DEMO', RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_EMBEDDINGS_ENABLED: 'false', RAG_CHAT_WEB_ENABLED: 'false' });
const pack = backend('./data/chatMedicineEvidence.v1.json');
const { passages, buildMedicineEvidencePack } = backend('./services/medicineEvidencePackService');
const { references, isKnownPublic } = backend('./services/chatReferenceRegistry');
const { answer } = backend('./services/contextualChatService');
const { evaluateSource } = backend('./services/chatSourceGovernanceService');
const noWeb = async () => ({ status: 'DISABLED', passages: [] });
const facts = {
  ibuprofen: { USES: /pain|fever/i, SIDE_EFFECTS: /nausea|headache/i },
  atorvastatin: { USES: /cholesterol/i, SIDE_EFFECTS: /muscle aches/i },
  losartan: { USES: /high blood pressure/i, SIDE_EFFECTS: /dizziness/i },
  omeprazole: { USES: /heartburn|reflux/i, SIDE_EFFECTS: /headache/i },
  pantoprazole: { USES: /heartburn|reflux/i, SIDE_EFFECTS: /uncommon side effects/i },
  azithromycin: { USES: /bacterial infections/i, SIDE_EFFECTS: /nausea/i }
};

test('bounded runtime pack has twelve immutable source-bound records and no runtime dependency on Gemini docs', () => {
  assert.equal(passages.length, 12);
  assert.ok(Object.isFrozen(passages));
  for (const source of passages) {
    assert.ok(Object.isFrozen(source));
    assert.equal(source.private, false);
    assert.equal(source.jurisdiction, 'UK');
    assert.equal(source.checkedAt, '2026-11-18');
    assert.equal(source.reviewStatus, 'ACADEMIC_SOURCE_CHECKED_NOT_CLINICAL_APPROVAL');
    assert.ok(isKnownPublic(source));
    assert.equal(isKnownPublic({ ...source, sourceUrl: 'https://example.com/' }), false);
    assert.equal(isKnownPublic({ ...source, excerpt: 'Unreviewed replacement.' }), false);
    assert.ok(references.some(value => value.id === source.id));
  }
});

test('malformed, duplicated and off-domain preparation cannot be loaded as the curated pack', () => {
  for (const mutate of [
    value => { value.records[0].sourceUrl = 'https://www.nhs.uk.evil.example/medicines/ibuprofen/'; },
    value => { value.records[0].sourceUrl = 'https://www.nhs.uk/medicines/losartan/'; },
    value => { value.records[0].attribute = 'DOSING'; },
    value => { value.records[1] = value.records[0]; },
    value => { value.records[0].text = 'long '.repeat(91); },
    value => { value.reviewStatus = 'CLINICALLY_APPROVED'; }
  ]) {
    const changed = structuredClone(pack); mutate(changed);
    assert.throws(() => buildMedicineEvidencePack(changed), /Invalid academic/);
  }
});

for (const [topic, attributes] of Object.entries(facts)) for (const [attribute, pattern] of Object.entries(attributes)) {
  test(topic + ' ' + attribute + ' retrieves a directly attributed local section without provider/web calls', async () => {
    let calls = 0;
    const message = attribute === 'USES' ? 'What is ' + topic + ' used for?' : 'What are ' + topic + ' side effects?';
    const result = await answer({ message }, { webSearch: async () => { calls++; throw Error('Local evidence should suffice.'); }, fetcher: async () => { calls++; throw Error('No provider call allowed.'); } });
    assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE');
    assert.match(result.reply, pattern);
    assert.equal(result.sources.length, 1);
    assert.match(result.reply, /\[S1\]/);
    assert.equal(result.sources[0].sourceUrl, passages.find(value => value.topics[0] === topic && value.supportedAttributes[0] === attribute).sourceUrl);
    assert.match(result.sources[0].version, /source checked 2026-11-18/);
    assert.equal(result.sources[0].reviewStatus, 'NOT_CLINICALLY_APPROVED');
    assert.equal(calls, 0);
  });
}

test('new evidence is academic only and remains blocked in reviewed-only/production mode', async t => {
  for (const source of passages) {
    assert.equal(evaluateSource(source, { environment: { NODE_ENV: 'production', CHAT_SOURCE_POLICY: 'ACADEMIC_DEMO' } }).eligible, false);
  }
  const previous = process.env.CHAT_SOURCE_POLICY;
  t.after(() => { process.env.CHAT_SOURCE_POLICY = previous; });
  process.env.CHAT_SOURCE_POLICY = 'REVIEWED_ONLY';
  const result = await answer({ message: 'What is Losartan used for?' }, { webSearch: async () => { throw Error('Unreviewed web cannot bypass policy.'); } });
  assert.equal(result.mode, 'ABSTAIN'); assert.equal(result.sources.length, 0);
});

test('coverage expansion does not invent a temperature or permit individual treatment decisions', async () => {
  const storage = await answer({ message: 'What exact temperature should I store Losartan at?' }, { webSearch: noWeb });
  assert.equal(storage.mode, 'ABSTAIN'); assert.equal(storage.sources.length, 0);
  for (const message of ['Can I take Losartan while pregnant?', 'How many Azithromycin tablets should I take?', 'I have chest pain after Atorvastatin.']) {
    let calls = 0;
    const result = await answer({ message }, { webSearch: async () => { calls++; } });
    assert.ok(['ABSTAIN', 'SAFETY'].includes(result.mode));
    assert.equal(result.sources.length, 0); assert.equal(calls, 0);
  }
});
