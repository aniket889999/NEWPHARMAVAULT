'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sec = require('../services/platform/accountSecurity');

test('MFA enforcement applies only to staff roles and only when the flag is on', () => {
  const on = { MFA_REQUIRED_FOR_STAFF: 'true' };
  assert.equal(sec.mfaEnforcedFor('pharmacist', on), true);
  assert.equal(sec.mfaEnforcedFor('payer_reviewer', on), true);
  assert.equal(sec.mfaEnforcedFor('patient', on), false);
  assert.equal(sec.mfaEnforcedFor('pharmacist', {}), false);
  assert.equal(sec.needsMfaSetup({ role: 'org_admin', mfa: { enabled: false } }, on), true);
  assert.equal(sec.needsMfaSetup({ role: 'org_admin', mfa: { enabled: true } }, on), false);
});

test('only profile, logout, MFA and notification paths are open during forced MFA setup', () => {
  for (const ok of ['/api/users/profile', '/api/users/logout', '/api/users/mfa/setup', '/api/users/mfa/enable?x=1', '/api/v1/notifications']) assert.equal(sec.mfaSetupPathAllowed(ok), true, ok);
  for (const blocked of ['/api/review-queue', '/api/users/staff', '/api/v1/claims', '/api/users/profile/extra', '/api/cases/abc']) assert.equal(sec.mfaSetupPathAllowed(blocked), false, blocked);
});

test('recovery codes are unique, well-formed and hashed case-insensitively', () => {
  const codes = sec.generateRecoveryCodes();
  assert.equal(codes.length, sec.RECOVERY_CODE_COUNT);
  assert.equal(new Set(codes).size, codes.length);
  for (const c of codes) assert.equal(sec.looksLikeRecoveryCode(c), true, c);
  assert.equal(sec.hashRecoveryCode(codes[0]), sec.hashRecoveryCode(` ${codes[0].toLowerCase()} `));
  assert.notEqual(sec.hashRecoveryCode(codes[0]), sec.hashRecoveryCode(codes[1]));
  assert.equal(sec.looksLikeRecoveryCode('123456'), false, 'a TOTP code is not a recovery code');
  assert.equal(sec.looksLikeRecoveryCode('ABCD-EFG0'), false, 'ambiguous characters are excluded');
});

test('lockout counts failures and locks at the threshold', () => {
  const env = { LOGIN_MAX_FAILURES: '3', LOGIN_LOCK_MINUTES: '10' };
  const now = new Date('2026-11-18T10:00:00Z');
  assert.deepEqual(sec.failureUpdate({ login: { failedCount: 0 } }, now, env), { 'login.failedCount': 1, 'login.lastFailedAt': now });
  const lock = sec.failureUpdate({ login: { failedCount: 2 } }, now, env);
  assert.equal(lock['login.failedCount'], 0);
  assert.equal(lock['login.lockedUntil'].toISOString(), '2026-11-18T10:10:00.000Z');
  assert.equal(sec.isLocked({ login: { lockedUntil: lock['login.lockedUntil'] } }, now), true);
  assert.equal(sec.isLocked({ login: { lockedUntil: lock['login.lockedUntil'] } }, new Date('2026-11-18T10:11:00Z')), false);
  assert.deepEqual(sec.lockoutPolicy({ LOGIN_MAX_FAILURES: '1', LOGIN_LOCK_MINUTES: 'x' }), { maxFailures: 5, lockMinutes: 15 }, 'out-of-range values fall back to defaults');
});

test('reviewer credential rule and registration validation', () => {
  const on = { REVIEW_CREDENTIAL_REQUIRED: 'true' };
  assert.equal(sec.credentialRequiredFor('pharmacist', on), true);
  assert.equal(sec.credentialRequiredFor('org_admin', on), false);
  assert.equal(sec.credentialRequiredFor('pharmacist', {}), false);
  assert.equal(sec.hasVerifiedCredential({ professional: { registrationNumber: 'MH/12345', verifiedAt: new Date(), verifiedBy: 'x' } }), true);
  assert.equal(sec.hasVerifiedCredential({ professional: { registrationNumber: 'MH/12345' } }), false);
  assert.deepEqual(sec.validateRegistration({ registrationNumber: ' mh/12345 ', council: 'State Pharmacy Council' }), { registrationNumber: 'MH/12345', council: 'State Pharmacy Council' });
  assert.throws(() => sec.validateRegistration({ registrationNumber: 'x', council: 'State Pharmacy Council' }), /Registration number/);
  assert.throws(() => sec.validateRegistration({ registrationNumber: 'MH/12345', council: '' }), /council/);
});
