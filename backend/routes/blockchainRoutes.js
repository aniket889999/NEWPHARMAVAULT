const express = require('express');
const router = express.Router();
const { registerBatch, getLedger, checkIntegrity, verifyBatch } = require('../controllers/blockchainController');
const { protect, pharmacy } = require('../middleware/authMiddleware');

// Public route for patients to verify medicine authenticity
router.post('/verify', verifyBatch);

// Pharmacy routes
router.post('/register-batch', protect, pharmacy, registerBatch);
router.get('/ledger', protect, pharmacy, getLedger);
router.get('/integrity-check', protect, pharmacy, checkIntegrity);

module.exports = router;
