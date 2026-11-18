'use strict';

// Real HTTP + MongoDB tests for reviewer launch blockers: four-eyes, assignment
// lease, reopen, paged queues and claim appeals. Needs MongoDB on 127.0.0.1:27017.
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_review_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-review-workflow-00001';
process.env.GEMINI_API_KEY = 'test-only-gemini-key';

const app = require('../app');
const User = require('../models/userModel');
const Organization = require('../models/organizationModel');
const VerificationCase = require('../models/verificationCaseModel');
const Claim = require('../models/claimModel');
const CaseShareGrant = require('../models/caseShareGrantModel');
const Notification = require('../models/notificationModel');
const AuditEvent = require('../models/auditEventModel');
const { assertTestDatabase } = require('../utils/testDatabaseGuard');

const tokenFor = (user) => jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (req, user) => req.set('Authorization', `Bearer ${tokenFor(user)}`);
const FAKE_SNAPSHOT = `rs_${'a'.repeat(64)}`;
const verifyBody = { action: 'VERIFY', reasonCode: 'CROSS_DOCUMENT_CONSISTENT', notes: 'Synthetic review note for integration testing.', snapshotToken: FAKE_SNAPSHOT };

test('Reviewer launch blockers: four-eyes, lease, reopen, paging, appeals', async (t) => {
  let org, otherOrg, payer, patient, pharmacist, reviewer, admin, outsider, payerReviewer, payerAdmin;

  t.before(async () => {
    assertTestDatabase(process.env.MONGO_URI);
    assertTestDatabase(await mongoose.connect(process.env.MONGO_URI));
    await Promise.all([User, Organization, VerificationCase, Claim, CaseShareGrant, Notification, AuditEvent].map((M) => M.deleteMany({})));
    const owner = new mongoose.Types.ObjectId();
    org = await Organization.create({ name: 'Review Test Pharmacy', owner, kind: 'pharmacy' });
    otherOrg = await Organization.create({ name: 'Review Test Other Pharmacy', owner, kind: 'pharmacy' });
    payer = await Organization.create({ name: 'Review Test Insurer', owner, kind: 'payer' });
    const mk = (name, role, organizationId) => User.create({ name, email: `${name.toLowerCase().replace(/\s/g, '.')}@example.com`, password: 'password-for-tests-only', role, organizationId });
    patient = await mk('Review Patient', 'patient');
    pharmacist = await mk('Review Pharmacist', 'pharmacist', org._id);
    reviewer = await mk('Review Claims Reviewer', 'claims_reviewer', org._id);
    admin = await mk('Review Org Admin', 'org_admin', org._id);
    outsider = await mk('Review Outsider', 'claims_reviewer', otherOrg._id);
    payerReviewer = await mk('Review Payer One', 'payer_reviewer', payer._id);
    payerAdmin = await mk('Review Payer Admin', 'payer_admin', payer._id);
  });

  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  const newCase = (fields = {}) => VerificationCase.create({ organizationId: org._id, createdBy: patient._id, status: 'NEEDS_REVIEW', ...fields });

  await t.test('four-eyes: the case creator cannot VERIFY, but can still ESCALATE; another reviewer is not blocked', async () => {
    const own = await newCase({ createdBy: pharmacist._id });
    const blocked = await auth(request(app).post(`/api/v1/cases/${own._id}/reviews`).send(verifyBody), pharmacist);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, 'FOUR_EYES_CASE_CREATOR');
    const escalate = await auth(request(app).post(`/api/v1/cases/${own._id}/reviews`).send({ ...verifyBody, action: 'ESCALATE' }), pharmacist);
    assert.notEqual(escalate.body.code, 'FOUR_EYES_CASE_CREATOR');
    const other = await auth(request(app).post(`/api/v1/cases/${own._id}/reviews`).send(verifyBody), reviewer);
    assert.notEqual(other.body.code, 'FOUR_EYES_CASE_CREATOR', 'a different reviewer reaches the snapshot check instead');
  });

  await t.test('assignment lease: take, conflict, decision blocked for others, admin reassign, release', async () => {
    const vCase = await newCase();
    const take = await auth(request(app).post(`/api/v1/review/cases/${vCase._id}/assignment`), pharmacist);
    assert.equal(take.status, 200, JSON.stringify(take.body));
    assert.equal(take.body.assignment.assignedToMe, true);

    const conflict = await auth(request(app).post(`/api/v1/review/cases/${vCase._id}/assignment`), reviewer);
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.code, 'CASE_ASSIGNED_TO_OTHER');
    const decide = await auth(request(app).post(`/api/v1/cases/${vCase._id}/reviews`).send(verifyBody), reviewer);
    assert.equal(decide.status, 409);
    assert.equal(decide.body.code, 'CASE_ASSIGNED_TO_OTHER');

    assert.equal((await auth(request(app).post(`/api/v1/review/cases/${vCase._id}/assignment`).send({ force: true }), reviewer)).status, 403, 'only admins force');
    assert.equal((await auth(request(app).get(`/api/v1/review/cases/${vCase._id}/assignment`), outsider)).status, 404, 'other tenant');
    const forced = await auth(request(app).post(`/api/v1/review/cases/${vCase._id}/assignment`).send({ force: true }), admin);
    assert.equal(forced.status, 200);
    assert.equal(forced.body.assignment.assignedToMe, true);
    assert.equal((await auth(request(app).delete(`/api/v1/review/cases/${vCase._id}/assignment`), pharmacist)).status, 409, 'previous holder no longer holds it');
    const released = await auth(request(app).delete(`/api/v1/review/cases/${vCase._id}/assignment`), admin);
    assert.equal(released.body.assignment, null);

    await VerificationCase.updateOne({ _id: vCase._id }, { $set: { assignedTo: pharmacist._id, assignmentExpiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await auth(request(app).post(`/api/v1/review/cases/${vCase._id}/assignment`), reviewer)).status, 200, 'expired lease can be taken');
    const actions = (await AuditEvent.find({ caseId: vCase._id }).lean()).map((e) => e.action);
    for (const action of ['REVIEW_CASE_TAKEN', 'REVIEW_CASE_REASSIGNED', 'REVIEW_CASE_RELEASED']) assert.ok(actions.includes(action), action);
  });

  await t.test('review queue is paged server-side with totals in headers and filters', async () => {
    await VerificationCase.deleteMany({});
    for (let i = 0; i < 5; i += 1) await newCase({ status: i % 2 ? 'NEEDS_CORRECTION' : 'NEEDS_REVIEW' });
    await VerificationCase.create({ organizationId: otherOrg._id, createdBy: patient._id, status: 'NEEDS_REVIEW' });
    const first = await auth(request(app).get('/api/v1/review-queue?limit=2&page=1'), reviewer);
    assert.equal(first.status, 200);
    assert.equal(first.body.length, 2);
    assert.equal(first.headers['x-total-count'], '5', 'only own tenant');
    const third = await auth(request(app).get('/api/v1/review-queue?limit=2&page=3'), reviewer);
    assert.equal(third.body.length, 1);
    const corrections = await auth(request(app).get('/api/v1/review-queue?status=NEEDS_CORRECTION'), reviewer);
    assert.equal(corrections.headers['x-total-count'], '2');
    const target = first.body[0];
    await auth(request(app).post(`/api/v1/review/cases/${target._id || target.id}/assignment`), reviewer);
    assert.equal((await auth(request(app).get('/api/v1/review-queue?assigned=me'), reviewer)).headers['x-total-count'], '1');
    assert.equal((await auth(request(app).get('/api/v1/review-queue?assigned=unassigned'), pharmacist)).headers['x-total-count'], '4');
    assert.equal((await auth(request(app).get('/api/v1/review-queue?assigned=others'), pharmacist)).headers['x-total-count'], '1');
  });

  await t.test('reopen: admin only, with reason, blocked by an open claim, invalidates snapshots', async () => {
    const done = await newCase({ status: 'VERIFIED', evidenceRevision: 3 });
    assert.equal((await auth(request(app).post(`/api/v1/review/cases/${done._id}/reopen`).send({ reason: 'New evidence arrived from the pharmacy.' }), pharmacist)).status, 403);
    assert.equal((await auth(request(app).post(`/api/v1/review/cases/${done._id}/reopen`).send({ reason: 'short' }), admin)).status, 400);

    const grant = await CaseShareGrant.create({ caseId: done._id, granteeOrganizationId: payer._id, grantedBy: patient._id, scope: ['documents'], consentText: 'Synthetic consent text for tests.', expiresAt: new Date(Date.now() + 86400000) });
    const claim = await Claim.create({ caseId: done._id, claimantId: patient._id, pharmacyOrganizationId: org._id, payerOrganizationId: payer._id, shareGrantId: grant._id, policyNumber: 'SYN-REOPEN-1', claimedAmount: 100, status: 'SUBMITTED' });
    const blocked = await auth(request(app).post(`/api/v1/review/cases/${done._id}/reopen`).send({ reason: 'New evidence arrived from the pharmacy.' }), admin);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, 'CLAIM_IN_PROGRESS');

    await Claim.updateOne({ _id: claim._id }, { $set: { status: 'WITHDRAWN' } });
    const reopened = await auth(request(app).post(`/api/v1/review/cases/${done._id}/reopen`).send({ reason: 'New evidence arrived from the pharmacy.' }), admin);
    assert.equal(reopened.status, 200, JSON.stringify(reopened.body));
    assert.equal(reopened.body.status, 'NEEDS_REVIEW');
    assert.equal(reopened.body.evidenceRevision, 4);
    assert.equal(reopened.body.reopenCount, 1);
    assert.ok(await AuditEvent.exists({ caseId: done._id, action: 'CASE_REOPENED' }));
    assert.ok(await Notification.exists({ userId: patient._id, type: 'CASE_REOPENED' }));
    assert.equal((await auth(request(app).post(`/api/v1/review/cases/${done._id}/reopen`).send({ reason: 'Second reopen attempt while in review.' }), admin)).body.code, 'CASE_NOT_REOPENABLE');
  });

  await t.test('claim appeal: once, reason required, decided by a different insurer reviewer, insurer queue paged', async () => {
    const verified = await newCase({ status: 'VERIFIED' });
    const submit = await auth(request(app).post('/api/v1/claims').send({ caseId: String(verified._id), payerOrganizationId: String(payer._id), claimedAmount: 400, policyNumber: 'SYN-APPEAL-1', consent: { accepted: true } }), patient);
    assert.equal(submit.status, 201, JSON.stringify(submit.body));
    const id = submit.body.id;
    await auth(request(app).post(`/api/v1/payer/claims/${id}/start-review`), payerReviewer);
    const rejected = await auth(request(app).post(`/api/v1/payer/claims/${id}/decision`).send({ decision: 'REJECTED', reasonCode: 'DOCUMENT_MISMATCH', note: 'Invoice strength differs from the prescription.' }), payerReviewer);
    assert.equal(rejected.body.status, 'REJECTED');

    assert.equal((await auth(request(app).post(`/api/v1/claims/${id}/appeal`).send({ reason: 'too short' }), patient)).status, 400);
    const appealed = await auth(request(app).post(`/api/v1/claims/${id}/appeal`).send({ reason: 'The pharmacy corrected the invoice; strengths now match the prescription.' }), patient);
    assert.equal(appealed.status, 200, JSON.stringify(appealed.body));
    assert.equal(appealed.body.status, 'APPEALED');
    assert.equal(appealed.body.appeal.previousDecision.decision, 'REJECTED');
    assert.equal(appealed.body.decision, null);

    assert.equal((await auth(request(app).post(`/api/v1/payer/claims/${id}/start-review`), payerReviewer)).body.status, 'UNDER_PAYER_REVIEW');
    const sameReviewer = await auth(request(app).post(`/api/v1/payer/claims/${id}/decision`).send({ decision: 'APPROVED', note: 'Corrected invoice now matches.' }), payerReviewer);
    assert.equal(sameReviewer.status, 403);
    assert.equal(sameReviewer.body.code, 'FOUR_EYES_APPEAL');
    const approved = await auth(request(app).post(`/api/v1/payer/claims/${id}/decision`).send({ decision: 'APPROVED', note: 'Corrected invoice now matches.' }), payerAdmin);
    assert.equal(approved.body.status, 'APPROVED');
    assert.equal((await auth(request(app).post(`/api/v1/claims/${id}/appeal`).send({ reason: 'Trying to appeal an approved claim again.' }), patient)).status, 409);

    const page = await auth(request(app).get('/api/v1/payer/claims?limit=1'), payerReviewer);
    assert.equal(page.body.length, 1);
    // Two claims exist for this insurer: the reopen test's withdrawn claim and this one.
    assert.equal(page.headers['x-total-count'], String(await Claim.countDocuments({ payerOrganizationId: payer._id })));
    assert.equal(page.headers['x-total-count'], '2');
  });
});
