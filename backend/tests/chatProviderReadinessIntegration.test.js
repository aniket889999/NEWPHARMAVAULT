const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('V2-01 actual protected status/answer routes with mocked provider and scoped disposable DB', { timeout: 30000 }, async t => {
  const keys = ['NODE_ENV', 'MONGO_URI', 'JWT_SECRET', 'GEMINI_API_KEY', 'RAG_CHAT_LLM_ENABLED', 'RAG_CHAT_PUBLIC_EXPORT_ALLOWED', 'RAG_CHAT_EMBEDDINGS_ENABLED', 'RAG_CHAT_MODEL', 'TRUSTRAG_LLM_EXPORT_ALLOWED'];
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]])), oldFetch = global.fetch;
  Object.assign(process.env, { NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/pharmavault_smoke_test', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    GEMINI_API_KEY: 'SYNTHETIC_HTTP_READINESS_CREDENTIAL', RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'false',
    RAG_CHAT_EMBEDDINGS_ENABLED: 'false', RAG_CHAT_MODEL: 'gemini-2.5-flash', TRUSTRAG_LLM_EXPORT_ALLOWED: 'false' });
  const mongoose = require('mongoose'), jwt = require('jsonwebtoken'), request = require('supertest');
  const { assertTestDatabase } = require('../utils/testDatabaseGuard');
  const User = require('../models/userModel'), Org = require('../models/organizationModel'), Case = require('../models/verificationCaseModel');
  const app = require('../app');
  const users = [], orgs = [], cases = []; let connected = false, calls = 0;
  t.after(async () => {
    global.fetch = oldFetch;
    if (connected) {
      assertTestDatabase(mongoose.connection);
      await Case.deleteMany({ _id: { $in: cases }, createdBy: { $in: users } });
      await User.deleteMany({ _id: { $in: users } }); await Org.deleteMany({ _id: { $in: orgs } });
      await mongoose.disconnect();
    }
    for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  });
  assertTestDatabase(process.env.MONGO_URI); await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 }); connected = true;
  assertTestDatabase(mongoose.connection);
  const run = crypto.randomUUID();
  for (let i = 0; i < 2; i++) {
    const org = await Org.create({ name: 'SYNTHETIC V2-01 ' + run + i, owner: new mongoose.Types.ObjectId(), plan: 'Enterprise', status: 'active' }); orgs.push(org._id);
    const user = await User.create({ name: 'Synthetic readiness user', email: 'readiness-' + run + i + '@example.invalid', password: crypto.randomUUID(), role: 'patient', organizationId: org._id }); users.push(user._id);
  }
  const record = await Case.create({ organizationId: orgs[0], createdBy: users[0], status: 'DRAFT', reviewRequired: false }); cases.push(record._id);
  const auth = index => 'Bearer ' + jwt.sign({ id: String(users[index]) }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const status = () => request(app).get('/api/v1/chat/status').set('Authorization', auth(0));
  global.fetch = async () => { calls++; throw Error('Status must not call a provider.'); };

  await t.test('unauthenticated status is blocked and authenticated local-only status never probes', async () => {
    assert.equal((await request(app).get('/api/v1/chat/status')).status, 401);
    const response = await status(); assert.equal(response.status, 200); assert.match(response.headers['cache-control'], /private, no-store/);
    assert.equal(response.body.providerReadiness.state, 'LOCAL_ONLY'); assert.equal(response.body.generationEnabled, false); assert.equal(calls, 0);
  });
  await t.test('enabled flags expose only configured/unverified state and no credential, private ID or raw configuration', async () => {
    process.env.RAG_CHAT_LLM_ENABLED = 'true'; process.env.RAG_CHAT_PUBLIC_EXPORT_ALLOWED = 'true';
    const response = await status(); assert.equal(response.body.generationEnabled, true); assert.equal(response.body.providerReadiness.state, 'CONFIGURED_UNVERIFIED');
    assert.equal(response.body.providerReadiness.liveProviderVerified, false); assert.equal(calls, 0);
    const text = JSON.stringify(response.body); assert.doesNotMatch(text, /SYNTHETIC_HTTP_READINESS_CREDENTIAL|fingerprint|MONGO_URI|JWT_SECRET/);
    assert.equal(text.includes(String(record._id)), false);
  });
  await t.test('a real public answer route records a mocked, citation-validated provider response', async () => {
    global.fetch = async (url, options) => {
      calls++; assert.match(url, /:streamGenerateContent\?alt=sse$/);
      const context = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text), source = context.passages[0];
      const text = JSON.stringify({ paragraphs: [{ text: 'An authorized human reviews the evidence and records the reason for the decision.', support: [{ sourceId: source.sourceId, quote: source.text }] }] });
      return new Response('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) + '\n\n', { status: 200 });
    };
    const response = await request(app).post('/api/v1/chat').set('Authorization', auth(0)).send({ message: 'Explain human-in-the-loop validation' });
    assert.equal(response.status, 200); assert.equal(response.body.mode, 'GEMINI_RAG'); assert.equal(calls, 1);
    const current = await status(); assert.equal(current.body.providerReadiness.state, 'VERIFIED_RECENTLY'); assert.equal(current.body.providerReadiness.verificationScope, 'PUBLIC_REFERENCE_GENERATION'); assert.equal(calls, 1);
  });
  await t.test('public stream fallback records degraded status and returns no upstream secrets', async () => {
    global.fetch = async () => { calls++; return new Response('SECRET_PROVIDER_RESPONSE', { status: 429 }); };
    const response = await request(app).post('/api/v1/chat/stream').set('Authorization', auth(0)).send({ message: 'Explain human-in-the-loop validation' });
    assert.equal(response.status, 200); assert.match(response.text, /event: reset/); assert.match(response.text, /PROVIDER_RATE_LIMIT/);
    assert.doesNotMatch(response.text, /SECRET_PROVIDER_RESPONSE|SYNTHETIC_HTTP_READINESS_CREDENTIAL/);
    const current = await status(); assert.equal(current.body.providerReadiness.state, 'DEGRADED'); assert.equal(current.body.providerReadiness.liveProviderVerified, false); assert.ok(current.body.providerReadiness.lastSuccessAt); assert.equal(calls, 2);
  });
  await t.test('greetings, ordinary private scope and opaque cross-tenant denials do not probe or overwrite provider observation', async () => {
    const before = (await status()).body.providerReadiness;
    const greeting = await request(app).post('/api/v1/chat').set('Authorization', auth(0)).send({ message: 'hello' }); assert.equal(greeting.status, 200);
    const body = { message: 'Show prescription strength fields', caseId: String(record._id) };
    const own = await request(app).post('/api/v1/chat').set('Authorization', auth(0)).send(body); assert.equal(own.status, 200); assert.notEqual(own.body.mode, 'GEMINI_RAG');
    const other = await request(app).post('/api/v1/chat').set('Authorization', auth(1)).send(body); assert.equal(other.status, 404);
    assert.equal(calls, 2); assert.deepEqual((await status()).body.providerReadiness, before);
  });
  await t.test('unsafe configured model is not reflected and old proof cannot survive a key change', async () => {
    process.env.GEMINI_API_KEY = 'NEW_SYNTHETIC_CREDENTIAL';
    assert.equal((await status()).body.providerReadiness.state, 'CONFIGURED_UNVERIFIED');
    process.env.RAG_CHAT_MODEL = 'https://SECRET_CONFIGURATION.invalid/?credential=DO_NOT_ECHO';
    const response = await status(); assert.equal(response.body.model, null); assert.equal(response.body.generationEnabled, false);
    assert.equal(response.body.providerReadiness.state, 'MISCONFIGURED'); assert.equal(response.body.providerReadiness.reasonCode, 'INVALID_MODEL');
    assert.doesNotMatch(JSON.stringify(response.body), /SECRET_CONFIGURATION|DO_NOT_ECHO|NEW_SYNTHETIC_CREDENTIAL/); assert.equal(calls, 2);
  });
});
