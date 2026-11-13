'use strict';
// Explicit opt-in local browser fixture. Never connects to a development database or reads .env.
if (process.argv[2] !== '--synthetic-browser-check') throw new Error('Explicit synthetic-browser-check opt-in required.');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const backend = createRequire(path.join(root, 'backend/package.json'));
const mongoose = backend('mongoose');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pharmavault-s3-browser-'));
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_integration_v2_test';
process.env.JWT_SECRET = 'synthetic-browser-session3-only-not-a-deployed-secret';
process.env.GEMINI_API_KEY = 'synthetic-browser-unused-key';
process.env.CORS_ALLOWED_ORIGINS = 'http://127.0.0.1:5174';
process.env.FRONTEND_URL = 'http://127.0.0.1:5174';
process.env.DOCUMENT_STORAGE_ROOT = path.join(temp, 'documents');
process.env.TRUSTRAG_LLM_ENABLED = 'false';
process.env.TRUSTRAG_LLM_EXPORT_ALLOWED = 'false';
process.env.RAG_CHAT_LLM_ENABLED = 'false';
process.env.RAG_CHAT_EMBEDDINGS_ENABLED = 'false';
const { assertTestDatabase } = backend('./utils/testDatabaseGuard.js');
assertTestDatabase(process.env.MONGO_URI);
const app = backend('./app.js');
const User = backend('./models/userModel.js');
const Org = backend('./models/organizationModel.js');
const Case = backend('./models/verificationCaseModel.js');
const Audit = backend('./models/auditEventModel.js');
const Review = backend('./models/reviewDecisionModel.js');
const Doc = backend('./models/documentModel.js');
const Field = backend('./models/extractedFieldModel.js');
const Evidence = backend('./models/evidenceItemModel.js');
const Check = backend('./models/consistencyCheckModel.js');
const Risk = backend('./models/riskSignalModel.js');
const users = []; let org, server, vite, closing = false, staffToken;
const password = 'synthetic-browser-only-pass';

