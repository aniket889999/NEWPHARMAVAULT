// Conservative request/evidence matching, not clinical NLP or semantic proof.
// Raw query words stay local. Only fixed enums may be used by external tools.
const ATTRIBUTES = Object.freeze(['GENERAL', 'USES', 'SIDE_EFFECTS', 'STORAGE', 'PREVENTION', 'MECHANISM', 'SPECIFIC_FACT']);
const languages = ['Marathi', 'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi', 'Urdu', 'Spanish', 'French', 'German'];
const registry = require('../data/chatTopicRegistry');
const words = text => String(text || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
const STOP = new Set(('what which how why when where who is are was were do does did can could would should will may might a an the i me my you your it its that this those them about for of to from on in at by and or with without please tell explain describe list give briefly briefly general information reference available recorded possible associated affect affects effect effects cause causes causing make makes have has having need needs mean means more less simply simple simpler shorter short briefly exactly level levels regarding related also now old previous asking asked question answer respond translate english speak cite cited citing citation citations evidence source sources supporting supported concise brief switch instead topic link links').split(/\s+/));
function concept(word) {
  return ({ drowsiness: 'sleep', drowsy: 'sleep', sleepy: 'sleep', sleepiness: 'sleep', sleeping: 'sleep', diarrhoea: 'diarrhea', vomiting: 'vomit', vitamins: 'vitamin', b: 'vitamin', deficiency: 'deficiency', uses: 'use', used: 'use' })[word] || word;
}
function requestedLanguage(message) {
  const text = String(message || '');
  for (const language of languages) if (new RegExp('(?:\\b(?:in|into|using|speak|answer|respond|explain|translate(?: to)?)\\s+' + language + '\\b|\\b' + language + '\\s+(?:me|mein|madhe|madhye|please)\\b|^\\s*' + language + '[.!?]?\\s*$)', 'i').test(text)) return language.toUpperCase();
  if (/[\u0900-\u097f\u0b80-\u0bff\u0c00-\u0d7f]/.test(text)) return 'UNSUPPORTED_SCRIPT';
  return 'ENGLISH';
}
function planQuestion(message, topics, { previous, inherit = false } = {}) {
  const text = String(message || '');
  if (topics.length && topics.every(value => value.id.startsWith('workflow-'))) return { version: 'question-plan-v1', attribute: 'GENERAL', anchors: [], language: requestedLanguage(text), exactTemperature: false, multipleAttributes: false, inherited: false };
  const explicitAttributes = [
    ['STORAGE', /\b(?:stor(?:e|age|ing)|refrigerat\w*|freez\w*|temperature)\b/i],
    ['SIDE_EFFECTS', /side effects?|adverse effects?/i],
    ['USES', /\buses\b|used for|indications?/i],
    ['MECHANISM', /how (?:does|do).*work|mechanism/i]
  ].map(([attribute, pattern]) => [attribute, text.search(pattern)]).filter(([, index]) => index >= 0).sort((a, b) => a[1] - b[1]).map(([attribute]) => attribute);
  let attribute = /stor(?:e|age|ing)|refrigerat|freez|temperature|shelf life|expiry|expiration/i.test(text) ? 'STORAGE'
    : /side effects?|adverse|risks?|nuksan|nuksaan/i.test(text) ? 'SIDE_EFFECTS'
    : /used for|uses? of|indications?|purpose of|what (?:does|is).*(?:treat|used)|what.*\bfor\b/i.test(text) ? 'USES'
    : /\b(?:prevent(?:ed|ion|ing)?|avoid(?:ed|ing)?)\b|\b(?:resistance|errors?|risks?)\b.{0,35}\breduc|\breduc\w*\b.{0,35}\b(?:resistance|errors?|risks?)\b/i.test(text) ? 'PREVENTION'
    : /how (?:does|do).*work|mechanism|how.*(?:acts?|lowers?|reduces?)/i.test(text) ? 'MECHANISM'
    : /^(?:can|does|do|is|will|could|why|what (?:about|happens))\b/i.test(text.trim()) && !/^what (?:is|are|does).*\bmean\b/i.test(text.trim()) ? 'SPECIFIC_FACT' : 'GENERAL';
  // Vocabulary such as a vitamin or a specific symptom remains a local term,
  // never a free-form web query or a model-export field.
  const excluded = new Set(topics.flatMap(topic => words(topic.label)));
  const specific = ['paracetamol', 'acetaminophen', 'metformin', 'cetirizine', 'amoxicillin', 'ibuprofen'];
  specific.forEach(value => excluded.add(value));
  const terms = [...new Set(words(text).filter(value => !STOP.has(value) && !excluded.has(value) && !/^\d+$/.test(value)).map(concept))];
  const detailed = attribute === 'SPECIFIC_FACT' || /\b(?:b12|vitamin|nausea|vomit\w*|diarrh\w*|drows\w*|sleep\w*|headache|appetite|taste)\b/i.test(text);
  const anchors = detailed ? terms.filter(value => !['side', 'adverse', 'risk', 'risks'].includes(value)).slice(0, 6) : [];
  if (/\bb\s*12\b/i.test(text) && !anchors.includes('b12')) anchors.push('b12');
  if (anchors.length && attribute === 'GENERAL') attribute = 'SPECIFIC_FACT';
  if (inherit && previous && !anchors.length && !/stor(?:e|age|ing)|refrigerat|freez|temperature|side effects?|adverse|risks?|prevent|used for|uses? of|mechanism|how.*work/i.test(text)) return { ...previous, language: requestedLanguage(text), inherited: true };
  return { version: 'question-plan-v1', attribute, anchors, language: requestedLanguage(text), exactTemperature: /temperature|degrees?|celsius|fahrenheit|\bc\b|\bf\b/i.test(text) && attribute === 'STORAGE', multipleAttributes: explicitAttributes.length > 1, requestedAttributes: explicitAttributes, inherited: false };
}
function sentences(text) { return (String(text || '').match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || []).map(value => value.trim()).filter(value => /[.!?]$/.test(value)); }
function sentenceSupports(text, plan) {
  if (!plan) return true;
  const tokens = new Set(words(text).map(concept));
  if (plan.anchors.length && !plan.anchors.every(value => tokens.has(value))) return false;
  if (plan.attribute === 'SPECIFIC_FACT') return plan.anchors.length > 0;
  if (plan.attribute === 'STORAGE') {
    if (/does not (?:establish|provide|cover)|cannot (?:establish|determine)|not (?:available|provided)|(?:no|insufficient)(?: product(?:-specific)?)? (?:storage|temperature) (?:information|guidance|instructions)/i.test(text)) return false;
    if (plan.exactTemperature) return /(?:\b\d+(?:\.\d+)?\s*(?:°\s*)?(?:celsius|fahrenheit|degrees?|[cf]\b)|room temperature)/i.test(text) && /stor|keep|temperat/i.test(text);
    return /\b(?:stor(?:e|age|ing)|refrigerat\w*|freez\w*|keep(?:ing)?|safety cap)\b/i.test(text);
  }
  if (plan.attribute === 'USES') return /\b(?:used|use|relieve|treat|reduce|helps?)\b/i.test(text);
  if (plan.attribute === 'MECHANISM') return /\b(?:works?|acts?|helps?|lowers?|reduces?)\b/i.test(text);
  if (plan.attribute === 'PREVENTION') return /prevent|unnecessary|incorrect|keep|maintain|check|ask|closing|reduce|avoid|appropriate/i.test(text);
  if (plan.attribute === 'SIDE_EFFECTS') return /side effects?|adverse|nausea|vomit|diarrh|sleep|drows|headache|allerg|deficien|appetite|taste/i.test(text);
  return true;
}
function supportsRequest(passage, context) {
  const plan = context.questionPlan;
  // Existing project definitions keep the separate source/freshness contracts.
  if (!plan || context.topics.every(value => value.id.startsWith('workflow-'))) return true;
  if (passage.kind === 'OFFICIAL_WEB') {
    // The official site can return broad health topics. A keyword in the query
    // does not establish that a result describes the selected medicine/topic.
    const padded = ' ' + words(passage.title + ' ' + passage.excerpt).join(' ') + ' ';
    const matchingTopic = context.topics.some(topic => {
      const entry = registry.find(value => value.id === topic.id);
      return [topic.label, ...(entry?.aliases || [])].some(alias => padded.includes(' ' + words(alias).join(' ') + ' '));
    });
    if (!matchingTopic) return false;
  }
  return sentences(passage.excerpt).some(value => sentenceSupports(value, plan));
}
function projection(plan, evidenceStatus = 'NOT_ASSESSED') { return { attribute: plan.attribute, language: plan.language, evidenceStatus, method: 'CONSERVATIVE_TEXT_MATCH_NOT_SEMANTIC_PROOF' }; }
module.exports = { ATTRIBUTES, planQuestion, requestedLanguage, sentences, sentenceSupports, supportsRequest, projection };
