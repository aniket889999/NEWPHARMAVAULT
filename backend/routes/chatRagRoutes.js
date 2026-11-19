const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { aiLimiter } = require('../middleware/rateLimiter');
const rag = require('../services/chatRagService');
const conversational = require('../services/conversationalRagService');
const contextual = require('../services/contextualChatService');
const { references, corpusHash } = require('../services/chatReferenceRegistry');
const precisionModel = require('../data/precisionRanker.v1.json');
const { issueReceiptDurably, submitFeedback, receiptPersistence } = require('../services/chatFeedbackService');
const { providerReadiness } = require('../services/chatProviderReadinessService');
const { sourceSummary } = require('../services/chatSourceGovernanceService');
const { authorize } = require('../middleware/authMiddleware');
const { chatMetrics } = require('../services/chatOperationMetricsService');
const { toolControls } = require('../services/chatRuntimeControlService');
const { webLookupPolicy } = require('../services/approvedHealthSearchService');
const router = express.Router();
const savedHistory = require('../services/chatHistoryService');
const conversationMemory = require('../services/chatConversationMemoryService');
const { publicSemanticRetrieval } = require('../services/publicSemanticRetrievalService');
const { FIXED_NHS_SOURCES } = require('../services/approvedMedicineSearchService');
const topicRegistry = require('../data/chatTopicRegistry');
router.use('/history', require('./chatHistoryRoutes'));

// App mounts authentication and tenant middleware before this versioned route.
router.post('/', aiLimiter, asyncHandler(async (req, res) => {
  const finish = chatMetrics.begin();
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(); finish(undefined, 'FAILED');
    if (!res.headersSent && !res.destroyed) res.status(504).json({ message: 'The chat request exceeded its time limit. Please retry.' });
  }, 45000); timer.unref?.();
  const cancel = () => { if (!res.writableEnded) { controller.abort(); finish(undefined, 'CANCELLED'); } };
  res.on('close', cancel);
  let result;
  try {
  const input = conversational.validateRequest(req.body);
  const attempt = input.caseId ? null : providerReadiness.beginPublicAttempt();
  const serverMemory = conversationMemory.prepareMemory(input, req.user);
  const response = await contextual.answer({ ...input, serverMemory, user: req.user, tenantContext: req.tenantContext }, { signal: controller.signal });
  result = await issueReceiptDurably(req.user._id, conversationMemory.finishMemory(response, input, req.user), { organizationId: req.user.organizationId });
  controller.signal.throwIfAborted();
  providerReadiness.observePublicAnswer(attempt, result, { privateScope: Boolean(input.caseId) });
  res.setHeader('Cache-Control', 'private, no-store');
  if (!res.destroyed && !res.writableEnded) res.json(result);
  } catch (error) {
    if (controller.signal.aborted && (res.writableEnded || res.destroyed)) return;
    if (controller.signal.aborted && !res.destroyed) throw Object.assign(new Error('The chat request exceeded its time limit. Please retry.'), { statusCode: 504 });
    throw error;
  } finally {
    clearTimeout(timer); res.removeListener('close', cancel);
    finish(result, controller.signal.aborted ? 'CANCELLED' : result ? 'SUCCESS' : 'FAILED');
  }
}));

router.get('/operations', authorize('super_admin'), (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ metrics: chatMetrics.snapshot(), externalTools: toolControls.snapshot(), receiptPersistence: receiptPersistence(),
    limitations: ['Process-local metrics/tool budgets; shared ingress limits still required.', 'No clinical correctness or billing-cost score.'] });
});

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
    privateCasePolicy: 'LOCAL_ONLY', providerReadiness: readiness, sourceGovernance: sourceSummary(references), receiptPersistence: receiptPersistence(),
    semanticRetrieval: publicSemanticRetrieval.snapshot(),
    sourceDirectory: { nhsIndexedTopics: Object.keys(FIXED_NHS_SOURCES).length, fdaFallbackTopics: ['ondansetron', 'telmisartan'], metadataPolicy: 'OFFICIAL_INDEX_NOT_CLINICAL_APPROVAL' },
    conversationMemory: { session: 'ENCRYPTED_ACCOUNT_AND_CHAT_BOUND_CONTEXT', saved: 'OPT_IN_ACCOUNT_SCOPED_30_DAYS', maxSavedMessages: 200, historyIsEvidence: false, autoTraining: false },
    contextualChat: { version: 'contextual-chat-v3', webEnabled: process.env.RAG_CHAT_WEB_ENABLED === 'true', webLookupPolicy: webLookupPolicy(), webProvider: process.env.RAG_CHAT_ANSWER_STYLE === 'GROUNDED_PARAPHRASE' ? 'NHS_MEDICINES+MEDLINEPLUS_HEALTH_TOPICS' : 'MEDLINEPLUS_HEALTH_TOPICS', privateWebPolicy: 'NEVER', feedbackPolicy: 'EXPERT_REVIEW_REQUIRED_NO_AUTOTRAINING',
      precision: { version: 'precision-chat-v1', referenceCount: references.length, corpusHash, trainedReranker: precisionModel.corpusHash === corpusHash, trainingScope: 'LOCAL_RETRIEVAL_RANKER_NOT_LLM', clinicalValidation: 'NOT_PERFORMED', webSynthesisAllowed: process.env.RAG_CHAT_WEB_SYNTHESIS_ALLOWED === 'true' } }
  });
});
router.get('/sources', (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ schemaVersion: 'public-source-directory-v1', clinicalApproval: 'NOT_ESTABLISHED',
    entries: topicRegistry.filter(value => FIXED_NHS_SOURCES[value.id] || ['ondansetron', 'telmisartan'].includes(value.id)).map(value => ({
      topicId: value.id, label: value.label, publisher: FIXED_NHS_SOURCES[value.id] ? 'NHS' : 'FDA', jurisdiction: FIXED_NHS_SOURCES[value.id] ? 'UK' : 'US',
      status: 'INDEXED_NOT_A_LIVE_COVERAGE_GUARANTEE', sourceUrl: FIXED_NHS_SOURCES[value.id]?.GENERAL || 'https://open.fda.gov/apis/drug/label/' })) });
});

