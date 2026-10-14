const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const environmentKeys = [
  'NODE_ENV', 'CORS_ALLOWED_ORIGINS', 'FRONTEND_URL', 'JWT_SECRET',
  'DOCUMENT_STORAGE_ROOT', 'TRUST_PROXY', 'GEMINI_API_KEY',
  'TRUSTRAG_LLM_ENABLED', 'TRUSTRAG_LLM_EXPORT_ALLOWED'
];
const originalEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));
test.afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const evidenceID = '650000000000000000000001';
function adversarialContext() {
  const privateText = 'Asha Patient, 19 Secret Street, asha@example.org, 9876543210, token-private';
  return {
    vCase: { status: 'NEEDS_REVIEW', subjectReference: privateText },
    documents: [{ type: 'PRESCRIPTION', originalFilename: `${privateText}.pdf`, file: privateText }],
    fields: [{ rawValue: privateText }],
    evidenceItems: [{
      _id: evidenceID, sourceType: 'CASE_DOCUMENT', evidenceText: privateText,
      claimSupported: privateText, sourceLabel: privateText,
      sourceUrl: `https://example.org/${privateText}`, arbitrary: privateText
    }],
    checks: [{
      checkType: 'DOSAGE_STRENGTH_CONSISTENCY', status: 'FAIL',
      message: privateText, evidenceItemIds: [evidenceID]
    }],
    signals: [{
      signalType: 'MEDICINE_STRENGTH_MISMATCH', severity: 'HIGH',
      description: privateText, evidenceItemIds: [evidenceID]
    }]
  };
}

test('untrusted nested selectors/prototype keys are rejected while ordinary chat text remains valid', () => {
  const { assertSafeRequestObject } = require('../config/requestSecurity');
  for (const input of [
    { email: { $ne: null } }, { metadata: { nested: { $where: 'attack' } } },
    JSON.parse('{"__proto__":{"admin":true}}'), { 'user.role': 'admin' }
  ]) assert.throws(() => assertSafeRequestObject(input), /prohibited/);
  assert.doesNotThrow(() => assertSafeRequestObject({ message: 'Price is $5.00', metadata: { note: 'safe' }, history: [{ role: 'user' }] }));
  let deep = {};
  for (let i = 0; i < 40; i++) deep = { nested: deep };
  assert.throws(() => assertSafeRequestObject(deep), /limits/);
});

test('trusted review-queue operators cast correctly with the production database policy', () => {
  const { configureDatabaseSecurity } = require('../config/db');
  const VerificationCase = require('../models/verificationCaseModel');
  configureDatabaseSecurity();
  const query = VerificationCase.find({ status: { $in: ['NEEDS_REVIEW', 'NEEDS_CORRECTION'] } });
  query._castConditions();
  assert.ifError(query.error());
  assert.deepEqual(query.getFilter().status.$in, ['NEEDS_REVIEW', 'NEEDS_CORRECTION']);
});

