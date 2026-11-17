'use strict';

// Real HTTP + MongoDB integration test for the claims module and TOTP login.
// Needs a local MongoDB (npm --prefix backend run mongo:local) and installed deps.
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_claims_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-claims-workflow-0001';
process.env.GEMINI_API_KEY = 'test-only-gemini-key';
process.env.MFA_ENCRYPTION_KEY = 'test-only-mfa-encryption-key-0123456789';

const app = require('../app');
const User = require('../models/userModel');
const Organization = require('../models/organizationModel');
const VerificationCase = require('../models/verificationCaseModel');
const Claim = require('../models/claimModel');
const CaseShareGrant = require('../models/caseShareGrantModel');
const Notification = require('../models/notificationModel');
const AuditEvent = require('../models/auditEventModel');
const { assertTestDatabase } = require('../utils/testDatabaseGuard');
const { totp } = require('../utils/totp');

const tokenFor = (user) => jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (req, user) => req.set('Authorization', `Bearer ${tokenFor(user)}`);

test('Claims module: consent, tenant isolation, human decisions, FHIR and MFA', async (t) => {
  let pharmacyOrg, payerA, payerB, patient, otherPatient, pharmacist, payerReviewer, payerAdmin, otherPayerReviewer, verifiedCase, draftCase;

  t.before(async () => {
    assertTestDatabase(process.env.MONGO_URI);
    const conn = await mongoose.connect(process.env.MONGO_URI);
    assertTestDatabase(conn);
    await Promise.all([User, Organization, VerificationCase, Claim, CaseShareGrant, Notification, AuditEvent].map((M) => M.deleteMany({})));
    await Claim.syncIndexes();

    const owner = new mongoose.Types.ObjectId();
    pharmacyOrg = await Organization.create({ name: 'Claims Test Pharmacy', owner, kind: 'pharmacy' });
    payerA = await Organization.create({ name: 'Claims Test Insurer A', owner, kind: 'payer' });
    payerB = await Organization.create({ name: 'Claims Test Insurer B', owner, kind: 'payer' });

    const mk = (name, role, organizationId) => User.create({ name, email: `${name.toLowerCase().replace(/\s/g, '.')}@example.com`, password: 'password-for-tests-only', role, organizationId });
    patient = await mk('Claimant One', 'patient');
    otherPatient = await mk('Claimant Two', 'patient');
    pharmacist = await mk('Pharmacist One', 'pharmacist', pharmacyOrg._id);
    payerReviewer = await mk('Payer Reviewer A', 'payer_reviewer', payerA._id);
    payerAdmin = await mk('Payer Admin A', 'payer_admin', payerA._id);
    otherPayerReviewer = await mk('Payer Reviewer B', 'payer_reviewer', payerB._id);

    verifiedCase = await VerificationCase.create({ organizationId: pharmacyOrg._id, createdBy: patient._id, status: 'VERIFIED' });
    draftCase = await VerificationCase.create({ organizationId: pharmacyOrg._id, createdBy: patient._id, status: 'NEEDS_REVIEW' });
  });

  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  const submitBody = (overrides = {}) => ({
    caseId: String(verifiedCase._id), payerOrganizationId: String(payerA._id), claimedAmount: 500,
    policyNumber: 'SYN-POL-0001', consent: { accepted: true }, ...overrides
  });

  let claimId;

  await t.test('claimant lists only payer organizations and only verified cases', async () => {
    const payers = await auth(request(app).get('/api/v1/claims/payers'), patient);
    assert.equal(payers.status, 200);
    assert.deepEqual(payers.body.map((p) => p.name).sort(), ['Claims Test Insurer A', 'Claims Test Insurer B']);
    const eligible = await auth(request(app).get('/api/v1/claims/eligible-cases'), patient);
    assert.deepEqual(eligible.body.map((c) => c.id), [String(verifiedCase._id)]);
  });

  await t.test('submission rules: consent, verified case, ownership, duplicates', async () => {
    assert.equal((await auth(request(app).post('/api/v1/claims').send(submitBody({ consent: { accepted: false } })), patient)).status, 400);
    assert.equal((await auth(request(app).post('/api/v1/claims').send(submitBody({ caseId: String(draftCase._id) })), patient)).status, 409);
    assert.equal((await auth(request(app).post('/api/v1/claims').send(submitBody()), otherPatient)).status, 404);
    assert.equal((await auth(request(app).post('/api/v1/claims').send(submitBody({ claimedAmount: 10.123 })), patient)).status, 400);
    const ok = await auth(request(app).post('/api/v1/claims').send(submitBody()), patient);
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.status, 'SUBMITTED');
    claimId = ok.body.id;
    assert.equal((await auth(request(app).post('/api/v1/claims').send(submitBody()), patient)).status, 409);
    assert.equal(await CaseShareGrant.countDocuments({ caseId: verifiedCase._id, granteeOrganizationId: payerA._id }), 1);
    assert.ok(await Notification.exists({ userId: payerReviewer._id, type: 'CLAIM_SUBMITTED' }));
  });

  await t.test('tenant isolation: other insurer, pharmacy staff and other claimant are blocked', async () => {
    assert.equal((await auth(request(app).get(`/api/v1/payer/claims/${claimId}`), otherPayerReviewer)).status, 404);
    assert.equal((await auth(request(app).get('/api/v1/payer/claims'), otherPayerReviewer)).body.length, 0);
    assert.equal((await auth(request(app).get(`/api/v1/payer/claims/${claimId}`), pharmacist)).status, 403);
    assert.equal((await auth(request(app).get(`/api/v1/claims/${claimId}`), otherPatient)).status, 404);
    // Payer roles cannot use the pharmacy case API directly; access is only through the consented claim.
    assert.equal((await auth(request(app).get(`/api/v1/cases/${verifiedCase._id}`), payerReviewer)).status, 403);
  });

  await t.test('payer workflow: open, query, claimant answers, partial decision', async () => {
    assert.equal((await auth(request(app).post(`/api/v1/payer/claims/${claimId}/decision`).send({ decision: 'APPROVED', note: 'Looks consistent overall.' }), payerReviewer)).status, 409, 'must open review first');
    assert.equal((await auth(request(app).post(`/api/v1/payer/claims/${claimId}/start-review`), payerReviewer)).status, 200);
    const view = await auth(request(app).get(`/api/v1/payer/claims/${claimId}`), payerReviewer);
    assert.equal(view.status, 200);
    assert.equal(view.body.case.caseReference, verifiedCase.caseReference);
    assert.ok(!JSON.stringify(view.body).includes('objectStorageKey'));

    const q = await auth(request(app).post(`/api/v1/payer/claims/${claimId}/queries`).send({ question: 'Please confirm the dispensed quantity.' }), payerReviewer);
    assert.equal(q.body.status, 'QUERY_RAISED');
    const queryId = q.body.queries[0].id;
    const answered = await auth(request(app).post(`/api/v1/claims/${claimId}/queries/${queryId}/answer`).send({ answer: 'Ten tablets were dispensed.' }), patient);
    assert.equal(answered.status, 200);
    assert.equal(answered.body.status, 'UNDER_PAYER_REVIEW');

    assert.equal((await auth(request(app).post(`/api/v1/payer/claims/${claimId}/decision`).send({ decision: 'PARTIALLY_APPROVED', approvedAmount: 300, note: 'too short' }), payerReviewer)).status, 400);
    const decided = await auth(request(app).post(`/api/v1/payer/claims/${claimId}/decision`).send({ decision: 'PARTIALLY_APPROVED', approvedAmount: 300, reasonCode: 'QUANTITY_LIMIT', note: 'Policy covers up to 300 for this item.' }), payerReviewer);
    assert.equal(decided.status, 200, JSON.stringify(decided.body));
    assert.equal(decided.body.status, 'PARTIALLY_APPROVED');
    assert.equal((await auth(request(app).post(`/api/v1/payer/claims/${claimId}/decision`).send({ decision: 'REJECTED', reasonCode: 'OTHER', note: 'Second reviewer attempt.' }), payerReviewer)).status, 409, 'no double decision');
    assert.equal((await auth(request(app).post(`/api/v1/claims/${claimId}/withdraw`), patient)).status, 409, 'cannot withdraw after decision');
  });

  await t.test('FHIR bundle validates; only payer_admin settles (simulated)', async () => {
    const fhir = await auth(request(app).get(`/api/v1/payer/claims/${claimId}/fhir-bundle`), payerReviewer);
    assert.equal(fhir.status, 200);
    assert.equal(fhir.body.validation.valid, true, JSON.stringify(fhir.body.validation.issues));
    assert.equal((await auth(request(app).post(`/api/v1/payer/claims/${claimId}/settle`), payerReviewer)).status, 403);
    const settled = await auth(request(app).post(`/api/v1/payer/claims/${claimId}/settle`), payerAdmin);
    assert.equal(settled.body.status, 'SETTLED');
    assert.equal(settled.body.settlement.simulated, true);
    const analytics = await auth(request(app).get('/api/v1/payer/analytics'), payerAdmin);
    assert.equal(analytics.body.byStatus.SETTLED.count, 1);
  });

  await t.test('withdrawing revokes consent and blocks payer access', async () => {
    const second = await auth(request(app).post('/api/v1/claims').send(submitBody({ payerOrganizationId: String(payerB._id), policyNumber: 'SYN-POL-0002' })), patient);
    assert.equal(second.status, 201);
    assert.equal((await auth(request(app).get(`/api/v1/payer/claims/${second.body.id}`), otherPayerReviewer)).status, 200);
    assert.equal((await auth(request(app).post(`/api/v1/claims/${second.body.id}/withdraw`), patient)).status, 200);
    const blocked = await auth(request(app).get(`/api/v1/payer/claims/${second.body.id}`), otherPayerReviewer);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, 'CONSENT_INACTIVE');
  });

  await t.test('pharmacy staff see read-only claim status; audit trail recorded', async () => {
    const linked = await auth(request(app).get('/api/v1/pharmacy/claims'), pharmacist);
    assert.equal(linked.status, 200);
    assert.equal(linked.body.length, 2);
    const actions = (await AuditEvent.find({ caseId: verifiedCase._id }).lean()).map((e) => e.action);
    for (const action of ['CLAIM_SUBMITTED_WITH_CONSENT', 'CLAIM_UNDER_PAYER_REVIEW', 'CLAIM_QUERY_RAISED', 'CLAIM_PARTIALLY_APPROVED', 'CLAIM_SETTLED', 'CASE_SHARE_REVOKED', 'PAYER_VIEWED_CASE']) {
      assert.ok(actions.includes(action), `missing audit ${action}`);
    }
  });

  await t.test('TOTP MFA: setup, enable, login requires code, replay rejected', async () => {
    const setup = await auth(request(app).post('/api/users/mfa/setup'), payerReviewer);
    assert.equal(setup.status, 200);
    const code = totp(setup.body.secret);
    assert.equal((await auth(request(app).post('/api/users/mfa/enable').send({ code }), payerReviewer)).status, 200);

    const creds = { email: payerReviewer.email, password: 'password-for-tests-only', role: 'payer_reviewer' };
    const noCode = await request(app).post('/api/users/login').send(creds);
    assert.equal(noCode.status, 401);
    assert.equal(noCode.body.mfaRequired, true);
    // The enrolment code was consumed; reusing it must fail.
    assert.equal((await request(app).post('/api/users/login').send({ ...creds, otp: code })).status, 401);
    const next = totp(setup.body.secret, { time: Date.now() + 30_000 });
    const ok = await request(app).post('/api/users/login').send({ ...creds, otp: next });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.mfaEnabled, true);
  });
});
