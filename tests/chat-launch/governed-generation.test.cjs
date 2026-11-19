'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const gov = backend('./services/chatSourceGovernanceService');
const { assertSentenceSupport } = backend('./services/groundedSentenceService');
const { validateAnswerParagraph, synthesize } = backend('./services/publicAnswerSynthesisService');
const { answer } = backend('./services/contextualChatService');
const { references } = backend('./services/chatReferenceRegistry');
const source = { id: 'synthetic-evidence', key: 'synthetic-key', title: 'Synthetic governance fixture', sourceUrl: 'https://example.invalid/synthetic', version: 'v1', kind: 'HEALTH_REFERENCE', private: false, excerpt: 'This is a synthetic reference. It does not approve insurance claims.' };
const now = Date.parse('2026-11-18T00:00:00Z');
const production = { NODE_ENV: 'production' };
function review(overrides = {}) {
  return { status: 'APPROVED', sourceId: source.id, sourceUrl: source.sourceUrl, version: source.version,
    contentHash: gov.contentHash(source), reviewedBy: 'SYNTHETIC_REVIEWER_A', approvedBy: 'SYNTHETIC_REVIEWER_B',
    reviewedAt: '2026-11-15T00:00:00Z', approvedAt: '2026-11-16T00:00:00Z', nextReviewAt: '2026-12-16T00:00:00Z',
    jurisdiction: 'SYNTHETIC', permittedUse: 'ALLOWED', licenceBasis: 'Synthetic test-only content', supportedAttributes: ['GENERAL'], ...overrides };
}
function evaluate(record, extra = {}) { return gov.evaluateSource(source, { environment: production, rules: { [source.key]: record }, now, ...extra }); }

