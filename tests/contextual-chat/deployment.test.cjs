'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..'), backend = createRequire(path.join(root, 'backend/package.json'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('backend container allow-list includes the actual RAG runtime and excludes training/private data', () => {
  const ignore = read('backend/.dockerignore');
  for (const name of ['academicMedicineCatalogue.js', 'chatKnowledge.js', 'healthChatKnowledge.js', 'chatTopicRegistry.js', 'chatReferenceExtensions.js', 'precisionRanker.v1.json']) {
    assert.ok(fs.existsSync(path.join(root, 'backend/data', name))); assert.ok(ignore.split('\n').includes('!data/' + name));
  }
  assert.match(ignore, /^data\/\*$/m); assert.doesNotMatch(ignore, /!data\/precisionTrainingTasks/); assert.match(ignore, /^\.env\.\*$/m);
  assert.match(read('backend/Dockerfile'), /require\('\.\/services\/contextualChatService'\)/);
});
test('web deployment has a fixed same-origin API, streaming proxy and no browser provider credentials', () => {
  const docker = read('deploy/web.Dockerfile'), nginx = read('deploy/nginx.conf'), compose = read('docker-compose.production.example.yml');
  assert.match(docker, /ENV VITE_API_URL=\/api/); assert.doesNotMatch(docker, /ARG .*KEY|ENV .*KEY|VITE_.*KEY/); assert.match(docker, /USER nginx/);
  assert.match(nginx, /proxy_pass http:\/\/api:5001/); assert.match(nginx, /proxy_buffering off/); assert.match(nginx, /proxy_cache off/); assert.match(nginx, /proxy_set_header X-Forwarded-For \$remote_addr/);
  assert.match(nginx, /connect-src 'self'/); assert.match(nginx, /frame-ancestors 'none'/); assert.match(nginx, /access_log off/); assert.match(nginx, /error_log \/dev\/null crit/);
  for (const directive of ['client_body_temp_path', 'proxy_temp_path', 'fastcgi_temp_path', 'uwsgi_temp_path', 'scgi_temp_path']) assert.match(nginx, new RegExp(directive + ' /tmp/'));
  assert.match(compose, /127\.0\.0\.1:8080:8080/); assert.match(compose, /127\.0\.0\.1:5001:5001/); assert.equal((compose.match(/read_only: true/g) || []).length, 2); assert.equal((compose.match(/cap_drop: \[ALL\]/g) || []).length, 2);
  for (const flag of ['RAG_CHAT_LLM_ENABLED', 'RAG_CHAT_PUBLIC_EXPORT_ALLOWED', 'RAG_CHAT_EMBEDDINGS_ENABLED', 'RAG_CHAT_WEB_SYNTHESIS_ALLOWED']) assert.match(compose, new RegExp(flag + ': "false"'));
  assert.doesNotMatch(read('index.html'), /fonts\.googleapis|fonts\.gstatic/);
});
test('updated mail adapter requires TLS, blocks file/URL attachments and composes synthetic mail without sending', async () => {
  const nodemailer = backend('nodemailer');
  const original = nodemailer.createTransport; let config;
  nodemailer.createTransport = value => { config = value; return { sendMail: async () => ({ accepted: [] }) }; };
  try {
    await backend('./utils/sendEmail')({ email: 'synthetic@example.invalid', subject: 'Synthetic test', html: '<p>Synthetic test only</p>' });
    assert.equal(config.requireTLS, true); assert.equal(config.disableUrlAccess, true); assert.equal(config.disableFileAccess, true);
  } finally { nodemailer.createTransport = original; }
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, disableFileAccess: true, disableUrlAccess: true });
  const result = await transport.sendMail({ from: 'synthetic-sender@example.invalid', to: 'synthetic@example.invalid', subject: 'Synthetic offline compatibility test', text: 'No network delivery.' });
  assert.match(result.message.toString(), /Synthetic offline compatibility test/); transport.close();
});
test('production local-only configuration does not require or disclose an unused paid API key', () => {
  const env = { ...process.env }, storage = fs.mkdtempSync(path.join(os.tmpdir(), 'pharmavault-release-env-'));
  try {
    Object.assign(process.env, { NODE_ENV: 'production', MONGO_URI: 'mongodb://127.0.0.1:27017/pharmavault_smoke_test', JWT_SECRET: 'synthetic-config-only-secret-over-32-characters', CORS_ALLOWED_ORIGINS: 'https://preview.example', DOCUMENT_STORAGE_ROOT: storage, RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_EMBEDDINGS_ENABLED: 'false', TRUSTRAG_LLM_ENABLED: 'false' });
    delete process.env.GEMINI_API_KEY;
    const { validateEnv } = backend('./config/envValidator'); assert.doesNotThrow(validateEnv);
    process.env.RAG_CHAT_LLM_ENABLED = 'true'; assert.throws(validateEnv, /GEMINI_API_KEY/);
  } finally { for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]; Object.assign(process.env, env); fs.rmSync(storage, { recursive: true, force: true }); }
});
test('native sign-out calls the revocation endpoint before removing its Keychain token', () => {
  const source = read('ios/PharmaVault/PharmaVault/PharmaVaultApp.swift');
  assert.match(source, /func revokeSessions\(token: String\) async throws/); assert.match(source, /path: "users\/logout", method: "POST", token: token/);
  assert.match(source, /await PharmaVaultAPI\.shared\.revokeSessions\(token: token\)/); assert.match(source, /server sign-out could not be confirmed/); assert.match(source, /Sign out on all devices/);
});
test('real host production smoke includes local RAG and PDF runtime without any provider or database connection', () => {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'pharmavault-release-smoke-'));
  try {
    const result = spawnSync(process.execPath, ['backend/scripts/productionSmoke.js'], { cwd: root, encoding: 'utf8', timeout: 25000, env: { ...process.env, NODE_ENV: 'production', MONGO_URI: 'mongodb://127.0.0.1:27017/pharmavault_smoke_test', JWT_SECRET: 'synthetic-smoke-only-secret-over-32-characters', CORS_ALLOWED_ORIGINS: 'https://preview.example', DOCUMENT_STORAGE_ROOT: storage, GEMINI_API_KEY: '', TRUSTRAG_LLM_ENABLED: 'false', TRUSTRAG_LLM_EXPORT_ALLOWED: 'false', RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'false', RAG_CHAT_EMBEDDINGS_ENABLED: 'false', RAG_CHAT_WEB_ENABLED: 'false', SMOKE_CONTAINER: 'false' } });
    assert.equal(result.status, 0, 'Synthetic runtime smoke must succeed, not be skipped.');
    const report = JSON.parse(result.stdout.trim().split('\n').find(line => line.startsWith('{'))); assert.equal(report.localRagRuntime, 'PASS'); assert.equal(report.realPdfRenderer, 'PASS'); assert.equal(report.databaseConnected, false); assert.equal(report.externalLlmCalled, false);
  } finally { fs.rmSync(storage, { recursive: true, force: true }); }
});
