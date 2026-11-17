const fs = require('node:fs'), path = require('node:path');
const dotenv = require('dotenv');
const { performance } = require('node:perf_hooks');
const { hashes } = require('./evaluatePrecision');
const root = path.resolve(__dirname, '../..');
const cases = [
  { id: 'public-review', message: 'Explain human-in-the-loop validation', history: [], expectedKey: 'human-review', wordLimit: 160 },
  { id: 'public-reference-effects', message: 'What are the common side effects of Metformin?', history: [], expectedKey: 'nhs-metformin-effects', wordLimit: 160 },
  { id: 'public-context-followup', message: 'Explain it more simply', history: [{ role: 'user', text: 'What is Paracetamol? SYNTHETIC_LOCAL_CONTEXT_ONLY' }, { role: 'user', text: 'What about its side effects?' }], expectedKey: 'nhs-paracetamol-effects', wordLimit: 90 }
];
async function main() {
  if (!process.argv.includes('--live-public-approved')) { console.log(JSON.stringify({ dryRun: true, plannedRequests: 6, maxOutputTokensEach: 1024, privateData: false, warning: 'Requires explicit user approval before using --live-public-approved.' })); return; }
  const file = [path.join(root, 'backend/.env'), '/Users/aniket/Downloads/PBL 5 TH SEM/backend/.env'].find(value => fs.existsSync(value)); if (file) dotenv.config({ path: file });
  Object.assign(process.env, { RAG_CHAT_LLM_ENABLED: 'true', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'true', RAG_CHAT_EMBEDDINGS_ENABLED: 'false', RAG_CHAT_WEB_ENABLED: 'false', RAG_CHAT_WEB_SYNTHESIS_ALLOWED: 'false', TRUSTRAG_LLM_ENABLED: 'false', TRUSTRAG_LLM_EXPORT_ALLOWED: 'false' });
  if (!process.env.GEMINI_API_KEY) throw new Error('Server credential unavailable; no request made.');
  const baseline = require('../services/conversationalRagService'), candidate = require('../services/contextualChatService'), rag = require('../services/chatRagService');
  const sourceKeys = new Map(rag.publicChunks.map(value => [value.id, value.key]));
  const candidateSha256 = hashes(); let calls = 0;
  const rows = [];
  const fetcher = async (url, options) => {
    if (calls >= 6 || !/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-[a-z0-9.-]+:streamGenerateContent\?alt=sse$/.test(url)) throw new Error('Approved request budget/type exceeded.');
    if (options.body.includes('SYNTHETIC_LOCAL_CONTEXT_ONLY')) throw new Error('Local context marker denied before egress.');
    const body = JSON.parse(options.body); body.generationConfig.maxOutputTokens = 1024; calls++;
    return fetch(url, { ...options, body: JSON.stringify(body) });
  };
  for (const value of cases) for (const [arm, service] of [['BASELINE_CONVERSATIONAL_RAG', baseline], ['ENHANCED_PRECISE_RAG', candidate]]) {
    const started = performance.now(), before = calls;
    let result;
    try { result = await service.answer({ message: value.message, history: value.history }, { fetcher }); }
    catch { result = { mode: 'FAILED_CLOSED', reply: '', sources: [], warnings: ['Request failed; no retry performed.'] }; }
    const keys = result.sources.map(source => sourceKeys.get(source.sourceId) || 'OUTSIDE_COMPARABLE_BASE_CORPUS');
    const row = { id: value.id, arm, mode: result.mode, model: result.model || null, durationMs: Math.round(performance.now() - started), requests: calls - before,
      words: result.reply.trim() ? result.reply.trim().split(/\s+/).length : 0, wordLimit: value.wordLimit, selectedSourceKeys: keys, expectedSourceHit: keys.includes(value.expectedKey),
      mechanicalCitationValidationPassed: result.mode === 'GEMINI_RAG', comparableBaseCorpusOnly: !keys.includes('OUTSIDE_COMPARABLE_BASE_CORPUS'), reply: result.reply, warnings: result.warnings || [] };
    rows.push(row); console.log(JSON.stringify({ id: row.id, arm, mode: row.mode, requests: row.requests, expectedSourceHit: row.expectedSourceHit, words: row.words, totalRequests: calls }));
  }
  if (JSON.stringify(hashes()) !== JSON.stringify(candidateSha256)) throw new Error('Candidate changed during live pilot. Results cannot attest the final version.');
  const summary = Object.fromEntries(['BASELINE_CONVERSATIONAL_RAG', 'ENHANCED_PRECISE_RAG'].map(arm => { const values = rows.filter(value => value.arm === arm); return [arm, { scenarios: values.length, generatedAndCitationChecked: values.filter(value => value.mechanicalCitationValidationPassed).length, expectedSourceHit: values.filter(value => value.expectedSourceHit).length, wordLimitMet: values.filter(value => value.words > 0 && value.words <= value.wordLimit).length, totalWords: values.reduce((sum, value) => sum + value.words, 0) }]; }));
  const report = { schemaVersion: 'public-precision-pilot-v1', date: new Date().toISOString(), scope: 'PUBLIC_REFERENCE_ONLY', userApprovalRequestLimit: 6, actualGenerationRequests: calls, embeddingRequests: 0, retries: 0, maxOutputTokensEach: 1024, privateDataSent: false, rawHistoryExported: false,
    candidateSha256, summary, canClaimSuperiority: false, GPT: 'NOT_RUN', Claude: 'NOT_RUN', clinicalReview: 'NOT_PERFORMED',
    limitation: 'Three developer-selected public scenarios; two pipeline variants using the same Gemini model and base corpus, different prompts/retrieval. Mechanical/source/length checks only, no blinded semantic or clinical grading, significance test, independent gold set, cross-model superiority or training claim about Gemini weights.', rows };
  const target = path.join(root, 'docs/contextual-chat/PUBLIC_PRECISION_PILOT_2026-11-17.json'); fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ complete: true, actualGenerationRequests: calls, summary, canClaimSuperiority: false }));
}
main().catch(() => { console.error('Public precision pilot did not complete. No automatic retry, private export or extra request is authorized.'); process.exitCode = 1; });
