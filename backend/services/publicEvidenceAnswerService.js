'use strict';
// Academic public-only path. Local concept expansion is not an embedding model
// or clinical NLP. The model must pass a separate support/relevance check.
const { references, isKnownPublic } = require('./chatReferenceRegistry');
const { searchApprovedHealth, registerMedicineCandidates, webLookupPolicy, isApprovedWebPassage } = require('./approvedHealthSearchService');
const { searchApprovedMedicine } = require('./approvedMedicineSearchService');
const { searchApprovedFdaMedicine } = require('./approvedFdaMedicineSearchService');
const { evaluateSource, sourcePolicy } = require('./chatSourceGovernanceService');
const { rankPassages } = require('./chatRagService');
const { sentenceSupports } = require('./chatQuestionService');
const { composePrecise } = require('./preciseAnswerService');
const synthesis = require('./publicAnswerSynthesisService');
const { toolControls } = require('./chatRuntimeControlService');
const { buildPublicAnswerTask } = require('./publicAnswerTaskService');
const registry = require('../data/chatTopicRegistry');
const { publicSemanticRetrieval } = require('./publicSemanticRetrievalService');
const DISCLAIMER = 'Educational evidence assistant, not diagnosis, prescribing or claim approval. Source checks and model review are not clinical validation.';
const labels = { GENERAL: 'General information', USES: 'Uses', SIDE_EFFECTS: 'Possible side effects', STORAGE: 'Storage', MECHANISM: 'How it works', PREVENTION: 'Prevention', SPECIFIC_FACT: 'Specific question' };
const concept = value => ({ drowsy: 'sleep', drowsiness: 'sleep', sleepy: 'sleep', sleeping: 'sleep', sleepiness: 'sleep', diarrhoea: 'diarrhea', vomiting: 'vomit', viral: 'virus', viruses: 'virus', colds: 'cold', vitamins: 'vitamin', treats: 'treat', treating: 'treat', causes: 'cause', causing: 'cause', affects: 'affect', works: 'work' })[value] || value;
function concepts(text) { return [...new Set(String(text || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).map(concept))]; }
function attributesFor(context) {
  const plan = context.questionPlan;
  const values = plan.multipleAttributes ? plan.requestedAttributes : [plan.attribute];
  return Array.isArray(values) && values.length <= 4 && values.every(value => labels[value]) ? [...new Set(values)] : [];
}
function compatible(source, attribute) {
  if (source.supportedAttributes?.length && !['GENERAL', 'SPECIFIC_FACT', 'MECHANISM'].includes(attribute) && !source.supportedAttributes.includes(attribute)) return false;
  if (attribute === 'GENERAL' || attribute === 'SPECIFIC_FACT') return true;
  return source.excerpt.split(/(?<=[.!?])\s+/).some(text => sentenceSupports(text, { attribute, anchors: [], exactTemperature: false }));
}
function rankCandidates(query, candidates, context) {
  const lexical = new Map(rankPassages(query, candidates, candidates.length, { minScore: 0, minMatchedTerms: 1 }).map(value => [value.id, value.score]));
  const wanted = new Set((context.questionPlan.anchors || []).map(concept));
  return candidates.map(value => {
    const present = new Set(concepts(value.excerpt));
    const matches = [...wanted].filter(term => present.has(term)).length;
    const overview = context.questionPlan.attribute === 'GENERAL' && (value.supportedAttributes?.some(attribute => ['USES', 'GENERAL'].includes(attribute)) || value.focuses?.includes('DEFINITION'));
    return { ...value, score: (lexical.get(value.id) || 0) + matches * 2 + (overview ? 4 : 0) + (value.kind === 'OFFICIAL_WEB' ? 0.15 : 0) };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
function sourceCard(passage, index) {
  const review = evaluateSource(passage);
  return { citation: 'S' + (index + 1), sourceId: passage.id, title: passage.title, excerpt: passage.excerpt, kind: passage.kind,
    version: passage.version, sourceUrl: passage.sourceUrl, score: passage.score || 0, reviewStatus: review.status,
    ...(passage.publisher ? { publisher: passage.publisher, jurisdiction: passage.jurisdiction, checkedAt: passage.checkedAt || passage.fetchedAt, licensingNote: passage.licensingNote } : {}),
    ...(passage.attribution ? { attribution: passage.attribution } : {}) };
}
async function answerPublicEvidence(input, context, options = {}) {
  const { signal, emit = () => {}, webSearch = searchApprovedHealth, medicineSearch = searchApprovedMedicine } = options;
  const attributes = attributesFor(context), topic = registry.find(value => value.id === context.topics[0]?.id);
  if (!topic || !attributes.length) return null;
  // Reserve room for the bounded model stages inside the protected 45s route.
  const webSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000);
  const trace = [{ tool: 'PUBLIC_QUESTION_PLAN', status: attributes.length > 1 ? 'MULTI_ATTRIBUTE' : 'SINGLE_ATTRIBUTE' }];
  let pool = references.filter(value => value.topics.includes(topic.id));
  const webStatuses = [], providers = new Set();
  if (!topic.localOnly && webLookupPolicy() !== 'DISABLED' && sourcePolicy() !== 'REVIEWED_ONLY') {
    emit('status', { stage: 'searching_official', message: 'Checking medicine-specific NHS evidence and relevant official health topics…' });
    // Calls contain only fixed topic IDs and attribute enums, never input text.
    const lookupAttributes = [...new Set(attributes)];
    for (const attribute of lookupAttributes) {
      signal?.throwIfAborted();
      if (webSignal.aborted) { webStatuses.push('TIMEOUT'); break; }
      let response;
      try { response = await toolControls.run('WEB', () => medicineSearch(topic.id, { attribute, signal: webSignal }), { signal: webSignal }); }
      catch (error) { if (signal?.aborted) throw error; response = { status: 'UNAVAILABLE', candidates: [] }; }
      if (response.status === 'UNSUPPORTED' && ['ondansetron', 'telmisartan'].includes(topic.id)) {
        try { response = await toolControls.run('WEB', () => (options.fdaSearch || searchApprovedFdaMedicine)(topic.id, { attribute, signal: webSignal }), { signal: webSignal });
          providers.add('FDA_LABELS'); } catch (error) { if (signal?.aborted) throw error; response = { status: 'UNAVAILABLE', candidates: [] }; }
      }
      if (response.status !== 'UNSUPPORTED' && response.status !== 'DISABLED') { webStatuses.push(response.status); if (response.candidates?.some(value => value.publisher === 'FDA')) providers.add('FDA_LABELS'); else providers.add('NHS_MEDICINES'); }
      if (response.candidates?.length) {
        try { pool.push(...registerMedicineCandidates(response.candidates)); }
        catch { trace.push({ tool: 'MEDICINE_SOURCE_PROVENANCE', status: 'UNBOUND_CANDIDATES_REJECTED' }); }
      }
    }
    // A broad topic service is a fallback, not the sole medicine database.
    if (!pool.some(value => value.kind === 'OFFICIAL_WEB') && !webSignal.aborted) {
      let response;
      try { response = await webSearch(topic.id, { signal: webSignal }); }
      catch (error) { if (signal?.aborted) throw error; response = { status: 'UNAVAILABLE', passages: [] }; }
      webStatuses.push(response.status); providers.add('MEDLINEPLUS_HEALTH_TOPICS');
      pool.push(...(response.passages || []).filter(value => {
        const entry = registry.find(item => item.id === topic.id), text = ' ' + concepts(value.title + ' ' + value.excerpt).join(' ') + ' ';
        if (entry.strictWebTopic) return [entry.label, entry.webTerm, ...entry.aliases].some(name => concepts(name).join(' ') === concepts(value.title.replace(/^MedlinePlus:\s*/i, '')).join(' '));
        return [entry.label, ...entry.aliases].some(name => text.includes(' ' + concepts(name).join(' ') + ' '));
      }));
    }
  }
  // A bounded class bridge, not medicine substitution: both the named medicine's
  // class and the class statement must be evidenced. Needed for e.g. viral-cold
  // questions whose answer spans two documents rather than a single sentence.
  if (attributes.includes('SPECIFIC_FACT') && /virus|viral|colds?|flu/i.test(context.localQuestion) && pool.some(value => /\bantibiotic\b/i.test(value.excerpt))) {
    pool.push(...references.filter(value => value.topics.includes('antibiotics')));
    if (webLookupPolicy() !== 'DISABLED' && sourcePolicy() !== 'REVIEWED_ONLY' && !webSignal.aborted) {
      try {
        const response = await toolControls.run('WEB', () => medicineSearch('antibiotics', { attribute: 'GENERAL', signal: webSignal }), { signal: webSignal });
        if (response.candidates?.length) { pool.push(...registerMedicineCandidates(response.candidates)); providers.add('NHS_MEDICINES'); webStatuses.push(response.status); }
      } catch (error) { if (signal?.aborted) throw error; }
    }
    trace.push({ tool: 'CLASS_EVIDENCE_BRIDGE', status: 'ANTIBIOTIC_CLASS_REFERENCE' });
  }
  const unique = new Map(pool.filter(value => isKnownPublic(value) || isApprovedWebPassage(value)).map(value => [value.id, value]));
  const eligible = rankCandidates(context.localQuestion, [...unique.values()].filter(value => attributes.some(attribute => evaluateSource(value, { attribute }).eligible && compatible(value, attribute))), context).slice(0, 24);
  const semantic = await (options.semanticRetrieve || publicSemanticRetrieval.retrieve)(context, eligible, { signal });
  const semanticScores = new Map(semantic.passages.map(value => [value.id, value.hybridScore]));
  const byAttribute = new Map(attributes.map(attribute => [attribute, rankCandidates(context.localQuestion,
    eligible.filter(value => evaluateSource(value, { attribute }).eligible && compatible(value, attribute)), { ...context, questionPlan: { ...context.questionPlan, attribute } })
    .sort((a, b) => semantic.method === 'HYBRID_BM25_VECTOR' ? (semanticScores.get(b.id) || 0) - (semanticScores.get(a.id) || 0) : b.score - a.score)]));
  const coverage = attributes.map(attribute => ({ attribute, status: byAttribute.get(attribute).length ? 'AVAILABLE' : 'MISSING' }));
  const selected = new Map();
  for (const attribute of attributes) { const first = byAttribute.get(attribute)[0]; if (first) selected.set(first.id, first); }
  const remaining = rankCandidates(context.localQuestion, [...new Map([...byAttribute.values()].flat().map(value => [value.id, value])).values()], context);
  if (semantic.method === 'HYBRID_BM25_VECTOR') remaining.sort((a,b)=>(semanticScores.get(b.id)||0)-(semanticScores.get(a.id)||0));
  for (const passage of remaining) {
    if (selected.size >= 4) break;
    selected.set(passage.id, passage);
  }
  const passages = [...selected.values()].slice(0, 4), sources = passages.map(sourceCard);
  const usedWeb = passages.some(value => value.kind === 'OFFICIAL_WEB');
  const webLookup = providers.size ? { policy: webLookupPolicy(), status: webStatuses.includes('RETRIEVED') ? 'RETRIEVED' : webStatuses.includes('CACHED') ? 'CACHED' : webStatuses[0] || 'UNAVAILABLE',
    relevantSources: passages.filter(value => value.kind === 'OFFICIAL_WEB').length, usedInAnswer: false, checkedAt: new Date().toISOString(), provider: [...providers].sort().join('+') } : undefined;
  const base = { mode: usedWeb ? 'PRECISE_WEB_EVIDENCE' : 'PRECISE_LOCAL_EVIDENCE', sources, warnings: ['Academic educational sources; not India-specific regulatory verification or clinical validation.'],
    disclaimer: DISCLAIMER, sourcePolicy: { mode: sourcePolicy(), clinicalValidation: 'NOT_ESTABLISHED' }, evidenceCoverage: coverage,
    retrieval: { method: semantic.method, matchedPassages: passages.length, embeddingRequests: semantic.embeddingRequests }, agentTrace: trace, ...(webLookup ? { webLookup } : {}) };
  if (semantic.warning && process.env.RAG_CHAT_EMBEDDINGS_ENABLED === 'true') base.warnings.push(semantic.warning);
  const missing = coverage.filter(value => value.status === 'MISSING');
  if (!passages.length) return { ...base, mode: 'ABSTAIN', reply: 'I could not retrieve supporting evidence for ' + attributes.map(value => labels[value].toLowerCase()).join(', ') + '. I will not replace missing evidence with model guesses.', requestEvidenceStatus: 'MISSING' };
  // Keep unsupported requested sections outside the generative task and state
  // their absence deterministically. The model cannot fill them from memory.
  const available = coverage.filter(value => value.status === 'AVAILABLE').map(value => value.attribute);
  const generationContext = { ...context, questionPlan: { ...context.questionPlan, attribute: available[0], requestedAttributes: available, multipleAttributes: available.length > 1 } };
  const task = buildPublicAnswerTask({ context: generationContext, focus: context.focus, passages });
  let fallbackReason, generationDiagnostics, providerRequestCount = 0;
  if (synthesis.enabled() && task) {
    emit('status', { stage: 'generating', message: 'Writing a contextual answer, then checking each cited claim against the evidence…' });
    try {
      const result = await (options.synthesize || synthesis.synthesize)({ passages, context: generationContext, focus: context.focus }, { signal, fetcher: options.fetcher });
      const used = new Set(result.paragraphs.flatMap(value => value.ids));
      const cited = sources.filter(value => used.has(value.sourceId)).map((value, index) => ({ ...value, citation: 'S' + (index + 1) }));
      const reply = result.paragraphs.map(value => value.text + ' ' + value.ids.map(id => '[' + cited.find(source => source.sourceId === id).citation + ']').join(' ')).join('\n\n')
        + missing.map(value => '\n\n**' + labels[value.attribute] + ':** No supporting passage was retrieved for this part.').join('');
      if (webLookup) webLookup.usedInAnswer = cited.some(value => value.kind === 'OFFICIAL_WEB');
      const final = { ...base, sources: cited, reply, mode: 'GEMINI_RAG', model: result.model, providerRequestCount: result.providerRequests, requestEvidenceStatus: missing.length ? 'MISSING' : 'MATCHED_TEXT',
        answerQuality: { focus: attributes.length > 1 ? 'MULTI_DETAIL' : context.focus, style: context.style, words: reply.split(/\s+/).length, sourceCount: cited.length, trainedReranker: false, modelVersion: null, assessment: result.supportMethod } };
      emit('meta', final); emit('delta', { text: reply }); return final;
    } catch (error) {
      if (signal?.aborted) throw error;
      fallbackReason = error.fallbackReason || (error.providerStatus === 429 ? 'PROVIDER_RATE_LIMIT' : error.providerStatus ? 'PROVIDER_UNAVAILABLE' : error.name === 'TimeoutError' ? 'PROVIDER_TIMEOUT' : 'ANSWER_VALIDATION_FAILED');
      providerRequestCount = error.providerRequests || 0;
      generationDiagnostics = { status: error.providerStatus || null, code: error.providerCode || fallbackReason, stage: error.providerStage || 'LOCAL_VALIDATION', fields: error.providerFields || [] };
    }
  }
  const notes = [], noteSourceIds = new Set();
  for (const attribute of attributes) {
    const scopedContext = { ...context, questionPlan: { ...context.questionPlan, attribute, multipleAttributes: false } };
    const composed = composePrecise(context.localQuestion, scopedContext, byAttribute.get(attribute).filter(value => selected.has(value.id)), { web: usedWeb });
    if (composed) {
      const rewritten = composed.reply.replace(/\[S(\d+)\]/g, (_match, number) => {
        const id = composed.sources[Number(number) - 1]?.sourceId;
        noteSourceIds.add(id);
        return '[' + sources.find(value => value.sourceId === id)?.citation + ']';
      });
      notes.push((attributes.length > 1 ? '**' + labels[attribute] + ':** ' : '') + rewritten);
    } else notes.push('**' + labels[attribute] + ':** I found related material, but no directly supported answer was established for this part.');
  }
  const noteSources = sources.filter(value => noteSourceIds.has(value.sourceId));
  if (webLookup) webLookup.usedInAnswer = noteSources.some(value => value.kind === 'OFFICIAL_WEB');
  return { ...base, sources: noteSources, mode: !noteSources.length ? 'ABSTAIN' : noteSources.some(value => value.kind === 'OFFICIAL_WEB') ? 'PRECISE_WEB_EVIDENCE' : 'PRECISE_LOCAL_EVIDENCE',
    reply: notes.join('\n\n'), providerRequestCount, ...(generationDiagnostics ? { generationDiagnostics } : {}), retrieval: { ...base.retrieval, matchedPassages: noteSources.length }, requestEvidenceStatus: notes.every(value => /\[S\d+\]/.test(value)) ? 'MATCHED_TEXT' : 'MISSING', ...(fallbackReason ? { fallbackReason, warnings: [...base.warnings, 'Generated answer could not pass both provider/support stages; showing source excerpts or explicit gaps instead.'] } : {}) };
}
module.exports = { answerPublicEvidence, concepts, rankCandidates, attributesFor };
