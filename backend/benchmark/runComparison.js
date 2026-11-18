const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { getTasks, datasetHash, reviewStatus } = require('./publicComparisonTasks');
const { prepareTask, mechanicalScore, hash } = require('./comparisonContract');
const { read } = require('./localEvidenceReader');
const { generate, requestFor } = require('./providerAdapters');
const { hashes } = require('../scripts/evaluatePrecision');
const ROOT = path.resolve(__dirname, '../..');
const COMPONENT = 'PHARMAVAULT_EVIDENCE_READER';
const FILES = ['backend/benchmark/publicComparisonTasks.js', 'backend/benchmark/comparisonContract.js', 'backend/benchmark/providerAdapters.js', 'backend/benchmark/localEvidenceReader.js', 'backend/benchmark/approvalLedger.js', 'backend/benchmark/runComparison.js', 'backend/scripts/runProviderComparison.js', 'backend/scripts/checkBenchmarkConfig.js', 'backend/data/chatKnowledge.js', 'backend/data/healthChatKnowledge.js', 'backend/services/conversationalRagService.js'];
function fingerprints() {
  return { ...hashes(), ...Object.fromEntries(FILES.map(file => [file, hash(fs.readFileSync(path.join(ROOT, file)))])) };
}
function canRun(config) {
  if (!config || config.BENCHMARK_LIVE_ALLOWED !== 'true') return false;
  try { const first = prepareTask(getTasks()[0].id); requestFor('GPT', first, config); requestFor('CLAUDE', first, config); return true; } catch { return false; }
}
async function runComparison({ live = false, config, budget, fetcher, progress = () => {}, onRow = () => {}, fingerprint = fingerprints } = {}) {
  const tasks = getTasks(), before = fingerprint();
  if (live && (!canRun(config) || !budget)) throw new Error('Both private provider configurations, live flag and bounded approval are required.');
  // Preflight every fixed request before spending the first attempt.
  if (live) for (const task of tasks) for (const provider of ['GPT', 'CLAUDE']) requestFor(provider, prepareTask(task.id), config);
  const rows = [];
  for (const task of tasks) {
    const prepared = prepareTask(task.id), started = performance.now();
    const local = read(task);
    const localRow = { taskId: task.id, system: COMPONENT, status: 'COMPLETE', model: 'LOCAL_EXTRACTIVE_WITH_TRAINED_RERANKER_NOT_LLM', answer: local, durationMs: Math.round(performance.now() - started), usage: { externalRequests: 0 }, inputHash: prepared.inputHash, score: mechanicalScore(task, local) };
    rows.push(localRow); onRow(localRow);
    // Counterbalance model order across cases. Failures stay in the denominator;
    // there is no retry, fallback model, prompt change or early-win stopping.
    const order = tasks.indexOf(task) % 2 ? ['CLAUDE', 'GPT'] : ['GPT', 'CLAUDE'];
    for (const provider of order) {
      if (!live) { const row = { taskId: task.id, system: provider, status: 'NOT_RUN', reason: 'LIVE_EXECUTION_NOT_REQUESTED', answer: null, inputHash: prepared.inputHash, score: null }; rows.push(row); onRow(row); continue; }
      if (JSON.stringify(before) !== JSON.stringify(fingerprint())) throw new Error('Frozen candidate changed; remaining calls stopped.');
      const at = performance.now(); let row;
      try {
        const result = await generate(provider, prepared, config, { fetcher, beforeRequest: (name, details) => budget.reserve(name, details) });
        row = { taskId: task.id, system: provider, status: 'COMPLETE', ...result, inputHash: prepared.inputHash, durationMs: Math.round(performance.now() - at), score: mechanicalScore(task, result.answer) };
      } catch (error) {
        // No raw upstream text, URL, headers, credential values or exception stack.
        const allowed = new Set(['PROVIDER_RATE_LIMIT', 'PROVIDER_AUTH_FAILED', 'PROVIDER_HTTP_ERROR', 'INVALID_RESPONSE_TYPE', 'MISSING_RESPONSE_BODY', 'RESPONSE_LIMIT', 'INCOMPLETE_OUTPUT', 'PROVIDER_REFUSAL', 'UNEXPECTED_PROVIDER_OUTPUT', 'CREDENTIAL_ECHO_DENIED', 'INVALID_PROVIDER_JSON', 'NETWORK_OR_FORMAT_FAILURE', 'REQUEST_ABORTED_OR_TIMEOUT']);
        if (!allowed.has(error.code)) throw new Error('Budget/configuration failure; remaining calls stopped.');
        row = { taskId: task.id, system: provider, status: 'FAILED', reason: error.code, model: provider === 'GPT' ? config.OPENAI_BENCHMARK_MODEL : config.ANTHROPIC_BENCHMARK_MODEL, answer: null, inputHash: prepared.inputHash, durationMs: Math.round(performance.now() - at), score: mechanicalScore(task, null) };
      }
      rows.push(row); onRow(row); progress({ taskId: task.id, provider, status: row.status, attempts: budget.snapshot() });
    }
  }
  if (JSON.stringify(before) !== JSON.stringify(fingerprint())) throw new Error('Candidate changed; this run cannot attest the final implementation.');
  const summary = Object.fromEntries([COMPONENT, 'GPT', 'CLAUDE'].map(system => {
    const values = rows.filter(row => row.system === system), attempted = values.filter(row => row.status !== 'NOT_RUN');
    return [system, { planned: tasks.length, completed: values.filter(row => row.status === 'COMPLETE').length, failed: values.filter(row => row.status === 'FAILED').length, notRun: values.filter(row => row.status === 'NOT_RUN').length,
      developerActionChecksPassed: attempted.length ? attempted.filter(row => row.score.actionMatch).length : null,
      citationEligibleAnswers: attempted.filter(row => row.answer?.action === 'ANSWER').length,
      mechanicalTraceabilityChecksPassed: attempted.length ? attempted.filter(row => row.score.citationTraceability === true && row.score.formatValid).length : null,
      wordLimitChecksPassed: attempted.length ? attempted.filter(row => row.score.withinWordLimit).length : null, humanScores: 'NOT_REVIEWED' }];
  }));
  return { schemaVersion: 'public-provider-comparison-pilot-v1', createdAt: new Date().toISOString(), live, transport: fetcher ? 'INJECTED_TEST_DOUBLE_NOT_LIVE_ATTESTATION' : live ? 'DIRECT_PROVIDER_HTTP' : 'OFFLINE_NO_NETWORK', track: 'EQUAL_PUBLIC_EVIDENCE_READER_COMPONENT_NOT_FULL_PRODUCT', datasetHash, reviewStatus, candidateSha256: before,
    sharedPromptHash: prepareTask(tasks[0].id).sharedPromptHash, samePromptAndEvidenceForGPTAndClaude: true,
    localComponentUses: 'Production context/safety, ranker and source-note composition functions; comparison wrapper only, no web, full app or LLM synthesis.',
    limits: { totalRequests: 12, eachProvider: 6, outputTokensEach: 1024, serializedInputCharactersEach: 8000, retries: 0, tools: [], privateData: false, embeddings: false },
    attempts: budget?.snapshot() || { GPT: 0, CLAUDE: 0, total: 0 }, sampling: 'Provider defaults; no temperature/reasoning-effort equivalence claimed. Same output cap does not imply equal visible tokens or compute.',
    costUSD: null, costStatus: 'NOT_CALCULATED_MODEL_PRICING_NOT_CONFIGURED', summary, rows,
    superiorityEstablished: false, conclusion: 'NOT_ESTABLISHED', clinicalReview: 'NOT_PERFORMED',
    limitations: ['Six visible developer-authored source families, not independent gold or clinical validation.', 'No semantic entailment grading or blinded human scores yet. Pattern checks are diagnostic, not factual-accuracy scoring.', 'Compares configured API models under this harness, not ChatGPT/Claude applications, all model versions or medical capability.', 'Failures and unavailable providers are retained. No cherry-picking or resampling to manufacture a win.', 'Different architectures and provider defaults; no latency/cost/fairness significance claim from this pilot.'] };
}
function reviewPacket(report, runId = crypto.randomUUID()) {
  const mapping = {}, cases = getTasks().map(task => {
    const answers = report.rows.filter(row => row.taskId === task.id && row.status === 'COMPLETE').map(row => {
      const answerId = crypto.randomBytes(10).toString('hex'); mapping[answerId] = { taskId: task.id, system: row.system, model: row.model };
      return { answerId, answer: row.answer, review: { contextRelevance: null, factualSupport: null, completeness: null, uncertaintyHandling: null, unsafeClaimPresent: null, notes: null } };
    });
    for (let index = answers.length - 1; index > 0; index--) { const other = crypto.randomInt(index + 1); [answers[index], answers[other]] = [answers[other], answers[index]]; }
    return { taskId: task.id, question: task.question, history: task.history, passages: task.passages.map((source, index) => ({ sourceId: 'E' + (index + 1), title: source.title, text: source.excerpt, version: source.version, sourceUrl: source.sourceUrl || null })), answers };
  });
  return { packet: { runId, status: 'UNREVIEWED', completeThreeSystemComparison: report.live && report.rows.every(row => row.status === 'COMPLETE'), reviewer: { id: null, qualification: null, independent: null }, scale: 'Score 0 (poor), 1 (partial), 2 (good); unsafeClaimPresent boolean. Medical scoring requires a qualified pharmacist. No score is prefilled.', warning: 'Answer IDs are randomized; source/version context is visible. Keep the separate mapping private until reviews are locked. Style can still reveal a system; blinding is imperfect.', cases }, mapping: { runId, mapping } };
}
module.exports = { runComparison, fingerprints, canRun, reviewPacket, COMPONENT };
