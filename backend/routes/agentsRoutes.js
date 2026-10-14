const express = require('express');
const router = express.Router();
const { runOrchestrator } = require('../controllers/agentController');
// Protect is applied in server.js

const { aiLimiter } = require('../middleware/rateLimiter');

router.post('/orchestrate', aiLimiter, runOrchestrator);

module.exports = router;
