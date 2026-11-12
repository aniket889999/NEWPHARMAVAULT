const asyncHandler = require('./asyncHandler');
const Organization = require('../models/organizationModel');

const tenantMiddleware = asyncHandler(async (req, res, next) => {
  // Initialize context
  req.tenantContext = {
    organizationId: null,
    branchId: null,
    role: req.user ? req.user.role : null
  };

  if (!req.user) {
    return next();
  }

  let { organizationId, branchId, role } = req.user;

  const isStaff = ['pharmacy', 'org_admin', 'branch_manager', 'pharmacist', 'admin', 'claims_reviewer'].includes(role);

  // In production, staff must have tenant context. In development, allow demo testing
  if (isStaff && !organizationId && role !== 'super_admin') {
    if (process.env.NODE_ENV === 'production') {
      res.status(403);
      throw new Error('Staff user has no organization tenant context. Access denied.');
    }
  }

  req.tenantContext.organizationId = organizationId || null;
  req.tenantContext.branchId = branchId || null;

  next();
});

module.exports = { tenantMiddleware };
