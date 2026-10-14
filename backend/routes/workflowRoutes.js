const express = require('express');
const router = express.Router();
const workflowEngine = require('../workflows/workflowEngine');
const WorkflowAudit = require('../models/workflowAuditModel');
const { protect, authorize } = require('../middleware/authMiddleware');

// @desc    Get active workflows
// @route   GET /api/workflows/active
// @access  Private (Pharmacy, Admin)
router.get('/active', protect, authorize('pharmacy', 'admin'), async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const active = await workflowEngine.getActiveWorkflows(pharmacyId);
    res.json(active);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @desc    Get full workflow audit history
// @route   GET /api/workflows/audit
// @access  Private (Pharmacy, Admin)
router.get('/audit', protect, authorize('pharmacy', 'admin'), async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const history = await WorkflowAudit.find({ pharmacyId }).sort({ createdAt: -1 }).limit(100);
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @desc    Trigger an event manually (usually done internally by backend agents)
// @route   POST /api/workflows/trigger
// @access  Private (Admin, System)
router.post('/trigger', protect, authorize('admin', 'pharmacy'), async (req, res) => {
  try {
    const { event, context } = req.body;
    if (!context.pharmacyId) {
       context.pharmacyId = req.user.pharmacyId || req.user._id;
    }
    await workflowEngine.triggerEvent(event, context);
    res.json({ success: true, message: `Triggered event: ${event}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @desc    Approve a pending workflow
// @route   POST /api/workflows/approve/:id
// @access  Private (Pharmacy, Admin)
router.post('/approve/:id', protect, authorize('pharmacy', 'admin'), async (req, res) => {
  try {
    const auditId = req.params.id;
    const { action } = req.body; // 'approve' or 'reject'
    
    if (action === 'reject') {
      const result = await workflowEngine.rejectWorkflow(auditId, req.user._id, req.user.role);
      return res.json(result);
    }
    
    const result = await workflowEngine.approveWorkflow(auditId, req.user._id, req.user.role);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @desc    Get priority queues (Pending Approvals)
// @route   GET /api/workflows/priorities
// @access  Private (Pharmacy, Admin)
// @desc    Seed demo workflows
// @route   POST /api/workflows/seed
// @access  Private (Admin, Pharmacy)
router.post('/seed', protect, authorize('admin', 'pharmacy'), async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const result = await workflowEngine.seedDemoWorkflows(pharmacyId, req.user._id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/priorities', protect, authorize('pharmacy', 'admin'), async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user._id;
    const pending = await workflowEngine.getPendingApprovals(pharmacyId);
    res.json(pending);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
