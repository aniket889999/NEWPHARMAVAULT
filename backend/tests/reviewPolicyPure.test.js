'use strict';

// Database-free tests for reviewer workflow rules and the claim appeal state machine.
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../services/review/reviewPolicy');
const sm = require('../services/claims/claimStateMachine');

const A = '65a0000000000000000000a1';
const B = '65a0000000000000000000b2';

test('four-eyes applies only to the final VERIFY by the creator or a document uploader', () => {
  const vCase = { createdBy: A };
  assert.equal(policy.fourEyesViolation({ action: 'VERIFY', reviewerId: A, vCase }), 'FOUR_EYES_CASE_CREATOR');
  assert.equal(policy.fourEyesViolation({ action: 'VERIFY', reviewerId: B, vCase, documentUploaderIds: [B] }), 'FOUR_EYES_DOCUMENT_UPLOADER');
  assert.equal(policy.fourEyesViolation({ action: 'VERIFY', reviewerId: B, vCase, documentUploaderIds: [A] }), null);
  assert.equal(policy.fourEyesViolation({ action: 'ESCALATE', reviewerId: A, vCase }), null);
  assert.equal(policy.fourEyesViolation({ action: 'RETURN_FOR_CORRECTION', reviewerId: A, vCase }), null);
  assert.equal(policy.fourEyesViolation({ action: 'VERIFY', reviewerId: B, vCase: { createdBy: { _id: B } } }), 'FOUR_EYES_CASE_CREATOR', 'populated refs compare by id');
});

test('assignment lease: active lease blocks others, expired lease does not', () => {
  const now = new Date('2026-11-18T10:00:00Z');
  const held = { assignedTo: A, assignedAt: now, assignmentExpiresAt: new Date(now.getTime() + 60_000) };
  assert.ok(policy.activeAssignment(held, now));
  assert.doesNotThrow(() => policy.assertNotAssignedToOther(held, A, now));
  assert.throws(() => policy.assertNotAssignedToOther(held, B, now), { code: 'CASE_ASSIGNED_TO_OTHER', statusCode: 409 });
  const expired = { ...held, assignmentExpiresAt: new Date(now.getTime() - 1) };
  assert.equal(policy.activeAssignment(expired, now), null);
  assert.doesNotThrow(() => policy.assertNotAssignedToOther(expired, B, now));
  assert.equal(policy.assignmentMinutes({}), 30);
  assert.equal(policy.assignmentMinutes({ REVIEW_ASSIGNMENT_MINUTES: '9999' }), 240);
  assert.equal(policy.assignmentMinutes({ REVIEW_ASSIGNMENT_MINUTES: '-5' }), 30);
  assert.deepEqual(policy.takeableFilter(A, B, { override: true }), { _id: A });
});

test('reopen: admin only, finished cases only, reason required, blocked by open claims', () => {
  const ok = { role: 'org_admin', status: 'VERIFIED', reason: 'New pharmacist evidence received.', openClaimCount: 0 };
  assert.equal(policy.validateReopen(ok), 'New pharmacist evidence received.');
  assert.throws(() => policy.validateReopen({ ...ok, role: 'pharmacist' }), { code: 'FORBIDDEN_ROLE' });
  assert.throws(() => policy.validateReopen({ ...ok, status: 'NEEDS_REVIEW' }), { code: 'CASE_NOT_REOPENABLE' });
  assert.throws(() => policy.validateReopen({ ...ok, status: 'CLOSED' }), { code: 'CASE_NOT_REOPENABLE' });
  assert.throws(() => policy.validateReopen({ ...ok, reason: 'short' }), { code: 'REOPEN_REASON_REQUIRED' });
  assert.throws(() => policy.validateReopen({ ...ok, openClaimCount: 1 }), { code: 'CLAIM_IN_PROGRESS' });
});

test('queue paging is bounded and filters are whitelisted', () => {
  assert.deepEqual(policy.parseQueueQuery({}), { page: 1, limit: 50, status: null, assigned: null, sort: 'oldest', q: '' });
  const p = policy.parseQueueQuery({ page: '0', limit: '5000', status: 'VERIFIED', assigned: 'x', sort: 'newest', q: ' CASE-1 ' });
  assert.deepEqual(p, { page: 1, limit: 100, status: null, assigned: null, sort: 'newest', q: 'CASE-1' });
  const f = policy.queueFilter({ organizationId: 'org' }, { status: null, assigned: 'me', q: 'a.b' }, A, new Date(0));
  assert.deepEqual(f.status, { $in: ['NEEDS_REVIEW', 'NEEDS_CORRECTION'] });
  assert.equal(f.organizationId, 'org', 'tenant filter is kept');
  assert.equal(f.$and[0].$or[0].caseReference.source, '^a\\.b', 'search is escaped and anchored');
  assert.equal(f.$and[1].assignedTo, A);
});

test('claim appeal: once, only after a negative or partial decision, decided again by payer', () => {
  assert.equal(sm.canTransition('REJECTED', 'APPEALED', 'patient'), true);
  assert.equal(sm.canTransition('PARTIALLY_APPROVED', 'APPEALED', 'patient'), true);
  assert.equal(sm.canTransition('APPROVED', 'APPEALED', 'patient'), false);
  assert.equal(sm.canTransition('REJECTED', 'APPEALED', 'payer_reviewer'), false);
  assert.equal(sm.canTransition('APPEALED', 'UNDER_PAYER_REVIEW', 'payer_reviewer'), true);
  assert.equal(sm.canTransition('APPEALED', 'APPROVED', 'payer_reviewer'), false, 'review must be reopened first');
  assert.equal(sm.validateAppeal({ status: 'REJECTED', appealCount: 0, reason: 'The invoice shows the prescribed strength exactly.' }).length > 20, true);
  assert.throws(() => sm.validateAppeal({ status: 'REJECTED', appealCount: 1, reason: 'x'.repeat(30) }), { code: 'APPEAL_ALREADY_USED' });
  assert.throws(() => sm.validateAppeal({ status: 'APPROVED', reason: 'x'.repeat(30) }), { code: 'NOT_APPEALABLE' });
  assert.throws(() => sm.validateAppeal({ status: 'REJECTED', reason: 'too short' }), { code: 'APPEAL_REASON_REQUIRED' });
  assert.equal(sm.isTerminal('REJECTED', 0), false);
  assert.equal(sm.isTerminal('REJECTED', 1), true);
});
