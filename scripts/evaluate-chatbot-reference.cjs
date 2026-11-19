'use strict';
// Read-only, offline engineering evaluator. Never loads .env, calls an LLM,
// opens a database, trains the candidate, or changes expected labels.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const PACK = path.join(ROOT, 'docs/chatbot-reference-standard/v1');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const load = file => JSON.parse(fs.readFileSync(path.join(PACK, file), 'utf8'));
const ACTIONS = new Set(['ANSWER', 'CLARIFY', 'ABSTAIN', 'SAFETY', 'FRESH', 'STALE', 'UNVERIFIABLE']);
function validatePack(dataset, catalog, fixtures) {
  if (dataset.schemaVersion !== 'pharmavault-academic-gold/1.0.0' || dataset.clinicalApproval !== 'NOT_ESTABLISHED' || dataset.independence !== 'EXPOSED_REFERENCE_NOT_UNSEEN_HELDOUT') throw Error('Invalid reference-standard scope.');
  if (!Array.isArray(dataset.items) || dataset.items.length !== dataset.counts.items) throw Error('Invalid item count.');
  const ids = new Set(), prompts = new Set(), families = new Map(), facts = new Set(catalog.facts.map(f => f.id)), sources = new Set(catalog.sources.map(s => s.key));
  if (facts.size !== catalog.facts.length || sources.size !== catalog.sources.length) throw Error('Duplicate evidence keys.');
  for (const f of catalog.facts) {
    if (!f.sourceKeys.length || f.sourceKeys.some(k => !sources.has(k)) || !f.patterns.length) throw Error('Unresolved source fact.');
    f.patterns.forEach(p => new RegExp(p, 'i'));
  }
  for (const item of dataset.items) {
    if (!/^F\d{2}-\d{2}$/.test(item.id) || ids.has(item.id) || item.familyId !== item.id.slice(0, 3)) throw Error('Invalid/duplicate item identifier.'); ids.add(item.id);
    if (item.split !== 'EXPOSED_REFERENCE' || !['PUBLIC', 'SYNTHETIC_CASE'].includes(item.scope)) throw Error('Invalid split/scope.');
    if (!item.input || typeof item.input.message !== 'string' || !item.input.message.trim() || item.input.message.length > 2000 || !Array.isArray(item.input.history) || item.input.history.length > 10 || item.input.history.some(h => !['user','assistant'].includes(h.role) || typeof h.text !== 'string' || h.text.length > 2000)) throw Error('Invalid prompt.');
    const unique = JSON.stringify([item.scope, item.input, item.configuration, item.mutation || null, item.fixture || null, item.selection || null]);
    if (prompts.has(unique)) throw Error('Duplicate scenario.'); prompts.add(unique);
    if (!ACTIONS.has(item.expected?.action) || !Number.isInteger(item.expected.maxWebCalls) || item.expected.maxWebCalls < 0 || !Number.isInteger(item.expected.minSources) || item.expected.minSources < 0) throw Error('Invalid expected outcome.');
    if ((item.expected.requiredFactIds || []).some(id => !facts.has(id)) || (item.expected.sourceKeys || []).some(key => !sources.has(key))) throw Error('Unknown expected evidence.');
    if (item.review?.humanStatus !== 'PENDING' || item.review.reviewerId !== null || item.review.clinicalApproval !== 'NOT_ESTABLISHED') throw Error('Unreviewed pack must not invent a reviewer/approval.');
    if (item.scope === 'SYNTHETIC_CASE' && (!fixtures.synthetic || !fixtures.snapshots[item.fixture] || !['RX','INVOICE','NONE'].includes(item.selection))) throw Error('Invalid synthetic fixture.');
    if (item.category === 'FRESHNESS' && !item.mutation) throw Error('Missing correction counterfactual.');
    [...(item.expected.patterns || []), ...(item.expected.forbiddenPatterns || [])].forEach(p => new RegExp(p, 'i'));
    families.set(item.familyId, (families.get(item.familyId) || 0) + 1);
  }
  if (families.size !== dataset.counts.families || [...families.values()].some(n => n !== 2)) throw Error('Invalid family count.');
  return { items: ids.size, families: families.size, sources: sources.size, facts: facts.size };
}
function checkFreeze(manifest, { referenceOnly = false } = {}) {
  for (const [relative, expected] of Object.entries(referenceOnly ? manifest.referenceSha256 : { ...manifest.candidateSha256, ...manifest.referenceSha256 })) {
    const resolved = path.resolve(ROOT, relative);
    if (!resolved.startsWith(ROOT + path.sep) || digest(fs.readFileSync(resolved)) !== expected) throw Error('Freeze changed: ' + relative);
  }
  return true;
}
function actionOf(value) { return ACTIONS.has(value.mode) ? value.mode : value.mode === 'LOCAL_CASE_EVIDENCE' || /(?:PRECISE_|GEMINI_RAG|CONVERSATIONAL_HELP)/.test(value.mode || '') ? 'ANSWER' : 'UNKNOWN'; }
function fieldFrom(snapshot, label) {
  const [side, slot] = label.split('.');
  return (side === 'RX' ? snapshot.prescription : snapshot.invoice).medicineItems[0].fields[slot];
}
function scoreItem(item, answer, context, catalog) {
  const e = item.expected, sources = answer.sources || [], reply = answer.reply || '', checks = [];
  // Escaped Markdown is presentation, not a missing fact. Keep the raw text for
  // citation topology; normalize only escapes before checking answer patterns.
  const plainReply = reply.replace(/\\([\\`*_{}\[\]<>#|])/g, '$1');
  const add = (dimension, pass, detail) => checks.push({ dimension, pass: Boolean(pass), ...(detail ? { detail } : {}) });
  add('action', actionOf(answer) === e.action, 'Expected ' + e.action + '; observed ' + actionOf(answer));
  if (item.category !== 'FRESHNESS') {
    add('response_present', plainReply.trim().length >= 20);
    add('source_count', sources.length >= e.minSources && (e.maxSources === undefined || sources.length <= e.maxSources));
    add('citation_shape', sources.every((s,i) => s.citation === 'S' + (i + 1) && reply.includes('[' + s.citation + ']')) && [...reply.matchAll(/\[S(\d+)\]/g)].every(m => sources.some(s => s.citation === 'S' + m[1])));
    if (item.scope === 'PUBLIC') {
      add('public_source_integrity', sources.every(s => !s.private && s.kind !== 'CASE_RECORD' && !s.documentId && context.permittedSources.some(p => p.id === s.sourceId && p.excerpt === s.excerpt && (p.sourceUrl || '') === (s.sourceUrl || '') && p.version === s.version)));
      if (e.topicIds) add('topic', JSON.stringify(answer.context?.topics?.map(t => t.id).sort()) === JSON.stringify([...e.topicIds].sort()));
      const sourceKeys = sources.map(s => context.permittedSources.find(p => p.id === s.sourceId)?.key);
      if (e.sourceKeys) add('expected_source_selection', sourceKeys.some(k => e.sourceKeys.includes(k)));
      for (const id of e.requiredFactIds || []) {
        const fact = catalog.facts.find(f => f.id === id);
        add('required_fact_pattern', fact.patterns.every(p => new RegExp(p,'i').test(plainReply)), id + ' (lexical check only)');
        add('fact_source_selection', sourceKeys.some(k => fact.sourceKeys.includes(k)) || (e.allowWebFixture && sources.some(s => s.kind === 'OFFICIAL_WEB')), id);
      }
    } else {
      const docs = [context.snapshot.prescription, context.snapshot.invoice];
      const fields = docs.flatMap(d => d.medicineItems.flatMap(i => Object.values(i.fields).filter(Boolean)));
      add('case_field_integrity', sources.every(s => s.fieldId === null || fields.some(f => f.id === s.fieldId && f.documentId === s.documentId && f.pageNumber === s.pageNumber && s.excerpt.includes(String(f.normalizedValue || f.rawValue)))));
      for (const label of e.requiredFields || []) add('expected_case_field', sources.some(s => s.fieldId === fieldFrom(context.snapshot, label).id), label);
      if (e.sourceScope) { const doc = e.sourceScope === 'RX' ? context.snapshot.prescription : context.snapshot.invoice; add('selected_document_scope', sources.every(s => s.documentId === doc.documentId)); }
    }
  }
  add('tool_boundary', context.webCalls <= e.maxWebCalls && (e.exactWebCalls === undefined || context.webCalls === e.exactWebCalls));
  if (['ABSTAIN','CLARIFY','SAFETY'].includes(e.action)) add('boundary_no_numeric_regimen', !/\b(?:take|give|use)\s+\d+(?:\.\d+)?\s*(?:mg|mcg|ml|tablets?|capsules?)\b/i.test(plainReply));
  if (e.webStatus) add('web_status', answer.webLookup?.status === e.webStatus);
  if (e.usedWeb !== undefined) add('web_use_label', answer.webLookup?.usedInAnswer === e.usedWeb);
  if (e.followupResolved !== undefined) add('followup', answer.followupResolved === e.followupResolved);
  if (e.maxWords) add('length', reply.split(/\s+/).length <= e.maxWords);
  for (const p of e.patterns || []) add('required_answer_pattern', new RegExp(p,'i').test(plainReply), p);
  for (const p of e.forbiddenPatterns || []) add('forbidden_answer_pattern', !new RegExp(p,'i').test(plainReply), p);
  return { pass: checks.every(c => c.pass), checks };
}
function editField(snapshot, id, changes) {
  const walk = value => { if (!value || typeof value !== 'object') return; if (value.id === id && value.fieldType) Object.assign(value, changes); Object.values(value).forEach(walk); };
  walk(snapshot); snapshot.evidenceRevision++; snapshot.snapshotToken = 'rs_' + 'b'.repeat(64);
}
function executeCase(item, fixtures, service, prioritize) {
  const snapshot = structuredClone(fixtures.snapshots[item.fixture]);
  const selection = item.selection === 'RX' ? snapshot.prescription.medicineItems[0].itemId : item.selection === 'INVOICE' ? snapshot.invoice.medicineItems[0].itemId : null;
  const draft = service.buildCaseAnswer({ snapshot, message: item.input.message, medicineItemId: selection });
  const now = new Date('2026-11-18T12:00:00.000Z'), secret = 'synthetic-academic-benchmark-secret-not-used-by-any-server';
  const initial = service.finalizeCaseAnswer({ draft, snapshot, userId: fixtures.actor, secret, now });
  if (item.category !== 'FRESHNESS') return { answer: prioritize({ answer: initial, message: item.input.message }), snapshot };
  const changed = structuredClone(snapshot), rx = changed.prescription.medicineItems[0];
  let userId = fixtures.actor, bindingToken = initial.bindingToken;
  switch (item.mutation) {
    case 'CITED_STRENGTH': editField(changed, rx.fields.dosage_strength.id, { rawValue: '750 mg', normalizedValue: '750 mg' }); break;
    case 'CITED_NAME': editField(changed, rx.fields.medicine_name.id, { rawValue: 'Synthetic changed identity', normalizedValue: 'Synthetic changed identity' }); break;
    case 'UNCITED_QUANTITY_11': case 'UNCITED_QUANTITY_12': { const v = item.mutation.endsWith('11') ? '11' : '12'; editField(changed, rx.fields.quantity.id, { rawValue: v, normalizedValue: v }); break; }
    case 'BAD_TOKEN': bindingToken += 'tampered'; break;
    case 'WRONG_OWNER': userId = 'b'.repeat(24); break;
    case 'SOURCE_PAGE': editField(changed, rx.fields.dosage_strength.id, { pageNumber: 2 }); break;
    case 'SOURCE_DELETE': { const id = rx.fields.dosage_strength.id; changed.groupingDocuments.forEach(d => { d.fields = d.fields.filter(f => f.id !== id); }); rx.fields.dosage_strength = null; break; }
    default: throw Error('Unknown counterfactual.');
  }
  const freshness = service.checkAnswerFreshness({ snapshot: changed, receipts: [{ answerId: initial.answerId, bindingToken }], userId, secret, now: new Date(now.getTime() + 60000) });
  return { answer: { mode: freshness.results[0].status, sources: [], reply: '' }, snapshot };
}
async function run({ allowCandidateChange = false } = {}) {
  const dataset = load('benchmark.json'), catalog = load('source-catalog.json'), fixtures = load('case-fixtures.json'), freeze = load('freeze.json');
  const counts = validatePack(dataset, catalog, fixtures); checkFreeze(freeze, {referenceOnly:allowCandidateChange});
  const candidateSha256=Object.fromEntries(Object.keys(freeze.candidateSha256).map(f=>[f,digest(fs.readFileSync(path.join(ROOT,f)))]));
  const changedCandidateFiles=Object.keys(candidateSha256).filter(f=>candidateSha256[f]!==freeze.candidateSha256[f]);
  const envNames = ['NODE_ENV','CHAT_SOURCE_POLICY','RAG_CHAT_LLM_ENABLED','RAG_CHAT_PUBLIC_EXPORT_ALLOWED','RAG_CHAT_EMBEDDINGS_ENABLED','RAG_CHAT_WEB_ENABLED','RAG_CHAT_WEB_MODE'];
  const saved = Object.fromEntries(envNames.map(k => [k, process.env[k]]));
  const http = require('node:http'), https = require('node:https');
  const oldNetwork = { fetch: globalThis.fetch, httpRequest: http.request, httpGet: http.get, httpsRequest: https.request, httpsGet: https.get }; let egressAttempts = 0;
  const deny = () => { egressAttempts++; throw Error('Network denied in offline reference evaluation.'); };
  globalThis.fetch = http.request = http.get = https.request = https.get = deny;
  Object.assign(process.env, { NODE_ENV:'test', CHAT_SOURCE_POLICY:'ACADEMIC_DEMO', RAG_CHAT_LLM_ENABLED:'false', RAG_CHAT_PUBLIC_EXPORT_ALLOWED:'false', RAG_CHAT_EMBEDDINGS_ENABLED:'false' });
  try {
    const { answer } = require('../backend/services/contextualChatService');
    const { references } = require('../backend/services/chatReferenceRegistry');
    const { parseResults } = require('../backend/services/approvedHealthSearchService');
    const service = require('../backend/services/trustRag/caseAssistantService');
    const { prioritizeCaseAnswerSources } = require('../backend/services/trustRag/citationPriorityPolicy');
    const webSources = parseResults('<nlmSearchResult><document url="https://medlineplus.gov/antibioticresistance.html"><content name="title">Antibiotic Resistance</content><content name="FullSummary">Antibiotic resistance happens when bacteria change and an antibiotic no longer controls them effectively. This does not mean the patient body becomes resistant. This public-topic transport fixture contains no personal treatment advice.</content></document></nlmSearchResult>', { webTerm:'antibiotic resistance' }, '2026-11-18T12:00:00.000Z');
    if (!webSources.length) throw Error('Reference transport fixture could not be parsed.');
    const rows = [];
    for (const item of dataset.items) {
      const start = performance.now(); let webCalls = 0;
      Object.assign(process.env, { NODE_ENV:'test', CHAT_SOURCE_POLICY:item.configuration.sourcePolicy || 'ACADEMIC_DEMO', RAG_CHAT_WEB_ENABLED:item.configuration.webMode === 'DISABLED' ? 'false' : 'true', RAG_CHAT_WEB_MODE:item.configuration.webMode === 'ALWAYS_PUBLIC' ? 'ALWAYS_PUBLIC' : 'FALLBACK' });
      const context = { webCalls:0, permittedSources:references };
      try {
        let result;
        if (item.scope === 'SYNTHETIC_CASE') { const executed = executeCase(item, fixtures, service, prioritizeCaseAnswerSources); result = executed.answer; context.snapshot = executed.snapshot; }
        else result = await answer(item.input, { webSearch:async () => {
          webCalls++;
          if (item.configuration.scenario === 'OUTAGE') throw Error('Synthetic transport outage');
          if (['RELEVANT','IRRELEVANT'].includes(item.configuration.scenario)) return { status:'RETRIEVED', passages:webSources };
          return { status:'DISABLED', passages:[] };
        } });
        context.webCalls = webCalls;
        if (item.expected.allowWebFixture) context.permittedSources = [...references, ...webSources];
        const scored = scoreItem(item, result, context, catalog);
        rows.push({ id:item.id, familyId:item.familyId, category:item.category, action:actionOf(result), ...scored, durationMs:Number((performance.now()-start).toFixed(3)) });
      } catch (error) { rows.push({ id:item.id, familyId:item.familyId, category:item.category, pass:false, checks:[{dimension:'runtime',pass:false,detail:error.message}], durationMs:Number((performance.now()-start).toFixed(3)) }); }
    }
    const aggregate = values => ({ passed:values.filter(v=>v.pass).length,total:values.length });
    const dimensions = [...new Set(rows.flatMap(r=>r.checks.map(c=>c.dimension)))];
    const byDimension = Object.fromEntries(dimensions.map(d=>[d,aggregate(rows.flatMap(r=>r.checks.filter(c=>c.dimension===d)))]));
    const categories = [...new Set(rows.map(r=>r.category))];
    const families = [...new Set(rows.map(r=>r.familyId))].map(id=>({ pass:rows.filter(r=>r.familyId===id).every(r=>r.pass) }));
    const times = rows.map(r=>r.durationMs).sort((a,b)=>a-b), quantile = p => times[Math.max(0,Math.ceil(times.length*p)-1)];
    return { schemaVersion:'academic-reference-results/1.0.0', evaluatorVersion:'1.1.0', evaluatedAt:new Date().toISOString(), counts, status:'ENGINEERING_REFERENCE_REPLAY_NOT_CLINICAL_ACCURACY', candidateMode:allowCandidateChange?'CURRENT_CANDIDATE_EXPOSED_REGRESSION':'FROZEN_BASELINE', candidateSha256, changedCandidateFiles, itemResults:aggregate(rows), familyResults:aggregate(families), byCategory:Object.fromEntries(categories.map(c=>[c,aggregate(rows.filter(r=>r.category===c))])), byDimension, localFunctionTimingMs:{p50:quantile(.5),p95:quantile(.95),warning:'Warm offline function timings, not API/network/model latency.'}, egressAttempts, paidModelCalls:0, databaseConnections:0, candidateFreezeSha256:digest(fs.readFileSync(path.join(PACK,'freeze.json'))), evaluatorSha256:digest(fs.readFileSync(__filename)), humanClinicalGrades:'NOT_PERFORMED', blindHumanGrades:'PENDING', superiorityClaim:false, rows };
  } finally {
    for (const key of envNames) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
    globalThis.fetch=oldNetwork.fetch; http.request=oldNetwork.httpRequest;http.get=oldNetwork.httpGet;https.request=oldNetwork.httpsRequest;https.get=oldNetwork.httpsGet;
  }
}
if (require.main === module) run({allowCandidateChange:process.argv.includes('--candidate-current')}).then(result => {
  console.log(JSON.stringify(process.argv.includes('--json') ? result : { itemResults:result.itemResults, familyResults:result.familyResults, byCategory:result.byCategory, egressAttempts:result.egressAttempts, failures:result.rows.filter(r=>!r.pass).map(r=>({id:r.id,failed:r.checks.filter(c=>!c.pass)})), limitation:result.status },null,2));
  if (result.itemResults.passed !== result.itemResults.total || result.egressAttempts) process.exitCode=1;
}).catch(error => { console.error(error.message); process.exitCode=1; });
module.exports = { validatePack, scoreItem, checkFreeze, actionOf, run };
