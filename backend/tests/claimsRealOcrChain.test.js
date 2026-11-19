'use strict';

// Real end-to-end chain for the claims USP, with no OCR, catalogue, review or claim shortcuts:
//
//   claimant uploads prescription + invoice + claim form  →  real local Tesseract OCR
//   →  pharmacist confirms fields and medicine groups  →  VERIFY (or blocked on a mismatch)
//   →  claimant submits a claim with consent  →  insurer reviews shared evidence
//   →  insurer asks the evidence assistant (cited, local)  →  human decision  →  simulated settlement
//
// Two claimants' journeys:
//   A. matching documents (Paracetamol 500 mg on both)         → verified, claimed, approved, settled
//   B. "other" invoice (650 mg billed against a 500 mg Rx)     → mismatch flagged, cannot be verified,
//                                                                 so it can never reach an insurer as a claim
//
// Opt-in (CLAIMS_REAL_OCR=true) because it needs local English OCR data: point
// CLAIMS_TESSDATA_PATH (or U5_LOCAL_TESSDATA_PATH) at a folder holding eng.traineddata.
// The app never downloads language data. Synthetic documents only; external LLM disabled.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
// Same synthetic one-page PDF builder as the U5 golden workflow (text rendered, then OCR'd as PNG).
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
  assert.doesNotMatch(JSON.stringify(body), /"(?:objectStorageKey|localPath|storageRoot|storagePath)"\s*:/);
}

