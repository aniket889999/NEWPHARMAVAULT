const express = require('express');
const router = express.Router({ mergeParams: true });
const { aiLimiter } = require('../middleware/rateLimiter');
const { answerCase, freshnessForCase } = require('../services/trustRag/caseAssistantService');

function sendControlledAssistantError(res, err) {
  res.set('Cache-Control', 'private, no-store');
  const statusCode =
    Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;
  const code =
    typeof err?.code === 'string' && err.code
      ? err.code
      : statusCode === 401
        ? 'UNAUTHENTICATED'
        : statusCode === 403
          ? 'FORBIDDEN'
          : statusCode === 404
            ? 'CASE_NOT_FOUND'
            : statusCode === 409
              ? 'CASE_BUSY'
              : statusCode === 400
                ? 'INVALID_REQUEST'
                : 'ASSISTANT_ERROR';
  const message =
    statusCode < 500 && typeof err?.message === 'string' && err.message
      ? err.message
      : 'Case assistant request failed.';
  return res.status(statusCode).json({ code, message });
}

router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

router.post('/answers', aiLimiter, async (req, res) => {
  try {
    const body = req.body;
    const answer = await answerCase({
      caseId: req.params.caseId,
      user: req.user,
      tenantContext: req.tenantContext,
      message: body?.message,
      medicineItemId: body?.medicineItemId ?? null,
      rawBody: body ?? {}
    });
    res.set('Cache-Control', 'private, no-store');
    return res.status(200).json(answer);
  } catch (err) {
    return sendControlledAssistantError(res, err);
  }
});

router.post('/freshness', aiLimiter, async (req, res) => {
  try {
    const body = req.body;
    const freshness = await freshnessForCase({
      caseId: req.params.caseId,
      user: req.user,
      tenantContext: req.tenantContext,
      receipts: body?.receipts,
      rawBody: body ?? {}
    });
    res.set('Cache-Control', 'private, no-store');
    return res.status(200).json(freshness);
  } catch (err) {
    return sendControlledAssistantError(res, err);
  }
});

module.exports = router;
