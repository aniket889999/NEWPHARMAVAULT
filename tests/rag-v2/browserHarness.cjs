'use strict';
// Opt-in controlled extraction-error demo, NOT evidence of an actual OCR mistake.
// All actors/documents are synthetic; authentication and production routes remain enabled.
const projectAudit = process.argv[2] === '--synthetic-project-integration';
if (!projectAudit && process.argv[2] !== '--synthetic-browser-check') throw new Error('Explicit synthetic-browser-check opt-in required.');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), readline = require('node:readline');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..'), backend = createRequire(path.join(root, 'backend/package.json'));
const mongoose = backend('mongoose'), jwt = backend('jsonwebtoken');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pharmavault-s4-browser-'));
process.env.NODE_ENV = 'test'; process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_integration_v2_test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex'); process.env.GEMINI_API_KEY = 'synthetic-unused';
process.env.CORS_ALLOWED_ORIGINS = 'http://127.0.0.1:5175'; process.env.FRONTEND_URL = 'http://127.0.0.1:5175';
process.env.DOCUMENT_STORAGE_ROOT = path.join(temporary, 'documents');
for (const flag of ['TRUSTRAG_LLM_ENABLED', 'TRUSTRAG_LLM_EXPORT_ALLOWED', 'RAG_CHAT_LLM_ENABLED', 'RAG_CHAT_PUBLIC_EXPORT_ALLOWED', 'RAG_CHAT_EMBEDDINGS_ENABLED']) process.env[flag] = 'false';
const { assertTestDatabase } = backend('./utils/testDatabaseGuard.js'); assertTestDatabase(process.env.MONGO_URI);
const User = backend('./models/userModel.js'), Org = backend('./models/organizationModel.js'), Case = backend('./models/verificationCaseModel.js');
const Doc = backend('./models/documentModel.js'), Field = backend('./models/extractedFieldModel.js');
const modelPaths = ['evidenceItem', 'consistencyCheck', 'riskSignal', 'reviewDecision', 'auditEvent'];
const childModels = [Doc, Field, ...modelPaths.map(name => backend('./models/' + name + 'Model.js'))];
let server, vite, org, closing = false; const users = [], cases = [];
const password = 'synthetic-s4-browser-only-pass';
async function cleanup() {
  if (closing) return; closing = true;
  if (vite) await vite.close();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  if (mongoose.connection.readyState === 1) {
    assertTestDatabase(mongoose.connection);
    const owned = (await Case.find({ _id: { $in: cases }, organizationId: org?._id, createdBy: { $in: users } }).select('_id')).map(c => c._id);
    for (const M of childModels) await M.deleteMany({ caseId: { $in: owned } });
    await Case.deleteMany({ _id: { $in: owned } }); await User.deleteMany({ _id: { $in: users } });
    if (org) await Org.deleteOne({ _id: org._id }); await mongoose.disconnect();
  }
  if (path.dirname(temporary) !== os.tmpdir() || !path.basename(temporary).startsWith('pharmavault-s4-browser-')) throw new Error('Invalid fixture teardown target.');
  fs.rmSync(temporary, { recursive: true, force: true });
  console.log(JSON.stringify({ stopped: true, cleanup: 'Only this run\'s synthetic accounts, cases and temporary assets removed.' }));
}
async function main() {
  // Require only after isolation and egress flags are set. No .env is loaded.
  const app = backend('./app.js');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2000 }); assertTestDatabase(mongoose.connection);
  const run = new mongoose.Types.ObjectId().toString(), owner = new mongoose.Types.ObjectId();
  org = await Org.create({ name: 'SYNTHETIC S4 Browser ' + run, owner, plan: 'Enterprise', status: 'active' });
  const accounts = {};
  for (const role of (projectAudit ? ['patient', 'pharmacist', 'pharmacy', 'research_evaluator', 'super_admin'] : ['patient', 'pharmacist'])) {
    const user = await User.create({ name: 'SYNTHETIC ' + role, email: role + '.' + run + '@example.invalid', password, role, organizationId: org._id });
    users.push(user._id); accounts[role] = user.email;
  }
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const api = 'http://127.0.0.1:' + server.address().port + '/api';
  if (projectAudit) {
    const checks = { patient: ['/v1/chat/status', '/v1/cases', '/medicines', '/orders/myorders', '/prescriptions/my-prescriptions', '/reminders/my-reminders', '/intelligence/timeline', '/intelligence/adherence', '/intelligence/refill-risk', '/intelligence/insights', '/intelligence/patient-graph', '/pharmacy/nearby?medicine=synthetic&lat=19.075&lng=72.875'],
      pharmacy: ['/pharmacy/intelligence', '/regulatory/pharmacy-status', '/pharmacy/expiry-risk', '/pharmacy/stock-risk', '/pharmacy/prescription-queue', '/orders', '/blockchain/ledger', '/blockchain/integrity-check', '/pharmacy-intelligence/forecast', '/pharmacy-intelligence/dead-stock', '/pharmacy-intelligence/reorder', '/pharmacy-intelligence/suppliers', '/pharmacy-intelligence/seasonal', '/workflows/active', '/workflows/priorities', '/workflows/audit', '/organizations/me', '/branches'],
      research_evaluator: ['/graph/medicine/paracetamol'], super_admin: ['/organizations', '/safety/audit-summary', '/safety/audit-logs'] };
    const results = [];
    for (const [role, endpoints] of Object.entries(checks)) {
      const index = ['patient', 'pharmacist', 'pharmacy', 'research_evaluator', 'super_admin'].indexOf(role);
      const token = jwt.sign({ id: String(users[index]) }, process.env.JWT_SECRET, { expiresIn: '2h' });
      for (const endpoint of endpoints) {
        const response = await fetch(api + endpoint, { headers: { Authorization: 'Bearer ' + token } });
        await response.arrayBuffer(); results.push({ role, endpoint, status: response.status });
      }
    }
    console.log(JSON.stringify({ projectReadSmoke: results, boundary: 'HTTP read availability on empty synthetic tenant only, not functionality or real-world validity.' }));
  }
  const headers = { Authorization: 'Bearer ' + jwt.sign({ id: String(users[1]) }, process.env.JWT_SECRET, { expiresIn: '2h' }), 'Content-Type': 'application/json' };
  const post = async (endpoint, body, method = 'POST') => {
    const r = await fetch(api + endpoint, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const data = await r.json(); if (!r.ok) throw new Error('Fixture request failed: ' + r.status + ' ' + (data.code || 'controlled error')); return data;
  };
  const created = await post('/v1/cases', { subjectReference: 'SYNTHETIC controlled extraction error — not actual OCR output' });
  const caseId = created.id || created._id; cases.push(caseId);
  const canvasRequire = createRequire(backend.resolve('pdf-to-img')), { createCanvas } = canvasRequire('@napi-rs/canvas');
  function image(type) {
    const canvas = createCanvas(1200, 380), context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 1200, 380); context.fillStyle = '#111111'; context.font = '25px Arial';
    ['SYNTHETIC DEMO ONLY — NOT VALID FOR MEDICAL USE', type, type === 'PRESCRIPTION' ? 'Paracetamol 650 mg tablet Qty: 10 tablets' : 'Dolo 650 mg tablet Qty: 10 tablets', 'Source date: 2026-11-01'].forEach((line, i) => context.fillText(line, 30, 60 + 75 * i));
    return canvas.toBuffer('image/png');
  }
  let strengthFieldId, invoiceTotalFieldId;
  for (const type of ['PRESCRIPTION', 'PHARMACY_INVOICE']) {
    const uploaded = await post('/v1/cases/' + caseId + '/documents', { type, filename: 'SYNTHETIC-' + type + '.png', mimeType: 'image/png', file: 'data:image/png;base64,' + image(type).toString('base64') });
    const docId = uploaded.id || uploaded._id;
    await Doc.updateOne({ _id: docId, caseId }, { $set: { processingStatus: 'PROCESSED', pageCount: 1, processedPageCount: 1, omittedPageCount: 0, pageCoverage: { total: 1, processed: 1, omitted: 0, status: 'COMPLETE' } } });
    const values = { medicine_name: type === 'PRESCRIPTION' ? 'Paracetamol' : 'Dolo', dosage_strength: type === 'PRESCRIPTION' ? '500 mg' : '650 mg', dosage_form: 'tablet', quantity: '10', quantity_unit: 'tablet' };
    const fields = await Field.insertMany(Object.entries(values).map(([fieldType, value]) => ({
      caseId, documentId: docId, fieldType, rawValue: value, normalizedValue: value, pageNumber: 1,
      extractionMethod: 'SYNTHETIC_CONTROLLED_EXTRACTION_ERROR', extractionConfidence: 0.95, needsCorrection: false,
      boundingBox: null, candidateRowKey: 'row_1'
    })));
    if (type === 'PRESCRIPTION') strengthFieldId = String(fields.find(f => f.fieldType === 'dosage_strength')._id);
    else invoiceTotalFieldId = String((await Field.create({ caseId, documentId: docId, fieldType: 'total_amount', rawValue: '100', normalizedValue: '100', pageNumber: 1, extractionMethod: 'SYNTHETIC_CONTROLLED_EXTRACTION_ERROR', extractionConfidence: 0.95, needsCorrection: false }))._id);
    const groups = [{ anchorFieldId: String(fields.find(f => f.fieldType === 'medicine_name')._id), fieldIds: fields.map(f => String(f._id)) }];
    await Doc.updateOne({ _id: docId, caseId }, { $set: { metadata: { detectedRowCount: 1, proposedMedicineGrouping: { groups }, extractionBlockers: [] } } });
  }
  await Case.updateOne({ _id: caseId }, { $set: { status: 'NEEDS_REVIEW', reviewRequired: true } });
  // Scripted fixture grouping is explicitly not a real professional's attestation.
  for (const doc of await Doc.find({ caseId })) {
    const snapshot = await post('/v1/cases/' + caseId + '/reconciliation', undefined, 'GET');
    await post('/v1/cases/' + caseId + '/documents/' + doc._id + '/medicine-groups',
      { snapshotToken: snapshot.snapshotToken, observedItemCount: 1, completenessAttested: true, groups: doc.metadata.proposedMedicineGrouping.groups }, 'PUT');
  }
  const { createServer } = await import('vite'), react = (await import('@vitejs/plugin-react')).default;
  vite = await createServer({ configFile: false, root, envDir: temporary, cacheDir: path.join(temporary, 'vite-cache'), mode: 'test', plugins: [react()],
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify(api) }, server: { host: '127.0.0.1', port: 5175, strictPort: true } });
  await vite.listen();
  console.log(JSON.stringify({ ready: true, frontend: 'http://127.0.0.1:5175', caseUrl: 'http://127.0.0.1:5175/assistant?caseId=' + caseId,
    api, accounts, password, caseId, strengthFieldId, invoiceTotalFieldId,
    fixtureBoundary: 'Images show 650 mg; prescription extraction deliberately seeded as 500 mg with synthetic confidence. No actual OCR mistake or human attestation is claimed.', commands: ['status', 'cleanup'] }));
  const input = readline.createInterface({ input: process.stdin });
  input.on('line', async line => {
    if (line.trim() === 'cleanup') { input.close(); await cleanup(); process.exit(0); }
    if (line.trim() === 'status') console.log(JSON.stringify({ case: await Case.findOne({ _id: caseId, organizationId: org._id }).select('status evidenceRevision') }));
  });
}
process.on('SIGINT', () => cleanup().then(() => process.exit(0))); process.on('SIGTERM', () => cleanup().then(() => process.exit(0)));
main().catch(async () => { console.error('Synthetic browser fixture did not start; check the accepted backend and disposable local services.'); await cleanup(); process.exit(1); });