async function cleanup() {
  if (closing) return; closing = true;
  if (vite) await vite.close();
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.readyState === 1) {
    assertTestDatabase(mongoose.connection);
    const ids = org ? (await Case.find({ organizationId: org._id, createdBy: { $in: users } }).select('_id')).map(item => item._id) : [];
    for (const Model of [Field, Doc, Evidence, Check, Risk, Audit, Review]) await Model.deleteMany({ caseId: { $in: ids } });
    await Case.deleteMany({ _id: { $in: ids } });
    await User.deleteMany({ _id: { $in: users } });
    if (org) await Org.deleteOne({ _id: org._id });
    await mongoose.disconnect();
  }
  fs.rmSync(temp, { recursive: true, force: true });
  console.log(JSON.stringify({ stopped: true, cleanup: 'Only this run\'s synthetic accounts, cases and temporary assets removed.' }));
}
async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2000 });
  assertTestDatabase(mongoose.connection);
  const run = new mongoose.Types.ObjectId().toString();
  org = await Org.create({ name: `SYNTHETIC Browser Check ${run}`, owner: new mongoose.Types.ObjectId(), plan: 'Enterprise', status: 'active' });
  const accounts = {};
  for (const role of ['patient', 'pharmacist']) {
    const email = `${role}.${run}@example.com`;
    const user = await User.create({ name: `SYNTHETIC ${role}`, email, password, role, organizationId: org._id });
    users.push(user._id); accounts[role] = email;
  }
  const canvasRequire = createRequire(backend.resolve('pdf-to-img'));
  const { createCanvas } = canvasRequire('@napi-rs/canvas');
  function image(name, rows) {
    const canvas = createCanvas(1100, 400), context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 1100, 400);
    context.fillStyle = '#000000'; context.font = '24px Arial';
    context.fillText('SYNTHETIC DEMO ONLY - NOT VALID FOR MEDICAL USE', 30, 48);
    context.font = '28px Arial';
    rows.forEach((line, index) => context.fillText(line, 40, 110 + index * 78));
    const file = path.join(temp, name); fs.writeFileSync(file, canvas.toBuffer('image/png')); return file;
  }
  const assets = {
    prescription: image('SYNTHETIC_RX.png', ['Date: 2026-05-10', '1. Paracetamol 650 mg tablet Qty: 10 tablets', '2. Azithromycin 500 mg tablet Qty: 3 tablets']),
    invoice: image('SYNTHETIC_INVOICE.png', ['Date: 2026-05-11', '1. Azee 500 mg tablet Qty: 3 tablets', '2. Dolo 650 mg tablet Qty: 10 tablets']),
    mismatchInvoice: image('SYNTHETIC_STRENGTH_MISMATCH.png', ['Date: 2026-05-11', '1. Azee 500 mg tablet Qty: 3 tablets', '2. Paracetamol 500 mg tablet Qty: 10 tablets'])
  };
  server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  const api = `http://127.0.0.1:${server.address().port}/api`;
  const login = await fetch(api + '/users/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: accounts.pharmacist, password, role: 'pharmacist' }) });
  if (!login.ok) throw new Error('Synthetic fixture login failed.');
  staffToken = (await login.json()).token;
  const { createServer } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;
  vite = await createServer({ configFile: false, root, envDir: temp, cacheDir: path.join(temp, 'vite-cache'), mode: 'test', plugins: [react()], define: { 'import.meta.env.VITE_API_URL': JSON.stringify(api) }, server: { host: '127.0.0.1', port: 5174, strictPort: true } });
  await vite.listen();
  console.log(JSON.stringify({ ready: true, frontend: 'http://127.0.0.1:5174', api, accounts, password, assets, database: 'pharmavault_integration_v2_test', commands: ['status', 'reconfirm <caseId>', 'restart', 'cleanup'] }));
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async line => {
    try {
      if (line.trim() === 'cleanup') { rl.close(); await cleanup(); process.exit(0); }
      if (line.trim() === 'restart') {
        const port = server.address().port;
        await new Promise(resolve => server.close(resolve));
        delete require.cache[backend.resolve('./app.js')];
        delete require.cache[backend.resolve('./config/productionSecurity.js')];
        const freshApp = backend('./app.js');
        server = await new Promise(resolve => { const listening = freshApp.listen(port, '127.0.0.1', () => resolve(listening)); });
        return console.log(JSON.stringify({ restarted: true, api }));
      }
      const cases = await Case.find({ organizationId: org._id, createdBy: { $in: users } }).select('_id caseReference subjectReference status');
      if (line.trim() === 'status') return console.log(JSON.stringify({ cases }));
      if (line.startsWith('reconfirm ')) {
        const id = line.slice(10).trim();
        if (!cases.some(value => String(value._id) === id)) throw new Error('Only this fixture run\'s cases are permitted.');
        const headers = { Authorization: `Bearer ${staffToken}`, 'Content-Type': 'application/json' };
        const snapshot = await (await fetch(`${api}/v1/cases/${id}/reconciliation`, { headers })).json();
        const doc = snapshot.groupingDocuments.find(value => value.mode === 'HUMAN_CONFIRMED');
        if (!doc) throw new Error('Confirm groups in the browser first.');
        const response = await fetch(`${api}/v1/cases/${id}/documents/${doc.documentId}/medicine-groups`, { method: 'PUT', headers, body: JSON.stringify({ snapshotToken: snapshot.snapshotToken, observedItemCount: doc.observedItemCount, completenessAttested: true, groups: doc.groups }) });
        console.log(JSON.stringify({ action: 'reconfirm', status: response.status, evidenceRevision: (await response.json()).evidenceRevision }));
      }
    } catch (error) { console.error(JSON.stringify({ commandError: error.message })); }
  });
}
process.on('SIGTERM', () => cleanup().then(() => process.exit(0)));
process.on('SIGINT', () => cleanup().then(() => process.exit(0)));
main().catch(async error => { console.error(error.message); await cleanup(); process.exit(1); });
