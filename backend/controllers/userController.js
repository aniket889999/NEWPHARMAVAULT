const User = require('../models/userModel');
const asyncHandler = require('../middleware/asyncHandler');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { isWebClient, verifyBrowserMutation, setBrowserSession, clearBrowserSession } = require('../config/browserSession');
const { generateSecret, verifyTotp, otpauthUri, encryptSecret, decryptSecret } = require('../utils/totp');
const accountSecurity = require('../services/platform/accountSecurity');
const auditLoggerService = require('../services/trustRag/auditLoggerService');
const dummyPasswordHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

function credentials(body, { registration = false } = {}) {
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || body.email.length > 254 ||
    !body.password.length || Buffer.byteLength(body.password, 'utf8') > 72 ||
    (body.role !== undefined && typeof body.role !== 'string')) throw Object.assign(new Error('Valid account credentials are required.'), { statusCode: 400 });
  if (registration && (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 120 || body.password.length < 15)) {
    throw Object.assign(new Error('Provide a name and a password of at least 15 characters (maximum 72 UTF-8 bytes).'), { statusCode: 400 });
  }
  return { email: body.email.trim().toLowerCase(), password: body.password, role: body.role, ...(registration ? { name: body.name.trim() } : {}) };
}
function maskPhoneSafe(phone) {
  return require('../services/platform/textMessaging').maskPhone(phone);
}
function profile(user) {
  return { _id: user._id, name: user.name, email: user.email, role: user.role, mfaEnabled: Boolean(user.mfa?.enabled), mfaSetupRequired: accountSecurity.needsMfaSetup(user),
    textAlerts: { enabled: Boolean(user.contact?.textOptIn), channel: user.contact?.channel || 'sms', phone: maskPhoneSafe(user.contact?.phone) },
    ...(user.organizationId ? { organizationId: user.organizationId } : {}), ...(user.branchId ? { branchId: user.branchId } : {}) };
}
function sendSession(req, res, user, status = 200) {
  const web = isWebClient(req), token = generateToken(user._id, user.sessionVersion || 0, { web });
  res.setHeader('Cache-Control', 'private, no-store');
  if (web) setBrowserSession(res, token);
  return res.status(status).json({ ...profile(user), ...(web ? { session: 'HTTP_ONLY_COOKIE' } : { token }) });
}

