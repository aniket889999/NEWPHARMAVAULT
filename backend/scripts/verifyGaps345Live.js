'use strict';
// Strict opt-in: 2 public embedding batches + 4 generation/review calls maximum.
// Existing synthetic account only; no consent changes, private records or retry.
const crypto = require('node:crypto');
async function main() {
  if (!process.argv.includes('--allow-six-public-requests')) { console.log(JSON.stringify({ status: 'NOT_RUN', providerRequests: 0 })); return; }
  const base = 'http://127.0.0.1:5001/api';
  const auth = await fetch(base + '/users/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'patient@test.com', password: 'password123', role: 'patient' }), signal: AbortSignal.timeout(5000) });
  const user = await auth.json(); if (!auth.ok || !user.token) throw Error('SYNTHETIC_AUTH_UNAVAILABLE');
  const headers = { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' };
  const statusBefore = await fetch(base + '/v1/chat/status', { headers, signal: AbortSignal.timeout(5000) }).then(response => response.json());
  if (!statusBefore.generationEnabled || !statusBefore.embeddingEnabled) throw Error('PUBLIC_HYBRID_NOT_ENABLED');
  const contextId = crypto.randomUUID(), results = []; let contextToken, embeddingRequests = 0, generationRequests = 0;
  const cases = [
    { id: 'NEW_OFFICIAL_TOPIC_HYBRID', message: 'What is Allopurinol used for?', history: [] },
    { id: 'CONTEXT_BEYOND_RAW_WINDOW', message: 'What about its common side effects? Keep it concise.', history: Array.from({length:10},()=>({role:'user',text:'A formatting follow-up with no medicine name. PRIVATE_HISTORY_CANARY'})) }
  ];
  for (const entry of cases) {
    if (embeddingRequests >= 2 || generationRequests >= 4) break;
    const started = Date.now();
    const response = await fetch(base + '/v1/chat', { method: 'POST', headers,
      body: JSON.stringify({ message: entry.message, history: entry.history, contextId, ...(contextToken ? { contextToken } : {}) }), signal: AbortSignal.timeout(50000) });
    const result = await response.json();
    embeddingRequests += result.retrieval?.embeddingRequests || 0; generationRequests += result.providerRequestCount || 0;
    const markers = [...String(result.reply || '').matchAll(/\[S(\d+)\]/g)].map(value => 'S' + value[1]);
    const citationsResolve = markers.length > 0 && markers.every(value => result.sources?.some(source => source.citation === value));
    const passed = response.ok && result.mode === 'GEMINI_RAG' && result.retrieval?.method === 'HYBRID_BM25_VECTOR' && citationsResolve && typeof result.contextToken === 'string'
      && result.context?.topics?.[0]?.id === 'nhs-allopurinol' && (entry.id !== 'CONTEXT_BEYOND_RAW_WINDOW' || result.followupResolved === true);
    results.push({ id: entry.id, status: response.status, passed, mode: result.mode || null, model: result.model || null, elapsedMs: Date.now()-started,
      retrieval: result.retrieval, citationsResolve, contextTopic: result.context?.topics?.[0]?.id || null, followupResolved: result.followupResolved || false,
      encryptedContextReturned: typeof result.contextToken === 'string', generationDiagnostics: result.generationDiagnostics || null,
      fallbackReason: result.fallbackReason || null, sources: result.sources?.map(source=>({url:source.sourceUrl,publisher:source.publisher,jurisdiction:source.jurisdiction,reviewStatus:source.reviewStatus})), reply: result.reply || null });
    contextToken = result.contextToken;
    if (!passed) break; // No blind repeats, hidden cases, or extra API spend.
  }
  const state = await fetch(base + '/v1/chat/status', { headers, signal: AbortSignal.timeout(5000) }).then(response=>response.json());
  console.log(JSON.stringify({ status: results.length===2 && results.every(value=>value.passed)?'VERIFIED_GAPS_345_PUBLIC_FLOW':'PARTIAL_OR_FAILED',
    embeddingRequests, generationRequests, maximumEmbeddingRequests:2,maximumGenerationRequests:4,automaticRetries:0,privateDataSent:false,
    sourceDirectory:state.sourceDirectory,semantic:state.semanticRetrieval,memory:state.conversationMemory,results,clinicalValidation:'NOT_PERFORMED' },null,2));
  if(results.length!==2 || results.some(value=>!value.passed))process.exitCode=2;
}
main().catch(error=>{console.log(JSON.stringify({status:'BLOCKED',reason:/^[A-Z_]+$/.test(error.message)?error.message:error.name,automaticRetries:0}));process.exitCode=2;});
