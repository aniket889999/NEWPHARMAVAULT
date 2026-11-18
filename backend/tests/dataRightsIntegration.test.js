'use strict';

// Real HTTP + MongoDB tests for data-principal rights (export, erasure). Needs MongoDB on 127.0.0.1:27017.
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_privacy_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-data-rights-0000001';
process.env.GEMINI_API_KEY = 'test-only-gemini-key';
process.env.RATE_LIMIT_AUTH_MAX = '500';

const app = require('../app');
const User = require('../models/userModel');
const Organization = require('../models/organizationModel');
const VerificationCase = require('../models/verificationCaseModel');
const Document = require('../models/documentModel');
const Claim = require('../models/claimModel');
const CaseShareGrant = require('../models/caseShareGrantModel');
const Notification = require('../models/notificationModel');
const DataRequest = require('../models/dataRequestModel');
const AuditEvent = require('../models/auditEventModel');
const { assertTestDatabase } = require('../utils/testDatabaseGuard');

const PASSWORD = 'password-for-tests-only';
const as = async (req, user) => {
  const fresh = await User.findById(user._id).select('+sessionVersion');
  return req.set('Authorization', `Bearer ${jwt.sign({ id: String(user._id), ver: fresh.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1h' })}`);
};

test('Data rights: export own data, erasure request, guarded erasure', async (t) => {
  let org, payer, patient, other, pharmacist, superAdmin, vCase, claim, grant;

  t.before(async () => {
    assertTestDatabase(process.env.MONGO_URI);
    assertTestDatabase(await mongoose.connect(process.env.MONGO_URI));
    await mongoose.connection.dropDatabase();
    await DataRequest.init();
    const owner = new mongoose.Types.ObjectId();
    org = await Organization.create({ name: 'Privacy Test Pharmacy', owner, kind: 'pharmacy' });
    payer = await Organization.create({ name: 'Privacy Test Insurer', owner, kind: 'payer' });
    const mk = (name, role, organizationId) => User.create({ name, email: `${name.toLowerCase().replace(/\s/g, '.')}@example.com`, password: PASSWORD, role, organizationId });
    patient = await mk('Privacy Patient', 'patient');
    other = await mk('Privacy Other Patient', 'patient');
    pharmacist = await mk('Privacy Pharmacist', 'pharmacist', org._id);
    superAdmin = await mk('Privacy Super', 'super_admin');
    vCase = await VerificationCase.create({ organizationId: org._id, createdBy: patient._id, status: 'VERIFIED' });
    await VerificationCase.create({ organizationId: org._id, createdBy: other._id, status: 'VERIFIED' });
    await Document.create({ caseId: vCase._id, type: 'PRESCRIPTION', objectStorageKey: `${vCase._id}/rx.png`, originalFilename: 'rx.png', mimeType: 'image/png', uploadedBy: patient._id });
    grant = await CaseShareGrant.create({ caseId: vCase._id, granteeOrganizationId: payer._id, grantedBy: patient._id, scope: ['case_summary'], consentText: 'Synthetic consent text for tests.', expiresAt: new Date(Date.now() + 86_400_000) });
    claim = await Claim.create({ caseId: vCase._id, claimantId: patient._id, pharmacyOrganizationId: org._id, payerOrganizationId: payer._id, shareGrantId: grant._id, policyNumber: 'SYNTH-POLICY-1', claimedAmount: 100 });
    await Notification.create({ userId: patient._id, type: 'CLAIM_SUBMITTED', title: 'Synthetic', body: 'Synthetic notification' });
  });

  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  await t.test('export contains only the person\'s own data and no secrets or storage keys', async () => {
    const res = await as(request(app).get('/api/v1/me/data-export'), patient);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.format, 'pharmavault-personal-data-export/v1');
    assert.equal(res.body.cases.length, 1);
    assert.equal(res.body.cases[0].id, String(vCase._id));
    assert.equal(res.body.documents.length, 1);
    assert.equal(res.body.claims.length, 1);
    const raw = JSON.stringify(res.body);
    for (const secret of ['objectStorageKey', 'password', 'secretEnc', 'sessionVersion', 'recoveryCodeHashes']) assert.ok(!raw.includes(secret), secret);
    assert.match(res.headers['content-disposition'], /attachment/);
    assert.ok(await AuditEvent.exists({ action: 'PERSONAL_DATA_EXPORTED', actorId: patient._id }));
  });

  await t.test('erasure request: patient only, one open at a time, cancellable', async () => {
    assert.equal((await as(request(app).post('/api/v1/me/erasure-request').send({}), pharmacist)).status, 403);
    const first = await as(request(app).post('/api/v1/me/erasure-request').send({ reason: 'Synthetic reason' }), other);
    assert.equal(first.status, 201);
    assert.equal((await as(request(app).post('/api/v1/me/erasure-request').send({}), other)).status, 409);
    assert.equal((await as(request(app).post(`/api/v1/me/data-requests/${first.body.id}/cancel`), patient)).status, 404, 'cannot cancel someone else\'s request');
    assert.equal((await as(request(app).post(`/api/v1/me/data-requests/${first.body.id}/cancel`), other)).status, 200);
  });

  await t.test('erasure is refused while a claim is open, then completes and anonymises the account', async () => {
    const req = await as(request(app).post('/api/v1/me/erasure-request').send({}), patient);
    assert.equal(req.status, 201);
    const note = { note: 'Identity checked against account email; processed.' };
    assert.equal((await as(request(app).get('/api/v1/privacy/data-requests'), pharmacist)).status, 403);
    assert.equal((await as(request(app).post(`/api/v1/privacy/data-requests/${req.body.id}/complete`).send(note), pharmacist)).status, 403);
    const queue = await as(request(app).get('/api/v1/privacy/data-requests'), superAdmin);
    assert.ok(queue.body.some((r) => r.id === req.body.id));

    const blocked = await as(request(app).post(`/api/v1/privacy/data-requests/${req.body.id}/complete`).send(note), superAdmin);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, 'ERASURE_BLOCKED_OPEN_CLAIMS');
    assert.equal((await as(request(app).post(`/api/v1/privacy/data-requests/${req.body.id}/complete`).send({ note: 'short' }), superAdmin)).status, 400);

    await Claim.updateOne({ _id: claim._id }, { $set: { status: 'WITHDRAWN' } });
    const done = await as(request(app).post(`/api/v1/privacy/data-requests/${req.body.id}/complete`).send(note), superAdmin);
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.outcome.casesPurged, 1);

    const erased = await User.findById(patient._id);
    assert.equal(erased.name, 'Erased user');
    assert.match(erased.email, /@erased\.invalid$/);
    assert.equal(erased.active, false);
    assert.equal((await request(app).post('/api/users/login').send({ email: 'privacy.patient@example.com', password: PASSWORD, role: 'patient' })).status, 401);
    assert.equal(await Document.countDocuments({ caseId: vCase._id }), 0);
    assert.ok((await VerificationCase.findById(vCase._id)).purgedAt);
    assert.ok((await CaseShareGrant.findById(grant._id)).revokedAt);
    assert.equal(await Notification.countDocuments({ userId: patient._id }), 0);
    assert.ok(await Claim.exists({ _id: claim._id }), 'claim record is kept');
    assert.equal(await VerificationCase.countDocuments({ createdBy: other._id, purgedAt: null }), 1, 'other people are untouched');
    assert.ok(await AuditEvent.exists({ action: 'ERASURE_COMPLETED' }));
    assert.equal((await as(request(app).post(`/api/v1/privacy/data-requests/${req.body.id}/complete`).send(note), superAdmin)).status, 409, 'cannot run twice');
  });
});
