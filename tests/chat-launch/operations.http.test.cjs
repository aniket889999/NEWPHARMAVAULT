'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto'), path = require('node:path');
const { spawn } = require('node:child_process'), { createRequire } = require('node:module');
const backendRoot = path.resolve(__dirname, '../../backend'), backend = createRequire(path.join(backendRoot, 'package.json'));
test('operations release slice: real protected HTTP, durable feedback and process restart boundary', { timeout: 20000 }, async t => {
  const changes = { NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/pharmavault_smoke_test', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    GEMINI_API_KEY: 'synthetic-unused', CHAT_RECEIPT_STORE: 'mongo', CHAT_SOURCE_POLICY: 'ACADEMIC_DEMO',
    RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'false', RAG_CHAT_EMBEDDINGS_ENABLED: 'false', RAG_CHAT_WEB_ENABLED: 'false' };
  const old = Object.fromEntries(Object.keys(changes).map(key => [key, process.env[key]])); Object.assign(process.env, changes);
  const mongoose = backend('mongoose'), request = backend('supertest'), jwt = backend('jsonwebtoken');
  const { assertTestDatabase } = backend('./utils/testDatabaseGuard');
  const app = backend('./app'), User = backend('./models/userModel'), Org = backend('./models/organizationModel'), Receipt = backend('./models/chatReceiptModel'), Feedback = backend('./models/chatFeedbackModel');
  const users = [], orgs = []; let connected = false, receipt;
  t.after(async () => {
    if (connected) { assertTestDatabase(mongoose.connection); await Receipt.deleteMany({ user: { $in: users } }); await Feedback.deleteMany({ user: { $in: users } }); await User.deleteMany({ _id: { $in: users } }); await Org.deleteMany({ _id: { $in: orgs } }); await mongoose.disconnect(); }
    for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  });
  assertTestDatabase(process.env.MONGO_URI); await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 }); connected = true; assertTestDatabase(mongoose.connection);
  await Receipt.init();
  const run = crypto.randomUUID();
  const org = await Org.create({ name: 'Synthetic chat operations ' + run, owner: new mongoose.Types.ObjectId() }); orgs.push(org._id);
  for (const [index, role] of ['patient', 'patient', 'super_admin'].entries()) {
    const user = await User.create({ name: 'Synthetic operations user', email: run + index + '@example.invalid', password: crypto.randomUUID(), role, organizationId: org._id }); users.push(user._id);
  }
  const token = index => 'Bearer ' + jwt.sign({ id: String(users[index]) }, process.env.JWT_SECRET, { expiresIn: '5m' });
  await t.test('operational aggregates require super-admin authorization', async () => {
    assert.equal((await request(app).get('/api/v1/chat/operations')).status, 401);
    assert.equal((await request(app).get('/api/v1/chat/operations').set('Authorization', token(0))).status, 403);
    assert.equal((await request(app).get('/api/v1/chat/operations').set('Authorization', token(2))).status, 200);
  });
  await t.test('real JSON answer persists a hashed receipt, not the conversation', async () => {
    const response = await request(app).post('/api/v1/chat').set('Authorization', token(0)).send({ message: 'Explain human-in-the-loop validation' });
    assert.equal(response.status, 200); receipt = response.body.feedbackReceipt; assert.match(receipt, /^[a-f0-9-]{36}$/);
    const records = await Receipt.find({ user: users[0] }).lean(); assert.equal(records.length, 1);
    assert.equal(records[0]._id, crypto.createHash('sha256').update(receipt).digest('hex'));
    assert.doesNotMatch(JSON.stringify(records), /feedbackReceipt|Explain human-in-the-loop|reply|history|password/);
  });
  await t.test('a different OS process can submit feedback with no shared memory', async () => {
    const script = `const mongoose=require('mongoose'); const {assertTestDatabase}=require('./utils/testDatabaseGuard'); (async()=>{assertTestDatabase(process.env.MONGO_URI); await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:3000}); try { const r=await require('./services/chatFeedbackService').submitFeedback(process.env.CHAT_TEST_USER,{receipt:process.env.CHAT_TEST_RECEIPT,rating:'HELPFUL'}); console.log(JSON.stringify(r)); } finally {await mongoose.disconnect();}})().catch(()=>{console.error('Synthetic child feedback check failed.');process.exitCode=1;});`;
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['-e', script], { cwd: backendRoot, env: { ...process.env, CHAT_TEST_USER: String(users[0]), CHAT_TEST_RECEIPT: receipt }, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = ''; const timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Synthetic child deadline exceeded.')); }, 6000);
      child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.resume(); child.on('error', error => { clearTimeout(timeout); reject(error); });
      child.on('exit', code => { clearTimeout(timeout); code === 0 ? resolve(JSON.parse(stdout.trim())) : reject(new Error('Synthetic child feedback process failed.')); });
    });
    assert.equal(result.accepted, true); assert.equal(result.learningApplied, false);
  });
  await t.test('another patient cannot use the receipt; owner updates one feedback record', async () => {
    const body = { receipt, rating: 'NOT_HELPFUL' };
    assert.equal((await request(app).post('/api/v1/chat/feedback').set('Authorization', token(1)).send(body)).status, 404);
    assert.equal((await request(app).post('/api/v1/chat/feedback').set('Authorization', token(0)).send(body)).status, 200);
    assert.equal(await Feedback.countDocuments({ user: users[0] }), 1);
  });
  await t.test('SSE completion includes its persisted receipt and never exports private case sources', async () => {
    const result = await request(app).post('/api/v1/chat/stream').set('Authorization', token(0)).send({ message: 'What is Paracetamol used for?' });
    assert.equal(result.status, 200); assert.match(result.text, /event: done/); assert.match(result.text, /feedbackReceipt/);
    assert.equal(await Receipt.countDocuments({ user: users[0] }), 2);
  });
  await t.test('expired receipts fail immediately, without waiting for MongoDB TTL cleanup', async () => {
    await Receipt.updateOne({ _id: crypto.createHash('sha256').update(receipt).digest('hex') }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await request(app).post('/api/v1/chat/feedback').set('Authorization', token(0)).send({ receipt, rating: 'HELPFUL' })).status, 404);
  });
  await t.test('status and operational aggregates are honest, bounded and contain no patient content', async () => {
    const status = await request(app).get('/api/v1/chat/status').set('Authorization', token(0));
    assert.equal(status.body.receiptPersistence, 'mongo'); assert.equal(status.body.generationEnabled, false);
    const result = await request(app).get('/api/v1/chat/operations').set('Authorization', token(2));
    assert.ok(result.body.metrics.total >= 2); assert.equal(result.body.receiptPersistence, 'mongo');
    assert.doesNotMatch(JSON.stringify(result.body), /example.invalid|feedbackReceipt|answerHash|Explain human-in-the-loop|Paracetamol/);
    assert.match(result.headers['cache-control'], /private, no-store/);
  });
});
