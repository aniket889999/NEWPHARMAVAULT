'use strict';
const fs = require('node:fs'), path = require('node:path'), { performance } = require('node:perf_hooks'), { createRequire } = require('node:module');
const support = require('./evaluation-support.cjs');
const { loadClient } = require('./load-client.cjs');
const { parseCaseAnswer, parseFreshnessResponse } = loadClient('src/features/caseAssistant/contract.ts');
const root = path.resolve(__dirname, '../..'), backend = createRequire(path.join(root, 'backend/package.json'));
const CANDIDATE_FILES = ['backend/services/trustRag/caseAssistantService.js', 'backend/routes/caseAssistantRoutes.js', 'backend/routes/trustRagRoutes.js',
  'backend/services/trustRag/caseReconciliationService.js', 'backend/services/trustRag/caseEvidenceMutationService.js',
  'backend/services/chatRagService.js', 'backend/services/trustRag/medicineItemContract.js', 'backend/services/trustRag/medicineQuantityService.js',
  'backend/services/trustRag/medicineReconciliationService.js', 'backend/data/academicMedicineCatalogue.js',
  'tests/rag-v2/evaluation-support.cjs', 'tests/rag-v2/run-evaluation.cjs', 'tests/foundation-v2/fixtures.cjs',
  'src/features/caseAssistant/contract.ts', 'src/features/caseAssistant/types.ts',
  'tests/foundation-v2/development.manifest.json', 'tests/foundation-v2/heldout.manifest.json',
  'tests/foundation-v2/dataset-lock.json', 'docs/rag-v2/EVALUATION_PROTOCOL.md'];
