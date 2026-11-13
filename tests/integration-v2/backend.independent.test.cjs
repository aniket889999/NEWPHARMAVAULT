'use strict';
// Independent router regressions. Only synthetic seeded records and this exact disposable DB.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const backend = createRequire(path.join(root, 'backend/package.json'));
const request = backend('supertest');
const mongoose = backend('mongoose');
const jwt = backend('jsonwebtoken');
const tempStorage = fs.mkdtempSync(path.join(os.tmpdir(), 'pharmavault-s3-independent-'));
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_integration_v2_test';
process.env.JWT_SECRET = 'synthetic-session3-independent-test-secret';
process.env.GEMINI_API_KEY = 'synthetic-test-key-not-for-network';
process.env.TRUSTRAG_ALLOW_EXTERNAL_AI = 'false';
process.env.TRUSTRAG_USE_LLM_EXPLANATIONS = 'false';
process.env.CORS_ALLOWED_ORIGINS = 'http://127.0.0.1:5173';
process.env.DOCUMENT_STORAGE_ROOT = tempStorage;
const { assertTestDatabase } = backend('./utils/testDatabaseGuard.js');
assertTestDatabase(process.env.MONGO_URI);
const app = backend('./app.js');
const User = backend('./models/userModel.js');
const Organization = backend('./models/organizationModel.js');
const Case = backend('./models/verificationCaseModel.js');
const Document = backend('./models/documentModel.js');
const Field = backend('./models/extractedFieldModel.js');
const Audit = backend('./models/auditEventModel.js');
const Review = backend('./models/reviewDecisionModel.js');
const Evidence = backend('./models/evidenceItemModel.js');
const Check = backend('./models/consistencyCheckModel.js');
const Risk = backend('./models/riskSignalModel.js');
const { withCaseMutationGuard } = backend('./services/trustRag/caseEvidenceMutationService.js');
const { loadScenarios } = require('../foundation-v2/fixtures.cjs');
const { loadClient } = require('./load-client.cjs');
const { parseCaseSnapshot } = loadClient('integration/snapshot.ts');

