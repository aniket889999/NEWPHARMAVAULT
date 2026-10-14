const express = require('express');
const router = express.Router();
const { getEvaluationResults } = require('../controllers/evaluationController');

// @desc    Get Research Evaluation Results
// @route   GET /api/evaluation/results
router.get('/results', getEvaluationResults);

module.exports = router;
