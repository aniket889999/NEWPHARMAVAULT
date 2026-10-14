const express = require('express');
const router = express.Router();
const { generateExplanation } = require('../controllers/explainabilityController');

// @desc    Generate Explainability metrics and reasoning
// @route   POST /api/explainability/reason
router.post('/reason', generateExplanation);

module.exports = router;
