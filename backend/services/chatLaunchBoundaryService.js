'use strict';

// Bounded intent checks, not a complete prompt-injection detector or clinical
// classifier. Authorization remains enforced by the protected database APIs.
const registry = require('../data/chatTopicRegistry');
const { questionContent } = require('./chatQuestionService');
const { findBrandMentions } = require('./chatBrandVocabularyService');
const VERSION = 'chat-launch-boundary-v2';
const normalize = value => String(value || '').normalize('NFKC')
  .replace(/[\u200b-\u200d\ufeff]/g, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const decision = (reasonCode, reply) => ({
  mode: 'ABSTAIN', intent: 'ACCESS_BOUNDARY', reasonCode, policyVersion: VERSION, reply
});

function accessBoundary(message) {
  const text = normalize(message);
  const request = /\b(?:show|reveal|print|dump|export|return|give|list|extract|send|retrieve|display|access|open|download|read|view|get|tell|provide)\b|\bwhat (?:is|are) (?:your|the server|the backend)\b/i;
  if (request.test(text) && /\b(?:other|another|all|every|different)\s+(?:patients?|users?|customers?|tenants?|organizations?|companies|company)(?:'s|s')?\b/i.test(text)
      && /\b(?:prescriptions?|documents?|records?|invoices?|claims?|bills?|files?|data|histories|history|chats?)\b/i.test(text)) {
    return decision('PRIVATE_DATA_ACCESS_DENIED', 'I cannot disclose another person\'s or organization\'s private records. Select a verification case you are authorized to access; access is checked by the server. A chat request cannot grant extra permissions.');
  }
  if (request.test(text) && /\b(?:api[ -]?keys?|jwt[ -]?(?:secret|key)s?|passwords?|access[ -]?tokens?|refresh[ -]?tokens?|session[ -]?(?:cookies?|tokens?)|private[ -]?keys?|signing[ -]?(?:secrets?|keys?)|environment variables?)\b|(?:^|[\s/])\.env(?:\b|[./_-])/i.test(text)) {
    return decision('CREDENTIAL_REQUEST_DENIED', 'I cannot reveal credentials, secret keys, session tokens or private configuration. Use the authorized account or administrator settings for access; do not paste secrets into chat.');
  }
  if (/\b(?:ignore|bypass|disable|override|skip|turn off)\b.{0,70}\b(?:auth(?:entication|orization)?|tenant(?: isolation| checks?)?|access controls?|permissions?|safety (?:rules?|checks?)|safeguards?|(?:all |previous |prior |system |your )?(?:instructions?|rules?)|system prompt|security (?:rules?|checks?))\b/i.test(text)
      || /\b(?:act|pretend) (?:as|to be) (?:an? )?(?:admin(?:istrator)?|superuser)\b|\bassume (?:the )?(?:admin(?:istrator)?|superuser) role\b/i.test(text)) {
    return decision('SECURITY_BYPASS_DENIED', 'I cannot bypass authentication, tenant isolation, safety checks or account permissions. I can explain the supported workflow, but role changes and privileged actions require the authorized application controls.');
  }
  return null;
}

// Recognize explicit question frames only. Never infer a medicine identity from
// suffixes, a near spelling, or a model guess. The captured text stays local and
// is never echoed, persisted, or passed to a web/model tool.
function medicineSubject(message) {
  const text = normalize(questionContent(message)).replace(/\bwhat's\b/gi, 'what is').replace(/side-effects?/gi, 'side effects').replace(/[?.!]+$/, '');
  const frames = [
    /\bwhat (?:is|are) (.+?) (?:used|indicated) for\b/i,
    /\b(?:uses?|side effects?|adverse effects?|mechanism|generic name) of (.+)$/i,
    /\bwhat (?:is|are) (.+?) (?:(?:possible|potential|common|known|typical|usual)\s+)?(?:side effects?|uses)\b/i,
    /\bwhat does the (?:public )?reference (?:catalogue|guide) say about (.+)$/i,
    /\b(?:reference overview|educational reference entry) for (.+)$/i,
    /\bwhat reference information is recorded for (.+)$/i,
    /\bhow (?:does|do) (.+?) work\b/i,
    /\bhow (?:should|can|do) (?:i|we) store (.+)$/i
  ];
  const subject = frames.map(pattern => pattern.exec(text)?.[1]).find(Boolean);
  return subject && subject.length <= 100 ? subject.replace(/^(?:the |medicine |drug )+/i, '')
    .replace(/\s+(?:in|for)\s+(?:adults?|children|older adults?|elderly people)(?:\s+please)?$/i, '').replace(/\s+please$/i, '').replace(/'s$/i, '').trim() : null;
}

function coverageBoundary(message, context) {
  if (context.topics.some(value => value.id.startsWith('workflow-'))) return null;
  if (context.topics.some(value => value.id === 'iron-supplements') && !/\bferrous sulfate\b/i.test(message) && !context.followupResolved) return { mode: 'CLARIFY', intent: 'MEDICINE_IDENTITY', reasonCode: 'IRON_SALT_CONFIRMATION_REQUIRED', policyVersion: VERSION,
    reply: 'Which iron compound is written on the label? This medicine reference covers ferrous sulfate specifically. Please confirm the ingredient rather than assuming every iron product is the same.' };
  if (context.topics.some(value => value.id === 'insulin') && context.questionPlan?.attribute === 'STORAGE') return { mode: 'CLARIFY', intent: 'MEDICINE_IDENTITY', reasonCode: 'INSULIN_PRODUCT_CONFIRMATION_REQUIRED', policyVersion: VERSION,
    reply: 'Please identify the exact insulin product and form, and whether it has been opened. I cannot establish product-specific storage instructions from the generic word insulin alone. Check the exact product leaflet with a pharmacist.' };
  if (findBrandMentions(message).length) return { mode: 'CLARIFY', intent: 'MEDICINE_IDENTITY', reasonCode: 'BRAND_LABEL_CONFIRMATION_REQUIRED', policyVersion: VERSION,
    reply: 'I recognise a brand name, but brands can have different formulations or combination variants. Please type all active ingredients, strength and dosage form from the label. I can then retrieve supported generic references without assuming that the brand contains only one medicine.' };
  const subject = medicineSubject(message);
  if (!subject || /^(?:it|its|that|this|they|them|this medicine|the medicine)$/i.test(subject)) return null;
  if (/^(?:pharmavault|trust ?rag|graph ?rag|rag|ocr|fhir|nhcx)\b/i.test(subject)) return null;
  if (/^(?:medicines?|medications?|drugs?)$/i.test(subject) && context.topics.some(value => registry.find(topic => topic.id === value.id)?.concept)) return null;
  const names = subject.split(/\s+(?:and|versus|vs\.?)\s+|\s*,\s*/i);
  const known = value => {
    const padded = ' ' + value.toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    return registry.some(topic => topic.aliases.some(alias => padded === ' ' + alias + ' '));
  };
  // Product/identity questions containing strengths or forms are handled by the
  // existing conservative identity route, not treated as an exact name match.
  if (/\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml)\b|\b(?:tablet|capsule|syrup|suspension)\b/i.test(subject)) return null;
  if (names.every(known)) return null;
  const suggestions = names.length === 1 ? suggestMedicineNames(subject) : [];
  if (suggestions.length) return { mode: 'CLARIFY', intent: 'MEDICINE_EDUCATION', reasonCode: 'MEDICINE_NAME_CONFIRMATION_REQUIRED', policyVersion: VERSION,
    reply: 'The medicine name is not an exact supported match. A possible spelling is ' + suggestions.join(' or ') + '. Check the label and retype the confirmed generic name in a new question. I have not retrieved evidence for, or assumed, the suggested medicine.' };
  return { mode: 'ABSTAIN', intent: 'MEDICINE_EDUCATION', reasonCode: 'UNSUPPORTED_MEDICINE_REFERENCE', policyVersion: VERSION,
    reply: 'I cannot match every medicine named in this question to the supported reference vocabulary. Please check the exact generic name on the label. I will not guess a similar medicine or search the web using an unapproved name. For information about an unsupported medicine, consult its official leaflet or a qualified pharmacist.' };
}
function suggestMedicineNames(subject) {
  if (!/^[a-z]{6,30}$/i.test(subject)) return [];
  const distance = (left, right) => {
    let row = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i++) { const next = [i]; for (let j = 1; j <= right.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + Number(left[i - 1] !== right[j - 1])); row = next; }
    return row[right.length];
  };
  return registry.filter(topic => !topic.concept).map(topic => ({ label: topic.label, distance: distance(subject.toLowerCase(), topic.label.toLowerCase()) }))
    .filter(value => value.distance > 0 && value.distance <= (subject.length >= 10 ? 2 : 1)).sort((a, b) => a.distance - b.distance || a.label.localeCompare(b.label)).slice(0, 2).map(value => value.label);
}

module.exports = { accessBoundary, coverageBoundary, medicineSubject, suggestMedicineNames, VERSION };
