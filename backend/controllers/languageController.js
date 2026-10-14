const asyncHandler = require('../middleware/asyncHandler');
const languageDetector = require('../language/languageDetector');
const translationService = require('../language/translationService');
const multilingualEntityMapper = require('../language/multilingualEntityMapper');

// @desc    Detect language
// @route   POST /api/language/detect
// @access  Public
const detectLanguage = asyncHandler(async (req, res) => {
  const { text } = req.body;
  const result = await languageDetector.detect(text);
  res.status(200).json(result);
});

// @desc    Translate text
// @route   POST /api/language/translate
// @access  Public
const translateText = asyncHandler(async (req, res) => {
  const { text, targetLang } = req.body;
  // Currently translating FROM english TO target
  const result = await translationService.translateFromEnglish(text, targetLang);
  res.status(200).json({ translatedText: result });
});

// @desc    Normalize healthcare entities
// @route   POST /api/language/normalize
// @access  Public
const normalizeText = asyncHandler(async (req, res) => {
  const { text, sourceLang } = req.body;
  const result = await multilingualEntityMapper.normalize(text, sourceLang);
  res.status(200).json({ normalizedText: result });
});

module.exports = {
  detectLanguage,
  translateText,
  normalizeText
};
