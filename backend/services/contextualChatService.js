const conversational = require('./conversationalRagService');
const { routePharmacyQuestion } = require('./pharmacyChatPolicy');
const { resolveContext } = require('./chatContextService');
const { searchApprovedHealth } = require('./approvedHealthSearchService');
const { references } = require('./chatReferenceRegistry');
const { retrievePrecise, composePrecise } = require('./preciseAnswerService');
const { focusOf } = require('./precisionRankingService');
const publicSynthesis = require('./publicAnswerSynthesisService');
const { getPreference } = require('./knowledgeCurationService');
const LOCAL_TOPICS = new Set(references.flatMap(value => value.topics));
const DISCLAIMER = 'Educational evidence assistant, not a diagnosis, treatment recommendation or claim approval. Verify sources with a qualified professional.';
async function answerFromPassages(input, context, passages, retrieval, options, web = false) {
  const { emit = () => {}, signal } = options;
  const brief = composePrecise(context.localQuestion, context, passages, { ...retrieval, web });
  if (!brief) return null;
  brief.disclaimer = DISCLAIMER;
  emit('meta', brief);
  const synthesisAllowed = publicSynthesis.enabled() && (!web || process.env.RAG_CHAT_WEB_SYNTHESIS_ALLOWED === 'true');
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
    const final = { ...brief, reply: text, mode: 'GEMINI_RAG', model: result.model, sources, answerQuality: { ...brief.answerQuality, words: text.split(/\s+/).length, assessment: 'MECHANICAL_CITATION_CHECKS_NOT_SEMANTIC_OR_CLINICAL_PROOF' } };
    for (const paragraph of result.paragraphs) emit('delta', { text: paragraph.text + ' ' + paragraph.ids.map(id => '[' + sources.find(source => source.sourceId === id).citation + ']').join(' ') + '\n\n' });
    return final;
  } catch (error) {
    if (signal?.aborted) throw error;
    const fallbackReason = error.providerStatus === 429 ? 'PROVIDER_RATE_LIMIT' : error.providerStatus ? 'PROVIDER_UNAVAILABLE' : error.name === 'TimeoutError' ? 'PROVIDER_TIMEOUT' : 'ANSWER_VALIDATION_FAILED';
    const fallback = { ...brief, fallbackReason, warnings: [...brief.warnings, 'Model generation could not complete a validated answer; showing concise source-supported notes instead.'] };
    emit('reset', fallback);
    return fallback;
  }
}
async function answer(input, options = {}) {
  const { signal, emit = () => {}, localAnswer, webSearch = searchApprovedHealth } = options;
  signal?.throwIfAborted();
  if (input.caseId) return (localAnswer || conversational.answer)(input, options);
  const context = resolveContext(input.message, input.history);
  context.focus ||= focusOf(input.message, context);
  const trace = [{ tool: 'CONTEXT_RESOLUTION', status: context.followupResolved ? 'FOLLOWUP_RESOLVED' : 'CURRENT_QUESTION' }];
  const attach = result => ({ ...result, context: { version: context.version, topics: context.topics, intent: context.intent, focus: context.focus, style: context.style, knowledgeRevision: context.knowledgeRevision || 0, followupResolved: context.followupResolved }, agentTrace: trace, followupResolved: context.followupResolved });
  const basic = (reply, mode, reasonCode) => attach({ reply, mode, sources: [], warnings: [], disclaimer: DISCLAIMER, retrieval: { method: 'BM25', matchedPassages: 0 }, routing: { intent: context.intent, reasonCode, policyVersion: 'contextual-chat-v2' } });
  const policy = routePharmacyQuestion({ message: input.message, resolved: { question: input.message + (context.personalContext ? ' Can I take this medicine safely for me?' : ''), topics: context.topics.map(value => value.id) } });
  if (policy.action === 'RESPOND' && (policy.mode === 'SAFETY' || ['CLINICAL_REFERRAL', 'OUT_OF_DOMAIN'].includes(policy.intent))) return basic(policy.reply, policy.mode, policy.reasonCode);
  if (context.privateReference) return basic('Select the verification case under Evidence scope first. Chat history and public web pages cannot establish what your private documents contain.', 'CLARIFY', 'CASE_SELECTION_REQUIRED');
  if (context.ambiguous) return basic('Which topic should I use: ' + context.topics.map(value => value.label).join(' or ') + '? I will not guess which medicine “it” refers to or recommend a substitution.', 'CLARIFY', 'AMBIGUOUS_TOPIC');
  if (context.needsTopic) return basic('Which medicine or pharmacy topic do you mean? Please name it so I can retrieve the correct evidence.', 'CLARIFY', 'TOPIC_REQUIRED');
  if (policy.action === 'RESPOND' && !['REFERENCE_OR_MEDICINE_NAME_NEEDED', 'IDENTITY_REFERENCE_NOT_RESOLVED'].includes(policy.reasonCode)) return basic(policy.reply, policy.mode, policy.reasonCode);
  const topic = context.topics[0];
  if (!topic || (policy.intent === 'MEDICINE_IDENTITY' && topic.id !== 'generic-medicines')) return attach(await (localAnswer || conversational.answer)({ ...input, message: context.localQuestion, history: [] }, options));
  if (localAnswer) {
    trace.push({ tool: 'LOCAL_RETRIEVAL', status: 'CHECKED' });
    const result = await localAnswer({ ...input, message: context.localQuestion, history: [] }, options);
    if (result.sources?.length || ['SAFETY', 'CLARIFY'].includes(result.mode)) return attach(result);
  } else if (LOCAL_TOPICS.has(topic.id)) {
    let preference = { sourceIds: [], version: 0 };
    try { preference = await getPreference(input.user, topic.id, context.focus); } catch { trace.push({ tool: 'REVIEWED_PREFERENCE', status: 'UNAVAILABLE_DEFAULT_REFERENCES_USED' }); }
    const retrieval = retrievePrecise(context.localQuestion, context, { preferredSourceIds: preference.sourceIds });
    context.knowledgeRevision = preference.version;
    trace.push({ tool: 'LOCAL_RETRIEVAL', status: retrieval.trained ? 'TRAINED_CONTEXT_RERANKER' : 'BM25' });
    const result = await answerFromPassages(input, context, retrieval.passages, retrieval, options);
    if (result) return attach(result);
  } else trace.push({ tool: 'LOCAL_RETRIEVAL', status: 'NO_APPROVED_TOPIC_PASSAGE' });
  if (topic.id.startsWith('workflow-')) return basic('I could not retrieve sufficient project evidence for that question. Public medical pages cannot establish how this project works.', 'ABSTAIN', 'PROJECT_EVIDENCE_MISSING');
  emit('status', { stage: 'searching_official', message: 'Checking the approved MedlinePlus health-topic service…' });
  const web = await webSearch(topic.id, { signal });
  trace.push({ tool: 'APPROVED_WEB_SEARCH', status: web.status });
  if (!web.passages.length) return basic(web.status === 'DISABLED'
    ? 'The local library does not cover this topic, and official-source web lookup is disabled on this server. I will not fill the gap with an unsupported answer.'
    : 'I could not retrieve enough relevant approved evidence for this topic. The source may be unavailable or may cover broader topics rather than this exact medicine. Please clarify or ask a qualified pharmacist.', 'ABSTAIN', 'INSUFFICIENT_APPROVED_EVIDENCE');
  const result = await answerFromPassages(input, context, web.passages, { focus: context.focus, trained: false }, options, true);
  return result ? attach({ ...result, routing: { intent: context.intent, reasonCode: 'APPROVED_WEB_EVIDENCE', policyVersion: 'contextual-chat-v2' } })
    : basic('Related references were found, but they do not directly support this question’s focus. I will not turn unrelated material into an answer.', 'ABSTAIN', 'INSUFFICIENT_FOCUS_EVIDENCE');
}
module.exports = { answer, answerFromPassages };
