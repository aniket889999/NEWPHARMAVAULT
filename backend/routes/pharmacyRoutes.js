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
  updatePrescriptionStatus,
  markdownMedicine,
  recallMedicine,
  requestReorder
} = require('../controllers/pharmacyIntelligenceController');

router.get('/nearby', getNearbyPharmacies);

// Pharmacy Intelligence Routes (Protected for Pharmacy/Admin)
router.get('/intelligence', protect, getIntelligenceDashboard);
router.get('/expiry-risk', protect, getExpiryRisk);
router.get('/stock-risk', protect, getStockRisk);
router.get('/substitutes/:medicineName', protect, getSubstitutes);
router.get('/prescription-queue', protect, getPrescriptionQueue);
router.put('/prescription/:id/status', protect, updatePrescriptionStatus);
router.post('/medicines/:id/markdown', protect, markdownMedicine);
router.post('/medicines/:id/recall', protect, recallMedicine);
router.post('/medicines/:id/reorder', protect, requestReorder);

module.exports = router;
