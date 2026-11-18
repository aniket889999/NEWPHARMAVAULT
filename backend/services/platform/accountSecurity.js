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
    lockMinutes: intEnv(env, 'LOGIN_LOCK_MINUTES', 15, 1, 1440),
    // Distributed guessing from many addresses still locks the whole account, but only at a much higher count.
    accountMaxFailures: intEnv(env, 'LOGIN_ACCOUNT_MAX_FAILURES', 50, 10, 1000)
  };
}

const MAX_TRACKED_SOURCES = 20;

/** Stable, non-reversible key for the client address (raw IPs are never stored). */
function sourceKey(ip, env = process.env) {
  const salt = env.JWT_SECRET || 'pharmavault';
  return crypto.createHash('sha256').update(`login-source:${salt}:${String(ip || 'unknown')}`).digest('hex').slice(0, 24);
}

/**
 * Locked when this source address is locked, or the whole account is (distributed attack).
 * Someone who only knows a colleague's email can therefore lock out only their own address.
 */
function isLocked(user, now = new Date(), source = null) {
  const login = user?.login || {};
  if (login.lockedUntil && new Date(login.lockedUntil) > now) return true;
  if (!source) return false;
  const entry = (login.sources || []).find((s) => s.key === source);
  return Boolean(entry?.lockedUntil && new Date(entry.lockedUntil) > now);
}

function anyLock(user, now = new Date()) {
  const login = user?.login || {};
  return isLocked(user, now) || (login.sources || []).some((s) => s.lockedUntil && new Date(s.lockedUntil) > now);
}

/** Returns the $set to apply after a failed attempt from `source`. */
function failureUpdate(user, now = new Date(), env = process.env, source = 'unknown') {
  const { maxFailures, lockMinutes, accountMaxFailures } = lockoutPolicy(env);
  const until = new Date(now.getTime() + lockMinutes * 60_000);
  const login = user?.login || {};
  const sources = (login.sources || [])
    .filter((s) => s.key !== source && (!s.lockedUntil || new Date(s.lockedUntil) > now || s.failedCount))
    .slice(-(MAX_TRACKED_SOURCES - 1))
    .map((s) => ({ key: s.key, failedCount: s.failedCount || 0, lockedUntil: s.lockedUntil || null }));
  const previous = (login.sources || []).find((s) => s.key === source);
  const count = (previous?.failedCount || 0) + 1;
  const sourceLocked = count >= maxFailures;
  sources.push({ key: source, failedCount: sourceLocked ? 0 : count, lockedUntil: sourceLocked ? until : (previous?.lockedUntil || null) });
  const accountCount = (login.failedCount || 0) + 1;
  const accountLocked = accountCount >= accountMaxFailures;
  return {
    'login.sources': sources,
    'login.failedCount': accountLocked ? 0 : accountCount,
    'login.lastFailedAt': now,
    ...(accountLocked ? { 'login.lockedUntil': until } : {}),
    ...(sourceLocked || accountLocked ? { lockedNow: { scope: accountLocked ? 'account' : 'source', until } } : {})
  };
}

/** Removes the helper key before the update is written. */
function storedFailureUpdate(update) {
  const { lockedNow, ...rest } = update;
  return rest;
}

function credentialRequiredFor(role, env = process.env) {
  return env.REVIEW_CREDENTIAL_REQUIRED === 'true' && CREDENTIAL_ROLES.includes(role);
}

function hasVerifiedCredential(user, now = new Date()) {
  const p = user?.professional;
  if (!p?.registrationNumber || !p.verifiedAt || !p.verifiedBy) return false;
  // A registration past its renewal date no longer counts until the admin re-confirms it.
  return !(p.validUntil && new Date(p.validUntil) < now);
}

function validateRegistration({ registrationNumber, council, checkedVia, validUntil }) {
  const number = typeof registrationNumber === 'string' ? registrationNumber.trim().toUpperCase() : '';
  const body = typeof council === 'string' ? council.trim() : '';
  if (!/^[A-Z0-9/-]{3,40}$/.test(number)) {
    throw Object.assign(new Error('Registration number must be 3–40 letters, digits, "/" or "-".'), { statusCode: 400, code: 'INVALID_REGISTRATION' });
  }
  if (body.length < 3 || body.length > 120) {
    throw Object.assign(new Error('Name the registering council (e.g. State Pharmacy Council).'), { statusCode: 400, code: 'INVALID_COUNCIL' });
  }
  const method = typeof checkedVia === 'string' ? checkedVia.trim() : '';
  if (method.length < 5 || method.length > 200) {
    throw Object.assign(new Error('Say how you checked the registration (e.g. "State Pharmacy Council register, searched by number").'), { statusCode: 400, code: 'INVALID_CHECK_METHOD' });
  }
  let renewal = null;
  if (validUntil) {
    renewal = new Date(validUntil);
    if (Number.isNaN(renewal.getTime()) || renewal < new Date()) {
      throw Object.assign(new Error('The renewal date must be a future date.'), { statusCode: 400, code: 'INVALID_VALID_UNTIL' });
    }
  }
  return { registrationNumber: number, council: body, checkedVia: method, validUntil: renewal };
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
  anyLock,
  sourceKey,
  failureUpdate,
  storedFailureUpdate,
  credentialRequiredFor,
  hasVerifiedCredential,
  validateRegistration
};
