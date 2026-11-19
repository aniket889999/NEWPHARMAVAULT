const rag = require('./chatRagService');
const FEATURES = ['lexical', 'topicMatch', 'focusMatch', 'titleOverlap', 'kindMatch', 'lengthPenalty'];
function focusOf(message, context = {}) {
  // Asking what a reference says is not necessarily a definition request.
  message=String(message).replace(/^\s*what does (?:the )?(?:public )?reference(?: (?:catalogue|guide))? say about\s+/i,'Explain ');
  if (context.intent === 'SIDE_EFFECTS') return 'SIDE_EFFECTS';
  if (/prevent|avoid|reduce|bach|rok/i.test(message)) return 'PREVENTION';
  if (/\bwhat (?:is|are|does)\b|meaning|define|definition|matlab/i.test(message)) return 'DEFINITION';
  if (/generic|brand|ingredient|strength|dosage form|identity/i.test(message)) return 'IDENTITY';
  return context.intent === 'EXPLAIN' ? 'EXPLAIN' : 'OVERVIEW';
}
function features(query, context, passage, lexicalScore = 0) {
  const queryTokens = new Set(rag.tokens(query)), title = new Set(rag.tokens(passage.title));
  const overlap = [...queryTokens].filter(value => title.has(value)).length / Math.max(1, queryTokens.size);
  const topics = context.topics?.map(value => typeof value === 'string' ? value : value.id) || [];
  return [lexicalScore / (5 + lexicalScore), topics.some(value => passage.topics?.includes(value)) ? 1 : 0,
    passage.focuses?.includes(context.focus || focusOf(query, context)) ? 1 : 0, overlap,
    topics.some(value => value.startsWith('workflow-')) ? Number(passage.kind === 'PROJECT_GUIDE') : Number(passage.kind === 'HEALTH_REFERENCE' || passage.kind === 'OFFICIAL_WEB'),
    -Math.min(1, passage.excerpt.split(/\s+/).length / 160)];
}
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
function rank(query, context, candidates, model) {
  const lexical = new Map(rag.rankPassages(query, candidates, candidates.length).map(value => [value.id, value.score]));
  return candidates.map(passage => { const vector = features(query, context, passage, lexical.get(passage.id) || 0); return { ...passage, score: dot(vector, model.weights), rankingFeatures: vector }; })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
function train(pairs, { epochs = 400, rate = 0.08, regularization = 0.002 } = {}) {
  if (!pairs.length || pairs.some(pair => pair.positive.length !== FEATURES.length || pair.negative.length !== FEATURES.length)) throw new Error('Valid ranking pairs are required.');
  const weights = FEATURES.map(() => 0), losses = [];
  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradient = FEATURES.map(() => 0); let loss = 0;
    for (const pair of pairs) { const difference = pair.positive.map((value, index) => value - pair.negative[index]); const margin = dot(weights, difference); const error = 1 / (1 + Math.exp(Math.max(-40, Math.min(40, margin)))); loss += Math.log1p(Math.exp(Math.max(-40, Math.min(40, -margin)))); for (let index = 0; index < weights.length; index++) gradient[index] -= error * difference[index]; }
    for (let index = 0; index < weights.length; index++) weights[index] -= rate * (gradient[index] / pairs.length + regularization * weights[index]);
    if (epoch === 0 || epoch === epochs - 1) losses.push(loss / pairs.length);
  }
  return { weights: weights.map(value => Number(value.toFixed(10))), lossBefore: losses[0], lossAfter: losses.at(-1), pairCount: pairs.length, epochs, features: FEATURES };
}
module.exports = { FEATURES, focusOf, features, rank, train };
