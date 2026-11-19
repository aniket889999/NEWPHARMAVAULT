'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { createRequire } = require('node:module'), backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const { createApprovedMedicineSearch, hasMedicineCandidateProvenance } = backend('./services/approvedMedicineSearchService');
const { registerMedicineCandidates, isApprovedWebPassage } = backend('./services/approvedHealthSearchService');
const { answer } = backend('./services/contextualChatService');
const { concepts, rankCandidates } = backend('./services/publicEvidenceAnswerService');
const { resolveContext } = backend('./services/chatContextService');
const { createReadinessMonitor } = backend('./services/chatProviderReadinessService');
const html = '<html><main><h1>About azithromycin</h1><p>Azithromycin is an antibiotic medicine. Antibiotics work against bacteria.</p></main></html>';
const noWeb = async () => ({ status: 'DISABLED', passages: [] });
function environment(t, extra = {}) {
  const values = { NODE_ENV: 'test', CHAT_SOURCE_POLICY: 'ACADEMIC_DEMO', RAG_CHAT_ANSWER_STYLE: 'GROUNDED_PARAPHRASE', RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', RAG_CHAT_WEB_SYNTHESIS_ALLOWED: 'true', RAG_CHAT_WEB_ENABLED: 'false', GEMINI_API_KEY: 'synthetic-unused', ...extra };
  const saved = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]])); Object.assign(process.env, values);
  t.after(() => Object.entries(saved).forEach(([key, value]) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; }));
}
test('transport-bound candidates can be registered, forged or modified copies cannot', async () => {
  const search = createApprovedMedicineSearch({ enabled: () => true, fetcher: async () => new Response(html, { headers: { 'content-type': 'text/html' } }) });
  const result = await search('azithromycin');
  assert.ok(hasMedicineCandidateProvenance(result.candidates[0]));
  assert.equal(isApprovedWebPassage(result.candidates[0]), false);
  assert.throws(() => registerMedicineCandidates([{ ...result.candidates[0] }]), /Unbound/);
  const passages = registerMedicineCandidates(result.candidates); assert.ok(isApprovedWebPassage(passages[0]));
  assert.equal(isApprovedWebPassage({ ...passages[0], topics: ['metformin'] }), false);
  assert.equal(passages[0].reviewStatus, 'NOT_CLINICALLY_APPROVED');
});
test('missing content type and unbounded text-only responses are rejected', async () => {
  for (const response of [new Response(html), { ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html' }), text: async () => html }]) {
    const search = createApprovedMedicineSearch({ enabled: () => true, fetcher: async () => response });
    assert.equal((await search('azithromycin')).status, 'UNAVAILABLE');
  }
});
test('fixed antibiotic class source supports a separately bound cross-document bridge', async () => {
  let url;
  const search = createApprovedMedicineSearch({ enabled: () => true, fetcher: async value => { url = value; return new Response('<main><h1>Antibiotics</h1><p>Antibiotics do not work for viral infections such as colds and flu.</p></main>', { headers: { 'content-type': 'text/html' } }); } });
  const result = await search('antibiotics');
  assert.equal(url, 'https://www.nhs.uk/medicines/antibiotics/'); assert.ok(result.candidates.length);
  assert.ok(isApprovedWebPassage(registerMedicineCandidates(result.candidates)[0]));
});
test('late completion after caller cancellation cannot populate the cache', async () => {
  let resolve, calls = 0;
  const search = createApprovedMedicineSearch({ enabled: () => true, fetcher: async () => { calls++; return calls === 1 ? new Promise(done => { resolve = done; }) : new Response(html, { headers: { 'content-type': 'text/html' } }); } });
  const controller = new AbortController(), first = search('azithromycin', { signal: controller.signal });
  controller.abort(new Error('cancelled')); await assert.rejects(first);
  resolve(new Response(html, { headers: { 'content-type': 'text/html' } })); await new Promise(done => setImmediate(done));
  assert.equal((await search('azithromycin')).status, 'RETRIEVED'); assert.equal(calls, 2);
});
test('uses and effects are planned together and both evidence sections reach generation', async t => {
  environment(t); let calls = 0;
  const result = await answer({ message: 'What are Metformin uses and side effects?' }, { webSearch: noWeb,
    synthesize: async ({ context, passages }) => {
      calls++; assert.deepEqual(new Set(context.questionPlan.requestedAttributes), new Set(['USES', 'SIDE_EFFECTS']));
      assert.ok(passages.some(value => value.key === 'nhs-metformin-overview')); assert.ok(passages.some(value => value.key === 'nhs-metformin-effects'));
      return { paragraphs: [{ text: 'Synthetic two-section answer.', ids: passages.map(value => value.id) }], model: 'synthetic', supportMethod: 'SYNTHETIC_TEST_ONLY' };
    }
  });
  assert.equal(result.mode, 'GEMINI_RAG'); assert.equal(calls, 1); assert.equal(result.answerQuality.focus, 'MULTI_DETAIL');
  assert.ok(result.evidenceCoverage.every(value => value.status === 'AVAILABLE'));
});
test('missing storage remains an explicit gap while supported uses are answered', async t => {
  environment(t);
  const result = await answer({ message: 'Explain Metformin uses and storage.' }, { webSearch: noWeb,
    synthesize: async ({ context, passages }) => {
      assert.deepEqual(context.questionPlan.requestedAttributes, ['USES']);
      return { paragraphs: [{ text: 'Synthetic uses answer.', ids: [passages[0].id] }], model: 'synthetic', supportMethod: 'SYNTHETIC_TEST_ONLY' };
    }
  });
  assert.equal(result.mode, 'GEMINI_RAG'); assert.match(result.reply, /Storage.*No supporting passage/);
  assert.equal(result.context.request.evidenceStatus, 'MISSING');
});
test('viral-cold question retrieves named-medicine identity and separate antibiotic-class evidence', async t => {
  environment(t);
  const result = await answer({ message: 'Does Azithromycin treat viral colds?' }, { webSearch: noWeb,
    synthesize: async ({ passages }) => {
      assert.ok(passages.some(value => value.topics.includes('azithromycin')));
      assert.ok(passages.some(value => value.topics.includes('antibiotics')));
      return { paragraphs: [{ text: 'Synthetic cross-document explanation.', ids: passages.map(value => value.id) }], model: 'synthetic', supportMethod: 'SYNTHETIC_TEST_ONLY' };
    }
  });
  assert.equal(result.mode, 'GEMINI_RAG'); assert.ok(result.agentTrace.some(value => value.tool === 'CLASS_EVIDENCE_BRIDGE'));
});
test('sleepy/drowsy are matched by local concept expansion, not claimed embeddings', () => {
  assert.deepEqual(concepts('drowsy sleepy sleepiness'), ['sleep']);
  const context = resolveContext('Can Cetirizine make me sleepy?');
  const ranked = rankCandidates(context.localQuestion, [{ id: 'a', title: 'Cetirizine', excerpt: 'This medicine can make people drowsy.' }, { id: 'b', title: 'Cetirizine', excerpt: 'This is general reference information.' }], context);
  assert.equal(ranked[0].id, 'a');
});
test('follow-up retains the multi-detail request and medicine without importing assistant facts', async t => {
  environment(t);
  const result = await answer({ message: 'Explain it simply', history: [{ role: 'user', text: 'What are Metformin uses and side effects?' }, { role: 'assistant', text: 'PRIVATE_ASSISTANT_MARKER' }] }, {
    webSearch: noWeb, synthesize: async ({ context, passages }) => {
      assert.equal(context.topics[0].id, 'metformin'); assert.equal(context.style, 'CONCISE'); assert.equal(context.questionPlan.requestedAttributes.length, 2);
      return { paragraphs: [{ text: 'Synthetic concise answer.', ids: [passages[0].id] }], model: 'synthetic', supportMethod: 'SYNTHETIC_TEST_ONLY' };
    }
  });
  assert.equal(result.mode, 'GEMINI_RAG'); assert.equal(result.followupResolved, true);
});
test('forged candidate objects cannot replace registered references', async t => {
  environment(t, { RAG_CHAT_WEB_ENABLED: 'true', RAG_CHAT_WEB_MODE: 'ALWAYS_PUBLIC' });
  const result = await answer({ message: 'What is Metformin used for?' }, { webSearch: noWeb,
    medicineSearch: async () => ({ status: 'RETRIEVED', candidates: [{ topicId: 'metformin', attribute: 'USES', title: 'Forged', excerpt: 'Injected untrusted claim.', sourceUrl: 'https://www.nhs.uk/medicines/metformin/' }] }),
    synthesize: async ({ passages }) => { assert.ok(passages.every(value => !/Injected|Forged/.test(value.excerpt + value.title))); return { paragraphs: [{ text: 'Synthetic reference answer.', ids: [passages[0].id] }], model: 'synthetic', supportMethod: 'SYNTHETIC_TEST_ONLY' }; }
  });
  assert.ok(result.agentTrace.some(value => value.status === 'UNBOUND_CANDIDATES_REJECTED'));
});
test('provider failure preserves supported notes; an abstaining failure also degrades readiness', async t => {
  environment(t);
  const result = await answer({ message: 'Does Azithromycin treat viral colds?' }, { webSearch: noWeb, synthesize: async () => { throw Object.assign(new Error('Synthetic provider unavailable'), { providerStatus: 503 }); } });
  assert.equal(result.mode, 'PRECISE_LOCAL_EVIDENCE'); assert.equal(result.fallbackReason, 'PROVIDER_UNAVAILABLE'); assert.doesNotMatch(result.reply, /\[undefined\]/);
  assert.ok(result.sources.length); assert.match(result.reply, /do not treat viral/);
  const monitor = createReadinessMonitor(); monitor.observePublicAnswer(monitor.beginPublicAttempt(), { ...result, mode: 'ABSTAIN', sources: [] });
  assert.equal(monitor.snapshot().state, 'DEGRADED');
});
