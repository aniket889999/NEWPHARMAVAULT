const User = require('../models/userModel');
const asyncHandler = require('../middleware/asyncHandler');
const generateToken = require('../utils/generateToken');
const Organization = require('../models/organizationModel');

// @desc    Auth user & get token (Login)
// @route   POST /api/users/login
const authUser = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;

  let user = await User.findOne({ email });

  // In development mode, auto-create demo users on demand if they don't exist yet!
  if (!user && (email === 'pharmacy@test.com' || email === 'reviewer@test.com' || email === 'patient@test.com' || email === 'pharmacist@test.com')) {
    const demoRole = email.includes('pharmacy') ? 'pharmacy' : email.includes('reviewer') ? 'claims_reviewer' : 'patient';
    user = await User.create({
      name: email.split('@')[0].toUpperCase() + ' Demo',
      email,
      password: password || 'password123',
      role: role || demoRole,
    });
  }

  if (user && (await user.matchPassword(password))) {
    // In development mode, if user logs in to a portal, allow or adapt role
    if (process.env.NODE_ENV !== 'production') {
      if (role && user.role !== role) {
        user.role = role;
        await user.save();
      }
    } else if (role && user.role !== role) {
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

// @desc    Register a new user (Public Self-Registration)
// @route   POST /api/users/register
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  // In production, public registration only permits patient
  if (process.env.NODE_ENV === 'production' && role && role !== 'patient') {
    res.status(403);
    throw new Error('Public self-registration only permits the submitter (patient) role.');
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
    role: role || 'patient',
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
