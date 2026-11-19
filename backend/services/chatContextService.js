const registry = require('../data/chatTopicRegistry');
const { focusOf } = require('./precisionRankingService');
const { planQuestion, requestedLanguage, questionContent } = require('./chatQuestionService');
const { findBrandMentions } = require('./chatBrandVocabularyService');
const VERSION = 'chat-context-v1';
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
function findTopics(text) {
  const padded = ' ' + normalize(text) + ' ';
  const spans = registry.flatMap(topic => topic.aliases.flatMap(alias => {
    const target = ' ' + alias + ' ', result = []; let index = padded.indexOf(target);
    while (index !== -1) { result.push({ topic, start: index, end: index + target.length }); index = padded.indexOf(target, index + 1); }
    return result;
  }));
  const matches = [...new Map(spans.filter(value => !spans.some(other => other.start <= value.start && other.end >= value.end && other.end - other.start > value.end - value.start)).map(value => [value.topic.id, value.topic])).values()];
  const medicines = matches.filter(topic => !topic.concept);
  // The class word in "amoxicillin antibiotic" is not a second medicine.
  return medicines.length ? medicines : matches.filter(topic => topic.id !== 'antibiotics' || !matches.some(value => value.id === 'antibiotic-resistance'));
}
function selectTopics(text) {
  const all = findTopics(text);
  // Resolve explicit same-turn switches, but never use a negated switch or a
  // two-medicine suffix to silently choose one. Safety still sees the full query.
  const switches = [...String(text).matchAll(/\b(?:now|instead|switch(?: the)? topic to|switch to|change(?: the)? topic to)\b\s*:?\s+/gi)];
  for (const match of switches.reverse()) {
    if (/(?:do not|don't|never|not)\s*$/i.test(text.slice(Math.max(0, match.index - 16), match.index))) continue;
    const suffix = text.slice(match.index + match[0].length), selected = findTopics(suffix);
    if (selected.length === 1) return { topics: selected, text: suffix, switched: all.length > 1 };
  }
  return { topics: all, text, switched: false };
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
function resolveContext(message, history = [], { memory } = {}) {
  const users = history.filter(item => item?.role === 'user' && typeof item.text === 'string').slice(-10);
  const seed = require('./chatConversationMemoryService').sanitizeState(memory);
  let previousTopics = (seed?.topicIds || []).map(id => registry.find(value => value.id === id)), previousIntent = seed?.intent || null, previousFocus = seed?.focus || null,
    previousPersonal = seed?.personalContext || false, previousPrivate = seed?.privateReference || false, previousPlan = seed?.questionPlan || null;
  for (const entry of users) {
    const selection = selectTopics(entry.text), explicit = selection.topics;
    // An unconfirmed product must not lend the previous generic identity to
    // later pronoun questions. Safety/personal context still sees raw history.
    if (findBrandMentions(entry.text).length) {
      previousTopics = []; previousIntent = null; previousFocus = null; previousPlan = null;
      previousPersonal = personal(entry.text); previousPrivate = privateQuestion(entry.text);
      continue;
    }
    const sameTopic = !explicit.length || (explicit.length === 1 && previousTopics.length === 1 && explicit[0].id === previousTopics[0].id);
    if (explicit.length) { const same = explicit.length === 1 && previousTopics.length === 1 && explicit[0].id === previousTopics[0].id; previousTopics = explicit; previousPersonal = personal(entry.text) || (same && previousPersonal); previousPrivate = privateQuestion(entry.text); }
    else { previousPersonal ||= personal(entry.text); if (privateQuestion(entry.text)) previousPrivate = true; }
    previousIntent = intentOf(selection.text, sameTopic ? previousIntent : null);
    if (!sameTopic || !/simpler|simply|shorter|brief|again/i.test(selection.text) || !previousFocus) previousFocus = focusOf(selection.text, { intent: previousIntent });
    previousPlan = planQuestion(selection.text, previousTopics, { previous: previousPlan, inherit: sameTopic && /\b(it|its|that|those|them|simpler|simply|shorter|more|again|why|what about|aur|iske|iska|uske)\b/i.test(selection.text) });
  }
  const selected = selectTopics(message), direct = selected.topics;
  const followup = !direct.length && (/\b(it|its|that|those|them|this medicine|side effects?|risks?|simpler|simple|shorter|brief|concise|continue|more|again|why|what about|how about|aur|iske|iska|uske|explain further)\b|^(?:and|also|yes)\b/i.test(message) || requestedLanguage(message) !== 'ENGLISH' || /\bin english\b|^\s*english(?: please)?[.!?]?\s*$/i.test(message));
  const topics = direct.length ? direct : followup ? previousTopics : [];
  const transfer = direct.length === 1 && previousTopics.length === 1 && /\b(?:same question|what about|how about)\b/i.test(selected.text);
  let intent = intentOf(selected.text, followup || transfer ? previousIntent : null);
  if (transfer && previousIntent && !/side effects?|adverse|uses|used for|storage|mechanism/i.test(selected.text)) intent = previousIntent;
  if (topics.length && topics.every(value => value.id.startsWith('workflow-')) && intent === 'SIDE_EFFECTS') intent = 'OVERVIEW';
  const concise = /simpler|simple|simply|shorter|brief|concise|easy|asaan/i.test(selected.text) || (seed?.style === 'CONCISE' && !/detail|longer|thorough/i.test(selected.text));
  const focus = followup && previousFocus && !/side effects?|adverse|risks?|prevent|avoid|reduce|meaning|define|definition|generic|ingredient|strength|dosage form|identity/i.test(selected.text) ? previousFocus : focusOf(selected.text, { intent });
  const questionPlan = planQuestion(selected.text, topics, { previous: previousPlan, inherit: (followup || transfer) && Boolean(topics.length) });
  return { version: VERSION, topics: topics.map(value => ({ id: value.id, label: value.label })), focus, questionPlan, topicSwitchResolved: selected.switched,
    intent, style: concise ? 'CONCISE' : 'STANDARD', followupResolved: Boolean((followup || transfer) && topics.length),
    ambiguous: topics.length > 1, needsTopic: followup && !topics.length, unresolvedDetail: Boolean(seed?.unresolvedDetail && (followup || transfer) && (questionPlan.inherited || !questionPlan.anchors.length)),
    personalContext: personal(message) || ((followup || (direct.length === 1 && previousTopics.length === 1 && direct[0].id === previousTopics[0].id)) && previousPersonal),
    privateReference: privateQuestion(message) || (followup && previousPrivate),
    // History supplies topic and preference only, never evidence or instructions.
    localQuestion: followup && topics.length === 1 ? topics[0].label + ': ' + (intent === 'SIDE_EFFECTS' ? 'side effects. ' : '') + questionContent(message) : questionContent(selected.text) };
}
module.exports = { resolveContext, findTopics, selectTopics, VERSION };
