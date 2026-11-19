const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { references } = require('../services/chatReferenceRegistry');
const { features, train } = require('../services/precisionRankingService');
const { rankPassages } = require('../services/chatRagService');
const tasks = require('../data/precisionTrainingTasks');
function trainCandidate({ sources = references } = {}) {
  const trainingCorpusHash = crypto.createHash('sha256').update(JSON.stringify(sources.map(value => ({ id: value.id, topics: value.topics, focuses: value.focuses })))).digest('hex');
  const pairs = [];
  for (const task of tasks) for (const query of task.queries) {
    const positive = sources.find(value => value.key === task.sourceKey); if (!positive) throw new Error('Training source is missing.');
    const lexical = new Map(rankPassages(query, sources, sources.length).map(value => [value.id, value.score]));
    const context = { topics: [task.topic], focus: task.focus };
    for (const negative of sources.filter(value => value.key !== task.sourceKey)) pairs.push({ positive: features(query, context, positive, lexical.get(positive.id) || 0), negative: features(query, context, negative, lexical.get(negative.id) || 0) });
  }
  const fitted = train(pairs);
  return { schemaVersion: 'precision-ranker-v1', kind: 'PAIRWISE_LINEAR_RETRIEVAL_RERANKER_NOT_LLM', dataset: 'Synthetic developer-authored development labels, not a clinical gold standard', corpusHash: trainingCorpusHash,
    trainingHash: crypto.createHash('sha256').update(JSON.stringify(tasks)).digest('hex'), trainingFamilies: tasks.map(value => value.id), trainingQueries: tasks.reduce((sum, value) => sum + value.queries.length, 0), ...fitted };
}
if (require.main === module) {
  const candidate = trainCandidate(), target = path.resolve(__dirname, '../data/precisionRanker.v1.json');
  fs.writeFileSync(target, JSON.stringify(candidate, null, 2) + '\n', { mode: 0o644 });
  console.log(JSON.stringify({ target: 'backend/data/precisionRanker.v1.json', trained: true, type: candidate.kind, queries: candidate.trainingQueries, pairs: candidate.pairCount, lossBefore: candidate.lossBefore, lossAfter: candidate.lossAfter, externalRequests: 0, clinicalValidation: false }));
}
module.exports = { trainCandidate };
