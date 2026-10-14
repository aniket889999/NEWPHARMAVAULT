const asyncHandler = require('../middleware/asyncHandler');
const safetyAuditLogger = require('../safety/safetyAuditLogger');

// @desc    Get safety audit logs
// @route   GET /api/safety/audit-logs
// @access  Private
const getAuditLogs = asyncHandler(async (req, res) => {
  const logs = await safetyAuditLogger.getLogs();
  res.status(200).json(logs);
});

// @desc    Get safety audit summary
// @route   GET /api/safety/audit-summary
// @access  Private
const getAuditSummary = asyncHandler(async (req, res) => {
  const summary = await safetyAuditLogger.getSummary();
  res.status(200).json(summary);
});

module.exports = {
  getAuditLogs,
  getAuditSummary
};
