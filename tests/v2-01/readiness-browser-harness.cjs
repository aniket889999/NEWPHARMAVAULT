'use strict';
// GPT's small UI smoke fixture; not Gemini's full browser/OCR acceptance suite.
if (process.argv[2] !== '--synthetic-readiness-ui') throw new Error('Explicit synthetic readiness fixture opt-in required.');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), readline = require('node:readline');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..'), backend = createRequire(path.join(root, 'backend/package.json'));
const mongoose = backend('mongoose');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pharmavault-v2-readiness-'));
Object.assign(process.env, { NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/pharmavault_smoke_test', JWT_SECRET: crypto.randomBytes(32).toString('hex'), GEMINI_API_KEY: 'synthetic-unused',
  FRONTEND_URL: 'http://127.0.0.1:5176', CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:5176', DOCUMENT_STORAGE_ROOT: path.join(temp, 'documents') });
for (const key of ['RAG_CHAT_LLM_ENABLED', 'RAG_CHAT_PUBLIC_EXPORT_ALLOWED', 'RAG_CHAT_EMBEDDINGS_ENABLED', 'TRUSTRAG_LLM_ENABLED', 'TRUSTRAG_LLM_EXPORT_ALLOWED']) process.env[key] = 'false';
const { assertTestDatabase } = backend('./utils/testDatabaseGuard'); assertTestDatabase(process.env.MONGO_URI);
const User = backend('./models/userModel'), Org = backend('./models/organizationModel'), Case = backend('./models/verificationCaseModel');
const children = ['document', 'extractedField', 'evidenceItem', 'consistencyCheck', 'riskSignal', 'reviewDecision', 'auditEvent'].map(name => backend('./models/' + name + 'Model'));
const users = []; let org, server, vite, closing = false;
async function cleanup() {
  if (closing) return; closing = true;
  if (vite) await vite.close();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  if (mongoose.connection.readyState === 1) {
    assertTestDatabase(mongoose.connection);
    const ids = org ? (await Case.find({ organizationId: org._id, createdBy: { $in: users } }).select('_id')).map(value => value._id) : [];
    for (const Model of children) await Model.deleteMany({ caseId: { $in: ids } });
    await Case.deleteMany({ _id: { $in: ids } }); await User.deleteMany({ _id: { $in: users } });
    if (org) await Org.deleteOne({ _id: org._id }); await mongoose.disconnect();
  }
  if (path.dirname(temp) !== os.tmpdir() || !path.basename(temp).startsWith('pharmavault-v2-readiness-')) throw new Error('Invalid temporary cleanup target.');
  fs.rmSync(temp, { recursive: true, force: true });
  console.log(JSON.stringify({ stopped: true, cleanup: 'Only this GPT readiness run\'s synthetic accounts, cases and temporary assets removed.' }));
}
async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2000 }); assertTestDatabase(mongoose.connection);
  const run = new mongoose.Types.ObjectId().toString();
  org = await Org.create({ name: 'SYNTHETIC V2 Readiness ' + run, owner: new mongoose.Types.ObjectId(), plan: 'Enterprise', status: 'active' });
  const email = 'patient.' + run + '@example.invalid', password = 'synthetic-v2-readiness-only-pass';
  const user = await User.create({ name: 'SYNTHETIC readiness patient', email, password, role: 'patient', organizationId: org._id }); users.push(user._id);
  const record = await Case.create({ organizationId: org._id, createdBy: user._id, status: 'DRAFT', reviewRequired: false });
  const app = backend('./app');
  server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  const api = 'http://127.0.0.1:' + server.address().port + '/api';
  const { createServer } = await import('vite'), react = (await import('@vitejs/plugin-react')).default;
  vite = await createServer({ root, configFile: false, envDir: temp, cacheDir: path.join(temp, 'vite-cache'), plugins: [react()],
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify(api) }, server: { host: '127.0.0.1', port: 5176, strictPort: true } });
  await vite.listen();
  console.log(JSON.stringify({ ready: true, frontend: 'http://127.0.0.1:5176', api, email, password, caseId: String(record._id),
    fixtureBoundary: 'Synthetic local-only provider-state UI smoke; no OCR, live provider or full browser acceptance is claimed.', commands: ['cleanup'] }));
  const input = readline.createInterface({ input: process.stdin });
  input.on('line', async line => { if (line.trim() === 'cleanup') { input.close(); await cleanup(); process.exit(0); } });
}
process.once('SIGINT', () => cleanup().then(() => process.exit(0))); process.once('SIGTERM', () => cleanup().then(() => process.exit(0)));
main().catch(async () => { console.error('Synthetic readiness UI fixture could not start.'); await cleanup(); process.exit(1); });
