const conversational = require('./conversationalRagService');
const { routePharmacyQuestion } = require('./pharmacyChatPolicy');
const { resolveContext } = require('./chatContextService');
const { searchApprovedHealth } = require('./approvedHealthSearchService');
const LOCAL_HEALTH = new Set(['paracetamol', 'metformin', 'cetirizine', 'amoxicillin', 'antibiotics', 'workflow-human-review', 'workflow-ocr', 'workflow-trustrag']);
const DISCLAIMER = 'Educational evidence assistant, not a diagnosis, treatment recommendation or claim approval. Verify sources with a qualified professional.';
const escape = value => value.replace(/[\\`*_{}\[\]<>#|]/g, '\\$&');
async function answer(input, options = {}) {
  const { signal, emit = () => {}, localAnswer = conversational.answer, webSearch = searchApprovedHealth } = options;
  signal?.throwIfAborted();
  // Preserve the private-case implementation and its authorization boundary.
  if (input.caseId) return localAnswer(input, options);
  const context = resolveContext(input.message, input.history);
  const trace = [{ tool: 'CONTEXT_RESOLUTION', status: context.followupResolved ? 'FOLLOWUP_RESOLVED' : 'CURRENT_QUESTION' }];
  const attach = result => ({ ...result, context: { version: context.version, topics: context.topics, intent: context.intent, style: context.style, followupResolved: context.followupResolved }, agentTrace: trace, followupResolved: context.followupResolved });
  const basic = (reply, mode, reasonCode) => attach({ reply, mode, sources: [], warnings: [], disclaimer: DISCLAIMER, retrieval: { method: 'BM25', matchedPassages: 0 }, routing: { intent: context.intent, reasonCode, policyVersion: 'contextual-chat-v1' } });
  const policy = routePharmacyQuestion({ message: input.message, resolved: { question: input.message + (context.personalContext ? ' Can I take this medicine safely for me?' : ''), topics: context.topics.map(value => value.id) } });
  if (policy.action === 'RESPOND' && (policy.mode === 'SAFETY' || ['CLINICAL_REFERRAL', 'OUT_OF_DOMAIN'].includes(policy.intent))) return basic(policy.reply, policy.mode, policy.reasonCode);
  if (context.privateReference) return basic('Select the verification case under Evidence scope first. Chat history and public web pages cannot establish what your private documents contain.', 'CLARIFY', 'CASE_SELECTION_REQUIRED');
  if (context.ambiguous) return basic('Which topic should I use: ' + context.topics.map(value => value.label).join(' or ') + '? I will not guess which medicine “it” refers to or recommend a substitution.', 'CLARIFY', 'AMBIGUOUS_TOPIC');
  if (context.needsTopic) return basic('Which medicine or pharmacy topic do you mean? Please name it so I can retrieve the correct evidence.', 'CLARIFY', 'TOPIC_REQUIRED');
  if (policy.action === 'RESPOND' && !['REFERENCE_OR_MEDICINE_NAME_NEEDED', 'IDENTITY_REFERENCE_NOT_RESOLVED'].includes(policy.reasonCode)) return basic(policy.reply, policy.mode, policy.reasonCode);
  if (!context.topics.length || LOCAL_HEALTH.has(context.topics[0].id)) {
    trace.push({ tool: 'LOCAL_RETRIEVAL', status: 'CHECKED' });
    const generate = options.generate || ((value, generationOptions) => conversational.generateSummary({ ...value, intent: context.style === 'CONCISE' ? 'SIMPLE_EXPLANATION' : value.intent }, generationOptions));
    const result = await localAnswer({ ...input, message: context.localQuestion, history: [] }, { ...options, emit, generate });
    if (result.sources?.length || !context.topics.length || ['SAFETY', 'CLARIFY'].includes(result.mode)) return attach(result);
  } else trace.push({ tool: 'LOCAL_RETRIEVAL', status: 'NO_APPROVED_TOPIC_PASSAGE' });
  const topic = context.topics[0];
  if (!topic) return basic('I need a specific supported pharmacy topic to retrieve reliable evidence.', 'CLARIFY', 'TOPIC_REQUIRED');
  if (topic.id.startsWith('workflow-')) return basic('I could not retrieve sufficient project evidence for that question. Public medical pages cannot establish how this project works.', 'ABSTAIN', 'PROJECT_EVIDENCE_MISSING');
  emit('status', { stage: 'searching_official', message: 'Checking the approved MedlinePlus health-topic service…' });
  const web = await webSearch(topic.id, { signal });
  trace.push({ tool: 'APPROVED_WEB_SEARCH', status: web.status });
  if (!web.passages.length) return basic(web.status === 'DISABLED'
    ? 'The local library does not cover this topic, and official-source web lookup is disabled on this server. I will not fill the gap with an unsupported answer.'
    : 'I could not retrieve enough relevant approved evidence for this topic. The source may be unavailable or may cover broader topics rather than this exact medicine. Please clarify or ask a qualified pharmacist.', 'ABSTAIN', 'INSUFFICIENT_APPROVED_EVIDENCE');
  const sources = web.passages.slice(0, context.style === 'CONCISE' ? 1 : 2).map((passage, index) => ({ citation: 'S' + (index + 1), sourceId: passage.id, title: passage.title, excerpt: passage.excerpt, kind: 'OFFICIAL_WEB', version: passage.version, sourceUrl: passage.sourceUrl, score: passage.score }));
  return attach({ reply: 'I found related official health-topic material for **' + topic.label + '**. These are source notes, not an individualized answer or necessarily an exact medicine monograph.\n\n' + sources.map(source => escape(source.excerpt) + ' [' + source.citation + ']').join('\n\n'),
    mode: 'OFFICIAL_WEB_EXTRACTIVE', sources, warnings: ['Source: MedlinePlus.gov (US National Library of Medicine). This is not India-specific regulatory guidance. No live LLM synthesis was used for these web notes.'], disclaimer: DISCLAIMER,
    retrieval: { method: 'APPROVED_WEB_BM25', matchedPassages: sources.length }, routing: { intent: context.intent, reasonCode: 'APPROVED_WEB_EVIDENCE', policyVersion: 'contextual-chat-v1' } });
}
module.exports = { answer };
