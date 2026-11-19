'use strict';
const crypto = require('node:crypto');
const Cache = require('../models/publicEmbeddingModel');
const { isKnownPublic } = require('./chatReferenceRegistry');
const { isApprovedWebPassage } = require('./approvedHealthSearchService');
const { evaluateSource } = require('./chatSourceGovernanceService');
const { buildPublicAnswerTask } = require('./publicAnswerTaskService');
const { toolControls } = require('./chatRuntimeControlService');
const DIMENSION = 768, TTL = 30 * 86400000;
function normalize(vector) {
  if (!Array.isArray(vector) || vector.length !== DIMENSION || vector.some(value => !Number.isFinite(value))) throw new Error('Invalid public embedding dimensions.');
  const norm = Math.hypot(...vector); if (!Number.isFinite(norm) || norm <= 0) throw new Error('Invalid zero embedding.');
  return vector.map(value => value / norm);
}
const cosine = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
function fuse(lexical, semantic) {
  const scores = new Map();
  for (const list of [lexical, semantic]) list.forEach((value, index) => scores.set(value.id, (scores.get(value.id) || 0) + 1 / (60 + index + 1)));
  return lexical.map(value => ({ ...value, hybridScore: scores.get(value.id) || 0, similarity: semantic.find(item => item.id === value.id)?.similarity || 0 }))
    .sort((a, b) => b.hybridScore - a.hybridScore || a.id.localeCompare(b.id));
}
function createPublicSemanticRetrieval({ fetcher = (...args) => fetch(...args), environment = () => process.env, now = Date.now, store = Cache, controls = toolControls } = {}) {
  const cache = new Map(); let observation = null;
  const put = (key, vector, until) => { cache.delete(key); cache.set(key, { vector, until }); while (cache.size > 512) cache.delete(cache.keys().next().value); };
  async function retrieve(context, candidates, { signal } = {}) {
    const env = environment(), model = env.RAG_CHAT_EMBEDDING_MODEL || 'gemini-embedding-001';
    const fallback = reason => ({ passages: candidates, method: 'BM25_CONCEPT_RERANK', warning: reason, embeddingRequests: 0 });
    if (env.RAG_CHAT_EMBEDDINGS_ENABLED !== 'true' || env.RAG_CHAT_PUBLIC_EXPORT_ALLOWED !== 'true' || !env.GEMINI_API_KEY) return fallback('Dense retrieval is disabled.');
    if (!['gemini-embedding-001', 'gemini-embedding-2'].includes(model)) return fallback('Embedding model configuration is invalid.');
    if (!candidates.length) return fallback('No eligible public evidence to embed.');
    if (candidates.length > 24 || candidates.some(value => (!isKnownPublic(value) && !isApprovedWebPassage(value)) || !evaluateSource(value).eligible || value.excerpt.length > 5000)) throw new Error('Untrusted public embedding input.');
    const task = buildPublicAnswerTask({ context, focus: context.focus, passages: candidates, purpose: 'RETRIEVAL' });
    if (!task) return fallback('The public retrieval task could not be safely represented.');
    const requests = [...candidates.map(value => ({ text: value.title + '\n' + value.excerpt, task: 'RETRIEVAL_DOCUMENT' })), { text: task.question, task: 'RETRIEVAL_QUERY' }]
      .map(value => ({ ...value, key: crypto.createHash('sha256').update(JSON.stringify([model, DIMENSION, value.task, value.text])).digest('hex') }));
    const missing = new Map(), vectors = new Map(); let embeddingRequests = 0;
    try {
      for (const value of requests) { const saved = cache.get(value.key); if (saved && now() < saved.until) vectors.set(value.key, saved.vector); else missing.set(value.key, value); }
      if (missing.size && store?.db?.readyState === 1) {
        try {
          const query = store.find({ _id: { $in: [...missing.keys()] }, expiresAt: { $gt: new Date(now()) }, model, dimension: DIMENSION });
          query.maxTimeMS?.(1500);
          const saved = await query.lean();
          for (const value of saved) { try { const vector = normalize(value.vector); vectors.set(value._id, vector); put(value._id, vector, +value.expiresAt); missing.delete(value._id); } catch { /* Invalid/stale cached vectors are not proof. */ } }
        } catch { /* Cache availability must not be a prerequisite for public retrieval. */ }
      }
      if (missing.size) {
        const values = [...missing.values()]; if (values.length > 25 || values.reduce((sum, value) => sum + value.text.length, 0) > 50000) return fallback('Public embedding batch exceeds limits.');
        const body = { requests: values.map(value => ({ model: 'models/' + model,
          content: { parts: [{ text: model === 'gemini-embedding-2' ? (value.task === 'RETRIEVAL_QUERY' ? 'task: retrieval | query: ' : 'task: retrieval | document: ') + value.text : value.text }] },
          ...(model === 'gemini-embedding-001' ? { taskType: value.task } : {}), outputDimensionality: DIMENSION })) };
        const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000);
        const data = await controls.run('EMBEDDING', async () => {
          embeddingRequests++;
          const response = await fetcher('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':batchEmbedContents', {
            method: 'POST', redirect: 'error', signal: deadline, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify(body) });
          if (!response.ok || !/json/i.test(response.headers.get('content-type') || '')) throw new Error('Embedding provider unavailable.');
          const reader = response.body.getReader(); let text = '', bytes = 0; const decoder = new TextDecoder();
          try { while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.length; if (bytes > 1048576) throw new Error('Embedding response exceeds limits.'); text += decoder.decode(chunk.value, { stream: true }); } }
          finally { await reader.cancel().catch(() => {}); }
          deadline.throwIfAborted(); return JSON.parse(text + decoder.decode());
        }, { signal: deadline });
        if (!Array.isArray(data.embeddings) || data.embeddings.length !== values.length) throw new Error('Embedding batch shape mismatch.');
        const normalized = data.embeddings.map(value => normalize(value.values));
        normalized.forEach((vector, index) => { vectors.set(values[index].key, vector); put(values[index].key, vector, now() + TTL); });
        if (store?.db?.readyState === 1) void store.bulkWrite(values.map((value, index) => ({ updateOne: { filter: { _id: value.key }, update: { $set: { model, task: value.task, dimension: DIMENSION, vector: normalized[index], expiresAt: new Date(now() + TTL) } }, upsert: true } }))).catch(() => {});
      }
      const query = vectors.get(requests[requests.length - 1].key);
      const semantic = candidates.map((value, index) => ({ ...value, similarity: cosine(query, vectors.get(requests[index].key)) })).sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id));
      observation = { lastSuccessAt: new Date(now()).toISOString(), model, dimension: DIMENSION, failure: null };
      return { passages: fuse(candidates, semantic), method: 'HYBRID_BM25_VECTOR', embeddingRequests, cacheHits: requests.length - missing.size };
    } catch (error) {
      if (signal?.aborted) throw error;
      observation = { ...observation, failure: 'DENSE_RETRIEVAL_UNAVAILABLE' };
      return { ...fallback('Dense retrieval unavailable; scoped keyword/concept retrieval was used.'), embeddingRequests };
    }
  }
  return { retrieve, snapshot: () => ({ enabled: environment().RAG_CHAT_EMBEDDINGS_ENABLED === 'true', model: environment().RAG_CHAT_EMBEDDING_MODEL || 'gemini-embedding-001', dimension: DIMENSION,
    vectorRetrievalVerified: Boolean(observation && !observation.failure && observation.model === (environment().RAG_CHAT_EMBEDDING_MODEL || 'gemini-embedding-001')),
    cacheEntries: cache.size, cachePolicy: 'PUBLIC_ONLY_30_DAY_MONGO_TTL_AND_BOUNDED_MEMORY', ...(observation || {}), clinicalConfidence: 'NOT_ESTABLISHED' }) };
}
const publicSemanticRetrieval = createPublicSemanticRetrieval();
module.exports = { createPublicSemanticRetrieval, publicSemanticRetrieval, normalize, cosine, fuse, DIMENSION };
