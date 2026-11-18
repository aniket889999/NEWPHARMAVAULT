'use strict';

// Real HTTP + MongoDB tests for account security launch blockers: enforced staff MFA,
// recovery codes, per-account lockout, Team & Access admin actions and the reviewer
// credential rule. Needs MongoDB on 127.0.0.1:27017.
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_account_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-account-security-01';
process.env.GEMINI_API_KEY = 'test-only-gemini-key';
process.env.MFA_ENCRYPTION_KEY = 'test-only-mfa-encryption-key-0123456789';
process.env.RATE_LIMIT_AUTH_MAX = '500';
process.env.LOGIN_MAX_FAILURES = '3';

const app = require('../app');
const User = require('../models/userModel');
const Organization = require('../models/organizationModel');
const VerificationCase = require('../models/verificationCaseModel');
const AuditEvent = require('../models/auditEventModel');
const { totp } = require('../utils/totp');
const { assertTestDatabase } = require('../utils/testDatabaseGuard');

const PASSWORD = 'password-for-tests-only';
const tokenFor = async (user) => {
  const fresh = await User.findById(user._id).select('+sessionVersion');
  return jwt.sign({ id: String(user._id), ver: fresh.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
};
const as = async (req, user) => req.set('Authorization', `Bearer ${await tokenFor(user)}`);
const login = (user, extra = {}) => request(app).post('/api/users/login').send({ email: user.email, password: PASSWORD, role: user.role, ...extra });

test('Account security: enforced MFA, recovery codes, lockout, staff admin, credentials', async (t) => {
  let org, otherOrg, admin, pharmacist, reviewer, outsider, patient;

  t.before(async () => {
    assertTestDatabase(process.env.MONGO_URI);
    assertTestDatabase(await mongoose.connect(process.env.MONGO_URI));
    await Promise.all([User, Organization, VerificationCase, AuditEvent].map((M) => M.deleteMany({})));
    const owner = new mongoose.Types.ObjectId();
    org = await Organization.create({ name: 'Account Test Pharmacy', owner, kind: 'pharmacy' });
    otherOrg = await Organization.create({ name: 'Account Test Other', owner, kind: 'pharmacy' });
    const mk = (name, role, organizationId) => User.create({ name, email: `${name.toLowerCase().replace(/\s/g, '.')}@example.com`, password: PASSWORD, role, organizationId });
    admin = await mk('Acct Admin', 'org_admin', org._id);
    pharmacist = await mk('Acct Pharmacist', 'pharmacist', org._id);
    reviewer = await mk('Acct Reviewer', 'claims_reviewer', org._id);
    outsider = await mk('Acct Outsider', 'org_admin', otherOrg._id);
    patient = await mk('Acct Patient', 'patient');
  });

  t.after(async () => {
    delete process.env.MFA_REQUIRED_FOR_STAFF;
    delete process.env.REVIEW_CREDENTIAL_REQUIRED;
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  await t.test('MFA_REQUIRED_FOR_STAFF blocks staff without MFA except profile and MFA setup; patients unaffected', async () => {
    process.env.MFA_REQUIRED_FOR_STAFF = 'true';
    try {
      const queue = await as(request(app).get('/api/v1/review-queue'), reviewer);
      assert.equal(queue.status, 403);
      assert.equal(queue.body.code, 'MFA_SETUP_REQUIRED');
      const profile = await as(request(app).get('/api/users/profile'), reviewer);
      assert.equal(profile.status, 200);
      assert.equal(profile.body.mfaSetupRequired, true);
      assert.equal((await as(request(app).post('/api/users/mfa/setup'), reviewer)).status, 200);
      const patientProfile = await as(request(app).get('/api/users/profile'), patient);
      assert.equal(patientProfile.body.mfaSetupRequired, false);
    } finally {
      delete process.env.MFA_REQUIRED_FOR_STAFF;
    }
  });

  await t.test('recovery codes: issued once on enable, each works once at sign-in, TOTP still works', async () => {
    const setup = await as(request(app).post('/api/users/mfa/setup'), pharmacist);
    assert.equal(setup.status, 200);
    const enable = await as(request(app).post('/api/users/mfa/enable').send({ code: totp(setup.body.secret) }), pharmacist);
    assert.equal(enable.status, 200, JSON.stringify(enable.body));
    assert.equal(enable.body.recoveryCodes.length, 8);
    const stored = await User.findById(pharmacist._id).select('+mfa.recoveryCodeHashes');
    assert.ok(!stored.mfa.recoveryCodeHashes.includes(enable.body.recoveryCodes[0]), 'codes are stored hashed');

    const [first] = enable.body.recoveryCodes;
    const ok = await login(pharmacist, { otp: first.toLowerCase() });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const reused = await login(pharmacist, { otp: first });
    assert.equal(reused.status, 401);
    assert.equal(reused.body.mfaRequired, true);
    assert.ok(await AuditEvent.exists({ action: 'MFA_RECOVERY_CODE_USED', targetId: String(pharmacist._id) }));
    await User.updateOne({ _id: pharmacist._id }, { $set: { 'login.failedCount': 0, 'login.lockedUntil': null } });
  });

  await t.test('lockout: repeated failures lock the account with the same opaque error; admin unlock restores sign-in', async () => {
    for (let i = 0; i < 3; i += 1) {
      const bad = await request(app).post('/api/users/login').send({ email: reviewer.email, password: 'wrong-password-123', role: reviewer.role });
      assert.equal(bad.status, 401);
      assert.equal(bad.body.message, 'Invalid email or password');
    }
    const locked = await login(reviewer);
    assert.equal(locked.status, 401, 'correct password is refused while locked');
    assert.equal(locked.body.message, 'Invalid email or password');
    assert.ok(await AuditEvent.exists({ action: 'ACCOUNT_LOCKED', targetId: String(reviewer._id) }));

    const team = await as(request(app).get('/api/users/staff'), admin);
    assert.equal(team.body.staff.find((s) => s.id === String(reviewer._id)).locked, true);
    assert.equal((await as(request(app).post(`/api/users/staff/${reviewer._id}/unlock`), admin)).status, 200);
    assert.equal((await login(reviewer)).status, 200);
  });

  await t.test('staff admin is tenant-scoped, cannot target self or patients, and every action is audited', async () => {
    assert.equal((await as(request(app).post(`/api/users/staff/${reviewer._id}/deactivate`), outsider)).status, 404, 'other organization');
    assert.equal((await as(request(app).post(`/api/users/staff/${patient._id}/deactivate`), admin)).status, 404, 'patients are not staff');
    assert.equal((await as(request(app).post(`/api/users/staff/${admin._id}/deactivate`), admin)).status, 400, 'not on self');
    assert.equal((await as(request(app).post(`/api/users/staff/${admin._id}/deactivate`), reviewer)).status, 403, 'non-admin');
    assert.equal((await as(request(app).post(`/api/users/staff/${reviewer._id}/role`).send({ role: 'payer_admin' }), admin)).status, 400, 'role outside the organization type');
  });

  await t.test('deactivate revokes sessions and blocks sign-in; reactivate restores; role change and forced sign-out revoke tokens', async () => {
    const oldToken = await tokenFor(reviewer);
    assert.equal((await as(request(app).post(`/api/users/staff/${reviewer._id}/deactivate`), admin)).status, 200);
    assert.equal((await request(app).get('/api/users/profile').set('Authorization', `Bearer ${oldToken}`)).status, 401);
    const blocked = await login(reviewer);
    assert.equal(blocked.status, 401);
    assert.equal(blocked.body.message, 'Invalid email or password');
    assert.equal((await as(request(app).post(`/api/users/staff/${reviewer._id}/reactivate`), admin)).status, 200);
    assert.equal((await login(reviewer)).status, 200);

    const beforeRole = await tokenFor(reviewer);
    const role = await as(request(app).post(`/api/users/staff/${reviewer._id}/role`).send({ role: 'pharmacist' }), admin);
    assert.equal(role.status, 200);
    assert.equal((await User.findById(reviewer._id)).role, 'pharmacist');
    assert.equal((await request(app).get('/api/users/profile').set('Authorization', `Bearer ${beforeRole}`)).status, 401);

    const beforeSignOut = await tokenFor(reviewer);
    assert.equal((await as(request(app).post(`/api/users/staff/${reviewer._id}/sign-out`), admin)).status, 200);
    assert.equal((await request(app).get('/api/users/profile').set('Authorization', `Bearer ${beforeSignOut}`)).status, 401);
    for (const action of ['STAFF_DEACTIVATED', 'STAFF_REACTIVATED', 'STAFF_ROLE_CHANGED', 'STAFF_FORCED_SIGN_OUT', 'STAFF_UNLOCKED']) {
      assert.ok(await AuditEvent.exists({ action, actorId: admin._id }), action);
    }
  });

  await t.test('REVIEW_CREDENTIAL_REQUIRED: VERIFY needs an admin-confirmed registration', async () => {
    process.env.REVIEW_CREDENTIAL_REQUIRED = 'true';
    try {
      const patientCase = await VerificationCase.create({ organizationId: org._id, createdBy: patient._id, status: 'NEEDS_REVIEW' });
      const body = { action: 'VERIFY', reasonCode: 'CROSS_DOCUMENT_CONSISTENT', notes: 'Synthetic review note for integration testing.', snapshotToken: `rs_${'a'.repeat(64)}` };
      const blocked = await as(request(app).post(`/api/v1/cases/${patientCase._id}/reviews`).send(body), reviewer);
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.code, 'REVIEWER_CREDENTIAL_REQUIRED');
      const escalate = await as(request(app).post(`/api/v1/cases/${patientCase._id}/reviews`).send({ ...body, action: 'ESCALATE' }), reviewer);
      assert.notEqual(escalate.body.code, 'REVIEWER_CREDENTIAL_REQUIRED');

      assert.equal((await as(request(app).post(`/api/users/staff/${reviewer._id}/credential`).send({ registrationNumber: 'x', council: 'State Pharmacy Council' }), admin)).status, 400);
      const confirmed = await as(request(app).post(`/api/users/staff/${reviewer._id}/credential`).send({ registrationNumber: 'MH/12345', council: 'State Pharmacy Council' }), admin);
      assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
      const after = await as(request(app).post(`/api/v1/cases/${patientCase._id}/reviews`).send(body), reviewer);
      assert.notEqual(after.body.code, 'REVIEWER_CREDENTIAL_REQUIRED', 'confirmed reviewer reaches the snapshot check');
    } finally {
      delete process.env.REVIEW_CREDENTIAL_REQUIRED;
    }
  });
});
