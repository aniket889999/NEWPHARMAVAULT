'use strict';
// Export an evidence-bounded public task, never the original question/history.
// Unknown detail words fail closed rather than silently changing the question.
const registry = require('../data/chatTopicRegistry');
const ATTRIBUTES = new Set(['GENERAL', 'USES', 'SIDE_EFFECTS', 'STORAGE', 'PREVENTION', 'MECHANISM', 'SPECIFIC_FACT']);
const FOCUSES = new Set(['OVERVIEW', 'EXPLAIN', 'SIDE_EFFECTS', 'DEFINITION', 'PREVENTION', 'IDENTITY']);
const PUBLIC_MEDICAL_TERMS = 'groggy queasy somnolence nausea stomach diarrhea constipation gout uric acid blood sugar pressure cholesterol kidney liver heart pain fever swelling infection bacteria virus vitamin b12';
const WORDS = new Set(('treat treats treatment cause causes affect affects work works not never no use used effects cold colds viral virus vitamin b12 deficiency sleep ' + PUBLIC_MEDICAL_TERMS).split(' '));
const normalize = text => String(text || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  .map(value => ({ viral: 'virus', viruses: 'virus', diarrhoea: 'diarrhea', drowsiness: 'sleep', drowsy: 'sleep', sleepy: 'sleep', sleepiness: 'sleep', sleeping: 'sleep', vomiting: 'vomit', vitamins: 'vitamin' })[value] || value);
const instructions = Object.freeze({ GENERAL: 'Explain the general educational information', USES: 'Explain the supported uses', SIDE_EFFECTS: 'Explain the supported possible side effects', STORAGE: 'Explain only the supported storage information', PREVENTION: 'Explain the supported prevention information', MECHANISM: 'Explain how it works according to the evidence', SPECIFIC_FACT: 'Answer the specific relationship between the topic and the listed public concepts' });
function buildPublicAnswerTask({ context, focus, passages, purpose = 'ANSWER' }) {
  if (!context || context.privateReference || context.personalContext || context.ambiguous || context.topics?.length !== 1) return null;
  const topic = registry.find(value => value.id === context.topics[0].id);
  const plan = context.questionPlan || { attribute: 'GENERAL', anchors: [], language: 'ENGLISH' };
  const requested = plan.multipleAttributes ? plan.requestedAttributes : [plan.attribute];
  if (!topic || !ATTRIBUTES.has(plan.attribute) || (plan.language && plan.language !== 'ENGLISH') || !Array.isArray(plan.anchors) || plan.anchors.length > 7 || !Array.isArray(requested) || !requested.length || requested.length > 4 || requested.some(value => !ATTRIBUTES.has(value))) return null;
  if (!Array.isArray(passages) || !passages.length || passages.length > (purpose === 'RETRIEVAL' ? 24 : 4)) return null;
  const vocabulary = new Set(passages.flatMap(value => normalize(value.excerpt)));
  const concepts = [];
  for (const anchor of plan.anchors) {
    // No raw labels, private IDs, numbers, URLs, arbitrary instructions or
    // unrecognized tokens can be smuggled into an otherwise public task.
    if (typeof anchor !== 'string' || !/^(?:[a-z]{2,24}|b12)$/.test(anchor) || (!vocabulary.has(anchor) && !WORDS.has(anchor))) return null;
    if (!concepts.includes(anchor)) concepts.push(anchor);
  }
  const attributes = [...new Set(requested)];
  return { version: 'public-answer-task-v2', topic: { id: topic.id, label: topic.label }, attribute: plan.attribute, requestedAttributes: attributes,
    question: attributes.map(value => instructions[value]).join('; ') + ': ' + topic.label + (concepts.length ? '. Public concepts: ' + concepts.join(', ') : '') + '.',
    concepts, exactTemperature: plan.exactTemperature === true, focus: FOCUSES.has(focus) ? focus : 'OVERVIEW', style: context.style === 'CONCISE' ? 'CONCISE' : 'STANDARD' };
}
module.exports = { buildPublicAnswerTask, PUBLIC_MEDICAL_TERMS };
