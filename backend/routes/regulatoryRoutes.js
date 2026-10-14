const express = require('express');
const router = express.Router();
const { getCDSCOStatus, getPharmacyStatus, checkInsurance } = require('../controllers/regulatoryController');

router.get('/cdsco/:medicine', getCDSCOStatus);
router.get('/pharmacy-status', getPharmacyStatus);
router.post('/insurance-check', checkInsurance);

module.exports = router;
