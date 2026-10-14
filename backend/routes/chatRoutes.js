const express = require('express');
const router = express.Router();
const { handleChat, handleVisionOCR } = require('../controllers/chatController');

const { aiLimiter } = require('../middleware/rateLimiter');

router.post('/', aiLimiter, handleChat);
router.post('/vision-ocr', aiLimiter, handleVisionOCR);

module.exports = router;
