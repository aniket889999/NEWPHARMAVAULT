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

test('lockout is per source address; only many failures lock the whole account', () => {
  const env = { LOGIN_MAX_FAILURES: '3', LOGIN_LOCK_MINUTES: '10', LOGIN_ACCOUNT_MAX_FAILURES: '10' };
  const now = new Date('2026-11-18T10:00:00Z');
  const apply = (user, update) => {
    const login = { ...(user.login || {}) };
    for (const [k, v] of Object.entries(sec.storedFailureUpdate(update))) login[k.replace('login.', '')] = v;
    return { login };
  };
  const attacker = sec.sourceKey('203.0.113.9', env), owner = sec.sourceKey('198.51.100.7', env);
  assert.notEqual(attacker, owner);
  let user = { login: {} };
  for (let i = 0; i < 3; i += 1) user = apply(user, sec.failureUpdate(user, now, env, attacker));
  assert.equal(sec.isLocked(user, now, attacker), true, 'the guessing address is locked');
  assert.equal(sec.isLocked(user, now, owner), false, 'the real owner can still sign in from elsewhere');
  assert.equal(sec.anyLock(user, now), true);
  assert.equal(sec.isLocked(user, new Date('2026-11-18T10:11:00Z'), attacker), false, 'lock expires');
  for (let i = 0; i < 7; i += 1) user = apply(user, sec.failureUpdate(user, now, env, sec.sourceKey(`10.0.0.${i}`, env)));
  assert.equal(sec.isLocked(user, now, owner), true, 'distributed guessing locks the account at the higher threshold');
  assert.deepEqual(sec.lockoutPolicy({ LOGIN_MAX_FAILURES: '1', LOGIN_LOCK_MINUTES: 'x' }), { maxFailures: 5, lockMinutes: 15, accountMaxFailures: 50 }, 'out-of-range values fall back to defaults');
});

test('reviewer credential rule and registration validation', () => {
  const on = { REVIEW_CREDENTIAL_REQUIRED: 'true' };
  assert.equal(sec.credentialRequiredFor('pharmacist', on), true);
  assert.equal(sec.credentialRequiredFor('org_admin', on), false);
  assert.equal(sec.credentialRequiredFor('pharmacist', {}), false);
  assert.equal(sec.hasVerifiedCredential({ professional: { registrationNumber: 'MH/12345', verifiedAt: new Date(), verifiedBy: 'x' } }), true);
  assert.equal(sec.hasVerifiedCredential({ professional: { registrationNumber: 'MH/12345' } }), false);
  assert.deepEqual(sec.validateRegistration({ registrationNumber: ' mh/12345 ', council: 'State Pharmacy Council', checkedVia: 'Council register search' }), { registrationNumber: 'MH/12345', council: 'State Pharmacy Council', checkedVia: 'Council register search', validUntil: null });
  assert.throws(() => sec.validateRegistration({ registrationNumber: 'MH/12345', council: 'State Pharmacy Council' }), /how you checked/);
  assert.equal(sec.hasVerifiedCredential({ professional: { registrationNumber: 'MH/1', verifiedAt: new Date(), verifiedBy: 'x', validUntil: new Date('2020-01-01') } }), false, 'expired registration');
  assert.throws(() => sec.validateRegistration({ registrationNumber: 'x', council: 'State Pharmacy Council', checkedVia: 'Council register search' }), /Registration number/);
  assert.throws(() => sec.validateRegistration({ registrationNumber: 'MH/12345', council: '', checkedVia: 'Council register search' }), /council/);
});
