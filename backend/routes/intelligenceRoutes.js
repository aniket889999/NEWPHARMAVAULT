const express = require('express');
const router = express.Router();
const {
  getTimeline,
  getAdherence,
  getRefillRisk,
  getInsights,
  getPatientGraph
} = require('../controllers/intelligenceController');
const { protect } = require('../middleware/authMiddleware');

// @desc    Patient Intelligence Endpoints
// @route   GET /api/intelligence/*
router.get('/timeline', protect, getTimeline);
router.get('/adherence', protect, getAdherence);
router.get('/refill-risk', protect, getRefillRisk);
router.get('/insights', protect, getInsights);
router.get('/patient-graph', protect, getPatientGraph);

module.exports = router;