test('production cannot enable academic medical references through a demo flag', () => {
  assert.equal(gov.sourcePolicy({ NODE_ENV: 'production', CHAT_SOURCE_POLICY: 'ACADEMIC_DEMO' }), 'REVIEWED_ONLY');
  assert.equal(gov.evaluateSource(source, { environment: production, rules: {} }).eligible, false);
  assert.equal(gov.evaluateSource(source, { environment: { NODE_ENV: 'development' }, rules: {} }).status, 'NOT_CLINICALLY_APPROVED');
  assert.equal(gov.sourcePolicy({ NODE_ENV: 'development', CHAT_SOURCE_POLICY: 'INVALID' }), 'REVIEWED_ONLY');
});
test('current bound review record is eligible only within its documented question scope', () => {
  assert.equal(evaluate(review(), { attribute: 'GENERAL' }).eligible, true);
  assert.equal(evaluate(review(), { attribute: 'STORAGE' }).reasonCode, 'QUESTION_OUTSIDE_REVIEW_SCOPE');
});
for (const [label, changed] of [
  ['content', { contentHash: '0'.repeat(64) }], ['version', { version: 'v2' }], ['URL', { sourceUrl: 'https://example.invalid/changed' }],
  ['self-approval', { approvedBy: 'SYNTHETIC_REVIEWER_A' }], ['future approval', { approvedAt: '2027-01-01T00:00:00Z' }],
  ['missing licence', { licenceBasis: '' }], ['unknown permission', { permittedUse: 'UNKNOWN' }], ['missing scope', { supportedAttributes: [] }]
]) test('approval fails closed after ' + label + ' mismatch', () => assert.equal(evaluate(review(changed)).eligible, false));
test('expired and withdrawn sources cannot be used, even in academic mode', () => {
  assert.equal(evaluate(review({ nextReviewAt: '2026-11-17T00:00:00Z' })).status, 'EXPIRED');
  const record = review({ status: 'WITHDRAWN' });
  assert.equal(evaluate(record, { environment: { NODE_ENV: 'development' } }).eligible, false);
  assert.equal(gov.evaluateSource({ ...source, kind: 'PROJECT_GUIDE' }, { rules: { [source.key]: record } }).eligible, false);
});
test('private records never become public approved references; project docs do not claim clinical review', () => {
  assert.equal(gov.evaluateSource({ ...source, private: true }, { rules: {} }).eligible, false);
  assert.equal(gov.evaluateSource({ ...source, kind: 'PROJECT_GUIDE' }, { environment: production, rules: {} }).status, 'FIRST_PARTY_PROJECT_GUIDE');
  const summary = gov.sourceSummary(references, { environment: production });
  assert.equal(summary.currentReviewRecords, 0); assert.equal(summary.mode, 'REVIEWED_ONLY'); assert.ok(summary.blocked > 0);
});
test('complete cited sentences are accepted and original negation is preserved', () => {
  const paragraph = { text: source.excerpt, ids: [source.id] };
  assert.equal(assertSentenceSupport(paragraph, [source]), paragraph);
  assert.doesNotThrow(() => validateAnswerParagraph({ text: source.excerpt, support: [{ sourceId: source.id, quote: source.excerpt }] }, [source]));
});
for (const text of ['This is a verified reference.', 'It approves insurance claims.', 'This is a synthetic reference. Invented outcome.', 'This is a synthetic reference. trailing invented fragment', 'synthetic reference.']) test('fabricated/paraphrased/truncated sentence rejected: ' + text, () => {
  assert.throws(() => assertSentenceSupport({ text, ids: [source.id] }, [source]));
});
test('a real quote cannot support a contradictory paragraph or an unknown citation', () => {
  assert.throws(() => validateAnswerParagraph({ text: 'It approves insurance claims.', support: [{ sourceId: source.id, quote: source.excerpt }] }, [source]));
  assert.throws(() => assertSentenceSupport({ text: source.excerpt, ids: ['unknown'] }, [source]));
  assert.throws(() => assertSentenceSupport({ text: 'This is a synthetic reference.', ids: [source.id] }, [source], [{ sourceId: source.id, quote: 'synthetic reference' }]));
});
test('irrelevant extra citations cannot pad the support list', () => {
  const other = { ...source, id: 'other-source', excerpt: 'Another synthetic fixture covers a different topic.' };
  assert.throws(() => assertSentenceSupport({ text: source.excerpt, ids: [source.id, other.id] }, [source, other]));
});
test('sentence segmentation preserves decimal numbers rather than silently dropping fragments', () => {
  const decimal = { ...source, excerpt: 'The synthetic measurement is 2.5 units. This is a test fixture.' };
  assert.doesNotThrow(() => assertSentenceSupport({ text: decimal.excerpt, ids: [source.id] }, [decimal]));
  assert.throws(() => assertSentenceSupport({ text: 'The synthetic measurement is 5 units.', ids: [source.id] }, [decimal]));
});
function temporaryEnvironment(t, values) {
  const saved = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => Object.entries(saved).forEach(([key, value]) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; }));
}
test('reviewed-only medicine query abstains without web/model egress; project help remains available', async t => {
  temporaryEnvironment(t, { NODE_ENV: 'production', CHAT_SOURCE_POLICY: 'ACADEMIC_DEMO', RAG_CHAT_LLM_ENABLED: 'false' });
  let calls = 0;
  const options = { webSearch: async () => { calls++; throw new Error('Must not replace missing review with web.'); }, fetcher: async () => { calls++; throw new Error('No model.'); } };
  const result = await answer({ message: 'What is Paracetamol used for?' }, options);
  assert.equal(result.mode, 'ABSTAIN'); assert.equal(result.routing.reasonCode, 'REVIEWED_SOURCE_REQUIRED');
  assert.deepEqual(result.sources, []); assert.equal(calls, 0);
  const project = await answer({ message: 'Explain human-in-the-loop validation' }, options);
  assert.equal(project.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.ok(project.sources.every(value => value.reviewStatus === 'FIRST_PARTY_PROJECT_GUIDE'));
});
test('governance also filters the legacy public fallback before retrieval', async t => {
  temporaryEnvironment(t, { NODE_ENV: 'production', RAG_CHAT_LLM_ENABLED: 'false' });
  let candidates;
  // Brand-only queries now clarify before retrieval; retain this separate
  // governance-filter assertion on the explicit-generic legacy identity route.
  await answer({ message: 'What is the generic name of Paracetamol 500 mg Tablet?' }, { retrieve: async (_query, values) => { candidates = values; return { passages: [], method: 'BM25' }; } });
  assert.deepEqual(candidates, []);
});
test('live-adapter simulation validates all output before any sentence is emitted', async t => {
  temporaryEnvironment(t, { NODE_ENV: 'test', CHAT_SOURCE_POLICY: 'ACADEMIC_DEMO', RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', GEMINI_API_KEY: 'synthetic-unused' });
  const passage = references.find(value => value.key === 'human-review');
  let emitted = 0, calls = 0;
  const provider = text => async (_url, options) => {
    calls++; assert.doesNotMatch(options.body, /PRIVATE_MARKER/);
    const output = { paragraphs: [{ text, support: [{ sourceId: 'E1', quote: passage.excerpt }] }] };
    return new Response('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }] }) + '\n\n');
  };
  const context = { topics: [{ label: 'Human-in-the-loop validation' }], style: 'STANDARD', rawHistory: 'PRIVATE_MARKER' };
  await assert.rejects(synthesize({ passages: [passage], context, focus: 'OVERVIEW' }, { fetcher: provider('Human review is unnecessary for this workflow.'), onParagraph: () => { emitted++; } }));
  assert.equal(emitted, 0);
  const result = await synthesize({ passages: [passage], context, focus: 'OVERVIEW' }, { fetcher: provider(passage.excerpt), onParagraph: () => { emitted++; } });
  assert.equal(result.paragraphs.length, 1); assert.equal(calls, 2); assert.equal(emitted, 1);
});
test('unreviewed medical evidence is blocked before provider invocation in production', async t => {
  temporaryEnvironment(t, { NODE_ENV: 'production', RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', GEMINI_API_KEY: 'synthetic-unused' });
  let calls = 0;
  await assert.rejects(synthesize({ passages: [references.find(value => value.key === 'nhs-paracetamol-overview')], context: { topics: [], style: 'STANDARD' }, focus: 'OVERVIEW' }, { fetcher: async () => { calls++; } }));
  assert.equal(calls, 0);
});
