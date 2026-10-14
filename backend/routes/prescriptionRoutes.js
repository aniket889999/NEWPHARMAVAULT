const express = require('express');
const router = express.Router();
const { analyzePrescription, savePrescription, getMyPrescriptions } = require('../controllers/prescriptionController');
// Protect is applied in server.js

const { aiLimiter } = require('../middleware/rateLimiter');

router.post('/analyze', aiLimiter, analyzePrescription);
router.post('/save', savePrescription);
router.get('/my-prescriptions', getMyPrescriptions);

module.exports = router;