test('GPT independent Session 3 contract edge cases', async t => {
  const cases = [], users = [], organizations = [];
  let connection, patient, pharmacist, organization, token;
  const url = caseId => `/api/v1/cases/${caseId}`;
  t.before(async () => {
    connection = await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2000 });
    assertTestDatabase(connection);
    organization = await Organization.create({ name: 'SYNTHETIC independent Session 3 org', owner: new mongoose.Types.ObjectId(), plan: 'Enterprise', status: 'active' });
    organizations.push(organization._id);
    const unique = new mongoose.Types.ObjectId().toString();
    patient = await User.create({ name: 'SYNTHETIC Submitter', email: `submitter.${unique}@example.com`, password: 'synthetic-test-only', role: 'patient', organizationId: organization._id });
    users.push(patient._id);
    pharmacist = await User.create({ name: 'SYNTHETIC Pharmacist', email: `staff.${unique}@example.com`, password: 'synthetic-test-only', role: 'pharmacist', organizationId: organization._id });
    users.push(pharmacist._id);
    token = jwt.sign({ id: String(pharmacist._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });
  t.after(async () => {
    if (connection) {
      assertTestDatabase(connection);
      for (const Model of [Field, Document, Audit, Review, Evidence, Check, Risk]) await Model.deleteMany({ caseId: { $in: cases } });
      await Case.deleteMany({ _id: { $in: cases } });
      await User.deleteMany({ _id: { $in: users } });
      await Organization.deleteMany({ _id: { $in: organizations } });
      await mongoose.disconnect();
    }
    fs.rmSync(tempStorage, { recursive: true, force: true });
  });
  async function createCase(status = 'NEEDS_REVIEW') {
    const value = await Case.create({ organizationId: organization._id, createdBy: patient._id, subjectReference: 'SYNTHETIC — DEMO ONLY', status, reviewRequired: true });
    cases.push(value._id); return value;
  }
  async function snapshot(caseId) {
    const response = await request(app).get(url(caseId) + '/reconciliation').set('Authorization', `Bearer ${token}`).expect(200);
    return response.body;
  }
  async function seedPair({ lowConfidence = false, confirm = true } = {}) {
    const value = await createCase();
    const source = loadScenarios('development').find(item => item.id === 'F01-01');
    assert.ok(source, 'Use development synthetic fixtures, never held-out gold');
    const docs = [];
    for (const [index, original] of source.documents.entries()) {
      const doc = await Document.create({ caseId: value._id, type: original.type, objectStorageKey: `synthetic/${value._id}/${index}.png`, originalFilename: 'SYNTHETIC-DEMO-ONLY.png', mimeType: 'image/png', sizeBytes: 100, sha256: String(index + 1).repeat(64), pageCount: 1, processedPageCount: 1, omittedPageCount: 0, pageCoverage: { total: 1, processed: 1, omitted: 0, status: 'COMPLETE' }, processingStatus: 'PROCESSED', uploadedBy: patient._id });
      const fields = await Field.insertMany(original.extractedFields.map(field => ({ caseId: value._id, documentId: doc._id, fieldType: field.fieldType, rawValue: field.rawValue, normalizedValue: field.normalizedValue, pageNumber: 1, extractionMethod: 'SYNTHETIC_INDEPENDENT_FIXTURE', extractionConfidence: lowConfidence && index === 0 && field.fieldType === 'dosage_strength' ? 0.3 : 0.95, needsCorrection: false, candidateRowKey: 'row_1', boundingBox: null })));
      const group = { anchorFieldId: String(fields.find(field => field.fieldType === 'medicine_name')._id), fieldIds: fields.map(field => String(field._id)) };
      doc.metadata = { detectedRowCount: 1, extractionBlockers: [], proposedMedicineGrouping: { groups: [group] } }; await doc.save();
      docs.push({ doc, fields, group });
    }
    if (confirm) for (const { doc, group } of docs) {
      const current = await snapshot(value._id);
      await request(app).put(url(value._id) + `/documents/${doc._id}/medicine-groups`).set('Authorization', `Bearer ${token}`).send({ snapshotToken: current.snapshotToken, observedItemCount: 1, completenessAttested: true, groups: [group] }).expect(200);
    }
    return { value, docs };
  }

  await t.test('baseline: supported confirmed pair is eligible and decodes without a claim form', async () => {
    const { value } = await seedPair(); const current = await snapshot(value._id);
    assert.ok(parseCaseSnapshot(current, String(value._id)));
    assert.equal(current.reviewEligibility.canVerify, true, JSON.stringify(current.reviewEligibility));
  });
  await t.test('GET snapshot returns CASE_BUSY during the case mutation lock', async () => {
    const { value } = await seedPair();
    let release; const barrier = new Promise(resolve => { release = resolve; });
    const held = withCaseMutationGuard(value._id, () => barrier);
    let response;
    try { response = await request(app).get(url(value._id) + '/reconciliation').set('Authorization', `Bearer ${token}`); }
    finally { release(); await held; }
    assert.equal(response.status, 409, 'Snapshot generation must not read a partially mutated case');
    assert.equal(response.body.code, 'CASE_BUSY');
  });
  await t.test('low-confidence raw false flag stays visible as correctable, decodable evidence', async () => {
    const { value } = await seedPair({ lowConfidence: true, confirm: false });
    const current = await snapshot(value._id);
    assert.equal(current.reviewEligibility.canVerify, false);
    assert.ok(current.reviewEligibility.blockerCodes.includes('FIELD_CORRECTION_REQUIRED'));
    assert.ok(parseCaseSnapshot(current, String(value._id)), 'Projection and frozen linked evidence must agree so the correction screen can load');
  });
  await t.test('contradictory supporting claim coverage blocks Verify and its review POST', async () => {
    const { value } = await seedPair();
    await Document.create({ caseId: value._id, type: 'CLAIM_FORM', objectStorageKey: `synthetic/${value._id}/claim.png`, originalFilename: 'SYNTHETIC-DEMO-ONLY.png', mimeType: 'image/png', processingStatus: 'PROCESSED', uploadedBy: patient._id, pageCount: 1, processedPageCount: 1, omittedPageCount: 0, pageCoverage: { total: 2, processed: 1, omitted: 1, status: 'COMPLETE' } });
    const current = await snapshot(value._id);
    const response = await request(app).post(url(value._id) + '/reviews').set('Authorization', `Bearer ${token}`).send({ snapshotToken: current.snapshotToken, action: 'VERIFY', reasonCode: 'SOURCE_CHECKED', notes: 'SYNTHETIC completeness regression, not a clinical decision.' });
    assert.deepEqual({ canVerify: current.reviewEligibility.canVerify, status: response.status, code: response.body.code }, { canVerify: false, status: 409, code: 'REVIEW_BLOCKED' }, 'All uploaded source coverage must agree, including optional claim metadata');
  });
  await t.test('actual Rx + invoice upload reaches READY_FOR_PROCESSING without mandatory claim', async () => {
    const value = await createCase('DRAFT');
    const file = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    for (const type of ['PRESCRIPTION', 'PHARMACY_INVOICE']) await request(app).post(url(value._id) + '/documents').set('Authorization', `Bearer ${token}`).send({ type, file, filename: 'SYNTHETIC-DEMO-ONLY.png', mimeType: 'image/png' }).expect(201);
    const response = await request(app).get(url(value._id)).set('Authorization', `Bearer ${token}`).expect(200);
    assert.equal(response.body.status, 'READY_FOR_PROCESSING', 'The optional claim must not prevent the golden two-source workflow');
  });
  await t.test('FAILED cases can retry the processing operation offered by the case page', async () => {
    const { value } = await seedPair();
    await Case.updateOne({ _id: value._id }, { $set: { status: 'FAILED' } });
    const response = await request(app).post(url(value._id) + '/process').set('Authorization', `Bearer ${token}`).send({});
    assert.equal(response.status, 202, 'A recoverable failed case with existing synthetic source fields must support explicit retry');
    assert.ok(['NEEDS_REVIEW', 'NEEDS_CORRECTION'].includes(response.body.status));
  });
});

test('browser PUT grouping preflight keeps the strict configured-origin policy', async () => {
  const route = '/api/v1/cases/' + 'a'.repeat(24) + '/documents/' + 'b'.repeat(24) + '/medicine-groups';
  const response = await request(app).options(route).set('Origin', 'http://127.0.0.1:5173').set('Access-Control-Request-Method', 'PUT').set('Access-Control-Request-Headers', 'authorization,content-type').expect(204);
  assert.equal(response.headers['access-control-allow-origin'], 'http://127.0.0.1:5173');
  assert.ok(response.headers['access-control-allow-methods'].split(',').includes('PUT'), 'The real browser must be allowed to send the protected grouping request');
  const processing = await request(app).options('/api/v1/cases/' + 'a'.repeat(24) + '/process').set('Origin', 'http://127.0.0.1:5173').set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'authorization,content-type,idempotency-key').expect(204);
  assert.ok(processing.headers['access-control-allow-headers'].toLowerCase().split(',').includes('idempotency-key'), 'The processing client\'s existing idempotency header must pass browser preflight');
  const denied = await request(app).options(route).set('Origin', 'https://unapproved.example.invalid').set('Access-Control-Request-Method', 'PUT').expect(403);
  assert.equal(denied.headers['access-control-allow-origin'], undefined);
});