// @desc    Auth user & get token (Login)
// @route   POST /api/users/login
const authUser = asyncHandler(async (req, res) => {
  if (isWebClient(req)) verifyBrowserMutation(req);
  const { email, password, role } = credentials(req.body);
  const user = await User.findOne({ email }).select('+sessionVersion +mfa.secretEnc +mfa.lastUsedCounter');
  const matches = await bcrypt.compare(password, user?.password || dummyPasswordHash);
  const now = new Date();
  const source = accountSecurity.sourceKey(req.ip);
  // Locked or deactivated accounts get the same opaque error as a wrong password.
  const blocked = user && (user.active === false || accountSecurity.isLocked(user, now, source));
  if (user && matches && user.role === role && !blocked) {
    if (user.mfa?.enabled) {
      const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';
      if (!otp) {
        return res.status(401).json({ message: 'Enter the 6-digit code from your authenticator app.', mfaRequired: true });
      }
      let accepted = false;
      if (accountSecurity.looksLikeRecoveryCode(otp)) {
        // One-time recovery code: atomically removed so it can never be reused.
        accepted = await User.updateOne(
          { _id: user._id, 'mfa.recoveryCodeHashes': accountSecurity.hashRecoveryCode(otp) },
          { $pull: { 'mfa.recoveryCodeHashes': accountSecurity.hashRecoveryCode(otp) } }
        ).then((r) => r.modifiedCount === 1);
        if (accepted) {
          await auditLoggerService.logEvent({ actorId: user._id, actorRole: user.role, action: 'MFA_RECOVERY_CODE_USED', targetType: 'User', targetId: user._id, metadata: {} });
        }
      } else {
        const counter = verifyTotp(decryptSecret(user.mfa.secretEnc), otp, { lastUsedCounter: user.mfa.lastUsedCounter ?? -1 });
        // Atomic update blocks the same code being replayed in parallel requests.
        accepted = counter !== null && await User.updateOne(
          { _id: user._id, 'mfa.lastUsedCounter': { $lt: counter } },
          { $set: { 'mfa.lastUsedCounter': counter } }
        ).then((r) => r.modifiedCount === 1);
      }
      if (!accepted) {
        await User.updateOne({ _id: user._id }, { $set: accountSecurity.storedFailureUpdate(accountSecurity.failureUpdate(user, now, process.env, source)) });
        return res.status(401).json({ message: 'The authenticator code is invalid or already used.', mfaRequired: true });
      }
    }
    if (user.login?.failedCount || user.login?.lockedUntil || user.login?.sources?.length) {
      await User.updateOne({ _id: user._id }, { $set: { 'login.failedCount': 0, 'login.lockedUntil': null, 'login.sources': [] } });
    }
    sendSession(req, res, user);
  } else {
    if (user && !blocked) {
      const update = accountSecurity.failureUpdate(user, now, process.env, source);
      await User.updateOne({ _id: user._id }, { $set: accountSecurity.storedFailureUpdate(update) });
      if (update.lockedNow) {
        await auditLoggerService.logEvent({ actorId: user._id, actorRole: user.role, action: 'ACCOUNT_LOCKED', targetType: 'User', targetId: user._id, metadata: { scope: update.lockedNow.scope, until: update.lockedNow.until.toISOString() } });
      }
    }
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

const Organization = require('../models/organizationModel');

// @desc    Register a new user (Public Self-Registration: patient only)
// @route   POST /api/users/register
const registerUser = asyncHandler(async (req, res) => {
  if (isWebClient(req)) verifyBrowserMutation(req);
  const { role } = req.body;

  // Public self-registration only permits the allowed submitter role (patient)
  if (role && role !== 'patient') {
    res.status(403);
    throw new Error('Public self-registration only permits the submitter (patient) role. Staff accounts must be provisioned by an authorized organization administrator.');
  }
  const { name, email, password } = credentials(req.body, { registration: true });

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('Registration could not be completed.');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: 'patient',
  });

  if (user) {
    sendSession(req, res, user, 201);
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Provision a new staff user (Org Admin or Super Admin)
// @route   POST /api/users/provision-staff
// @access  Private (org_admin, super_admin)
const provisionStaff = asyncHandler(async (req, res) => {
  if (!req.user || !['org_admin', 'super_admin', 'payer_admin'].includes(req.user.role)) {
    res.status(403);
    throw new Error('Access denied: Staff provisioning requires an authorized organization administrator.');
  }

  const { name, email, password, role, organizationId, branchId } = req.body;

  if (!email || !password || !name) {
    res.status(400);
    throw new Error('Name, email, and password are required for staff provisioning.');
  }

  // Payer admins can only add insurer staff; pharmacy org admins cannot create insurer staff.
  const allowedStaffRoles = req.user.role === 'payer_admin'
    ? ['payer_reviewer', 'payer_admin']
    : req.user.role === 'org_admin'
      ? ['pharmacist', 'pharmacy', 'claims_reviewer', 'org_admin', 'branch_manager']
      : ['pharmacist', 'pharmacy', 'claims_reviewer', 'org_admin', 'branch_manager', 'payer_reviewer', 'payer_admin'];
  if (!role || !allowedStaffRoles.includes(role)) {
    res.status(400);
    throw new Error(`Invalid staff role. Allowed staff roles: ${allowedStaffRoles.join(', ')}`);
  }
  credentials(req.body, { registration: true });

  // Determine explicit target organization
  let targetOrgId = ['org_admin', 'payer_admin'].includes(req.user.role)
    ? (req.user.organizationId || req.tenantContext?.organizationId)
    : organizationId;

  if (!targetOrgId) {
    res.status(400);
    throw new Error('Staff provisioning requires an explicit organization membership.');
  }

  const orgExists = await Organization.findById(targetOrgId);
  if (!orgExists) {
    res.status(404);
    throw new Error('Specified organization does not exist.');
  }
  const payerRole = ['payer_reviewer', 'payer_admin'].includes(role);
  if (payerRole !== (orgExists.kind === 'payer')) {
    res.status(400);
    throw new Error('Insurer roles belong only to payer organizations, and pharmacy roles only to pharmacy organizations.');
  }
  if (branchId) {
    const Branch = require('../models/branchModel');
    const branch = await Branch.findOne({ _id: branchId, organizationId: targetOrgId });
    if (!branch) throw Object.assign(new Error('Specified branch is unavailable for this organization.'), { statusCode: 400 });
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    organizationId: targetOrgId,
    branchId: branchId || null
  });

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    branchId: user.branchId,
    // Provisioning an account does not mint an impersonation token for its admin.
  });
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(profile(user));
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

const logoutUser = asyncHandler(async (req, res) => {
  // Durable in MongoDB, so every process rejects all earlier web/native sessions.
  await User.updateOne({ _id: req.user._id }, { $inc: { sessionVersion: 1 } });
  clearBrowserSession(res);
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(204).end();
});


// @desc    Start TOTP MFA enrolment (returns secret once; stored encrypted as pending)
// @route   POST /api/users/mfa/setup
const setupMfa = asyncHandler(async (req, res) => {
  if (isWebClient(req)) verifyBrowserMutation(req);
  const user = await User.findById(req.user._id);
  if (user.mfa?.enabled) {
    res.status(409);
    throw new Error('MFA is already enabled. Disable it first to enrol a new device.');
  }
  const secret = generateSecret();
  await User.updateOne({ _id: user._id }, { $set: { 'mfa.pendingSecretEnc': encryptSecret(secret) } });
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({ secret, otpauthUri: otpauthUri({ secret, accountName: user.email }) });
});

// @desc    Confirm enrolment with a valid code
// @route   POST /api/users/mfa/enable
const enableMfa = asyncHandler(async (req, res) => {
  if (isWebClient(req)) verifyBrowserMutation(req);
  const user = await User.findById(req.user._id).select('+mfa.pendingSecretEnc');
  if (!user.mfa?.pendingSecretEnc) {
    res.status(400);
    throw new Error('Start MFA setup first.');
  }
  const secret = decryptSecret(user.mfa.pendingSecretEnc);
  const counter = verifyTotp(secret, String(req.body?.code || '').trim());
  if (counter === null) {
    res.status(400);
    throw new Error('The code did not match. Check the time on your phone and try again.');
  }
  const recoveryCodes = accountSecurity.generateRecoveryCodes();
  await User.updateOne({ _id: user._id }, {
    $set: {
      'mfa.enabled': true, 'mfa.secretEnc': user.mfa.pendingSecretEnc, 'mfa.pendingSecretEnc': null, 'mfa.lastUsedCounter': counter, 'mfa.enabledAt': new Date(),
      'mfa.recoveryCodeHashes': recoveryCodes.map(accountSecurity.hashRecoveryCode)
    },
    // Enabling MFA revokes other sessions.
    $inc: { sessionVersion: 1 }
  });
  await auditLoggerService.logEvent({ actorId: user._id, actorRole: user.role, action: 'MFA_ENABLED', targetType: 'User', targetId: user._id, metadata: {} });
  const fresh = await User.findById(user._id).select('+sessionVersion');
  // Recovery codes are returned exactly once, together with the new session.
  const web = isWebClient(req), token = generateToken(fresh._id, fresh.sessionVersion || 0, { web });
  res.setHeader('Cache-Control', 'private, no-store');
  if (web) setBrowserSession(res, token);
  res.status(200).json({ ...profile(fresh), ...(web ? { session: 'HTTP_ONLY_COOKIE' } : { token }), recoveryCodes });
});

// @desc    Disable MFA (requires a current code)
// @route   POST /api/users/mfa/disable
const disableMfa = asyncHandler(async (req, res) => {
  if (isWebClient(req)) verifyBrowserMutation(req);
  const user = await User.findById(req.user._id).select('+mfa.secretEnc +mfa.lastUsedCounter');
  if (!user.mfa?.enabled) {
    res.status(400);
    throw new Error('MFA is not enabled.');
  }
  const counter = verifyTotp(decryptSecret(user.mfa.secretEnc), String(req.body?.code || '').trim(), { lastUsedCounter: user.mfa.lastUsedCounter ?? -1 });
  if (counter === null) {
    res.status(400);
    throw new Error('The code did not match.');
  }
  if (accountSecurity.mfaEnforcedFor(user.role)) {
    res.status(403);
    throw new Error('Two-factor authentication is required for staff accounts in this deployment and cannot be turned off.');
  }
  await User.updateOne({ _id: user._id }, { $set: { 'mfa.enabled': false, 'mfa.secretEnc': null, 'mfa.pendingSecretEnc': null, 'mfa.enabledAt': null, 'mfa.lastUsedCounter': -1, 'mfa.recoveryCodeHashes': [] } });
  await auditLoggerService.logEvent({ actorId: user._id, actorRole: user.role, action: 'MFA_DISABLED', targetType: 'User', targetId: user._id, metadata: {} });
  res.status(200).json({ mfaEnabled: false });
});

// @desc    Replace recovery codes (requires a current authenticator code)
// @route   POST /api/users/mfa/recovery-codes
const regenerateRecoveryCodes = asyncHandler(async (req, res) => {
  if (isWebClient(req)) verifyBrowserMutation(req);
  const user = await User.findById(req.user._id).select('+mfa.secretEnc +mfa.lastUsedCounter');
  if (!user.mfa?.enabled) {
    res.status(400);
    throw new Error('MFA is not enabled.');
  }
  const counter = verifyTotp(decryptSecret(user.mfa.secretEnc), String(req.body?.code || '').trim(), { lastUsedCounter: user.mfa.lastUsedCounter ?? -1 });
  if (counter === null) {
    res.status(400);
    throw new Error('The code did not match.');
  }
  const recoveryCodes = accountSecurity.generateRecoveryCodes();
  await User.updateOne({ _id: user._id }, { $set: { 'mfa.lastUsedCounter': counter, 'mfa.recoveryCodeHashes': recoveryCodes.map(accountSecurity.hashRecoveryCode) } });
  await auditLoggerService.logEvent({ actorId: user._id, actorRole: user.role, action: 'MFA_RECOVERY_CODES_REGENERATED', targetType: 'User', targetId: user._id, metadata: {} });
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({ recoveryCodes });
});

// @desc    List staff accounts in the administrator's own organization
// @route   GET /api/users/staff
const listStaff = asyncHandler(async (req, res) => {
  if (!['org_admin', 'payer_admin', 'super_admin'].includes(req.user?.role)) {
    res.status(403);
    throw new Error('Access denied: Staff list requires an organization administrator.');
  }
  const orgId = req.user.role === 'super_admin' ? req.query.organizationId : (req.user.organizationId || req.tenantContext?.organizationId);
  if (!orgId) {
    res.status(400);
    throw new Error('An organization is required.');
  }
  const [org, staff] = await Promise.all([
    Organization.findById(orgId).select('name kind').lean(),
    User.find({ organizationId: orgId, role: { $ne: 'patient' } }).select('name email role branchId mfa.enabled active login professional createdAt').sort('name').lean()
  ]);
  if (!org) {
    res.status(404);
    throw new Error('Organization not found.');
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({
    organization: { id: String(org._id), name: org.name, kind: org.kind || 'pharmacy', allowSingleReviewerVerify: Boolean(org.reviewPolicy?.allowSingleReviewerVerify) },
    assignableRoles: org.kind === 'payer' ? ['payer_reviewer', 'payer_admin'] : ['pharmacist', 'pharmacy', 'claims_reviewer', 'org_admin', 'branch_manager'],
    staff: staff.map((u) => ({
      id: String(u._id), name: u.name, email: u.email, role: u.role, mfaEnabled: Boolean(u.mfa?.enabled), createdAt: u.createdAt,
      active: u.active !== false,
      locked: accountSecurity.anyLock(u),
      credential: u.professional?.registrationNumber
        ? { registrationNumber: u.professional.registrationNumber, council: u.professional.council, verifiedAt: u.professional.verifiedAt, checkedVia: u.professional.checkedVia || null, validUntil: u.professional.validUntil || null, expired: Boolean(u.professional.validUntil && new Date(u.professional.validUntil) < new Date()) }
        : null,
      credentialRequired: accountSecurity.CREDENTIAL_ROLES.includes(u.role)
    })),
    mfaRequiredForStaff: process.env.MFA_REQUIRED_FOR_STAFF === 'true',
    credentialRequiredForReview: process.env.REVIEW_CREDENTIAL_REQUIRED === 'true'
  });
});

const STAFF_ADMIN_ROLES = ['org_admin', 'payer_admin', 'super_admin'];

/** Loads a staff account the caller administers (same organization; never patients). */
async function administeredStaff(req, res) {
  if (isWebClient(req)) verifyBrowserMutation(req);
  if (!STAFF_ADMIN_ROLES.includes(req.user?.role)) {
    res.status(403);
    throw new Error('Access denied: Staff administration requires an organization administrator.');
  }
  if (!/^[a-f\d]{24}$/i.test(String(req.params.userId))) {
    res.status(404);
    throw new Error('Staff member not found.');
  }
  const filter = { _id: req.params.userId, role: { $ne: 'patient' } };
  if (req.user.role !== 'super_admin') filter.organizationId = req.user.organizationId || req.tenantContext?.organizationId;
  const target = await User.findOne(filter);
  if (!target) {
    res.status(404);
    throw new Error('Staff member not found.');
  }
  return target;
}

function notSelf(req, res, target, what) {
  if (String(target._id) === String(req.user._id)) {
    res.status(400);
    throw new Error(`You cannot ${what} your own account.`);
  }
}

async function auditStaff(req, target, action, metadata = {}) {
  await auditLoggerService.logEvent({ actorId: req.user._id, actorRole: req.user.role, action, targetType: 'User', targetId: target._id, metadata: { targetRole: target.role, ...metadata } });
}

const staffView = (u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, active: u.active !== false });

// @route POST /api/users/staff/:userId/deactivate
const deactivateStaff = asyncHandler(async (req, res) => {
  const target = await administeredStaff(req, res);
  notSelf(req, res, target, 'deactivate');
  await User.updateOne({ _id: target._id }, { $set: { active: false, deactivatedAt: new Date(), deactivatedBy: req.user._id }, $inc: { sessionVersion: 1 } });
  await auditStaff(req, target, 'STAFF_DEACTIVATED');
  res.json({ ...staffView(target), active: false });
});

// @route POST /api/users/staff/:userId/reactivate
const reactivateStaff = asyncHandler(async (req, res) => {
  const target = await administeredStaff(req, res);
  await User.updateOne({ _id: target._id }, { $set: { active: true, deactivatedAt: null, deactivatedBy: null, 'login.failedCount': 0, 'login.lockedUntil': null, 'login.sources': [] } });
  await auditStaff(req, target, 'STAFF_REACTIVATED');
  res.json({ ...staffView(target), active: true });
});

// @route POST /api/users/staff/:userId/role  { role }
const changeStaffRole = asyncHandler(async (req, res) => {
  const target = await administeredStaff(req, res);
  notSelf(req, res, target, 'change the role of');
  const org = await Organization.findById(target.organizationId).select('kind').lean();
  const allowed = org?.kind === 'payer' ? ['payer_reviewer', 'payer_admin'] : ['pharmacist', 'pharmacy', 'claims_reviewer', 'org_admin', 'branch_manager'];
  const role = req.body?.role;
  if (!allowed.includes(role)) {
    res.status(400);
    throw new Error(`Role must be one of: ${allowed.join(', ')}.`);
  }
  // A role change ends the person's current sessions so new permissions apply immediately.
  await User.updateOne({ _id: target._id }, { $set: { role }, $inc: { sessionVersion: 1 } });
  await auditStaff(req, target, 'STAFF_ROLE_CHANGED', { from: target.role, to: role });
  res.json({ ...staffView(target), role });
});

// @route POST /api/users/staff/:userId/sign-out
const forceSignOutStaff = asyncHandler(async (req, res) => {
  const target = await administeredStaff(req, res);
  await User.updateOne({ _id: target._id }, { $inc: { sessionVersion: 1 } });
  await auditStaff(req, target, 'STAFF_FORCED_SIGN_OUT');
  res.json({ ...staffView(target), signedOut: true });
});

// @route POST /api/users/staff/:userId/unlock
const unlockStaff = asyncHandler(async (req, res) => {
  const target = await administeredStaff(req, res);
  await User.updateOne({ _id: target._id }, { $set: { 'login.failedCount': 0, 'login.lockedUntil': null, 'login.sources': [] } });
  await auditStaff(req, target, 'STAFF_UNLOCKED');
  res.json({ ...staffView(target), locked: false });
});

// @route POST /api/users/staff/:userId/credential  { registrationNumber, council }
const confirmStaffCredential = asyncHandler(async (req, res) => {
  const target = await administeredStaff(req, res);
  notSelf(req, res, target, 'confirm the credential of');
  const credential = accountSecurity.validateRegistration(req.body || {});
  await User.updateOne({ _id: target._id }, { $set: { 'professional.registrationNumber': credential.registrationNumber, 'professional.council': credential.council, 'professional.checkedVia': credential.checkedVia, 'professional.validUntil': credential.validUntil, 'professional.verifiedBy': req.user._id, 'professional.verifiedAt': new Date() } });
  await auditStaff(req, target, 'STAFF_CREDENTIAL_CONFIRMED', { council: credential.council, checkedVia: credential.checkedVia, validUntil: credential.validUntil });
  res.json({ ...staffView(target), credential: { ...credential, verifiedAt: new Date() } });
});

// @route POST /api/users/organization/review-policy  { allowSingleReviewerVerify }
const updateReviewPolicy = asyncHandler(async (req, res) => {
  if (isWebClient(req)) verifyBrowserMutation(req);
  if (!['org_admin', 'super_admin'].includes(req.user?.role) || !req.user.organizationId) {
    res.status(403);
    throw new Error('Access denied: only a pharmacy organization admin can change the review policy.');
  }
  if (typeof req.body?.allowSingleReviewerVerify !== 'boolean') {
    res.status(400);
    throw new Error('allowSingleReviewerVerify must be true or false.');
  }
  const org = await Organization.findOneAndUpdate(
    { _id: req.user.organizationId, kind: { $ne: 'payer' } },
    { $set: { 'reviewPolicy.allowSingleReviewerVerify': req.body.allowSingleReviewerVerify } },
    { new: true }
  );
  if (!org) {
    res.status(404);
    throw new Error('Pharmacy organization not found.');
  }
  await auditLoggerService.logEvent({ actorId: req.user._id, actorRole: req.user.role, action: 'REVIEW_POLICY_CHANGED', targetType: 'Organization', targetId: org._id, metadata: { allowSingleReviewerVerify: req.body.allowSingleReviewerVerify } });
  res.json({ allowSingleReviewerVerify: org.reviewPolicy.allowSingleReviewerVerify });
});

// @route POST /api/users/me/text-alerts  { enabled, phone?, channel? }
const updateTextAlerts = asyncHandler(async (req, res) => {
  if (isWebClient(req)) verifyBrowserMutation(req);
  const textMessaging = require('../services/platform/textMessaging');
  const { enabled, phone, channel } = req.body || {};
  if (typeof enabled !== 'boolean') {
    res.status(400);
    throw new Error('enabled must be true or false.');
  }
  let update;
  if (enabled) {
    if (!['sms', 'whatsapp'].includes(channel || 'sms')) {
      res.status(400);
      throw new Error('channel must be sms or whatsapp.');
    }
    let normalized;
    try { normalized = textMessaging.normalizePhone(phone); } catch (error) { res.status(400); throw error; }
    update = { 'contact.phone': normalized, 'contact.channel': channel || 'sms', 'contact.textOptIn': true, 'contact.textConsentAt': new Date() };
  } else {
    // Withdrawing consent also removes the number.
    update = { 'contact.phone': null, 'contact.textOptIn': false, 'contact.textConsentAt': null };
  }
  await User.updateOne({ _id: req.user._id }, { $set: update });
  await auditLoggerService.logEvent({ actorId: req.user._id, actorRole: req.user.role, action: enabled ? 'TEXT_ALERTS_ENABLED' : 'TEXT_ALERTS_DISABLED', targetType: 'User', targetId: req.user._id, metadata: { channel: enabled ? (channel || 'sms') : null } });
  res.json({ enabled, channel: enabled ? (channel || 'sms') : 'sms', phone: enabled ? textMessaging.maskPhone(update['contact.phone']) : null, deliveryConfigured: textMessaging.textEnabled() });
});

module.exports = { authUser, registerUser, provisionStaff, listStaff, getUserProfile, logoutUser, setupMfa, enableMfa, disableMfa, regenerateRecoveryCodes, deactivateStaff, reactivateStaff, changeStaffRole, forceSignOutStaff, unlockStaff, confirmStaffCredential, updateReviewPolicy, updateTextAlerts };
