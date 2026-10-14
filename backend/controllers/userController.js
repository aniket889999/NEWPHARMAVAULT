const User = require('../models/userModel');
const asyncHandler = require('../middleware/asyncHandler');
const generateToken = require('../utils/generateToken');

// @desc    Auth user & get token (Login)
// @route   POST /api/users/login
const authUser = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    if (user.role !== role) {
      res.status(401);
      throw new Error(`Access denied. This account belongs to a ${user.role}.`);
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

const Organization = require('../models/organizationModel');

// @desc    Register a new user (Public Self-Registration: patient only)
// @route   POST /api/users/register
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  // Public self-registration only permits the allowed submitter role (patient)
  if (role && role !== 'patient') {
    res.status(403);
    throw new Error('Public self-registration only permits the submitter (patient) role. Staff accounts must be provisioned by an authorized organization administrator.');
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
    role: 'patient',
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
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
    token: generateToken(user._id)
  });
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

module.exports = { authUser, registerUser, provisionStaff, getUserProfile };
