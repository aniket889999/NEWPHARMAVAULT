const express = require('express');
const router = express.Router();
const { getNearbyPharmacies } = require('../controllers/pharmacyController');
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getIntelligenceDashboard,
  getExpiryRisk,
  getStockRisk,
  getSubstitutes,
  getPrescriptionQueue,
  updatePrescriptionStatus
} = require('../controllers/pharmacyIntelligenceController');

router.get('/nearby', getNearbyPharmacies);

// Pharmacy Intelligence Routes (Protected for Pharmacy/Admin)
router.get('/intelligence', protect, getIntelligenceDashboard);
router.get('/expiry-risk', protect, getExpiryRisk);
router.get('/stock-risk', protect, getStockRisk);
router.get('/substitutes/:medicineName', protect, getSubstitutes);
router.get('/prescription-queue', protect, getPrescriptionQueue);
router.put('/prescription/:id/status', protect, updatePrescriptionStatus);

module.exports = router;
