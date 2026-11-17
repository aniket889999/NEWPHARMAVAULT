const User = require('../models/userModel');
const asyncHandler = require('../middleware/asyncHandler');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { isWebClient, verifyBrowserMutation, setBrowserSession, clearBrowserSession } = require('../config/browserSession');
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
  return { _id: user._id, name: user.name, email: user.email, role: user.role,
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
  const user = await User.findOne({ email }).select('+sessionVersion');
  const matches = await bcrypt.compare(password, user?.password || dummyPasswordHash);
  if (user && matches && user.role === role) {
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
  if (!req.user || !['org_admin', 'super_admin'].includes(req.user.role)) {
    res.status(403);
    throw new Error('Access denied: Staff provisioning requires an authorized organization administrator.');
  }

  const { name, email, password, role, organizationId, branchId } = req.body;

  if (!email || !password || !name) {
    res.status(400);
    throw new Error('Name, email, and password are required for staff provisioning.');
  }

  const allowedStaffRoles = ['pharmacist', 'pharmacy', 'claims_reviewer', 'org_admin', 'branch_manager'];
  if (!role || !allowedStaffRoles.includes(role)) {
    res.status(400);
    throw new Error(`Invalid staff role. Allowed staff roles: ${allowedStaffRoles.join(', ')}`);
  }
  credentials(req.body, { registration: true });

  // Determine explicit target organization
  let targetOrgId = req.user.role === 'org_admin'
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

module.exports = { authUser, registerUser, provisionStaff, getUserProfile, logoutUser };
