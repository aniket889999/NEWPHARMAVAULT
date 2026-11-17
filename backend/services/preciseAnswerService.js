const { references, corpusHash } = require('./chatReferenceRegistry');
const { rankPassages } = require('./chatRagService');
const { rank, focusOf } = require('./precisionRankingService');
const model = require('../data/precisionRanker.v1.json');
const { supportsRequest, sentenceSupports } = require('./chatQuestionService');
const escape = value => value.replace(/[\\`*_{}\[\]<>#|]/g, '\\$&');
const focusPatterns = {
  SIDE_EFFECTS: /side effects?|adverse|nausea|vomit|diarrh|sleep|drows|headache|allerg|deficien/i,
  DEFINITION: /\b(?:is|are|means|refers|includes|happens|compares|checks)\b/i,
  PREVENTION: /prevent|unnecessary|incorrect|keep|maintain|check|ask|closing|reduce|avoid|appropriate/i,
  IDENTITY: /ingredient|strength|form|route|brand|generic|identity/i,
  EXPLAIN: /because|means|helps|can|checks|before|after|require|depends|compares/i,
  OVERVIEW: /./
};
function retrievePrecise(query, context, { preferredSourceIds = [] } = {}) {
  const topicIds = context.topics.map(value => value.id);
  const focus = focusOf(query, context);
  const candidates = references.filter(value => value.topics.some(topic => topicIds.includes(topic)) && supportsRequest(value, context));
  if (!candidates.length) return { passages: [], focus, trained: false };
  const compatible = candidates.filter(value => value.focuses.includes(focus));
  const pool = compatible.length ? compatible : candidates;
  const trained = model.corpusHash === corpusHash && model.weights.length === model.features.length;
  let ranked = trained ? rank(query, { ...context, focus }, pool, model) : rankPassages(query, pool, 4);
  // Independently approved org preferences prioritize already topic/focus-
  // compatible public references. They cannot inject new content or facts.
  if (preferredSourceIds.length) ranked = [...ranked].sort((a, b) => Number(preferredSourceIds.includes(b.id)) - Number(preferredSourceIds.includes(a.id)) || b.score - a.score);
  return { passages: ranked.slice(0, 2), focus, trained, modelVersion: trained ? model.schemaVersion : null, corpusHash };
}
function selectStatements(passage, query, focus, limit, questionPlan) {
  const focusedRequest = questionPlan && (questionPlan.attribute !== 'GENERAL' || questionPlan.anchors.length);
  const sentences = (passage.excerpt.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || []).map(value => value.trim()).filter(value => /[.!?]$/.test(value) && (focusedRequest || !/^(?:there|but|however)\b/i.test(value)));
  const relevant = sentences.filter(value => focusedRequest ? sentenceSupports(value, questionPlan) : (focusPatterns[focus] || focusPatterns.OVERVIEW).test(value));
  // Definition questions should not begin with a secondary caveat when a direct
  // definition is present later in a retrieved official passage.
  const scored = relevant.map((text, index) => ({ text, index, definition: focus === 'DEFINITION' && /\b(?:means|happens when|is a |is an |refers to)\b/i.test(text) ? 1 : 0 }));
  scored.sort((a, b) => b.definition - a.definition || a.index - b.index);
  const chosen = []; let count = 0;
  for (const value of scored) { const words = value.text.split(/\s+/).length; if (count + words <= limit) { chosen.push(value.text); count += words; } if (chosen.length >= 2) break; }
  if (!chosen.length) return [];
  const specific = questionPlan?.anchors.length;
  const caveat = specific
    ? sentences.find(value => /not everyone|not a complete|not complete|not a diagnosis/i.test(value) && !chosen.includes(value))
    : sentences.find(value => /rare serious|urgent|severe|not a complete|not complete/i.test(value) && !chosen.includes(value)) || sentences.find(value => /not (?:a |an |for |prove|establish|mean)|cannot|does not|not suitable|professional|pharmacist|clinician/i.test(value) && !chosen.includes(value));
  if (caveat && count + caveat.split(/\s+/).length <= limit + 12) chosen.push(caveat);
  return chosen;
}
function composePrecise(query, context, passages, { web = false, focus = focusOf(query, context), trained = false, modelVersion = null } = {}) {
  const limit = context.style === 'CONCISE' ? 70 : 125;
  const sources = [], claims = [], seen = new Set(); let words = 0;
  for (const passage of passages) {
    if (!supportsRequest(passage, context)) continue;
    const plan = context.topics.every(value => value.id.startsWith('workflow-')) ? undefined : context.questionPlan;
    const statements = selectStatements(passage, query, focus, limit - words, plan);
    const unique = statements.filter(value => { const key = value.toLowerCase().replace(/\s+/g, ' '); if (seen.has(key)) return false; seen.add(key); return true; });
    if (!unique.length) continue;
    const citation = 'S' + (sources.length + 1);
    sources.push({ citation, sourceId: passage.id, title: passage.title, excerpt: passage.excerpt, kind: passage.kind, version: passage.version, sourceUrl: passage.sourceUrl, score: passage.score || 0 });
    const prefix = plan && (plan.anchors.length || /^(?:it|this|they)\b/i.test(unique[0])) && context.topics.length === 1 && !unique[0].toLowerCase().includes(context.topics[0].label.toLowerCase()) ? 'The ' + context.topics[0].label + ' reference states: ' : '';
    const text = prefix + unique.join(' '); words += text.split(/\s+/).length; claims.push(escape(text) + ' [' + citation + ']');
    if (words >= limit - 15 || context.style === 'CONCISE') break;
  }
  if (!claims.length) return null;
  return { reply: claims.join('\n\n'), mode: web ? 'PRECISE_WEB_EVIDENCE' : 'PRECISE_LOCAL_EVIDENCE', sources,
    retrieval: { method: web ? 'APPROVED_WEB_BM25' : trained ? 'CONTEXT_RERANKED_BM25' : 'BM25', matchedPassages: sources.length },
    warnings: passages.some(value => value.kind === 'HEALTH_REFERENCE' || value.kind === 'OFFICIAL_WEB') ? ['General educational reference; not individual treatment advice or India-specific regulatory verification. Source checks are not clinical validation.'] : [],
    answerQuality: { focus, style: context.style, words, sourceCount: sources.length, trainedReranker: trained, modelVersion, assessment: 'EXTRACTIVE_SOURCE_SUPPORT_NOT_CLINICAL_ACCURACY', requestMatch: 'CONSERVATIVE_TEXT_MATCH_NOT_SEMANTIC_PROOF' } };
}
module.exports = { retrievePrecise, composePrecise, selectStatements, focusPatterns };
