// Equal-evidence COMPONENT baseline, not a full web/UI product comparison.
// Reuses production context/safety, trained ranking and source-note composition.
const { resolveContext } = require('../services/chatContextService');
const { routePharmacyQuestion } = require('../services/pharmacyChatPolicy');
const { composePrecise } = require('../services/preciseAnswerService');
const { rank } = require('../services/precisionRankingService');
const model = require('../data/precisionRanker.v1.json');
const { corpusHash } = require('../services/chatReferenceRegistry');
function read(task) {
  const context = resolveContext(task.question, task.history);
  const response = (action, text) => ({ action, paragraphs: [{ text, support: [] }] });
  const policy = routePharmacyQuestion({ message: task.question, resolved: { question: task.question, topics: context.topics.map(value => value.id) } });
  if (policy.action === 'RESPOND' && ['SAFETY', 'ABSTAIN', 'CLARIFY'].includes(policy.mode)) return response(policy.mode, policy.reply);
  if (context.ambiguous) return response('CLARIFY', 'Which medicine do you mean: ' + context.topics.map(value => value.label).join(' or ') + '?');
  if (context.privateReference || context.needsTopic) return response('CLARIFY', 'Please select the authorized case or clarify the medicine. Public sources cannot establish private document facts.');
  const candidates = task.passages.filter(source => source.topics.some(topic => context.topics.some(value => value.id === topic)));
  if (!candidates.length) return response('ABSTAIN', 'The supplied public evidence cannot establish the requested fact. Check the product label or ask a qualified pharmacist.');
  const focused = candidates.filter(source => source.focuses.includes(context.focus));
  const ranked = rank(context.localQuestion, context, focused.length ? focused : candidates, model).slice(0, 2);
  const composed = composePrecise(context.localQuestion, { ...context, style: task.wordLimit <= 90 ? 'CONCISE' : context.style }, ranked, { focus: context.focus, trained: model.corpusHash === corpusHash, modelVersion: model.schemaVersion });
  if (!composed) return response('ABSTAIN', 'The supplied evidence does not directly support this question.');
  // Use exact sentence text before Markdown escaping. Support is the full
  // source passage; traceability still is not a semantic entailment guarantee.
  const paragraphs = composed.reply.split('\n\n').map(text => {
    const citations = [...text.matchAll(/\[(S\d+)\]/g)].map(value => value[1]);
    const source = composed.sources.find(value => citations.includes(value.citation));
    return { text: text.replace(/\s*\[S\d+\]/g, '').replace(/\\([\\`*_{}\[\]<>#|])/g, '$1').trim(), support: source ? [{ sourceId: 'E' + (task.passages.findIndex(value => value.id === source.sourceId) + 1), quote: source.excerpt }] : [] };
  });
  return { action: 'ANSWER', paragraphs };
}
module.exports = { read };
