'use strict';
// Opt-in synthetic HTTP acceptance, not a benchmark or clinical validation.
// Uses only the existing synthetic demo account and public questions. No keys,
// tokens, private data or full upstream error bodies are printed or written.
async function main() {
  if (!process.argv.includes('--run-three-public-answers')) {
    console.log(JSON.stringify({ status: 'NOT_RUN', reason: 'Explicit --run-three-public-answers required.', paidRequests: 0 })); return;
  }
  const base = 'http://127.0.0.1:5001/api';
  const login = await fetch(base + '/users/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@test.com', password: 'password123', role: 'patient' }), signal: AbortSignal.timeout(5000) });
  const session = await login.json();
  if (!login.ok || typeof session.token !== 'string') throw new Error('SYNTHETIC_SIGN_IN_FAILED');
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token };
  const beforeResponse = await fetch(base + '/v1/chat/status', { headers, signal: AbortSignal.timeout(5000) });
  const before = await beforeResponse.json();
  if (!beforeResponse.ok || !before.generationEnabled) throw new Error('PUBLIC_GENERATION_NOT_CONFIGURED');
  const cases = [
    { id: 'MULTI_ATTRIBUTE', message: 'What are Metformin uses and possible side effects?', history: [] },
    { id: 'CONTEXT_AND_WORDING', message: 'English please. Can it make me sleepy? Explain simply.', history: [{ role: 'user', text: 'Explain Cetirizine in Marathi.' }, { role: 'assistant', text: 'I currently provide evidence-backed answers in English only. Would you like an English answer?' }] },
    { id: 'CROSS_DOCUMENT_RELATIONSHIP', message: 'Does Azithromycin treat viral colds?', history: [] }
  ];
  const selected = process.argv.includes('--only-multi') ? cases.slice(0, 1) : process.argv.includes('--only-context') ? cases.slice(1, 2) : cases;
  const results = [];
  for (const item of selected) {
    const started = Date.now();
    const response = await fetch(base + '/v1/chat', { method: 'POST', headers, body: JSON.stringify({ message: item.message, history: item.history }), signal: AbortSignal.timeout(50000) });
    const result = await response.json();
    const markers = [...String(result.reply || '').matchAll(/\[S(\d+)\]/g)].map(value => 'S' + value[1]);
    const citationsResolve = markers.length > 0 && markers.every(marker => result.sources?.some(source => source.citation === marker));
    const passed = response.ok && result.mode === 'GEMINI_RAG' && citationsResolve && result.answerQuality?.assessment === 'MODEL_CHECKED_EVIDENCE_SUPPORT_NOT_CLINICAL_VALIDATION';
    results.push({ id: item.id, status: response.status, passed, mode: result.mode || null, model: result.model || null, fallbackReason: result.fallbackReason || null, generationDiagnostics: result.generationDiagnostics || null, providerRequestCount: result.providerRequestCount ?? null,
      elapsedMs: Date.now() - started, citationsResolve, sources: (result.sources || []).map(source => ({ title: source.title, url: source.sourceUrl, kind: source.kind, reviewStatus: source.reviewStatus })),
      retrieval: result.retrieval?.method || null, coverage: result.evidenceCoverage || null, context: result.context?.topics?.map(topic => topic.id) || [],
      reply: typeof result.reply === 'string' ? result.reply : null });
    // No blind provider retries or continued spend after a failed live case.
    if (!passed) break;
  }
  const statusResponse = await fetch(base + '/v1/chat/status', { headers, signal: AbortSignal.timeout(5000) });
  const status = await statusResponse.json();
  console.log(JSON.stringify({ status: results.length === selected.length && results.every(value => value.passed) ? 'VERIFIED_PUBLIC_HTTP_FLOW' : 'PARTIAL_OR_FAILED',
    attemptedAnswers: results.length, maximumGenerationRequests: selected.length * 2, outputTokenCapsPerAnswer: [1024, 512], automaticRetries: 0,
    privateDataSent: false, clinicalValidation: 'NOT_PERFORMED', readiness: status.providerReadiness, results }, null, 2));
  if (results.length !== selected.length || results.some(value => !value.passed)) process.exitCode = 2;
}
main().catch(error => { console.log(JSON.stringify({ status: 'BLOCKED_OR_UNAVAILABLE', reason: /^[A-Z_]+$/.test(error.message) ? error.message : error.name, automaticRetries: 0 })); process.exitCode = 2; });
