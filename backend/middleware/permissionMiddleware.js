const permissionMiddleware = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { role } = req.user;

    const rolePermissions = {
      super_admin: ['*'], // Access to everything
      org_admin: [
        'canManageOrganization', 'canManageBranch', 'canViewTenantAnalytics', 
        'canAccessSafetyLogs', 'canAccessWorkflowCenter', 'canUseAI', 
        'canApprovePrescription', 'canManageUsers'
      ],
      branch_manager: [
        'canManageBranch', 'canViewTenantAnalytics', 'canAccessWorkflowCenter', 
        'canUseAI', 'canApprovePrescription', 'canManageUsers'
      ],
      pharmacist: [
        'canAccessWorkflowCenter', 'canUseAI', 'canApprovePrescription'
      ],
      auditor: [
        'canViewTenantAnalytics', 'canAccessSafetyLogs'
      ],
      patient: [
        'canUseAI'
      ],
      // Compatibility mapping
      pharmacy: [
        'canAccessWorkflowCenter', 'canUseAI', 'canApprovePrescription'
      ],
      admin: [
         'canManageOrganization', 'canManageBranch', 'canViewTenantAnalytics', 
         'canAccessSafetyLogs', 'canAccessWorkflowCenter', 'canUseAI', 
         'canApprovePrescription', 'canManageUsers'
      ]
    };

    const permissions = rolePermissions[role] || [];

    if (permissions.includes('*') || permissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({ 
      message: `Access denied. Permission required: ${permission}` 
    });
  };
};

module.exports = permissionMiddleware;
