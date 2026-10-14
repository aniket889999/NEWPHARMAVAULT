const express = require('express');
const router = express.Router();
const {
  getMedicineGraph,
  traverseGraph,
  getPatientGraph,
  getPharmacyGraph
} = require('../controllers/graphController');
const { protect } = require('../middleware/authMiddleware');

router.get('/medicine/:name', getMedicineGraph);
router.post('/traverse', traverseGraph);
router.get('/patient/:id', protect, getPatientGraph);
router.get('/pharmacy/:id', protect, getPharmacyGraph);

module.exports = router;
