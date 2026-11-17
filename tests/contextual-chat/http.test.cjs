'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), crypto = require('node:crypto');
const { createRequire } = require('node:module'), backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
test('contextual chat actual protected HTTP and review-only feedback', async t => {
  const keys = ['NODE_ENV', 'MONGO_URI', 'JWT_SECRET', 'GEMINI_API_KEY', 'RAG_CHAT_LLM_ENABLED', 'RAG_CHAT_PUBLIC_EXPORT_ALLOWED', 'RAG_CHAT_EMBEDDINGS_ENABLED', 'RAG_CHAT_WEB_ENABLED'];
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]])), oldFetch = global.fetch;
  Object.assign(process.env, { NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/pharmavault_smoke_test', JWT_SECRET: crypto.randomBytes(32).toString('hex'), GEMINI_API_KEY: 'synthetic-unused', RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'false', RAG_CHAT_EMBEDDINGS_ENABLED: 'false', RAG_CHAT_WEB_ENABLED: 'true' });
  const mongoose = backend('mongoose'), request = backend('supertest'), jwt = backend('jsonwebtoken');
  const { assertTestDatabase } = backend('./utils/testDatabaseGuard'); const app = backend('./app');
  const User = backend('./models/userModel'), Org = backend('./models/organizationModel'), Case = backend('./models/verificationCaseModel'), Feedback = backend('./models/chatFeedbackModel');
  const ids = [], orgs = [], cases = []; let calls = 0, connected = false, receipt;
  t.after(async () => {
    global.fetch = oldFetch;
    if (connected) { assertTestDatabase(mongoose.connection); await Feedback.deleteMany({ user: { $in: ids } }); await Case.deleteMany({ _id: { $in: cases } }); await User.deleteMany({ _id: { $in: ids } }); await Org.deleteMany({ _id: { $in: orgs } }); await mongoose.disconnect(); }
    for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  });
  assertTestDatabase(process.env.MONGO_URI); await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 }); connected = true; assertTestDatabase(mongoose.connection);
  const run = crypto.randomUUID();
  for (let i = 0; i < 2; i++) { const org = await Org.create({ name: 'Synthetic contextual chat ' + run + i, owner: new mongoose.Types.ObjectId() }); orgs.push(org._id); const user = await User.create({ name: 'Synthetic contextual user', email: run + i + '@example.invalid', password: crypto.randomUUID(), role: 'patient', organizationId: org._id }); ids.push(user._id); }
  const token = index => 'Bearer ' + jwt.sign({ id: String(ids[index]) }, process.env.JWT_SECRET, { expiresIn: '5m' });
  global.fetch = async (url, options) => {
    calls++; assert.equal(new URL(url).origin, 'https://wsearch.nlm.nih.gov'); assert.equal(new URL(url).searchParams.get('term'), 'ibuprofen'); assert.equal(options.redirect, 'error');
    assert.doesNotMatch(String(url), /SYNTHETIC_PRIVATE_NAME|example.invalid|patient|650000/);
    return new Response('<nlmSearchResult><list><document url="https://medlineplus.gov/medicines.html"><content name="title">Ibuprofen synthetic fixture</content><content name="FullSummary">Ibuprofen is the topic of this synthetic reference. The fixture can demonstrate source matching, not medical facts. This is not clinical advice.</content></document></list></nlmSearchResult>', { headers: { 'content-type': 'application/xml' } });
  };
  await t.test('unauthenticated chat/feedback blocked; protected status makes no tool request', async () => {
    assert.equal((await request(app).post('/api/v1/chat').send({ message: 'medicine storage' })).status, 401);
    assert.equal((await request(app).post('/api/v1/chat/feedback').send({})).status, 401);
    const status = await request(app).get('/api/v1/chat/status').set('Authorization', token(0)); assert.equal(status.status, 200); assert.equal(status.body.contextualChat.webEnabled, true); assert.equal(status.body.providerReadiness.liveProviderVerified, false); assert.equal(calls, 0);
  });
  await t.test('approved web fallback is real HTTP routing with mocked official API, not a model claim', async () => {
    const result = await request(app).post('/api/v1/chat').set('Authorization', token(0)).send({ message: 'Explain Ibuprofen. SYNTHETIC_PRIVATE_NAME patient@example.invalid' });
    assert.equal(result.status, 200); assert.equal(result.body.mode, 'PRECISE_WEB_EVIDENCE'); assert.equal(result.body.context.topics[0].id, 'ibuprofen'); assert.ok(result.body.feedbackReceipt); receipt = result.body.feedbackReceipt; assert.equal(calls, 1); assert.match(result.headers['cache-control'], /private, no-store/);
  });
  await t.test('contextual follow-up is returned through SSE with the correct source scope', async () => {
    const result = await request(app).post('/api/v1/chat/stream').set('Authorization', token(0)).send({ message: 'Explain it more simply', history: [{ role: 'user', text: 'Explain Ibuprofen' }] });
    assert.equal(result.status, 200); assert.match(result.text, /event: done/); assert.match(result.text, /"followupResolved":true/); assert.match(result.text, /"style":"CONCISE"/); assert.match(result.text, /APPROVED_WEB_BM25/); assert.equal(calls, 1, 'cached official result avoids another request');
  });
  await t.test('feedback is protected, owner-bound, persisted as metadata and never auto-applied', async () => {
    assert.equal((await request(app).post('/api/v1/chat/feedback').set('Authorization', token(1)).send({ receipt, rating: 'HELPFUL' })).status, 404);
    const result = await request(app).post('/api/v1/chat/feedback').set('Authorization', token(0)).send({ receipt, rating: 'HELPFUL' }); assert.equal(result.status, 200); assert.equal(result.body.learningApplied, false);
    const records = await Feedback.find({ user: ids[0] }).lean(); assert.equal(records.length, 1); assert.equal(records[0].status, 'PENDING_EXPERT_REVIEW'); assert.ok(records[0].expiresAt); assert.doesNotMatch(JSON.stringify(records), /SYNTHETIC_PRIVATE_NAME|patient@example|fullSummary|reply|history/);
    assert.equal((await request(app).post('/api/v1/chat/feedback').set('Authorization', token(0)).send({ receipt, rating: 'HELPFUL', correction: 'untrusted replacement fact' })).status, 400);
  });
  await t.test('private case and outsider requests cannot fall through to official search', async () => {
    const value = await Case.create({ organizationId: orgs[0], createdBy: ids[0], status: 'DRAFT' }); cases.push(value._id);
    const body = { message: 'Explain medicine storage', caseId: String(value._id) };
    assert.equal((await request(app).post('/api/v1/chat').set('Authorization', token(0)).send(body)).status, 200);
    assert.equal((await request(app).post('/api/v1/chat').set('Authorization', token(1)).send(body)).status, 404); assert.equal(calls, 1);
  });
});
