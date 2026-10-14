const express = require('express');
const router = express.Router();
const { handleGraphRAGQuery } = require('../controllers/graphragController');

const { aiLimiter } = require('../middleware/rateLimiter');

// @desc    GraphRAG query
// @route   POST /api/graphrag/query
router.post('/query', aiLimiter, handleGraphRAGQuery);

module.exports = router;
