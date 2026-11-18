const User = require('../models/userModel');
const asyncHandler = require('../middleware/asyncHandler');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { isWebClient, verifyBrowserMutation, setBrowserSession, clearBrowserSession } = require('../config/browserSession');
const { generateSecret, verifyTotp, otpauthUri, encryptSecret, decryptSecret } = require('../utils/totp');
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
function profile(user) {
  return { _id: user._id, name: user.name, email: user.email, role: user.role, mfaEnabled: Boolean(user.mfa?.enabled),
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
  if (user && matches && user.role === role) {
    if (user.mfa?.enabled) {
      const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';
      if (!otp) {
        return res.status(401).json({ message: 'Enter the 6-digit code from your authenticator app.', mfaRequired: true });
      }
      const counter = verifyTotp(decryptSecret(user.mfa.secretEnc), otp, { lastUsedCounter: user.mfa.lastUsedCounter ?? -1 });
      // Atomic update blocks the same code being replayed in parallel requests.
      const accepted = counter !== null && await User.updateOne(
        { _id: user._id, 'mfa.lastUsedCounter': { $lt: counter } },
        { $set: { 'mfa.lastUsedCounter': counter } }
      ).then((r) => r.modifiedCount === 1);
      if (!accepted) {
        return res.status(401).json({ message: 'The authenticator code is invalid or already used.', mfaRequired: true });
      }
    }
    sendSession(req, res, user);
  } else {
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
  await User.updateOne({ _id: user._id }, {
    $set: { 'mfa.enabled': true, 'mfa.secretEnc': user.mfa.pendingSecretEnc, 'mfa.pendingSecretEnc': null, 'mfa.lastUsedCounter': counter, 'mfa.enabledAt': new Date() },
    // Enabling MFA revokes other sessions.
    $inc: { sessionVersion: 1 }
  });
  const fresh = await User.findById(user._id).select('+sessionVersion');
  sendSession(req, res, fresh);
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
  await User.updateOne({ _id: user._id }, { $set: { 'mfa.enabled': false, 'mfa.secretEnc': null, 'mfa.pendingSecretEnc': null, 'mfa.enabledAt': null, 'mfa.lastUsedCounter': -1 } });
  res.status(200).json({ mfaEnabled: false });
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
    User.find({ organizationId: orgId, role: { $ne: 'patient' } }).select('name email role branchId mfa.enabled createdAt').sort('name').lean()
  ]);
  if (!org) {
    res.status(404);
    throw new Error('Organization not found.');
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({
    organization: { id: String(org._id), name: org.name, kind: org.kind || 'pharmacy' },
    assignableRoles: org.kind === 'payer' ? ['payer_reviewer', 'payer_admin'] : ['pharmacist', 'pharmacy', 'claims_reviewer', 'org_admin', 'branch_manager'],
    staff: staff.map((u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, mfaEnabled: Boolean(u.mfa?.enabled), createdAt: u.createdAt }))
  });
});

module.exports = { authUser, registerUser, provisionStaff, listStaff, getUserProfile, logoutUser, setupMfa, enableMfa, disableMfa };
