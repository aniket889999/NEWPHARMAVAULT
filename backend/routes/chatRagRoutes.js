const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { aiLimiter } = require('../middleware/rateLimiter');
const rag = require('../services/chatRagService');
const conversational = require('../services/conversationalRagService');
const { providerReadiness } = require('../services/chatProviderReadinessService');
const router = express.Router();

// App mounts authentication and tenant middleware before this versioned route.
router.post('/', aiLimiter, asyncHandler(async (req, res) => {
  const input = conversational.validateRequest(req.body);
  const attempt = input.caseId ? null : providerReadiness.beginPublicAttempt();
  const result = await conversational.answer({ ...input, user: req.user, tenantContext: req.tenantContext });
  providerReadiness.observePublicAnswer(attempt, result, { privateScope: Boolean(input.caseId) });
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(result);
}));

router.get('/status', (req, res) => {
  const readiness = providerReadiness.snapshot();
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({
    // Compatibility: enabled describes configuration, not a successful live call.
    generationEnabled: readiness.configured,
    embeddingEnabled: readiness.configured && process.env.RAG_CHAT_EMBEDDINGS_ENABLED === 'true',
    model: readiness.configured ? readiness.model : null,
    publicPassages: rag.publicChunks.length,
    healthReferencePassages: rag.publicChunks.filter(p => p.kind === 'HEALTH_REFERENCE').length,
    privateCasePolicy: 'LOCAL_ONLY', providerReadiness: readiness
  });
});

router.post('/stream', aiLimiter, asyncHandler(async (req, res) => {
  const input = conversational.validateRequest(req.body);
  const attempt = input.caseId ? null : providerReadiness.beginPublicAttempt();
  // Authorize before opening SSE, so denied cases still receive a real 4xx.
  if (input.caseId) await rag.retrieveCase(input.caseId, req.user, req.tenantContext);
  const controller = new AbortController();
  let finished = false;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const emit = (event, data) => {
    if (!res.destroyed && !finished) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  res.on('close', () => { if (!finished) controller.abort(); });
  const heartbeat = setInterval(() => { if (!res.destroyed) res.write(': keepalive\n\n'); }, 10000);
  try {
    const result = await conversational.answer({ ...input, user: req.user, tenantContext: req.tenantContext }, { signal: controller.signal, emit });
    providerReadiness.observePublicAnswer(attempt, result, { privateScope: Boolean(input.caseId), aborted: controller.signal.aborted });
    emit('done', result);
  } catch (_) {
    if (!controller.signal.aborted) emit('error', { message: 'The evidence response could not complete. Please try again.' });
  } finally {
    clearInterval(heartbeat);
    finished = true;
    res.end();
  }
}));

module.exports = router;
