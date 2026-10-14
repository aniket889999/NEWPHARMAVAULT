const express = require('express');
const router = express.Router();
const { detectLanguage, translateText, normalizeText } = require('../controllers/languageController');

router.post('/detect', detectLanguage);
router.post('/translate', translateText);
router.post('/normalize', normalizeText);

module.exports = router;
