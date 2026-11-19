const conversational = require('./conversationalRagService');
const { routePharmacyQuestion } = require('./pharmacyChatPolicy');
const { resolveContext } = require('./chatContextService');
const { searchApprovedHealth, webLookupPolicy } = require('./approvedHealthSearchService');
const { references } = require('./chatReferenceRegistry');
const { retrievePrecise, composePrecise } = require('./preciseAnswerService');
const { focusOf } = require('./precisionRankingService');
const publicSynthesis = require('./publicAnswerSynthesisService');
const { getPreference } = require('./knowledgeCurationService');
const { projection, supportsRequest } = require('./chatQuestionService');
const { accessBoundary, coverageBoundary } = require('./chatLaunchBoundaryService');
const { retrieveCase, rankPassages } = require('./chatRagService');
const { evaluateSource, sourcePolicy } = require('./chatSourceGovernanceService');
const { assertSentenceSupport } = require('./groundedSentenceService');
const { toolControls } = require('./chatRuntimeControlService');
const { answerPublicEvidence } = require('./publicEvidenceAnswerService');
const LOCAL_TOPICS = new Set(references.flatMap(value => value.topics));
const DISCLAIMER = 'Educational evidence assistant, not a diagnosis, treatment recommendation or claim approval. Verify sources with a qualified professional.';
async function answerFromPassages(input, context, passages, retrieval, options, web = false) {
  const { emit = () => {}, signal } = options;
  const brief = composePrecise(context.localQuestion, context, passages, { ...retrieval, web });
  if (!brief) { context.requestEvidence = 'MISSING'; return null; }
  context.requestEvidence = 'MATCHED_TEXT';
  brief.disclaimer = DISCLAIMER;
  emit('meta', brief);
  // The opt-in task builder exports only fixed topics and evidence-bounded
  // concepts, not the raw question/history. Legacy copy-only mode stays strict.
  const detailedRequest = context.questionPlan && (context.questionPlan.attribute !== 'GENERAL' && context.questionPlan.attribute !== 'SIDE_EFFECTS' || context.questionPlan.anchors.length > 0);
  const synthesisAllowed = (!detailedRequest || publicSynthesis.paraphraseEnabled()) && publicSynthesis.enabled() && (!web || process.env.RAG_CHAT_WEB_SYNTHESIS_ALLOWED === 'true');
  if (!synthesisAllowed) return brief;
  emit('status', { stage: 'generating', message: 'Writing a concise evidence-grounded answer…' });
  try {
    // Restrict generation to the passages actually used by the precise answer.
    const ids = new Set(brief.sources.map(value => value.sourceId));
    const used = passages.filter(value => ids.has(value.id));
    const result = await (options.synthesize || publicSynthesis.synthesize)({ passages: used, context, focus: retrieval.focus }, { signal, fetcher: options.fetcher });
    const sourceIds = new Set(result.paragraphs.flatMap(value => value.ids));
    const sources = brief.sources.filter(value => sourceIds.has(value.sourceId)).map((value, index) => ({ ...value, citation: 'S' + (index + 1) }));
    const text = result.paragraphs.map(value => value.text + ' ' + value.ids.map(id => '[' + sources.find(source => source.sourceId === id).citation + ']').join(' ')).join('\n\n');
    const final = { ...brief, reply: text, mode: 'GEMINI_RAG', model: result.model, sources, answerQuality: { ...brief.answerQuality, sourceCount: sources.length, words: text.split(/\s+/).length, assessment: result.supportMethod || 'CITED_SENTENCE_SUPPORT_NOT_CLINICAL_VALIDATION' } };
    for (const paragraph of result.paragraphs) emit('delta', { text: paragraph.text + ' ' + paragraph.ids.map(id => '[' + sources.find(source => source.sourceId === id).citation + ']').join(' ') + '\n\n' });
    return final;
  } catch (error) {
    if (signal?.aborted) throw error;
    const fallbackReason = error.fallbackReason || (error.providerStatus === 429 ? 'PROVIDER_RATE_LIMIT' : error.providerStatus ? 'PROVIDER_UNAVAILABLE' : error.name === 'TimeoutError' ? 'PROVIDER_TIMEOUT' : 'ANSWER_VALIDATION_FAILED');
    const fallback = { ...brief, fallbackReason, warnings: [...brief.warnings, 'Model generation could not complete a validated answer; showing concise source-supported notes instead.'] };
    emit('reset', fallback);
    return fallback;
  }
}
async function answer(input, options = {}) {
  const { signal, emit = () => {}, localAnswer, webSearch = searchApprovedHealth } = options;
  signal?.throwIfAborted();
  const urgent = routePharmacyQuestion({ message: input.message, resolved: { question: input.message, topics: [] } });
  const boundary = urgent.mode === 'SAFETY' ? urgent : accessBoundary(input.message);
  if (boundary) {
    // Do not let a safe refusal become an existence/authorization bypass for a
    // selected private case. SSE also performs its existing preflight check.
    if (input.caseId) await (options.authorizeCase || retrieveCase)(input.caseId, input.user, input.tenantContext);
    return { reply: boundary.reply, mode: boundary.mode, sources: [], warnings: [], disclaimer: DISCLAIMER,
      retrieval: { method: 'NONE', matchedPassages: 0 },
      routing: { intent: boundary.intent, reasonCode: boundary.reasonCode, policyVersion: boundary.policyVersion },
      agentTrace: [{ tool: 'REQUEST_BOUNDARY', status: boundary.reasonCode }] };
  }
  if (input.caseId) return (localAnswer || conversational.answer)(input, options);
  const publicLocalAnswer = localAnswer || ((request, dependencies) => conversational.answer(request, { ...dependencies,
    retrieve: async (query, candidates, retrievalOptions) => {
      const eligible = candidates.filter(value => evaluateSource(value).eligible);
      const action = () => (dependencies.retrieve || conversational.hybridRetrieve)(query, eligible, retrievalOptions);
      if (!conversational.isEnabled() || process.env.RAG_CHAT_EMBEDDINGS_ENABLED !== 'true') return action();
      try { return await toolControls.run('EMBEDDING', action, retrievalOptions); }
      catch (error) {
        if (retrievalOptions?.signal?.aborted) throw error;
        return { passages: rankPassages(query, eligible), method: 'BM25', warning: 'Semantic tool unavailable or locally limited; keyword retrieval was used.' };
      }
    },
    generate: async (context, generationOptions) => {
      // The legacy fallback must not stream provider paragraphs before the new
      // support gate accepts the entire result. No private input enters here.
      return toolControls.run('MODEL', async () => {
        const paragraphs = await (dependencies.generate || conversational.generateSummary)(context, { ...generationOptions, onParagraph: () => {} });
        paragraphs.forEach(paragraph => assertSentenceSupport(paragraph, context.passages));
        paragraphs.forEach(paragraph => generationOptions.onParagraph?.(paragraph));
        return paragraphs;
      }, generationOptions);
    }
  }));
  const context = resolveContext(input.message, input.serverMemory ? [] : input.history, { memory: input.serverMemory });
  context.focus ||= focusOf(input.message, context);
  const trace = [{ tool: 'CONTEXT_RESOLUTION', status: context.followupResolved ? 'FOLLOWUP_RESOLVED' : 'CURRENT_QUESTION' }];
  let webLookup;
  const attach = result => {
    const value = { ...result, ...(webLookup ? { webLookup } : {}), context: { version: context.version, topics: context.topics, intent: context.intent, focus: context.focus, style: context.style, knowledgeRevision: context.knowledgeRevision || 0, followupResolved: context.followupResolved, topicSwitchResolved: context.topicSwitchResolved, request: projection(context.questionPlan, context.requestEvidence || 'NOT_ASSESSED') }, agentTrace: trace, followupResolved: context.followupResolved };
    const memory = require('./chatConversationMemoryService');
    const state = ['GREETING', 'ACKNOWLEDGEMENT'].includes(result.routing?.reasonCode) && input.serverMemory ? memory.sanitizeState(input.serverMemory) : memory.snapshotContext(context, value.sources);
    Object.defineProperty(value, 'contextState', { value: state, enumerable: false }); return value;
  };
  const basic = (reply, mode, reasonCode) => attach({ reply, mode, sources: [], warnings: [], disclaimer: DISCLAIMER, retrieval: { method: 'BM25', matchedPassages: 0 }, routing: { intent: context.intent, reasonCode, policyVersion: 'contextual-chat-v2' } });
  const policy = routePharmacyQuestion({ message: input.message, resolved: { question: input.message + (context.personalContext ? ' Can I take this medicine safely for me?' : ''), topics: context.topics.map(value => value.id) } });
  if (policy.action === 'RESPOND' && (policy.mode === 'SAFETY' || policy.intent === 'CLINICAL_REFERRAL')) return basic(policy.reply, policy.mode, policy.reasonCode);
  if (context.privateReference) return basic('Select the verification case under Evidence scope first. Chat history and public web pages cannot establish what your private documents contain.', 'CLARIFY', 'CASE_SELECTION_REQUIRED');
  if (context.questionPlan.language !== 'ENGLISH') return basic('I currently provide evidence-backed answers in English only. I cannot provide a verified translation into the requested language yet. Would you like an English answer? For personal medicine decisions, ask a qualified pharmacist who speaks your preferred language.', 'CLARIFY', 'UNSUPPORTED_ANSWER_LANGUAGE');
  if (context.ambiguous) return basic('Which topic should I use: ' + context.topics.map(value => value.label).join(' or ') + '? I will not guess which medicine “it” refers to or recommend a substitution.', 'CLARIFY', 'AMBIGUOUS_TOPIC');
  if (context.unresolvedDetail) return basic('The earlier specific detail was not resolved from public evidence. Please restate the medicine and the fact you want checked; I will not replace it with a generic overview.', 'CLARIFY', 'EARLIER_DETAIL_UNRESOLVED');
  const coverage = coverageBoundary(input.message, context);
  if (coverage) {
    context.requestEvidence = 'MISSING';
    return { ...basic(coverage.reply, coverage.mode, coverage.reasonCode),
      routing: { intent: coverage.intent, reasonCode: coverage.reasonCode, policyVersion: coverage.policyVersion },
      retrieval: { method: 'NONE', matchedPassages: 0 } };
  }
  if (policy.action === 'RESPOND' && policy.intent === 'OUT_OF_DOMAIN') return basic(policy.reply, policy.mode, policy.reasonCode);
  if (!publicSynthesis.paraphraseEnabled() && context.questionPlan.multipleAttributes && context.topics.some(value => !value.id.startsWith('workflow-'))) return basic('You asked about more than one medicine detail. Which should I check first: uses, possible side effects, storage or how it works? I will check the evidence for each question separately.', 'CLARIFY', 'MULTIPLE_DETAILS_NEED_SCOPE');
  if (context.needsTopic) return basic('Which medicine or pharmacy topic do you mean? Please name it so I can retrieve the correct evidence.', 'CLARIFY', 'TOPIC_REQUIRED');
  if (policy.action === 'RESPOND' && !['REFERENCE_OR_MEDICINE_NAME_NEEDED', 'IDENTITY_REFERENCE_NOT_RESOLVED'].includes(policy.reasonCode)) return basic(policy.reply, policy.mode, policy.reasonCode);
  const topic = context.topics[0];
  if (!topic || (policy.intent === 'MEDICINE_IDENTITY' && topic.id !== 'generic-medicines')) return attach(await publicLocalAnswer({ ...input, message: context.localQuestion, history: [] }, options));
  if (publicSynthesis.paraphraseEnabled()) {
    const result = await answerPublicEvidence(input, context, options);
    if (result) {
      context.requestEvidence = result.requestEvidenceStatus || (result.sources.length ? 'MATCHED_TEXT' : 'MISSING');
      trace.push(...(result.agentTrace || []));
      return attach({ ...result, routing: { intent: context.intent, reasonCode: result.mode === 'GEMINI_RAG' ? 'CONTEXTUAL_GROUNDED_GENERATION' : 'PUBLIC_EVIDENCE_OR_EXPLICIT_GAP', policyVersion: 'contextual-chat-v3' } });
    }
  }
  let checkedWeb;
  const checkWeb = async () => {
    if (checkedWeb) return checkedWeb;
    emit('status', { stage: 'searching_official', message: 'Checking the approved MedlinePlus public-topic service…' });
    let response;
    try { response = await webSearch(topic.id, { signal }); }
    catch (error) { if (signal?.aborted) throw error; response = { status: 'UNAVAILABLE', passages: [] }; }
    const related = (response.passages || []).filter(value => supportsRequest(value, context));
    const eligible = related.filter(value => evaluateSource(value, { attribute: context.questionPlan?.attribute }).eligible);
    const status = related.length && !eligible.length ? 'SOURCE_REVIEW_REQUIRED'
      : response.passages?.length && !related.length ? 'NO_RELEVANT_EVIDENCE' : response.status;
    webLookup = { policy: webLookupPolicy() === 'ALWAYS_PUBLIC' ? 'ALWAYS_PUBLIC' : 'FALLBACK', status,
      relevantSources: eligible.length, usedInAnswer: false, checkedAt: new Date().toISOString(), provider: 'MEDLINEPLUS_HEALTH_TOPICS' };
    trace.push({ tool: 'APPROVED_WEB_SEARCH', status });
    checkedWeb = { status, passages: eligible };
    return checkedWeb;
  };
  // Only registered public topics reach this point. Every privacy, language,
  // clinical, ambiguity, unknown-name and private-case boundary ran beforehand.
  if (webLookupPolicy() === 'ALWAYS_PUBLIC' && !topic.id.startsWith('workflow-')) {
    const web = await checkWeb();
    if (web.passages.length) {
      const result = await answerFromPassages(input, context, web.passages, { focus: context.focus, trained: false }, options, true);
      if (result) { webLookup.usedInAnswer = true; return attach({ ...result, routing: { intent: context.intent, reasonCode: 'APPROVED_WEB_EVIDENCE', policyVersion: 'contextual-chat-v2' } }); }
    }
  }
  if (localAnswer) {
    trace.push({ tool: 'LOCAL_RETRIEVAL', status: 'CHECKED' });
    const result = await localAnswer({ ...input, message: context.localQuestion, history: [] }, options);
    if (result.sources?.length || ['SAFETY', 'CLARIFY'].includes(result.mode)) return attach(result);
  } else if (LOCAL_TOPICS.has(topic.id)) {
    let preference = { sourceIds: [], version: 0 };
    try { preference = await getPreference(input.user, topic.id, context.focus); } catch { trace.push({ tool: 'REVIEWED_PREFERENCE', status: 'UNAVAILABLE_DEFAULT_REFERENCES_USED' }); }
    const retrieval = retrievePrecise(context.localQuestion, context, { preferredSourceIds: preference.sourceIds });
    context.knowledgeRevision = preference.version;
    trace.push({ tool: 'LOCAL_RETRIEVAL', status: !retrieval.passages.length ? 'NO_PASSAGE_SUPPORTS_REQUEST' : retrieval.trained ? 'TRAINED_CONTEXT_RERANKER' : 'BM25' });
    const result = await answerFromPassages(input, context, retrieval.passages, retrieval, options);
    if (result) return attach(result);
  } else trace.push({ tool: 'LOCAL_RETRIEVAL', status: 'NO_APPROVED_TOPIC_PASSAGE' });
  if (topic.id.startsWith('workflow-')) return basic('I could not retrieve sufficient project evidence for that question. Public medical pages cannot establish how this project works.', 'ABSTAIN', 'PROJECT_EVIDENCE_MISSING');
  if (sourcePolicy() === 'REVIEWED_ONLY') {
    context.requestEvidence = 'MISSING';
    return basic('No current reviewed source supports this request under the reviewed-only policy. Unreviewed snapshots and newly fetched web pages cannot replace clinical source approval. Check an official product leaflet or a qualified pharmacist.', 'ABSTAIN', 'REVIEWED_SOURCE_REQUIRED');
  }
  const web = await checkWeb();
  if (!web.passages.length) { context.requestEvidence = 'MISSING'; return basic(web.status === 'DISABLED'
    ? 'The local references do not support the specific detail you asked about, and official-source web lookup is disabled on this server. Check the product leaflet or ask a qualified pharmacist. I will not replace the missing answer with an unrelated summary.'
    : 'I could not retrieve enough relevant approved evidence for this topic. The source may be unavailable or may cover broader topics rather than this exact medicine. Please clarify or ask a qualified pharmacist.', 'ABSTAIN', 'INSUFFICIENT_APPROVED_EVIDENCE');
  }
  const result = await answerFromPassages(input, context, web.passages, { focus: context.focus, trained: false }, options, true);
  if (result && webLookup) webLookup.usedInAnswer = true;
  return result ? attach({ ...result, routing: { intent: context.intent, reasonCode: 'APPROVED_WEB_EVIDENCE', policyVersion: 'contextual-chat-v2' } })
    : basic('Related references were found, but they do not directly support this question’s focus. I will not turn unrelated material into an answer.', 'ABSTAIN', 'INSUFFICIENT_FOCUS_EVIDENCE');
}
module.exports = { answer, answerFromPassages };