test('actual HTTP boundary denies selectors, preserves safe headers, and keeps native protected routes authenticated', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pharmavault-u2-http-'));
  try {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example';
    process.env.JWT_SECRET = 'synthetic-test-secret-with-at-least-32-characters';
    process.env.DOCUMENT_STORAGE_ROOT = root;
    const app = require('../app');
    const health = await request(app).get('/api/health').set('Origin', 'https://app.example');
    assert.equal(health.status, 200);
    assert.equal(health.headers['x-powered-by'], undefined);
    assert.equal(health.headers['cache-control'], 'no-store, max-age=0');
    assert.equal(health.headers['x-content-type-options'], 'nosniff');
    assert.match(health.headers['strict-transport-security'], /max-age=31536000/);
    const denied = await request(app).post('/api/users/login').send({ email: { $ne: null }, password: 'synthetic' });
    assert.equal(denied.status, 400);
    const queryDenied = await request(app).get('/api/health?filter%5B%24ne%5D=value');
    assert.equal(queryDenied.status, 400);
    assert.equal((await request(app).get('/api/v1/cases')).status, 401);
    const readiness = await request(app).get('/api/ready');
    assert.equal(readiness.status, 503);
    assert.deepEqual(readiness.body, { status: 'NOT_READY' });
    for (const legacyPath of ['/api/chat/vision-ocr', '/api/prescriptions/analyze', '/api/agents/orchestrate', '/api/language/translate']) {
      assert.equal((await request(app).post(legacyPath).send({})).status, 404);
    }
    const badOrigin = await request(app).get('/api/health').set('Origin', 'https://untrusted.example');
    assert.equal(badOrigin.status, 403);
    assert.equal(badOrigin.headers['cache-control'], 'no-store, max-age=0');
    const invalidJSON = await request(app).post('/api/users/login').set('Content-Type', 'application/json').send('{"private-patient":broken');
    assert.equal(invalidJSON.status, 400);
    assert.equal(invalidJSON.body.message, 'Invalid JSON request.');
    assert.equal(JSON.stringify(invalidJSON.body).includes('private-patient'), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('outbound LLM allow-list excludes adversarial names, documents, free text, persistent IDs and filenames', () => {
  const { buildStructuredEvidencePayload } = require('../config/llmExportPolicy');
  const result = buildStructuredEvidencePayload(adversarialContext());
  assert.deepEqual(result.payload, {
    evidence: [{ evidenceId: 'E1', sourceType: 'CASE_DOCUMENT' }],
    checks: [{ checkType: 'DOSAGE_STRENGTH_CONSISTENCY', status: 'FAIL', evidenceItemIds: ['E1'] }],
    signals: [{ signalType: 'MEDICINE_STRENGTH_MISMATCH', severity: 'HIGH', evidenceItemIds: ['E1'] }]
  });
  const exported = JSON.stringify(result.payload);
  for (const forbidden of ['Asha', 'Secret Street', 'asha@example.org', '9876543210', 'token-private', evidenceID, 'originalFilename', 'evidenceText']) {
    assert.equal(exported.includes(forbidden), false);
  }
});

test('unsupported enum values and unsupported evidence references cannot enter the outbound payload', () => {
  const { buildStructuredEvidencePayload } = require('../config/llmExportPolicy');
  const context = adversarialContext();
  context.checks.push({ checkType: 'Asha Patient', status: 'FAIL', evidenceItemIds: [evidenceID] });
  context.signals.push({ signalType: 'MISSING_REQUIRED_FIELD', severity: 'HIGH', evidenceItemIds: ['650000000000000000000099'] });
  context.evidenceItems.push({ _id: '650000000000000000000009', sourceType: 'private-patient-name' });
  const { payload } = buildStructuredEvidencePayload(context);
  assert.equal(payload.evidence.length, 1);
  assert.equal(payload.checks.length, 1);
  assert.equal(payload.signals.length, 1);
});

test('external LLM summaries require both explicit flags and never run when either is disabled', async () => {
  const service = require('../services/trustRag/llmExplainabilityService');
  const originalCall = service._callGeminiExplainer;
  let calls = 0;
  service._callGeminiExplainer = async () => { calls += 1; throw new Error('Must not call.'); };
  try {
    process.env.GEMINI_API_KEY = 'synthetic-test-key';
    for (const flags of [['false', 'false'], ['true', 'false'], ['false', 'true']]) {
      process.env.TRUSTRAG_LLM_ENABLED = flags[0];
      process.env.TRUSTRAG_LLM_EXPORT_ALLOWED = flags[1];
      const result = await service.generateExplanation(adversarialContext());
      assert.equal(result.generatedBy, 'DETERMINISTIC_ENGINE');
    }
    assert.equal(calls, 0);
  } finally { service._callGeminiExplainer = originalCall; }
});

test('SDK prompt contains only structural data and evidence aliases are mapped back locally', async () => {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const service = require('../services/trustRag/llmExplainabilityService');
  const originalModel = GoogleGenerativeAI.prototype.getGenerativeModel;
  let captured;
  GoogleGenerativeAI.prototype.getGenerativeModel = () => ({
    async generateContent(prompt) {
      captured = prompt;
      return { response: { text: () => JSON.stringify({
        summary: 'A dosage strength check failed.',
        findings: [{ statement: 'Dosage strength check failed.', status: 'DISCREPANCY', evidenceItemIds: ['E1'] }],
        evidenceItemIds: ['E1'], uncertainty: 'HIGH'
      }) } };
    }
  });
  try {
    process.env.GEMINI_API_KEY = 'synthetic-test-key';
    const result = await service._callGeminiExplainer(adversarialContext());
    assert.equal(captured.includes('Asha'), false);
    assert.equal(captured.includes(evidenceID), false);
    assert.equal(captured.includes('token-private'), false);
    assert.deepEqual(result.evidenceItemIds, [evidenceID]);
    assert.deepEqual(result.findings[0].evidenceItemIds, [evidenceID]);
  } finally { GoogleGenerativeAI.prototype.getGenerativeModel = originalModel; }
});

test('unknown evidence aliases are rejected and provider failures never leak their error content to logs', async () => {
  const { mapEvidenceAliases } = require('../config/llmExportPolicy');
  assert.throws(() => mapEvidenceAliases({ findings: [{ evidenceItemIds: ['E99'] }], evidenceItemIds: ['E99'] }, new Map([['E1', evidenceID]])), /evidence reference/);
  const service = require('../services/trustRag/llmExplainabilityService');
  const originalCall = service._callGeminiExplainer;
  const originalWarn = console.warn;
  const logs = [];
  service._callGeminiExplainer = async () => { throw new Error('provider-secret-key-and-private-text'); };
  console.warn = message => logs.push(message);
  try {
    process.env.GEMINI_API_KEY = 'synthetic-test-key';
    process.env.TRUSTRAG_LLM_ENABLED = 'true';
    process.env.TRUSTRAG_LLM_EXPORT_ALLOWED = 'true';
    const result = await service.generateExplanation(adversarialContext());
    assert.match(result.generatedBy, /LLM_ERROR_FALLBACK/);
    assert.equal(JSON.stringify(logs).includes('provider-secret-key'), false);
  } finally { service._callGeminiExplainer = originalCall; console.warn = originalWarn; }
});

test('configured storage uses private file permissions and safe failures without path disclosure', async () => {
  const { getDocumentStorageRoot } = require('../config/documentStorage');
  assert.throws(() => getDocumentStorageRoot({ NODE_ENV: 'production' }), /required/);
  assert.throws(() => getDocumentStorageRoot({ DOCUMENT_STORAGE_ROOT: 'private-relative-path' }), error => !error.message.includes('private-relative-path'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pharmavault-u2-storage-'));
  const storage = require('../services/trustRag/storageService');
  const originalRoot = storage.storageRoot;
  try {
    storage.storageRoot = getDocumentStorageRoot({ DOCUMENT_STORAGE_ROOT: root, NODE_ENV: 'production' });
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    const uploaded = await storage.storeDocument({ caseId: evidenceID, filename: 'synthetic.jpg', content: `data:image/jpeg;base64,${bytes.toString('base64')}` });
    assert.deepEqual(await storage.getDocumentBuffer(evidenceID, uploaded.objectStorageKey), bytes);
    assert.equal(fs.statSync(uploaded.localPath).mode & 0o077, 0);
    await assert.rejects(storage.getDocumentBuffer('../outside-root', uploaded.objectStorageKey), /unavailable/);
    const unavailable = path.join(root, 'not-a-folder');
    fs.writeFileSync(unavailable, 'synthetic');
    storage.storageRoot = unavailable;
    await assert.rejects(storage.storeDocument({ caseId: evidenceID, filename: 'synthetic.jpg', content: `data:image/jpeg;base64,${bytes.toString('base64')}` }), error => error.statusCode === 503 && !error.message.includes(root));
  } finally { storage.storageRoot = originalRoot; fs.rmSync(root, { recursive: true, force: true }); }
});

test('unexpected production errors never include private paths, credentials or stack traces', () => {
  process.env.NODE_ENV = 'production';
  const { errorHandler } = require('../middleware/errorMiddleware');
  const err = new Error('private filesystem path and credential');
  err.statusCode = 503;
  let response;
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { response = body; } };
  errorHandler(err, {}, res, () => {});
  assert.equal(res.statusCode, 503);
  assert.equal(response.message, 'An unexpected server error occurred.');
  assert.equal(response.stack, null);
});
