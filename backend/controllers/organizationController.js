const asyncHandler = require('../middleware/asyncHandler');
const Organization = require('../models/organizationModel');
const Subscription = require('../models/subscriptionModel');
const User = require('../models/userModel');

// @desc    Create new organization
// @route   POST /api/organizations
// @access  Private (Admin/User)
const createOrganization = asyncHandler(async (req, res) => {
  const { name, contactEmail, contactPhone, address, plan } = req.body;

  const orgExists = await Organization.findOne({ name });
  if (orgExists) {
    res.status(400);
    throw new Error('Organization already exists');
  }

  const organization = await Organization.create({
    name,
    owner: req.user._id,
    contactEmail,
    contactPhone,
    address,
    plan: plan || 'Starter'
  });

  // Create initial subscription
  const renewalDate = new Date();
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);

  const planConfigs = {
    Starter: { maxBranches: 1, maxUsers: 5, aiUsageLimit: 1000 },
    Professional: { maxBranches: 5, maxUsers: 20, aiUsageLimit: 5000 },
    Enterprise: { maxBranches: 100, maxUsers: 500, aiUsageLimit: 100000 }
  };

  const config = planConfigs[organization.plan];

  await Subscription.create({
    organizationId: organization._id,
    planName: organization.plan,
    maxBranches: config.maxBranches,
    maxUsers: config.maxUsers,
    aiUsageLimit: config.aiUsageLimit,
    renewalDate
  });

  // Update user role to org_admin and link org
  await User.findByIdAndUpdate(req.user._id, {
    role: 'org_admin',
    organizationId: organization._id
  });

  res.status(201).json(organization);
});

// @desc    Get my organization
// @route   GET /api/organizations/me
// @access  Private
const getMyOrganization = asyncHandler(async (req, res) => {
  if (!req.user.organizationId) {
    res.status(404);
    throw new Error('No organization found for this user');
  }

  const organization = await Organization.findById(req.user.organizationId);
  const subscription = await Subscription.findOne({ organizationId: req.user.organizationId });

  res.json({ organization, subscription });
});

// @desc    Get all organizations (Super Admin)
// @route   GET /api/organizations
// @access  Private (Super Admin)
const getAllOrganizations = asyncHandler(async (req, res) => {
  const organizations = await Organization.find({}).populate('owner', 'name email');
  res.json(organizations);
});

module.exports = {
  createOrganization,
  getMyOrganization,
  getAllOrganizations
};