test('Claims real chain: upload → OCR → pharmacist → claim → insurer + evidence assistant (opt-in)', {
  skip: process.env.CLAIMS_REAL_OCR !== 'true' ? 'Set CLAIMS_REAL_OCR=true with local eng.traineddata.' : false,
  timeout: 300000
}, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pharmavault-claims-ocr-'));
  process.env.NODE_ENV = 'test';
  process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_claims_ocr_test';
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.GEMINI_API_KEY = 'synthetic-unused-claims-ocr-key';
  process.env.MFA_ENCRYPTION_KEY = 'test-only-mfa-encryption-key-0123456789';
  process.env.TRUSTRAG_LLM_ENABLED = 'false';
  process.env.TRUSTRAG_LLM_EXPORT_ALLOWED = 'false';
  process.env.DOCUMENT_STORAGE_ROOT = root;
  process.env.TRUSTRAG_TESSDATA_PATH = path.join(root, 'tessdata');
  fs.mkdirSync(process.env.TRUSTRAG_TESSDATA_PATH, { mode: 0o700 });
  const sourceTessdata = process.env.CLAIMS_TESSDATA_PATH || process.env.U5_LOCAL_TESSDATA_PATH || path.resolve(__dirname, '../tessdata');
  const languageFile = ['eng.traineddata', 'eng.traineddata.gz'].find((name) => fs.existsSync(path.join(sourceTessdata, name)));
  assert.ok(languageFile, 'Provision local English OCR data; this test never downloads it.');
  fs.copyFileSync(path.join(sourceTessdata, languageFile), path.join(process.env.TRUSTRAG_TESSDATA_PATH, languageFile));

  const mongoose = require('mongoose');
  const request = require('supertest');
  const jwt = require('jsonwebtoken');
  const { assertTestDatabase } = require('../utils/testDatabaseGuard');
  const app = require('../app');
  const User = require('../models/userModel');
  const Organization = require('../models/organizationModel');
  const CanonicalMedicine = require('../models/canonicalMedicineModel');
  const Provider = require('../services/trustRag/nodePdfRendererProvider');
  const catalogue = require('../data/academicMedicineCatalogue').ACADEMIC_MEDICINE_CATALOGUE;

  t.after(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        assertTestDatabase(mongoose.connection);
        await mongoose.connection.dropDatabase(); // dedicated *_test database for this file only
        await mongoose.disconnect();
      }
    } finally {
      assert.ok(path.basename(root).startsWith('pharmavault-claims-ocr-'));
      assert.equal(path.dirname(root), os.tmpdir());
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  assertTestDatabase(process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 });
  assertTestDatabase(mongoose.connection);
  await mongoose.connection.dropDatabase();
  await CanonicalMedicine.insertMany(catalogue);

  const owner = new mongoose.Types.ObjectId();
  const pharmacyOrg = await Organization.create({ name: 'Synthetic Pune Pharmacy', owner, plan: 'Enterprise', status: 'active', kind: 'pharmacy' });
  const insurer = await Organization.create({ name: 'Synthetic Insurer (Demo)', owner, status: 'active', kind: 'payer' });
  const otherInsurer = await Organization.create({ name: 'Other Synthetic Insurer', owner, status: 'active', kind: 'payer' });
  const mk = (role, organizationId) => User.create({ name: `Synthetic ${role}`, email: `${role}-${crypto.randomUUID()}@example.invalid`, password: crypto.randomUUID(), role, organizationId });
  const claimantA = await mk('patient');
  const claimantB = await mk('patient');
  const pharmacist = await mk('pharmacist', pharmacyOrg._id);
  const reviewer = await mk('payer_reviewer', insurer._id);
  const insurerAdmin = await mk('payer_admin', insurer._id);
  const otherReviewer = await mk('payer_reviewer', otherInsurer._id);
  const tokenOf = (user) => jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const api = (method, route, user) => request(app)[method](`/api/v1${route}`).set('Authorization', `Bearer ${tokenOf(user)}`);
  const idOf = (value) => value.id || String(value._id);

  const provider = new Provider();
  async function documentPng(type, strength) {
    const date = type === 'PRESCRIPTION' ? '2026-10-10' : type === 'PHARMACY_INVOICE' ? '2026-10-11' : '2026-10-12';
    const lines = ['SYNTHETIC DEMO - NOT FOR CLINICAL USE', type.replaceAll('_', ' ')];
    if (type !== 'CLAIM_FORM') lines.push(`1. Paracetamol ${strength} mg tablet Qty: 10 tablets`);
    lines.push(`Date: ${date}`, 'Total: 100.00', 'Claimed: 100.00');
    return provider.renderPage(syntheticPdf(lines), 1);
  }

  // Claimant creates a case at the pharmacy and uploads the three documents.
  async function claimantUploads(claimant, { invoiceStrength }) {
    const created = await api('post', '/cases', claimant).send({ subjectReference: `claims-ocr-${crypto.randomUUID().slice(0, 8)}`, organizationId: String(pharmacyOrg._id) });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const caseID = idOf(created.body);
    const documents = [];
    for (const type of ['PRESCRIPTION', 'PHARMACY_INVOICE', 'CLAIM_FORM']) {
      const png = await documentPng(type, type === 'PRESCRIPTION' ? 500 : invoiceStrength);
      const uploaded = await api('post', `/cases/${caseID}/documents`, claimant).send({
        type, file: `data:image/png;base64,${png.toString('base64')}`, filename: `synthetic-${type}.png`, mimeType: 'image/png'
      });
      assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
      noStorageExposure(uploaded.body);
      documents.push({ id: idOf(uploaded.body), type, bytes: png });
    }
    return { caseID, documents };
  }

  async function processAndRead(caseID) {
    const processed = await api('post', `/cases/${caseID}/process`, pharmacist).send({});
    assert.equal(processed.status, 202, processed.body.message || 'Real local OCR processing must succeed.');
    const results = await api('get', `/cases/${caseID}/results`, pharmacist);
    assert.equal(results.status, 200);
    assert.ok(results.body.extractedFields.length >= 12, `Real OCR extracted only ${results.body.extractedFields.length} fields.`);
    assert.ok(results.body.extractedFields.every((f) => f.extractionMethod.startsWith('LOCAL_TESSERACT')), 'no mock or template OCR');
    return results.body;
  }

  // Pharmacist confirms low-confidence fields and the one-medicine grouping on each document.
  async function pharmacistConfirms(caseID, documents, results) {
    const quantity = results.extractedFields.find((f) => f.fieldType === 'quantity');
    const toConfirm = results.extractedFields.filter((f) => f.needsCorrection);
    if (quantity && !toConfirm.some((f) => idOf(f) === idOf(quantity))) toConfirm.push(quantity);
    for (const field of toConfirm) {
      const snap = await api('get', `/cases/${caseID}/reconciliation`, pharmacist);
      const fixed = await api('patch', `/cases/${caseID}/extracted-fields/${idOf(field)}`, pharmacist).send({ normalizedValue: field.normalizedValue, snapshotToken: snap.body.snapshotToken });
      assert.equal(fixed.status, 200, JSON.stringify(fixed.body));
    }
    if ((await api('get', `/cases/${caseID}`, pharmacist)).body.status === 'READY_FOR_PROCESSING') results = await processAndRead(caseID);
    for (const doc of documents.filter((d) => d.type !== 'CLAIM_FORM')) {
      const snap = await api('get', `/cases/${caseID}/reconciliation`, pharmacist);
      const docFields = results.extractedFields.filter((f) => String(f.documentId) === doc.id && f.candidateRowKey);
      const anchor = docFields.find((f) => f.fieldType === 'medicine_name');
      assert.ok(anchor, `medicine_name read by OCR on ${doc.type}`);
      const grouped = await api('put', `/cases/${caseID}/documents/${doc.id}/medicine-groups`, pharmacist).send({
        snapshotToken: snap.body.snapshotToken, observedItemCount: 1, completenessAttested: true,
        groups: [{ anchorFieldId: idOf(anchor), fieldIds: docFields.map(idOf) }]
      });
      assert.equal(grouped.status, 200, JSON.stringify(grouped.body));
    }
    return results;
  }

  const claimBody = (caseID, amount, policy) => ({ caseId: caseID, payerOrganizationId: String(insurer._id), claimedAmount: amount, policyNumber: policy, consent: { accepted: true } });
  let matching, other, matchingResults, claimId;

  await t.test('A. matching prescription and invoice: real OCR reads 500 mg on both; pharmacist verifies', async () => {
    matching = await claimantUploads(claimantA, { invoiceStrength: 500 });
    matchingResults = await processAndRead(matching.caseID);
    for (const doc of matching.documents.filter((d) => d.type !== 'CLAIM_FORM')) {
      const strength = matchingResults.extractedFields.find((f) => String(f.documentId) === doc.id && f.fieldType === 'dosage_strength');
      assert.equal(String(strength?.normalizedValue).replace(/\s/g, ''), '500mg', `${doc.type} strength read by OCR`);
    }
    const invoiceTotal = matchingResults.extractedFields.find((f) => f.fieldType === 'total_amount');
    assert.equal(invoiceTotal?.normalizedValue, '100.00', 'invoice total read by OCR');
    matchingResults = await pharmacistConfirms(matching.caseID, matching.documents, matchingResults);
    assert.equal(matchingResults.consistencyChecks.find((c) => c.checkType === 'DOSAGE_STRENGTH_CONSISTENCY')?.status, 'PASS');

    // Before verification the claimant cannot claim.
    const early = await api('post', '/claims', claimantA).send(claimBody(matching.caseID, 100, 'SYN-POL-OCR-01'));
    assert.equal(early.body.code, 'CASE_NOT_VERIFIED');

    const snap = await api('get', `/cases/${matching.caseID}/reconciliation`, pharmacist);
    assert.equal(snap.body.reviewEligibility.canVerify, true, `blockers: ${snap.body.reviewEligibility.blockerCodes}`);
    const verified = await api('post', `/cases/${matching.caseID}/reviews`, pharmacist).send({
      action: 'VERIFY', reasonCode: 'CROSS_DOCUMENT_CONSISTENT', notes: 'Prescription and invoice match: Paracetamol 500 mg, 10 tablets.',
      evidenceItemIds: matchingResults.evidenceItems.slice(0, 2).map(idOf), snapshotToken: snap.body.snapshotToken
    });
    assert.equal(verified.status, 201, JSON.stringify(verified.body));
    assert.equal(verified.body.newCaseStatus, 'VERIFIED');
  });

  await t.test('B. "other" invoice (650 mg billed for a 500 mg prescription): mismatch flagged and cannot be verified or claimed', async () => {
    other = await claimantUploads(claimantB, { invoiceStrength: 650 });
    let results = await processAndRead(other.caseID);
    assert.equal(results.consistencyChecks.find((c) => c.checkType === 'DOSAGE_STRENGTH_CONSISTENCY')?.status, 'FAIL');
    assert.ok(results.activeSignals.some((s) => s.signalType === 'MEDICINE_STRENGTH_MISMATCH'), 'risk signal raised for review');
    results = await pharmacistConfirms(other.caseID, other.documents, results);
    const snap = await api('get', `/cases/${other.caseID}/reconciliation`, pharmacist);
    assert.equal(snap.body.reviewEligibility.canVerify, false);
    assert.ok(!snap.body.reviewEligibility.allowedActions.includes('VERIFY'));
    t.diagnostic(`mismatch blockers: ${snap.body.reviewEligibility.blockerCodes.join(', ')}`);
    const forced = await api('post', `/cases/${other.caseID}/reviews`, pharmacist).send({
      action: 'VERIFY', reasonCode: 'CROSS_DOCUMENT_CONSISTENT', notes: 'Trying to verify despite the mismatch.',
      evidenceItemIds: results.evidenceItems.slice(0, 2).map(idOf), snapshotToken: snap.body.snapshotToken
    });
    assert.notEqual(forced.status, 201, 'VERIFY must be refused while strengths differ');
    assert.notEqual((await api('get', `/cases/${other.caseID}`, pharmacist)).body.status, 'VERIFIED');

    // The claimant cannot send this case to an insurer.
    const eligible = await api('get', '/claims/eligible-cases', claimantB);
    assert.ok(!eligible.body.some((c) => c.id === other.caseID), 'unverified case is not offered for claims');
    const refused = await api('post', '/claims', claimantB).send(claimBody(other.caseID, 100, 'SYN-POL-OCR-02'));
    assert.equal(refused.status, 409);
    assert.equal(refused.body.code, 'CASE_NOT_VERIFIED');

    const escalateSnap = await api('get', `/cases/${other.caseID}/reconciliation`, pharmacist);
    const escalated = await api('post', `/cases/${other.caseID}/reviews`, pharmacist).send({
      action: 'ESCALATE', reasonCode: 'SUSPECTED_ALTERATION', notes: 'Invoice strength differs from the prescription; this is a review prompt, not proof of fraud.',
      snapshotToken: escalateSnap.body.snapshotToken
    });
    assert.equal(escalated.status, 201, JSON.stringify(escalated.body));
  });

  await t.test('A. claimant claims within the OCR-read bill; insurer sees the real evidence', async () => {
    const eligible = await api('get', '/claims/eligible-cases', claimantA);
    const row = eligible.body.find((c) => c.id === matching.caseID);
    assert.deepEqual([row.claimable, row.invoiceTotal], [true, 100]);
    assert.equal((await api('post', '/claims', claimantA).send(claimBody(matching.caseID, 150, 'SYN-POL-OCR-03'))).body.code, 'CLAIM_EXCEEDS_INVOICE');
    const submitted = await api('post', '/claims', claimantA).send(claimBody(matching.caseID, 100, 'SYN-POL-OCR-04'));
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    claimId = submitted.body.id;

    const view = await api('get', `/payer/claims/${claimId}`, reviewer);
    assert.equal(view.status, 200);
    noStorageExposure(view.body);
    assert.deepEqual(view.body.documents.map((d) => d.type).sort(), ['CLAIM_FORM', 'PHARMACY_INVOICE', 'PRESCRIPTION']);
    assert.ok(view.body.extractedFields.some((f) => f.fieldType === 'dosage_strength' && /500\s*mg/i.test(f.normalizedValue)));
    assert.equal(view.body.consistencyChecks.find((c) => c.checkType === 'DOSAGE_STRENGTH_CONSISTENCY')?.status, 'PASS');
    assert.deepEqual([view.body.amountCheck.status, view.body.amountCheck.invoiceTotal], ['WITHIN_INVOICE', 100]);
    assert.ok(view.body.reviewDecisions.length >= 1, 'pharmacist decision is shared');
    const invoiceDoc = matching.documents.find((d) => d.type === 'PHARMACY_INVOICE');
    const content = await api('get', `/payer/claims/${claimId}/documents/${invoiceDoc.id}/content`, reviewer).buffer(true).parse((res, cb) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    assert.equal(content.status, 200);
    assert.ok(Buffer.compare(content.body, invoiceDoc.bytes) === 0, 'insurer sees the exact uploaded invoice');
    assert.equal((await api('get', `/payer/claims/${claimId}`, otherReviewer)).status, 404, 'other insurer cannot see it');
  });

  await t.test('A. insurer asks the evidence assistant: cited answer from both documents; it refuses to decide', async () => {
    const ask = (message, medicineItemId = null) => api('post', `/payer/claims/${claimId}/assistant/answers`, reviewer).send({ message, medicineItemId });
    let answer = (await ask('What strength is on the prescription and the invoice?')).body;
    if (answer.mode === 'CLARIFY' && answer.choices?.length) answer = (await ask('What strength is on the prescription and the invoice?', answer.choices[0].itemId)).body;
    assert.equal(answer.mode, 'LOCAL_CASE_EVIDENCE', JSON.stringify(answer));
    assert.match(answer.reply, /500/);
    const rx = matching.documents.find((d) => d.type === 'PRESCRIPTION').id;
    const inv = matching.documents.find((d) => d.type === 'PHARMACY_INVOICE').id;
    const cited = new Set(answer.sources.map((s) => String(s.documentId)));
    assert.ok(cited.has(rx) && cited.has(inv), 'answer cites both the prescription and the invoice');
    assert.equal(answer.bindingToken, null);
    t.diagnostic(`assistant reply: ${answer.reply.slice(0, 200)}`);

    const decide = (await ask('Should I approve this claim?')).body;
    assert.equal(decide.mode, 'SAFETY');
    assert.equal((await api('get', `/payer/claims/${claimId}`, reviewer)).body.claim.status, 'SUBMITTED', 'assistant changed nothing');
    assert.equal((await api('post', `/payer/claims/${claimId}/assistant/answers`, otherReviewer).send({ message: 'Which medicine?' })).status, 404);
  });

  await t.test('A. human decision: insurer approves with a note; insurer admin settles ₹100 (simulated)', async () => {
    assert.equal((await api('post', `/payer/claims/${claimId}/start-review`, reviewer)).status, 200);
    const decided = await api('post', `/payer/claims/${claimId}/decision`, reviewer).send({ decision: 'APPROVED', note: 'OCR evidence and pharmacist verification agree: Paracetamol 500 mg x10, bill 100.00.' });
    assert.equal(decided.status, 200, JSON.stringify(decided.body));
    const settled = await api('post', `/payer/claims/${claimId}/settle`, insurerAdmin);
    assert.equal(settled.body.status, 'SETTLED');
    assert.equal(settled.body.settlement.amount, 100);
    const mine = await api('get', `/claims/${claimId}`, claimantA);
    assert.equal(mine.body.settlement.simulated, true);
    const again = await api('post', '/claims', claimantA).send({ ...claimBody(matching.caseID, 10, 'SYN-POL-OCR-05'), payerOrganizationId: String(otherInsurer._id) });
    assert.equal(again.body.code, 'CASE_FULLY_CLAIMED', 'the same bill cannot be claimed again with another insurer');
  });

  t.diagnostic('Real MongoDB + local Tesseract OCR on synthetic documents + authenticated HTTP; external LLM disabled. No OCR accuracy figure is claimed.');
});
