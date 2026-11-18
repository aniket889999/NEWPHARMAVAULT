const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), crypto = require('node:crypto');
const { createRequire } = require('node:module'), backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
Object.assign(process.env, { NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/pharmavault_smoke_test', JWT_SECRET: crypto.randomBytes(32).toString('hex'), GEMINI_API_KEY: 'synthetic-unused', RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'false' });
const mongoose = backend('mongoose'), request = backend('supertest'), jwt = backend('jsonwebtoken');
const app = backend('./app'), User = backend('./models/userModel'), Org = backend('./models/organizationModel');
const { KnowledgeCuration, KnowledgeCurationCounter } = backend('./models/knowledgeCurationModel');
const { references, corpusHash } = backend('./services/chatReferenceRegistry');
const { getPreference } = backend('./services/knowledgeCurationService');
const { assertTestDatabase } = backend('./utils/testDatabaseGuard');
test('two-reviewer retrieval curation uses real protected HTTP and atomic revision gates', async t => {
  assertTestDatabase(process.env.MONGO_URI); await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 }); assertTestDatabase(mongoose.connection);
  const users = [], orgs = [], actors = {}; const run = crypto.randomUUID();
  t.after(async () => { assertTestDatabase(mongoose.connection); const policies = await KnowledgeCuration.find({ organizationId: { $in: orgs } }).lean(); const keys = policies.map(value => String(value.organizationId) + ':' + value.topicId + ':' + value.focus); await KnowledgeCurationCounter.deleteMany({ _id: { $in: keys } }); await KnowledgeCuration.deleteMany({ organizationId: { $in: orgs } }); await User.deleteMany({ _id: { $in: users } }); await Org.deleteMany({ _id: { $in: orgs } }); await mongoose.disconnect(); });
  for (const label of ['A', 'B']) { const org = await Org.create({ name: 'Synthetic curation ' + run + label, owner: new mongoose.Types.ObjectId() }); orgs.push(org._id); }
  for (const [label, role, org] of [['creator', 'pharmacist', 0], ['reviewer', 'org_admin', 0], ['otherReviewer', 'claims_reviewer', 0], ['patient', 'patient', 0], ['outsider', 'org_admin', 1]]) { const user = await User.create({ name: 'Synthetic ' + label, email: label + run + '@example.invalid', password: crypto.randomUUID(), role, organizationId: orgs[org] }); actors[label] = user; users.push(user._id); }
  const auth = label => 'Bearer ' + jwt.sign({ id: String(actors[label]._id) }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const source = references.find(value => value.key === 'reference-medicine-safety');
  const body = { topicId: 'medicine-safety', focus: 'OVERVIEW', sourceIds: [source.id], corpusHash };
  let candidate;
  await t.test('patient/unauthenticated access and new medical-text injection are blocked', async () => {
    assert.equal((await request(app).get('/api/v1/chat/knowledge/references')).status, 401);
    assert.equal((await request(app).post('/api/v1/chat/knowledge/candidates').set('Authorization', auth('patient')).send(body)).status, 403);
    assert.equal((await request(app).post('/api/v1/chat/knowledge/candidates').set('Authorization', auth('creator')).send({ ...body, medicalText: 'Invented replacement treatment' })).status, 400);
    assert.equal((await request(app).post('/api/v1/chat/knowledge/candidates').set('Authorization', auth('creator')).send({ ...body, sourceIds: [references.find(value => value.key === 'human-review').id] })).status, 400);
  });
  await t.test('proposal is tenant-bound and has no effect before independent review', async () => {
    const result = await request(app).post('/api/v1/chat/knowledge/candidates').set('Authorization', auth('creator')).send(body); assert.equal(result.status, 201); candidate = result.body;
    assert.deepEqual(await getPreference(actors.patient, body.topicId, body.focus), { sourceIds: [], version: 0 });
    assert.equal((await request(app).get('/api/v1/chat/knowledge/candidates').set('Authorization', auth('outsider'))).body.length, 0);
    assert.equal((await request(app).post('/api/v1/chat/knowledge/candidates/' + candidate._id + '/review').set('Authorization', auth('outsider')).send({ decision: 'APPROVE', revision: 1, reasonCode: 'SOURCE_FOCUS_SUPPORTED' })).status, 404);
    assert.equal((await request(app).post('/api/v1/chat/knowledge/candidates/' + candidate._id + '/review').set('Authorization', auth('creator')).send({ decision: 'APPROVE', revision: 1, reasonCode: 'SOURCE_FOCUS_SUPPORTED' })).status, 403);
  });
  await t.test('concurrent approvals produce one decision; weights do not change', async () => {
    const results = await Promise.all(['reviewer', 'otherReviewer'].map(label => request(app).post('/api/v1/chat/knowledge/candidates/' + candidate._id + '/review').set('Authorization', auth(label)).send({ decision: 'APPROVE', revision: 1, reasonCode: 'SOURCE_FOCUS_SUPPORTED' })));
    assert.equal(results.filter(value => value.status === 200).length, 1); assert.equal(results.filter(value => value.status === 409).length, 1); const value = results.find(value => value.status === 200).body; assert.equal(value.modelWeightsChanged, false); assert.equal(value.candidate.actions.length, 1); candidate = value.candidate;
    const profile = await getPreference(actors.patient, body.topicId, body.focus); assert.deepEqual(profile.sourceIds, [source.id]); assert.equal(profile.version, candidate.approvalVersion);
    assert.equal((await getPreference(actors.outsider, body.topicId, body.focus)).version, 0);
  });
  await t.test('stale reviews cannot overwrite a finalized proposal and revocation restores defaults', async () => {
    assert.equal((await request(app).post('/api/v1/chat/knowledge/candidates/' + candidate._id + '/review').set('Authorization', auth('reviewer')).send({ decision: 'APPROVE', revision: 1, reasonCode: 'SOURCE_FOCUS_SUPPORTED' })).status, 409);
    const result = await request(app).post('/api/v1/chat/knowledge/candidates/' + candidate._id + '/review').set('Authorization', auth('reviewer')).send({ decision: 'REVOKE', revision: candidate.revision, reasonCode: 'REVERT_TO_DEFAULT' }); assert.equal(result.status, 200); assert.equal(result.body.candidate.status, 'REVOKED'); assert.equal(result.body.candidate.actions.length, 2);
    assert.deepEqual((await getPreference(actors.patient, body.topicId, body.focus)).sourceIds, []);
  });
  await t.test('revoking the latest preference cannot silently reactivate an older approved policy', async () => {
    const create = async () => (await request(app).post('/api/v1/chat/knowledge/candidates').set('Authorization', auth('creator')).send(body)).body;
    const decide = (value, decision) => request(app).post('/api/v1/chat/knowledge/candidates/' + value._id + '/review').set('Authorization', auth('reviewer')).send({ decision, revision: value.revision, reasonCode: decision === 'REVOKE' ? 'REVERT_TO_DEFAULT' : 'SOURCE_FOCUS_SUPPORTED' });
    const older = await decide(await create(), 'APPROVE'); assert.equal(older.status, 200);
    const latest = await decide(await create(), 'APPROVE'); assert.equal(latest.status, 200); assert.ok(latest.body.candidate.approvalVersion > older.body.candidate.approvalVersion);
    assert.equal((await decide(latest.body.candidate, 'REVOKE')).status, 200);
    const preference = await getPreference(actors.patient, body.topicId, body.focus); assert.deepEqual(preference.sourceIds, []); assert.equal(preference.version, latest.body.candidate.approvalVersion);
    const list = await request(app).get('/api/v1/chat/knowledge/candidates').set('Authorization', auth('reviewer')); assert.match(list.headers['cache-control'], /private, no-store/);
  });
  await t.test('changed source corpora invalidate activation and block stale approvals', async () => {
    const created = await request(app).post('/api/v1/chat/knowledge/candidates').set('Authorization', auth('creator')).send(body); assert.equal(created.status, 201);
    await KnowledgeCuration.updateOne({ _id: created.body._id }, { $set: { corpusHash: '0'.repeat(64) } });
    const result = await request(app).post('/api/v1/chat/knowledge/candidates/' + created.body._id + '/review').set('Authorization', auth('reviewer')).send({ decision: 'APPROVE', revision: 1, reasonCode: 'SOURCE_FOCUS_SUPPORTED' }); assert.equal(result.status, 409);
    await KnowledgeCuration.updateOne({ _id: created.body._id }, { $set: { status: 'APPROVED', approvalVersion: 100 } });
    assert.deepEqual(await getPreference(actors.patient, body.topicId, body.focus), { sourceIds: [], version: 0 });
  });
});
