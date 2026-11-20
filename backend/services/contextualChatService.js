const conversational = require('./conversationalRagService');
const { routePharmacyQuestion } = require('./pharmacyChatPolicy');
const { resolveContext } = require('./chatContextService');
const { searchApprovedHealth } = require('./approvedHealthSearchService');
const { references } = require('./chatReferenceRegistry');
const { retrievePrecise, composePrecise } = require('./preciseAnswerService');
const { focusOf } = require('./precisionRankingService');
const publicSynthesis = require('./publicAnswerSynthesisService');
const { getPreference } = require('./knowledgeCurationService');
const { projection } = require('./chatQuestionService');
const LOCAL_TOPICS = new Set(references.flatMap(value => value.topics));
const DISCLAIMER = 'Educational evidence assistant, not a diagnosis, treatment recommendation or claim approval. Verify sources with a qualified professional.';
async function answerFromPassages(input, context, passages, retrieval, options, web = false) {
  const { emit = () => {}, signal } = options;
  const brief = composePrecise(context.localQuestion, context, passages, { ...retrieval, web });
  if (!brief) { context.requestEvidence = 'MISSING'; return null; }
  context.requestEvidence = 'MATCHED_TEXT';
  brief.disclaimer = DISCLAIMER;
  emit('meta', brief);
  // A fixed topic/focus prompt cannot safely preserve newly supported detailed
  // questions. Keep these answers extractive until that export contract is
  // separately evaluated; no raw question/history or local anchors leave.
  const detailedRequest = context.questionPlan && (context.questionPlan.attribute !== 'GENERAL' && context.questionPlan.attribute !== 'SIDE_EFFECTS' || context.questionPlan.anchors.length > 0);
  const synthesisAllowed = !detailedRequest && publicSynthesis.enabled() && (!web || process.env.RAG_CHAT_WEB_SYNTHESIS_ALLOWED === 'true');
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
// "What is X used for, and what are its side effects?" is answered one part at a time:
// each part runs the same retrieval and evidence checks as a single question, and the
// parts are joined with renumbered citations. A part without evidence says so.
const PART_QUESTIONS = { USES: label => 'What is ' + label + ' used for?', SIDE_EFFECTS: label => 'What are the common side effects of ' + label + '?', STORAGE: label => 'How should ' + label + ' be stored?', MECHANISM: label => 'How does ' + label + ' work?' };
const PART_LABELS = { USES: 'Uses', SIDE_EFFECTS: 'Possible side effects', STORAGE: 'Storage', MECHANISM: 'How it works' };
async function answerEachPart(input, context, options) {
  const attributes = (context.questionPlan.requestedAttributes || []).filter(value => PART_QUESTIONS[value]);
  if (attributes.length < 2 || attributes.length > 3) return null;
  const label = context.topics[0].label;
  const emit = options.emit || (() => {});
  const parts = [];
  for (const attribute of attributes) {
    options.signal?.throwIfAborted();
    const result = await answer({ ...input, message: PART_QUESTIONS[attribute](label), history: [] }, { ...options, splitPart: true, emit: (event, data) => { if (event === 'status') emit(event, data); } });
    parts.push({ attribute, result });
  }
  const supported = parts.filter(value => value.result.sources?.length && !['CLARIFY', 'ABSTAIN', 'SAFETY'].includes(value.result.mode));
  if (!supported.length) return null;
  const sources = [], citationBySource = new Map();
  const replies = parts.map(({ attribute, result }) => {
    if (!supported.some(value => value.attribute === attribute)) return PART_LABELS[attribute] + ': no approved source supported this part, so it is not answered.';
    const renumber = {};
    for (const source of result.sources) {
      let citation = citationBySource.get(source.sourceId);
      if (!citation) { citation = 'S' + (sources.length + 1); citationBySource.set(source.sourceId, citation); sources.push({ ...source, citation }); }
      renumber[source.citation] = citation;
    }
    return PART_LABELS[attribute] + ': ' + String(result.reply).replace(/\[(S\d+)\]/g, (match, citation) => '[' + (renumber[citation] || citation) + ']');
  });
  const first = supported[0].result;
  context.requestEvidence = supported.length === parts.length ? 'MATCHED_TEXT' : 'PARTIAL';
  return {
    trace: [{ tool: 'QUESTION_SPLIT', status: attributes.join('_AND_') }, ...parts.flatMap(({ result }) => (result.agentTrace || []).filter(step => step.tool !== 'CONTEXT_RESOLUTION'))],
    result: { reply: replies.join('\n\n'), mode: first.mode, sources, disclaimer: DISCLAIMER,
      warnings: [...new Set(supported.flatMap(value => value.result.warnings || []))],
      retrieval: { method: first.retrieval?.method || 'BM25', matchedPassages: sources.length },
      answerQuality: { ...(first.answerQuality || {}), sourceCount: sources.length, parts: attributes.length, partsAnswered: supported.length },
      routing: { intent: context.intent, reasonCode: 'MULTI_PART_ANSWERED_SEPARATELY', policyVersion: 'contextual-chat-v2' } }
  };
}
async function answer(input, options = {}) {
  const { signal, emit = () => {}, localAnswer, webSearch = searchApprovedHealth } = options;
  signal?.throwIfAborted();
  if (input.caseId) return (localAnswer || conversational.answer)(input, options);
  const context = resolveContext(input.message, input.history);
  context.focus ||= focusOf(input.message, context);
  const trace = [{ tool: 'CONTEXT_RESOLUTION', status: context.followupResolved ? 'FOLLOWUP_RESOLVED' : 'CURRENT_QUESTION' }];
  const attach = result => ({ ...result, context: { version: context.version, topics: context.topics, intent: context.intent, focus: context.focus, style: context.style, knowledgeRevision: context.knowledgeRevision || 0, followupResolved: context.followupResolved, topicSwitchResolved: context.topicSwitchResolved, request: projection(context.questionPlan, context.requestEvidence || 'NOT_ASSESSED') }, agentTrace: trace, followupResolved: context.followupResolved });
  const basic = (reply, mode, reasonCode) => attach({ reply, mode, sources: [], warnings: [], disclaimer: DISCLAIMER, retrieval: { method: 'BM25', matchedPassages: 0 }, routing: { intent: context.intent, reasonCode, policyVersion: 'contextual-chat-v2' } });
  const policy = routePharmacyQuestion({ message: input.message, resolved: { question: input.message + (context.personalContext ? ' Can I take this medicine safely for me?' : ''), topics: context.topics.map(value => value.id) } });
  if (policy.action === 'RESPOND' && (policy.mode === 'SAFETY' || ['CLINICAL_REFERRAL', 'OUT_OF_DOMAIN'].includes(policy.intent))) return basic(policy.reply, policy.mode, policy.reasonCode);
  if (context.privateReference) return basic('Select the verification case under Evidence scope first. Chat history and public web pages cannot establish what your private documents contain.', 'CLARIFY', 'CASE_SELECTION_REQUIRED');
  if (context.questionPlan.language !== 'ENGLISH') return basic('I currently provide evidence-backed answers in English only. I cannot provide a verified translation into the requested language yet. Would you like an English answer? For personal medicine decisions, ask a qualified pharmacist who speaks your preferred language.', 'CLARIFY', 'UNSUPPORTED_ANSWER_LANGUAGE');
  if (context.ambiguous) return basic('Which topic should I use: ' + context.topics.map(value => value.label).join(' or ') + '? I will not guess which medicine “it” refers to or recommend a substitution.', 'CLARIFY', 'AMBIGUOUS_TOPIC');
  if (context.questionPlan.multipleAttributes && context.topics.length === 1 && !context.topics[0].id.startsWith('workflow-') && !options.splitPart) {
    const split = await answerEachPart(input, context, options);
    if (split) { trace.push(...split.trace); return attach(split.result); }
  }
  if (context.questionPlan.multipleAttributes && context.topics.some(value => !value.id.startsWith('workflow-'))) return basic('You asked about more than one medicine detail. Which should I check first: uses, possible side effects, storage or how it works? I will check the evidence for each question separately.', 'CLARIFY', 'MULTIPLE_DETAILS_NEED_SCOPE');
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
    trace.push({ tool: 'LOCAL_RETRIEVAL', status: !retrieval.passages.length ? 'NO_PASSAGE_SUPPORTS_REQUEST' : retrieval.trained ? 'TRAINED_CONTEXT_RERANKER' : 'BM25' });
    const result = await answerFromPassages(input, context, retrieval.passages, retrieval, options);
    if (result) return attach(result);
  } else trace.push({ tool: 'LOCAL_RETRIEVAL', status: 'NO_APPROVED_TOPIC_PASSAGE' });
  if (topic.id.startsWith('workflow-')) return basic('I could not retrieve sufficient project evidence for that question. Public medical pages cannot establish how this project works.', 'ABSTAIN', 'PROJECT_EVIDENCE_MISSING');
  emit('status', { stage: 'searching_official', message: 'Checking the approved MedlinePlus health-topic service…' });
  const web = await webSearch(topic.id, { signal });
  trace.push({ tool: 'APPROVED_WEB_SEARCH', status: web.status });
  if (!web.passages.length) { context.requestEvidence = 'MISSING'; return basic(web.status === 'DISABLED'
    ? 'The local references do not support the specific detail you asked about, and official-source web lookup is disabled on this server. Check the product leaflet or ask a qualified pharmacist. I will not replace the missing answer with an unrelated summary.'
    : 'I could not retrieve enough relevant approved evidence for this topic. The source may be unavailable or may cover broader topics rather than this exact medicine. Please clarify or ask a qualified pharmacist.', 'ABSTAIN', 'INSUFFICIENT_APPROVED_EVIDENCE');
  }
  const result = await answerFromPassages(input, context, web.passages, { focus: context.focus, trained: false }, options, true);
  return result ? attach({ ...result, routing: { intent: context.intent, reasonCode: 'APPROVED_WEB_EVIDENCE', policyVersion: 'contextual-chat-v2' } })
    : basic('Related references were found, but they do not directly support this question’s focus. I will not turn unrelated material into an answer.', 'ABSTAIN', 'INSUFFICIENT_FOCUS_EVIDENCE');
}
module.exports = { answer, answerFromPassages };
