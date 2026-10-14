const express = require('express');
const router = express.Router();
const {
  getForecasts,
  getDeadStock,
  getReorder,
  getSuppliers,
  getSubstitutes,
  getSeasonal
} = require('../controllers/advancedPharmacyIntelligenceController');
const { protect, pharmacyOnly } = require('../middleware/authMiddleware');

// @desc    Advanced Pharmacy Intelligence Endpoints
// @route   GET /api/pharmacy-intelligence/*
router.get('/forecast', protect, getForecasts); // Add pharmacyOnly later if roles exist
router.get('/dead-stock', protect, getDeadStock);
router.get('/reorder', protect, getReorder);
router.get('/suppliers', protect, getSuppliers);
router.get('/substitutes/:medicine', protect, getSubstitutes);
router.get('/seasonal', protect, getSeasonal);

module.exports = router;
