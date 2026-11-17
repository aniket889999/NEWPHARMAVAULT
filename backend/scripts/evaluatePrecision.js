const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { references, corpusHash } = require('../services/chatReferenceRegistry');
const { resolveContext } = require('../services/chatContextService');
const { retrievePrecise } = require('../services/preciseAnswerService');
const { rankPassages } = require('../services/chatRagService');
const { focusOf } = require('../services/precisionRankingService');
const tasks = require('../data/precisionTrainingTasks');
const challenge = require('../../tests/contextual-chat/precision-challenge.dev.json');
const CANDIDATE_FILES = ['backend/data/chatReferenceExtensions.js', 'backend/data/chatTopicRegistry.js', 'backend/data/precisionRanker.v1.json', 'backend/services/chatReferenceRegistry.js', 'backend/services/chatContextService.js', 'backend/services/contextualChatService.js', 'backend/services/preciseAnswerService.js', 'backend/services/precisionRankingService.js', 'backend/services/publicAnswerSynthesisService.js', 'backend/services/pharmacyChatPolicy.js', 'backend/services/approvedHealthSearchService.js'];
const root = path.resolve(__dirname, '../..');
function hashes() { return Object.fromEntries(CANDIDATE_FILES.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')])); }
function evaluate() {
  const trainingQueries = new Set(tasks.flatMap(task => task.queries).map(value => value.toLowerCase().replace(/[^a-z0-9]/g, '')));
  const rows = challenge.cases.map(value => {
    if (trainingQueries.has(value.message.toLowerCase().replace(/[^a-z0-9]/g, ''))) throw new Error('Exact training-query overlap in development challenge.');
    const context = resolveContext(value.message, (value.history || []).map(text => ({ role: 'user', text })));
    const focus = context.focus || focusOf(value.message, context);
    const sameTopic = references.filter(source => source.topics.some(topic => context.topics.some(current => current.id === topic)));
    const focusPool = sameTopic.filter(source => source.focuses.includes(focus)); const pool = focusPool.length ? focusPool : sameTopic;
    const lexical = rankPassages(value.message, references)[0];
    // Strong baseline gets the same context/focus labels and falls back to a
    // deterministic source order when a tiny-pool BM25 threshold removes all.
    const scoped = rankPassages(context.localQuestion, pool)[0] || [...pool].sort((a, b) => a.id.localeCompare(b.id))[0];
    const trained = retrievePrecise(context.localQuestion, context).passages[0];
    return { id: value.id, expectedSourceKeys: value.expected, bareBM25: lexical?.key || null, ruleScopedBM25: scoped?.key || null, trainedContext: trained?.key || null,
      correct: { bareBM25: Boolean(lexical && value.expected.includes(lexical.key)), ruleScopedBM25: Boolean(scoped && value.expected.includes(scoped.key)), trainedContext: Boolean(trained && value.expected.includes(trained.key)) } };
  });
  const totals = Object.fromEntries(['bareBM25', 'ruleScopedBM25', 'trainedContext'].map(name => [name, { correct: rows.filter(value => value.correct[name]).length, total: rows.length }]));
  const ruleRegressions = rows.filter(value => value.correct.ruleScopedBM25 && !value.correct.trainedContext).map(value => value.id);
  return { schemaVersion: 'precision-development-evaluation-v1', dataset: { synthetic: true, reviewStatus: challenge.reviewStatus, split: challenge.split, scenarios: rows.length }, corpusHash, candidateSha256: hashes(), metric: 'Expected top-source selection, not clinical answer accuracy', totals, ruleRegressions,
    canClaimSuperiority: false, externalComparators: { GPT: 'NOT_RUN', Claude: 'NOT_RUN' }, limitation: 'Small developer-authored challenge with known source families and visible labels. A gain over bare BM25 can reflect context/focus engineering; compare the strong rule baseline. No independent gold-standard or clinical/general-model superiority claim.', rows };
}
if (require.main === module) {
  const result = evaluate(); const flag = process.argv.indexOf('--output');
  if (flag >= 0) { const target = path.resolve(process.argv[flag + 1]); if (!target.startsWith(path.join(root, 'docs/contextual-chat/'))) throw new Error('Evaluation output must stay in docs/contextual-chat.'); fs.writeFileSync(target, JSON.stringify(result, null, 2) + '\n'); }
  console.log(JSON.stringify({ totals: result.totals, ruleRegressions: result.ruleRegressions, canClaimSuperiority: result.canClaimSuperiority, GPT: 'NOT_RUN', Claude: 'NOT_RUN' }));
}
module.exports = { evaluate, hashes };