const freezePath = path.join(root, 'docs/rag-v2/SESSION_4_IMPLEMENTATION_FREEZE.json');
function codeHashes() {
  const result = {};
  for (const file of CANDIDATE_FILES) {
    const target = path.join(root, file);
    if (!fs.existsSync(target)) throw new Error('Session 4 implementation is incomplete; evaluation has not run.');
    result[file] = support.sha(fs.readFileSync(target));
  }
  return result;
}
function validateFreeze(freeze, hashes) {
  return freeze?.schemaVersion === 'session4-implementation-freeze/1.0.0' && freeze.acceptance === 'ACCEPTED_OFFLINE_AND_HTTP' &&
    freeze.reviewedSha256 && Object.keys(freeze.reviewedSha256).length === CANDIDATE_FILES.length &&
    CANDIDATE_FILES.every(file => freeze.reviewedSha256[file] === hashes[file]);
}
function parseOptions(args) {
  if (args.some(arg => !/^--split=(development|heldout)$/.test(arg) && arg !== '--accept-frozen-heldout')) throw new Error('Use --split=development or --split=heldout; held-out also requires --accept-frozen-heldout.');
  const matches = args.filter(arg => arg.startsWith('--split='));
  if (matches.length !== 1) throw new Error('Select exactly one explicit evaluation split.');
  const split = matches[0].slice(8);
  if (split === 'heldout' && !args.includes('--accept-frozen-heldout')) throw new Error('Held-out evaluation requires explicit freeze acceptance.');
  return { split };
}
function temporalSummary(records, policy) {
  const probes = records.flatMap(record => record.temporal || []);
  const dependent = probes.filter(p => p.kind === 'DEPENDENT'), unrelated = probes.filter(p => p.kind === 'UNRELATED');
  return {
    sameAnswerCohort: records.filter(r => r.temporal?.length).length,
    exactStaleDetection: support.ratio(dependent.filter(p => p.results[policy] === 'STALE').length, dependent.length),
    falseFreshAfterDependentEdit: support.ratio(dependent.filter(p => p.results[policy] === 'FRESH').length, dependent.length),
    falseStaleAfterUnrelatedEdit: support.ratio(unrelated.filter(p => p.results[policy] === 'STALE').length, unrelated.length),
    lostFreshnessAfterUnrelatedEdit: support.ratio(unrelated.filter(p => p.results[policy] !== 'FRESH').length, unrelated.length)
  };
}
function installNetworkGuard() {
  const http = require('node:http'), https = require('node:https');
  const original = { fetch: global.fetch, httpRequest: http.request, httpGet: http.get, httpsRequest: https.request, httpsGet: https.get };
  let attempts = 0;
  const deny = () => { attempts++; throw new Error('External network is prohibited in the offline fixture evaluation.'); };
  global.fetch = async () => deny(); http.request = deny; http.get = deny; https.request = deny; https.get = deny;
  return { get attempts() { return attempts; }, restore() {
    global.fetch = original.fetch; http.request = original.httpRequest; http.get = original.httpGet; https.request = original.httpsRequest; https.get = original.httpsGet;
  } };
}
async function evaluate(options) {
  const guard = installNetworkGuard();
  try {
    const result = await evaluateLocal(options);
    if (guard.attempts !== 0) throw new Error('A network attempt invalidated the offline run.');
    return { ...result, observedNetworkAttempts: guard.attempts };
  } finally { guard.restore(); }
}
async function evaluateLocal({ split }) {
  const hashes = codeHashes();
  if (split === 'heldout') {
    if (!fs.existsSync(freezePath) || !validateFreeze(JSON.parse(fs.readFileSync(freezePath, 'utf8')), hashes)) throw new Error('No matching independently accepted implementation freeze. Held-out labels were not loaded.');
  }
  // Held-out data is loaded only AFTER verifying the exact accepted source bytes.
  const { loadScenarios, FIXTURE_VERSION } = require('../foundation-v2/fixtures.cjs');
  const fixtures = loadScenarios(split);
  const candidate = backend('./services/trustRag/caseAssistantService.js');
  const { rankPassages } = backend('./services/chatRagService.js');
  const now = new Date('2026-11-16T00:00:00.000Z'), secret = 'synthetic-offline-evaluation-only-not-a-deployed-secret';
  const records = [];
  for (const fixture of fixtures) {
    const snapshot = support.snapshotFromFixture(fixture), target = support.targetFromAuthoredInput(fixture, snapshot);
    const started = performance.now();
    const lexical = rankPassages(target.query, support.privateCorpus(snapshot), 4);
    const lexicalMs = performance.now() - started;
    const begin = performance.now();
    const draft = candidate.buildCaseAnswer({ snapshot, message: target.query, medicineItemId: target.itemId });
    const issued = candidate.finalizeCaseAnswer({ draft, snapshot, userId: support.ACTOR, secret, now });
    if (!parseCaseAnswer(issued, snapshot.caseId, target.itemId)) throw new Error('Candidate answer violates the frozen consumer contract.');
    const candidateMs = performance.now() - begin;
    // Identical four-source retrieval/renderer budget for every primary ablation.
    // Keep the complete real signed answer only for the separate temporal cohort.
    const scoped = (issued.sources || []).slice(0, 4);
    const result = {
      scenarioId: fixture.id, familyId: fixture.familyId, split, effect: fixture.effect,
      expectedReferenceIds: target.relevantFieldIds, authoredAllowedFieldIds: target.allowedFieldIds,
      variants: {
        LEXICAL_UNSCOPED: { metrics: support.sourceMetrics(lexical, target), sourceFieldIds: lexical.map(s => s.fieldId), rendered: support.renderSources(lexical), durationMs: lexicalMs },
        ITEM_SCOPED_NO_FRESHNESS: { metrics: support.sourceMetrics(scoped, target), sourceFieldIds: scoped.map(s => s.fieldId), rendered: support.renderSources(scoped), durationMs: candidateMs },
        ITEM_SCOPED_DEPENDENCY_FRESHNESS: { metrics: support.sourceMetrics(scoped, target), sourceFieldIds: scoped.map(s => s.fieldId), rendered: support.renderSources(scoped), durationMs: candidateMs }
      }, action: issued.mode, temporal: null
    };
    if (issued.mode === 'LOCAL_CASE_EVIDENCE' && issued.bindingToken && target.primaryFieldId &&
      issued.sources.some(source => source.fieldId === target.primaryFieldId)) {
      result.temporal = ['DEPENDENT', 'UNRELATED'].map(kind => {
        const changed = support.counterfactual(snapshot, target, kind);
        const freshness = candidate.checkAnswerFreshness({ snapshot: changed, receipts: [{ answerId: issued.answerId, bindingToken: issued.bindingToken }],
          userId: support.ACTOR, secret, now: new Date(now.getTime() + 60000) });
        if (!parseFreshnessResponse(freshness, changed.caseId, [{ answerId: issued.answerId, bindingToken: issued.bindingToken }])) throw new Error('Candidate freshness violates the frozen consumer contract.');
        const status = freshness.results.find(r => r.answerId === issued.answerId)?.status;
        if (!['FRESH', 'STALE', 'UNVERIFIABLE'].includes(status)) throw new Error('Candidate emitted an invalid freshness result; evaluation stopped.');
        return { kind, expected: kind === 'DEPENDENT' ? 'STALE' : 'FRESH',
          results: { NO_INVALIDATION: 'FRESH', WHOLE_CASE_REVISION: changed.evidenceRevision === snapshot.evidenceRevision ? 'FRESH' : 'STALE', SIGNED_DEPENDENCIES: status } };
      });
    }
    records.push(result);
  }
  const variants = ['LEXICAL_UNSCOPED', 'ITEM_SCOPED_NO_FRESHNESS', 'ITEM_SCOPED_DEPENDENCY_FRESHNESS'];
  return {
    schemaVersion: 'synthetic-rag-feasibility/1.0.0', generatedAt: new Date().toISOString(), split,
    dataset: { version: FIXTURE_VERSION, scenarios: records.length, families: new Set(records.map(r => r.familyId)).size,
      lockSha256: hashes['tests/foundation-v2/dataset-lock.json'] },
    codeSha256: hashes, retrieval: Object.fromEntries(variants.map(v => [v, support.summarize(records, v)])),
    temporal: Object.fromEntries(['NO_INVALIDATION', 'WHOLE_CASE_REVISION', 'SIGNED_DEPENDENCIES'].map(v => [v, temporalSummary(records, v)])),
    scope: 'Structured synthetic medicine/source retrieval and content-freshness mechanisms only. Same quoted-source renderer across retrieval ablations; native generated prose is not scored.',
    limitations: [
      'No OCR/layout, clinical correctness, payment eligibility, clinician-efficiency or competitor evaluation.',
      'Temporal policies reuse the identical candidate-supported cited answer to isolate invalidation; this is not a full-system clinical comparison.',
      'Unrelated administrative edits are represented by changed case revision/token with identical visible medicine evidence, matching the server projection boundary.',
      'Abstention and coverage are reported, not silently removed. Temporal metrics are restricted to answers with an actual receipt and primary cited field; cohort size is explicit.',
      'Runtime is one warm process-local function pass, not API latency or a cold/warm performance study. API cost is unmeasured.',
      'Small template-linked synthetic family split; not external validation. No novelty percentage or publication guarantee.'
    ], records
  };
}
async function main() {
  const options = parseOptions(process.argv.slice(2));
  const output = path.join(root, 'reports/checkpoints'); fs.mkdirSync(output, { recursive: true });
  const resultFile = path.join(output, 'rag-evaluation-' + options.split + '.json');
  fs.writeFileSync(resultFile, JSON.stringify({ status: 'RUNNING', split: options.split, startedAt: new Date().toISOString() }) + '\n');
  let result;
  try { result = await evaluate(options); }
  catch (error) {
    fs.writeFileSync(resultFile, JSON.stringify({ status: 'FAILED', split: options.split, finishedAt: new Date().toISOString(), result: null }) + '\n');
    throw error;
  }
  fs.writeFileSync(resultFile, JSON.stringify({ status: 'COMPLETED', ...result }, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ split: result.split, dataset: result.dataset, retrieval: result.retrieval, temporal: result.temporal, limitations: result.limitations }, null, 2) + '\n');
}
if (require.main === module) main().catch(() => { console.error('Evaluation did not complete. Check the explicit split, implementation availability and accepted freeze; no passing result was generated.'); process.exitCode = 1; });
module.exports = { CANDIDATE_FILES, validateFreeze, parseOptions, temporalSummary, codeHashes, evaluate, installNetworkGuard };
