'use strict';
const router = require('express').Router({ mergeParams: true });
const { protect } = require('../middleware/authMiddleware');
const { tenantMiddleware } = require('../middleware/tenantMiddleware');
const { aiLimiter } = require('../middleware/rateLimiter');
const { answerCaseWithPriority } = require('../services/trustRag/prioritizedCaseAssistantService');
const { CITATION_POLICY } = require('../services/trustRag/citationPriorityPolicy');

router.post('/prioritized-answers', (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
}, protect, tenantMiddleware, aiLimiter, async (req, res) => {
  try {
    const answer = await answerCaseWithPriority({ caseId: req.params.caseId, user: req.user, tenantContext: req.tenantContext,
      message: req.body?.message, medicineItemId: req.body?.medicineItemId ?? null, rawBody: req.body ?? {} });
    res.set('X-PharmaVault-Citation-Policy', CITATION_POLICY);
    return res.status(200).json(answer);
  } catch (error) {
    const status = Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    return res.status(status).json({ code: status < 500 && typeof error.code === 'string' ? error.code : 'ASSISTANT_ERROR',
      message: status < 500 && typeof error.message === 'string' ? error.message : 'Case assistant request failed.' });
  }
});

module.exports = router;
