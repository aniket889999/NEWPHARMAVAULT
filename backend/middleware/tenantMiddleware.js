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

  // STEP 14: Backward Compatibility - Only Pharmacy/Staff MUST have a tenant
  // Patients remain tenant-neutral by default for global record portability.
  const isStaff = ['pharmacy', 'org_admin', 'branch_manager', 'pharmacist', 'admin', 'claims_reviewer'].includes(role);

  // U1 Lifecycle & Authorization: Staff with missing tenant context receive a denial, not a demo fallback
  if (isStaff && !organizationId && role !== 'super_admin') {
    res.status(403);
    throw new Error('Staff user has no organization tenant context. Access denied.');
  }

  req.tenantContext.organizationId = organizationId || null;
  req.tenantContext.branchId = branchId || null;

  // Removed sensitive logging of user/org IDs

  next();
});

module.exports = { tenantMiddleware };