async function streamAnswer(req, res, lease) {
  const input = conversational.validateRequest(req.body);
  const attempt = input.caseId ? null : providerReadiness.beginPublicAttempt();
  // Authorize before opening SSE, so denied cases still receive a real 4xx.
  if (input.caseId) await rag.retrieveCase(input.caseId, req.user, req.tenantContext);
  const serverMemory = conversationMemory.prepareMemory(input, req.user, lease);
  const controller = new AbortController();
  const finishMetric = chatMetrics.begin();
  let outcome = 'FAILED', answer;
  let finished = false;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const emit = (event, data) => {
    if (!res.destroyed && !finished) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  res.on('close', () => { if (!finished) { controller.abort(); finishMetric(undefined, 'CANCELLED'); } });
  const heartbeat = setInterval(() => { if (!res.destroyed) res.write(': keepalive\n\n'); }, 10000);
  const deadline = setTimeout(() => {
    controller.abort();
    emit('error', { message: 'The chat request exceeded its time limit. Please retry.' });
    clearInterval(heartbeat); finishMetric(undefined, 'FAILED'); finished = true;
    if (!res.writableEnded) res.end();
  }, 45000); deadline.unref?.();
  try {
    const response = await contextual.answer({ ...input, serverMemory, user: req.user, tenantContext: req.tenantContext }, { signal: controller.signal, emit });
    let result = await issueReceiptDurably(req.user._id, conversationMemory.finishMemory(response, input, req.user, lease), { organizationId: req.user.organizationId });
    if (lease && !controller.signal.aborted) {
      let saved=false;
      try { saved=await savedHistory.finish(lease,input.message,result); } catch { /* Preserve the answer, never claim a failed save succeeded. */ }
      result={...result,savedConversation:{id:lease.id,saved},...(!saved?{warnings:[...result.warnings,'This reply could not be saved. It remains in this session only.']}: {})};
    }
    answer = result; outcome = 'SUCCESS';
    providerReadiness.observePublicAnswer(attempt, result, { privateScope: Boolean(input.caseId), aborted: controller.signal.aborted });
    emit('done', result);
  } catch (_) {
    if (!controller.signal.aborted) emit('error', { message: 'The evidence response could not complete. Please try again.' });
  } finally {
    clearInterval(heartbeat);
    clearTimeout(deadline);
    finishMetric(answer, controller.signal.aborted ? 'CANCELLED' : outcome);
    finished = true;
    if (!res.writableEnded) res.end();
    if (lease) await savedHistory.release(lease).catch(()=>{});
  }
}
router.post('/stream', aiLimiter, asyncHandler((req,res)=>streamAnswer(req,res)));
router.post('/history/conversations/:conversationId/stream', aiLimiter, asyncHandler(async(req,res)=>{
  const lease=await savedHistory.acquire(req.user,req.params.conversationId,req.body);
  try {
    req.body={message:req.body.message,history:lease.conversation.messages.slice(-10).map(m=>({role:m.role,text:m.content.slice(0,2000)}))};
    await streamAnswer(req,res,lease);
  } finally { await savedHistory.release(lease).catch(()=>{}); }
}));

router.post('/feedback', aiLimiter, asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(await submitFeedback(req.user._id, req.body));
}));

router.use('/knowledge', require('./knowledgeCurationRoutes'));

module.exports = router;
