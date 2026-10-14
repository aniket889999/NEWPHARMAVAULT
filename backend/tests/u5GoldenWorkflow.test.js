// Opt-in real local integration: no mocked OCR, PDF renderer, auth, database,
// retrieval or review. Never run against the development database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

function syntheticPdf(lines) {
  const text = lines.map((line, index) => `${index ? '0 -32 Td\n' : ''}(${line.replace(/[\\()]/g, '\\$&')}) Tj`).join('\n');
  const stream = `BT /F1 20 Tf 40 740 Td\n${text}\nET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let content = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(content)); content += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(content);
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  content += offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(content);
}

function noStorageExposure(body) {
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /"(?:objectStorageKey|localPath|storageRoot|storagePath)"\s*:/);
}

module.exports = { syntheticPdf };

test('U5 real local golden API workflow (opt-in)', {
  skip: process.env.U5_RUN_REAL !== 'true' ? 'Set U5_RUN_REAL=true; uses only the fixed loopback disposable test database.' : false,
  timeout: 180000
}, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pharmavault-u5-'));
  const fixtureTag = crypto.randomUUID();
  process.env.NODE_ENV = 'test';
  process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_smoke_test';
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.GEMINI_API_KEY = 'synthetic-unused-u5-key';
  process.env.TRUSTRAG_LLM_ENABLED = 'false';
  process.env.TRUSTRAG_LLM_EXPORT_ALLOWED = 'false';
  process.env.DOCUMENT_STORAGE_ROOT = root;
  process.env.TRUSTRAG_TESSDATA_PATH = path.join(root, 'tessdata');
  fs.mkdirSync(process.env.TRUSTRAG_TESSDATA_PATH, { mode: 0o700 });

  const sourceTessdata = path.resolve(__dirname, '../tessdata');
  const languageFile = ['eng.traineddata', 'eng.traineddata.gz'].find(name => fs.existsSync(path.join(sourceTessdata, name)));
  assert.ok(languageFile, 'Provision local English OCR data; this test never downloads it.');
  fs.copyFileSync(path.join(sourceTessdata, languageFile), path.join(process.env.TRUSTRAG_TESSDATA_PATH, languageFile));

  const mongoose = require('mongoose');
  const request = require('supertest');
  const jwt = require('jsonwebtoken');
  const { assertTestDatabase } = require('../utils/testDatabaseGuard');
  const app = require('../app');
  const User = require('../models/userModel');
  const Organization = require('../models/organizationModel');
  const VerificationCase = require('../models/verificationCaseModel');
  const CanonicalMedicine = require('../models/canonicalMedicineModel');
  const EvidenceItem = require('../models/evidenceItemModel');
  const caseModels = ['Document', 'ExtractedField', 'ConsistencyCheck', 'RiskSignal', 'ReviewDecision', 'EvidenceItem', 'AuditEvent'];
  const Provider = require('../services/trustRag/nodePdfRendererProvider');
  const pdfService = require('../services/trustRag/pdfRenderingService');
  const catalogue = require('../data/academicMedicineCatalogue').ACADEMIC_MEDICINE_CATALOGUE;
  const caseIDs = [], userIDs = [], orgIDs = [], insertedCatalogueIDs = [];
  let connected = false;

  t.after(async () => {
    try {
      if (connected) {
        assertTestDatabase(mongoose.connection);
        // Delete only IDs created and ownership-checked by this run, never {}.
        for (const name of caseModels) await mongoose.model(name).deleteMany({ caseId: { $in: caseIDs } });
        await VerificationCase.deleteMany({ _id: { $in: caseIDs }, createdBy: { $in: userIDs } });
        await User.deleteMany({ _id: { $in: userIDs } });
        await Organization.deleteMany({ _id: { $in: orgIDs } });
        await CanonicalMedicine.deleteMany({ _id: { $in: insertedCatalogueIDs } });
        await mongoose.disconnect();
      }
    } finally {
      // Exact directory returned by mkdtemp, containing only synthetic fixtures.
      assert.ok(path.basename(root).startsWith('pharmavault-u5-'));
      assert.equal(path.dirname(root), os.tmpdir());
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  assertTestDatabase(process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 });
  connected = true;
  assertTestDatabase(mongoose.connection);
  for (const medicine of catalogue) {
    if (!await CanonicalMedicine.exists({ brandName: medicine.brandName, strength: medicine.strength, dosageForm: medicine.dosageForm })) {
      const entry = await CanonicalMedicine.create(medicine);
      insertedCatalogueIDs.push(entry._id);
    }
  }
  for (const suffix of ['A', 'B']) {
    const owner = new mongoose.Types.ObjectId();
    const org = await Organization.create({ name: `Synthetic U5 ${fixtureTag} ${suffix}`, owner, plan: 'Enterprise', status: 'active' });
    orgIDs.push(org._id);
  }
  const staff = await User.create({ name: 'Synthetic U5 reviewer', email: `u5-staff-${fixtureTag}@example.invalid`, password: crypto.randomUUID(), role: 'claims_reviewer', organizationId: orgIDs[0] });
  const otherStaff = await User.create({ name: 'Synthetic U5 other tenant', email: `u5-other-${fixtureTag}@example.invalid`, password: crypto.randomUUID(), role: 'claims_reviewer', organizationId: orgIDs[1] });
  const patient = await User.create({ name: 'Synthetic U5 submitter', email: `u5-patient-${fixtureTag}@example.invalid`, password: crypto.randomUUID(), role: 'patient', organizationId: orgIDs[0] });
  userIDs.push(staff._id, otherStaff._id, patient._id);
  const token = user => jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const staffToken = token(staff), otherToken = token(otherStaff), patientToken = token(patient);
  const api = (method, route, auth = staffToken) => request(app)[method](`/api/v1${route}`).set('Authorization', `Bearer ${auth}`);
  const idOf = value => value.id || String(value._id);
  const provider = new Provider();
  const types = ['PRESCRIPTION', 'PHARMACY_INVOICE', 'CLAIM_FORM'];
  const fixtureCache = new Map();

  async function fixture(type, strength) {
    const key = `${type}:${strength}`;
    if (!fixtureCache.has(key)) {
      const date = type === 'PRESCRIPTION' ? '2026-10-10' : type === 'PHARMACY_INVOICE' ? '2026-10-11' : '2026-10-12';
      const pdf = syntheticPdf(['SYNTHETIC DEMO - NOT FOR CLINICAL USE', type.replaceAll('_', ' '), `Paracetamol ${strength} mg Tablet`, 'Quantity: 10', `Date: ${date}`, 'Total: 100.00', 'Claimed: 100.00']);
      fixtureCache.set(key, { pdf, png: await provider.renderPage(pdf, 1) });
    }
    return fixtureCache.get(key);
  }

  async function createTriangle({ mismatch = false, format = 'png', creatorToken = staffToken } = {}) {
    const created = await api('post', '/cases', creatorToken).send({ subjectReference: `U5-${fixtureTag}` });
    assert.equal(created.status, 201);
    const caseID = idOf(created.body);
    assert.ok(await VerificationCase.exists({ _id: caseID, createdBy: { $in: userIDs } }));
    caseIDs.push(caseID);
    const documents = [];
    for (const type of types) {
      const data = await fixture(type, mismatch && type !== 'PRESCRIPTION' ? 650 : 500);
      const mime = format === 'pdf' ? 'application/pdf' : 'image/png';
      const uploaded = await api('post', `/cases/${caseID}/documents`, creatorToken).send({
        type, file: `data:${mime};base64,${data[format].toString('base64')}`, filename: `synthetic-${type}.${format}`, mimeType: mime
      });
      assert.equal(uploaded.status, 201);
      noStorageExposure(uploaded.body);
      documents.push({ id: idOf(uploaded.body), type, bytes: data[format] });
    }
    assert.equal((await api('get', `/cases/${caseID}`, creatorToken)).body.status, 'READY_FOR_PROCESSING');
    return { caseID, documents };
  }

  async function processAndRead(caseID) {
    const processed = await api('post', `/cases/${caseID}/process`).send({});
    assert.equal(processed.status, 202, processed.body.message || 'Real local OCR processing must succeed.');
    assert.equal(processed.body.reviewRequired, true);
    assert.ok(['NEEDS_REVIEW', 'NEEDS_CORRECTION'].includes(processed.body.status));
    const results = await api('get', `/cases/${caseID}/results`);
    assert.equal(results.status, 200);
    noStorageExposure(results.body);
    assert.ok(results.body.extractedFields.length >= 12, `Real OCR extracted ${results.body.extractedFields.length} fields; expected printed medicine/strength/quantity/date fields. Check Tesseract structured block output; do not use mock/template fallback.`);
    assert.ok(results.body.extractedFields.every(field => field.extractionMethod.startsWith('LOCAL_TESSERACT')));
    const evidenceIDs = new Set(results.body.evidenceItems.map(idOf));
    assert.ok(evidenceIDs.size > 0);
    for (const finding of results.body.consistencyChecks) {
      for (const id of finding.evidenceItemIds) assert.ok(evidenceIDs.has(String(id)), 'Check must cite same-case evidence.');
    }
    return results.body;
  }

  let clean;
  await t.test('Real image OCR → correction confirmation → reprocess → human verify → audit → draft export', async () => {
    clean = await createTriangle({ creatorToken: patientToken });
    let results = await processAndRead(clean.caseID);
    for (const doc of clean.documents) {
      const strength = results.extractedFields.find(field => String(field.documentId) === doc.id && field.fieldType === 'dosage_strength');
      assert.equal(strength?.normalizedValue, '500mg');
      const content = await api('get', `/cases/${clean.caseID}/documents/${doc.id}/content`);
      assert.equal(content.status, 200);
      assert.deepEqual(content.body, doc.bytes);
    }
    const quantity = results.extractedFields.find(field => field.fieldType === 'quantity');
    assert.equal((await api('patch', `/cases/${clean.caseID}/extracted-fields/${idOf(quantity)}`, patientToken).send({ normalizedValue: '10' })).status, 403);
    const toConfirm = results.extractedFields.filter(field => field.needsCorrection);
    if (!toConfirm.some(field => idOf(field) === idOf(quantity))) toConfirm.push(quantity);
    for (const field of toConfirm) {
      const correction = await api('patch', `/cases/${clean.caseID}/extracted-fields/${idOf(field)}`).send({ normalizedValue: field.normalizedValue });
      assert.equal(correction.status, 200);
      assert.equal(correction.body.rawValue, field.rawValue, 'Human confirmation must retain original OCR text.');
      assert.equal(String(correction.body.correctedBy), String(staff._id));
    }
    if ((await api('get', `/cases/${clean.caseID}`)).body.status === 'READY_FOR_PROCESSING') results = await processAndRead(clean.caseID);
    assert.equal(results.consistencyChecks.find(check => check.checkType === 'DOSAGE_STRENGTH_CONSISTENCY')?.status, 'PASS');
    const queue = await api('get', '/review-queue');
    assert.equal(queue.status, 200);
    assert.ok(queue.body.some(item => idOf(item) === clean.caseID));
    const review = await api('post', `/cases/${clean.caseID}/reviews`).send({ action: 'VERIFY', reasonCode: 'CROSS_DOCUMENT_CONSISTENT', notes: 'Synthetic single-medicine sources inspected and confirmed.', evidenceItemIds: results.evidenceItems.slice(0, 2).map(idOf) });
    assert.equal(review.status, 201);
    assert.equal(review.body.newCaseStatus, 'VERIFIED');
    const audit = await api('get', `/cases/${clean.caseID}/audit-trail`);
    assert.ok(audit.body.some(event => event.action === 'EXTRACTED_FIELD_CORRECTED'));
    assert.ok(audit.body.some(event => event.action === 'REVIEW_DECISION_RECORDED'));
    const exported = await api('get', `/cases/${clean.caseID}/fhir-bundle`);
    assert.equal(exported.status, 200);
    assert.equal(exported.body.resourceType, 'Bundle');
    assert.equal(exported.body.entry.filter(entry => entry.resource.resourceType === 'DocumentReference').length, 3);
    noStorageExposure(exported.body); // Structural smoke only, not FHIR conformance.
  });

  await t.test('Real 500 mg versus 650 mg discrepancy stays human-controlled and cites actual evidence', async () => {
    const mismatch = await createTriangle({ mismatch: true });
    const results = await processAndRead(mismatch.caseID);
    const strengthCheck = results.consistencyChecks.find(check => check.checkType === 'DOSAGE_STRENGTH_CONSISTENCY');
    assert.equal(strengthCheck?.status, 'FAIL');
    const signal = results.activeSignals.find(item => item.signalType === 'MEDICINE_STRENGTH_MISMATCH');
    assert.ok(signal);
    const storedSignals = await mongoose.model('RiskSignal').find({ caseId: mismatch.caseID });
    const evidenceIDs = new Set((await EvidenceItem.find({ caseId: mismatch.caseID })).map(item => String(item._id)));
    for (const item of storedSignals) for (const id of item.evidenceItemIds) assert.ok(evidenceIDs.has(String(id)), 'Signal must not cite an ExtractedField or another case.');
    assert.equal((await api('post', `/cases/${mismatch.caseID}/reviews`, patientToken).send({ action: 'VERIFY', reasonCode: 'X' })).status, 403);
    const escalation = await api('post', `/cases/${mismatch.caseID}/reviews`).send({ action: 'ESCALATE', reasonCode: 'SUSPECTED_ALTERATION', notes: 'Synthetic strength discrepancy requires clarification; this is not proof of fraud.' });
    assert.equal(escalation.status, 201);
    assert.equal(escalation.body.newCaseStatus, 'NEEDS_REVIEW');
  });

  await t.test('Cross-tenant requests and lifecycle bypasses fail on actual mounted routes', async () => {
    assert.ok(clean, 'The first workflow must create a test-owned case.');
    for (const suffix of ['', '/results', '/evidence', '/audit-trail', '/fhir-bundle', `/documents/${clean.documents[0].id}/content`]) {
      assert.equal((await api('get', `/cases/${clean.caseID}${suffix}`, otherToken)).status, 404);
    }
    assert.equal((await api('post', `/cases/${clean.caseID}/process`, otherToken).send({})).status, 404);
    assert.equal((await api('patch', `/cases/${clean.caseID}`, patientToken).send({ status: 'VERIFIED' })).status, 403);
    assert.equal((await api('patch', `/cases/${clean.caseID}`).send({ status: 'VERIFIED' })).status, 400);
    assert.equal((await api('post', `/cases/${clean.caseID}/process`).send({})).status, 400);
    assert.equal((await api('get', '/review-queue', patientToken)).status, 403);
  });

  const pdfStorageIntegrated = path.resolve(pdfService.storageRoot) === path.resolve(root);
  await t.test('Real PDF intake/OCR and protected preview use the shared private storage root', {
    skip: !pdfStorageIntegrated ? 'U3 pending: PDF preview service still ignores DOCUMENT_STORAGE_ROOT; do not redirect it in this test.' : false
  }, async () => {
    const pdfCase = await createTriangle({ format: 'pdf' });
    const results = await processAndRead(pdfCase.caseID);
    assert.ok(results.extractedFields.every(field => field.pageNumber === 1));
    const preview = await api('get', `/cases/${pdfCase.caseID}/documents/${pdfCase.documents[0].id}/pages/1/preview`);
    assert.equal(preview.status, 200);
    assert.equal(preview.headers['content-type'].split(';')[0], 'image/png');
    assert.equal((await api('get', `/cases/${pdfCase.caseID}/documents/${pdfCase.documents[0].id}/pages/1/preview`, otherToken)).status, 404);
  });
  t.diagnostic('Real local MongoDB + Tesseract + synthetic PDF-to-PNG + authenticated HTTP; external LLM disabled. Skipped PDF gate is not a U5 pass. No OCR accuracy percentage or FHIR conformance measured.');
});
