const asyncHandler = require('../middleware/asyncHandler');
const Branch = require('../models/branchModel');
const Organization = require('../models/organizationModel');

// @desc    Create new branch
// @route   POST /api/branches
// @access  Private (Org Admin)
const createBranch = asyncHandler(async (req, res) => {
  const { name, location, licenseNumber, managerId } = req.body;
  const organizationId = req.user.organizationId;

  if (!organizationId) {
    res.status(400);
    throw new Error('User not linked to an organization');
  }

  const branch = await Branch.create({
    organizationId,
    name,
    location,
    licenseNumber,
    managerId
  });

  res.status(201).json(branch);
});

// @desc    Get all branches for an organization
// @route   GET /api/branches
// @access  Private
const getBranches = asyncHandler(async (req, res) => {
  const organizationId = req.user.organizationId;
  if (!organizationId) {
    return res.json([]);
  }

  const branches = await Branch.find({ organizationId });
  res.json(branches);
});

module.exports = {
  createBranch,
  getBranches
};
