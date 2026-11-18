'use strict';

/**
 * Account security rules. Pure helpers (no database) so they can be unit tested.
 *
 * - Staff/insurer MFA enforcement (MFA_REQUIRED_FOR_STAFF=true): a staff account
 *   without MFA can sign in but may only reach profile, logout and MFA setup.
 * - Recovery codes: 8 one-time codes, stored as SHA-256 hashes, shown once.
 * - Per-account lockout: LOGIN_MAX_FAILURES (default 5) failed attempts lock the
 *   account for LOGIN_LOCK_MINUTES (default 15). Errors stay generic.
 * - Reviewer credential (REVIEW_CREDENTIAL_REQUIRED=true): a final VERIFY needs a
 *   professional registration confirmed by an organization admin.
 */
const crypto = require('node:crypto');

const STAFF_ROLES = Object.freeze(['pharmacy', 'pharmacist', 'claims_reviewer', 'org_admin', 'branch_manager', 'super_admin', 'admin', 'payer_reviewer', 'payer_admin', 'research_evaluator', 'auditor']);
const CREDENTIAL_ROLES = Object.freeze(['pharmacist', 'claims_reviewer', 'pharmacy']);
const RECOVERY_CODE_COUNT = 8;
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const RECOVERY_PATTERN = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

// Paths a staff user without MFA may still use when enforcement is on.
const MFA_SETUP_PATHS = [/^\/api\/users\/profile$/, /^\/api\/users\/logout$/, /^\/api\/users\/mfa\//, /^\/api\/v1\/notifications/];

const intEnv = (env, name, fallback, min, max) => {
  const n = Number(env[name]);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

function mfaEnforcedFor(role, env = process.env) {
  return env.MFA_REQUIRED_FOR_STAFF === 'true' && STAFF_ROLES.includes(role);
}

function needsMfaSetup(user, env = process.env) {
  return mfaEnforcedFor(user?.role, env) && !user?.mfa?.enabled;
}

function mfaSetupPathAllowed(originalUrl) {
  const path = String(originalUrl || '').split('?')[0];
  return MFA_SETUP_PATHS.some((rx) => rx.test(path));
}

function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  return Array.from({ length: count }, () => {
    const bytes = crypto.randomBytes(8);
    const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('');
    return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
  });
}

function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(`pv-recovery:${String(code).trim().toUpperCase()}`).digest('hex');
}

function looksLikeRecoveryCode(value) {
  return RECOVERY_PATTERN.test(String(value || '').trim().toUpperCase());
}

function lockoutPolicy(env = process.env) {
  return {
    maxFailures: intEnv(env, 'LOGIN_MAX_FAILURES', 5, 3, 20),
    lockMinutes: intEnv(env, 'LOGIN_LOCK_MINUTES', 15, 1, 1440)
  };
}

function isLocked(user, now = new Date()) {
  return Boolean(user?.login?.lockedUntil && new Date(user.login.lockedUntil) > now);
}

/** Returns the $set to apply after a failed attempt. */
function failureUpdate(user, now = new Date(), env = process.env) {
  const { maxFailures, lockMinutes } = lockoutPolicy(env);
  const failures = (user?.login?.failedCount || 0) + 1;
  if (failures >= maxFailures) {
    return { 'login.failedCount': 0, 'login.lockedUntil': new Date(now.getTime() + lockMinutes * 60_000), 'login.lastFailedAt': now };
  }
  return { 'login.failedCount': failures, 'login.lastFailedAt': now };
}

function credentialRequiredFor(role, env = process.env) {
  return env.REVIEW_CREDENTIAL_REQUIRED === 'true' && CREDENTIAL_ROLES.includes(role);
}

function hasVerifiedCredential(user) {
  return Boolean(user?.professional?.registrationNumber && user.professional.verifiedAt && user.professional.verifiedBy);
}

function validateRegistration({ registrationNumber, council }) {
  const number = typeof registrationNumber === 'string' ? registrationNumber.trim().toUpperCase() : '';
  const body = typeof council === 'string' ? council.trim() : '';
  if (!/^[A-Z0-9/-]{3,40}$/.test(number)) {
    throw Object.assign(new Error('Registration number must be 3–40 letters, digits, "/" or "-".'), { statusCode: 400, code: 'INVALID_REGISTRATION' });
  }
  if (body.length < 3 || body.length > 120) {
    throw Object.assign(new Error('Name the registering council (e.g. State Pharmacy Council).'), { statusCode: 400, code: 'INVALID_COUNCIL' });
  }
  return { registrationNumber: number, council: body };
}

module.exports = {
  STAFF_ROLES,
  CREDENTIAL_ROLES,
  RECOVERY_CODE_COUNT,
  mfaEnforcedFor,
  needsMfaSetup,
  mfaSetupPathAllowed,
  generateRecoveryCodes,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  lockoutPolicy,
  isLocked,
  failureUpdate,
  credentialRequiredFor,
  hasVerifiedCredential,
  validateRegistration
};
