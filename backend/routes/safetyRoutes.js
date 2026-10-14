const express = require('express');
const router = express.Router();
const { getAuditLogs, getAuditSummary } = require('../controllers/safetyController');
const { protect } = require('../middleware/authMiddleware');

router.get('/audit-logs', protect, getAuditLogs);
router.get('/audit-summary', protect, getAuditSummary);

module.exports = router;
