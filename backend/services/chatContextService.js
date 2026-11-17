const registry = require('../data/chatTopicRegistry');
const { focusOf } = require('./precisionRankingService');
const VERSION = 'chat-context-v1';
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
function findTopics(text) {
  const padded = ' ' + normalize(text) + ' ';
  const matches = registry.filter(topic => topic.aliases.some(alias => padded.includes(' ' + alias + ' ')));
  const medicines = matches.filter(topic => !topic.concept);
  // The class word in "amoxicillin antibiotic" is not a second medicine.
  return medicines.length ? medicines : matches.filter(topic => topic.id !== 'antibiotics' || !matches.some(value => value.id === 'antibiotic-resistance'));
}
const personal = text => /\b(can i take|should i (?:take|stop|switch)|safe for me|my (?:baby|child)|pregnan\w*|breastfeed\w*|interactions?|how (?:much|many).*(?:take|give)|my dose)\b/i.test(text);
const privateQuestion = text => /\b(?:my|our|this)\s+(?:verification\s+)?(?:case|claim|prescription|invoice|bill|rx)\b/i.test(text);
function intentOf(message, previous) {
  if (/side effects?|adverse|risks?|nuksan|nuksaan/i.test(message)) return 'SIDE_EFFECTS';
  if (/compare|difference|versus|\bvs\b/i.test(message)) return 'COMPARE';
  if (/simpler|simply|simple|shorter|brief|easy|asaan/i.test(message)) return previous || 'OVERVIEW';
  if (/how|why|kaise|kyu/i.test(message)) return 'EXPLAIN';
  return 'OVERVIEW';
}
function resolveContext(message, history = []) {
  const users = history.filter(item => item?.role === 'user' && typeof item.text === 'string').slice(-10);
  let previousTopics = [], previousIntent = null, previousFocus = null, previousPersonal = false, previousPrivate = false;
  for (const entry of users) {
    const explicit = findTopics(entry.text);
    if (explicit.length) { const same = explicit.length === 1 && previousTopics.length === 1 && explicit[0].id === previousTopics[0].id; previousTopics = explicit; previousPersonal = personal(entry.text) || (same && previousPersonal); previousPrivate = privateQuestion(entry.text); }
    else { previousPersonal ||= personal(entry.text); if (privateQuestion(entry.text)) previousPrivate = true; }
    previousIntent = intentOf(entry.text, previousIntent);
    if (!/simpler|simply|shorter|brief|again/i.test(entry.text) || !previousFocus) previousFocus = focusOf(entry.text, { intent: previousIntent });
  }
  const direct = findTopics(message);
  const followup = !direct.length && /\b(it|its|that|those|them|this medicine|side effects?|risks?|simpler|simple|shorter|more|again|why|what about|aur|iske|iska|uske|explain further)\b/i.test(message);
  const topics = direct.length ? direct : followup ? previousTopics : [];
  const intent = intentOf(message, followup ? previousIntent : null);
  const concise = /simpler|simple|simply|shorter|brief|easy|asaan/i.test(message);
  const focus = followup && previousFocus && !/side effects?|adverse|risks?|prevent|avoid|reduce|meaning|define|definition|generic|ingredient|strength|dosage form|identity/i.test(message) ? previousFocus : focusOf(message, { intent });
  return { version: VERSION, topics: topics.map(value => ({ id: value.id, label: value.label })), focus,
    intent, style: concise ? 'CONCISE' : 'STANDARD', followupResolved: Boolean(followup && topics.length),
    ambiguous: topics.length > 1, needsTopic: followup && !topics.length,
    personalContext: personal(message) || ((followup || (direct.length === 1 && previousTopics.length === 1 && direct[0].id === previousTopics[0].id)) && previousPersonal),
    privateReference: privateQuestion(message) || (followup && previousPrivate),
    // History supplies topic and preference only, never evidence or instructions.
    localQuestion: followup && topics.length === 1 ? topics[0].label + ': ' + (intent === 'SIDE_EFFECTS' ? 'side effects. ' : '') + message : message };
}
module.exports = { resolveContext, findTopics, VERSION };
