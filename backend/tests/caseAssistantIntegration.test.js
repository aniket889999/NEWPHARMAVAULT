const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_smoke_test';
process.env.JWT_SECRET = 'test-only-session4-assistant-integration-secret-key';
process.env.GEMINI_API_KEY = 'test-only-gemini-key-never-called';
process.env.TRUSTRAG_LLM_ENABLED = 'true';
process.env.RAG_CHAT_LLM_ENABLED = 'true';
process.env.RAG_CHAT_PUBLIC_EXPORT_ALLOWED = 'true';

const Ajv2020 = createRequire(require.resolve('ajv-cli/package.json'))('ajv/dist/2020');
const addFormats = require('ajv-formats');
const { loadClient } = require('../../tests/rag-v2/load-client.cjs');
const { parseCaseAnswer, parseFreshnessResponse } = loadClient(
  'src/features/caseAssistant/contract.ts'
);

const app = require('../app');
const User = require('../models/userModel');
const Organization = require('../models/organizationModel');
const VerificationCase = require('../models/verificationCaseModel');
const Document = require('../models/documentModel');
const ExtractedField = require('../models/extractedFieldModel');
const AuditEvent = require('../models/auditEventModel');
const ReviewDecision = require('../models/reviewDecisionModel');
const { assertTestDatabase } = require('../utils/testDatabaseGuard');
const { withCaseMutationGuard } = require('../services/trustRag/caseEvidenceMutationService');

const answerSchema = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../contracts/schemas/case-assistant-answer.schema.json'),
    'utf8'
  )
);
const freshnessSchema = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../contracts/schemas/case-assistant-freshness.schema.json'),
    'utf8'
  )
);

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateAnswerSchema = ajv.compile(answerSchema);
const validateFreshnessSchema = ajv.compile(freshnessSchema);

function signToken(user) {
  return jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

test('Session 4 Real HTTP + MongoDB Integration Suite — Case Assistant & Freshness', async (t) => {
  const createdOrgIds = [];
  const createdUserIds = [];
  const createdCaseIds = [];

  let orgA, orgB;
  let patientA, patientB, pharmacistA, reviewerA, pharmacistB, tenantlessStaff, evaluatorUser;
  let tokenPatientA,
    tokenPatientB,
    tokenPharmA,
    tokenReviewerA,
    tokenPharmB,
    tokenTenantless,
    tokenEvaluator;

  t.before(async () => {
    assertTestDatabase(process.env.MONGO_URI);
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    assertTestDatabase(mongoose.connection);

    const runTag = new mongoose.Types.ObjectId().toString().slice(-8);
    orgA = await Organization.create({
      name: `S4 Org A ${runTag}`,
      type: 'hospital',
      code: `S4ORGA_${runTag}`,
      owner: new mongoose.Types.ObjectId()
    });
    orgB = await Organization.create({
      name: `S4 Org B ${runTag}`,
      type: 'pharmacy',
      code: `S4ORGB_${runTag}`,
      owner: new mongoose.Types.ObjectId()
    });
    createdOrgIds.push(orgA._id, orgB._id);

    const createTestUser = async (overrides) => {
      const u = await User.create({
        name: overrides.name,
        email: `${overrides.prefix}_${runTag}@s4test.local`,
        password: 'TestPassword123!',
        role: overrides.role,
        organizationId: overrides.organizationId ?? null
      });
      createdUserIds.push(u._id);
      return u;
    };

    patientA = await createTestUser({ name: 'Patient A', prefix: 'patA', role: 'patient', organizationId: orgA._id });
    patientB = await createTestUser({ name: 'Patient B', prefix: 'patB', role: 'patient', organizationId: orgA._id });
    pharmacistA = await createTestUser({ name: 'Pharmacist A', prefix: 'pharmA', role: 'pharmacist', organizationId: orgA._id });
    reviewerA = await createTestUser({ name: 'Reviewer A', prefix: 'revA', role: 'claims_reviewer', organizationId: orgA._id });
    pharmacistB = await createTestUser({ name: 'Pharmacist B', prefix: 'pharmB', role: 'pharmacist', organizationId: orgB._id });
    tenantlessStaff = await createTestUser({ name: 'Tenantless Staff', prefix: 'notenant', role: 'pharmacist', organizationId: null });
    evaluatorUser = await createTestUser({ name: 'Evaluator', prefix: 'eval', role: 'research_evaluator', organizationId: orgA._id });

    tokenPatientA = signToken(patientA);
    tokenPatientB = signToken(patientB);
    tokenPharmA = signToken(pharmacistA);
    tokenReviewerA = signToken(reviewerA);
    tokenPharmB = signToken(pharmacistB);
    tokenTenantless = signToken(tenantlessStaff);
    tokenEvaluator = signToken(evaluatorUser);
  });

  t.after(async () => {
    if (mongoose.connection.readyState === 1) {
      assertTestDatabase(mongoose.connection);
      await Promise.all([
        ExtractedField.deleteMany({ caseId: { $in: createdCaseIds } }),
        Document.deleteMany({ caseId: { $in: createdCaseIds } }),
        AuditEvent.deleteMany({ caseId: { $in: createdCaseIds } }),
        ReviewDecision.deleteMany({ caseId: { $in: createdCaseIds } }),
        VerificationCase.deleteMany({ _id: { $in: createdCaseIds } }),
        User.deleteMany({ _id: { $in: createdUserIds } }),
        Organization.deleteMany({ _id: { $in: createdOrgIds } })
      ]);
      await mongoose.disconnect();
    }
  });

  async function seedCaseWithMedicinePair({ rxStrength = '500 mg', invStrength = '500 mg' } = {}) {
    const vCase = await VerificationCase.create({
      organizationId: orgA._id,
      createdBy: patientA._id,
      subjectReference: 's4-synthetic-subject',
      status: 'NEEDS_REVIEW',
      reviewRequired: true,
      evidenceRevision: 1
    });
    createdCaseIds.push(vCase._id);

    const rxDoc = await Document.create({
      caseId: vCase._id,
      type: 'PRESCRIPTION',
      originalFilename: 's4_rx.png',
      mimeType: 'image/png',
      sizeBytes: 256,
      sha256: '1'.repeat(64),
      objectStorageKey: `cases/${vCase._id}/s4_rx.png`,
      uploadedBy: patientA._id,
      processingStatus: 'PROCESSED',
      pageCount: 1,
      processedPageCount: 1,
      omittedPageCount: 0,
      pageCoverage: { total: 1, processed: 1, omitted: 0, status: 'COMPLETE' }
    });

    const invDoc = await Document.create({
      caseId: vCase._id,
      type: 'PHARMACY_INVOICE',
      originalFilename: 's4_inv.png',
      mimeType: 'image/png',
      sizeBytes: 256,
      sha256: '2'.repeat(64),
      objectStorageKey: `cases/${vCase._id}/s4_inv.png`,
      uploadedBy: patientA._id,
      processingStatus: 'PROCESSED',
      pageCount: 1,
      processedPageCount: 1,
      omittedPageCount: 0,
      pageCoverage: { total: 1, processed: 1, omitted: 0, status: 'COMPLETE' }
    });

    vCase.documentIds = [rxDoc._id, invDoc._id];
    await vCase.save();

    const makeFieldsForDoc = async (doc, strengthVal) => {
      const med = await ExtractedField.create({
        caseId: vCase._id,
        documentId: doc._id,
        fieldType: 'medicine_name',
        rawValue: 'Paracetamol',
        normalizedValue: 'Paracetamol',
        pageNumber: 1,
        boundingBox: [0.1, 0.1, 0.4, 0.18],
        extractionConfidence: 0.96,
        needsCorrection: false,
        candidateRowKey: 'row_1'
      });
      const str = await ExtractedField.create({
        caseId: vCase._id,
        documentId: doc._id,
        fieldType: 'dosage_strength',
        rawValue: strengthVal,
        normalizedValue: strengthVal,
        pageNumber: 1,
        boundingBox: [0.42, 0.1, 0.55, 0.18],
        extractionConfidence: 0.96,
        needsCorrection: false,
        candidateRowKey: 'row_1'
      });
      const form = await ExtractedField.create({
        caseId: vCase._id,
        documentId: doc._id,
        fieldType: 'dosage_form',
        rawValue: 'tablet',
        normalizedValue: 'tablet',
        pageNumber: 1,
        boundingBox: [0.56, 0.1, 0.68, 0.18],
        extractionConfidence: 0.96,
        needsCorrection: false,
        candidateRowKey: 'row_1'
      });
      const qty = await ExtractedField.create({
        caseId: vCase._id,
        documentId: doc._id,
        fieldType: 'quantity',
        rawValue: '10',
        normalizedValue: '10',
        pageNumber: 1,
        boundingBox: [0.7, 0.1, 0.78, 0.18],
        extractionConfidence: 0.96,
        needsCorrection: false,
        candidateRowKey: 'row_1'
      });
      const unit = await ExtractedField.create({
        caseId: vCase._id,
        documentId: doc._id,
        fieldType: 'quantity_unit',
        rawValue: 'tablets',
        normalizedValue: 'tablets',
        pageNumber: 1,
        boundingBox: [0.8, 0.1, 0.92, 0.18],
        extractionConfidence: 0.96,
        needsCorrection: false,
        candidateRowKey: 'row_1'
      });
      return { med, str, form, qty, unit };
    };

    const rxFields = await makeFieldsForDoc(rxDoc, rxStrength);
    const invFields = await makeFieldsForDoc(invDoc, invStrength);

    return { vCase, rxDoc, invDoc, rxFields, invFields };
  }

  await t.test('1. Authentication, tenant isolation, role controls, and strict request validation on /answers and /freshness', async () => {
    const { vCase } = await seedCaseWithMedicinePair();
    const cid = String(vCase._id);

    // Unauthenticated -> 401
    const unauthAns = await request(app)
      .post(`/api/v1/cases/${cid}/assistant/answers`)
      .send({ message: 'Show strength' });
    assert.equal(unauthAns.status, 401);

    const unauthFresh = await request(app)
      .post(`/api/v1/cases/${cid}/assistant/freshness`)
      .send({ receipts: [{ answerId: '11111111-1111-4111-8111-111111111111', bindingToken: 'tok' }] });
    assert.equal(unauthFresh.status, 401);

    // Tenantless staff & research_evaluator -> 403
    for (const badToken of [tokenTenantless, tokenEvaluator]) {
      const r1 = await request(app)
        .post(`/api/v1/cases/${cid}/assistant/answers`)
        .set('Authorization', `Bearer ${badToken}`)
        .send({ message: 'Show strength' });
      assert.equal(r1.status, 403);

      const r2 = await request(app)
        .post(`/api/v1/cases/${cid}/assistant/freshness`)
        .set('Authorization', `Bearer ${badToken}`)
        .send({ receipts: [{ answerId: '11111111-1111-4111-8111-111111111111', bindingToken: 'tok' }] });
      assert.equal(r2.status, 403);
    }

    // Cross-tenant staff & other patient -> opaque 404
    for (const crossToken of [tokenPharmB, tokenPatientB]) {
      const r1 = await request(app)
        .post(`/api/v1/cases/${cid}/assistant/answers`)
        .set('Authorization', `Bearer ${crossToken}`)
        .send({ message: 'Show strength' });
      assert.equal(r1.status, 404);

      const r2 = await request(app)
        .post(`/api/v1/cases/${cid}/assistant/freshness`)
        .set('Authorization', `Bearer ${crossToken}`)
        .send({ receipts: [{ answerId: '11111111-1111-4111-8111-111111111111', bindingToken: 'tok' }] });
      assert.equal(r2.status, 404);
    }

    // Extra / override keys rejected with 400
    const extraKeyRes = await request(app)
      .post(`/api/v1/cases/${cid}/assistant/answers`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({ message: 'Show strength', role: 'super_admin' });
    assert.equal(extraKeyRes.status, 400);
    assert.match(extraKeyRes.headers['cache-control'] || '', /private,\s*no-store/i);

    const badReceiptsRes = await request(app)
      .post(`/api/v1/cases/${cid}/assistant/freshness`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({ receipts: [] });
    assert.equal(badReceiptsRes.status, 400);
  });

  await t.test('2. Real PATCH /extracted-fields workflow: unrelated edit stays FRESH; cited-field edit becomes STALE', async () => {
    const { vCase, rxFields } = await seedCaseWithMedicinePair();
    const cid = String(vCase._id);

    // Get initial reconciliation snapshot to discover prescription itemId
    const snap1 = await request(app)
      .get(`/api/v1/cases/${cid}/reconciliation`)
      .set('Authorization', `Bearer ${tokenPharmA}`);
    assert.equal(snap1.status, 200);
    const rxItemId = snap1.body.prescription.medicineItems[0].itemId;

    // Ask for recorded prescription strength
    const ansRes = await request(app)
      .post(`/api/v1/cases/${cid}/assistant/answers`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({
        message: 'What is the recorded prescription dosage strength?',
        medicineItemId: rxItemId
      });
    assert.equal(ansRes.status, 200);
    assert.match(ansRes.headers['cache-control'] || '', /private,\s*no-store/i);
    assert.equal(validateAnswerSchema(ansRes.body), true);
    assert.ok(parseCaseAnswer(ansRes.body, cid, rxItemId));
    assert.equal(ansRes.body.mode, 'LOCAL_CASE_EVIDENCE');
    assert.equal(ansRes.body.intent, 'STRENGTH');

    const receipt = {
      answerId: ansRes.body.answerId,
      bindingToken: ansRes.body.bindingToken
    };

    // 2a. Check freshness immediately -> FRESH
    const fresh1 = await request(app)
      .post(`/api/v1/cases/${cid}/assistant/freshness`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({ receipts: [receipt] });
    assert.equal(fresh1.status, 200);
    assert.equal(validateFreshnessSchema(fresh1.body), true);
    assert.ok(parseFreshnessResponse(fresh1.body, cid, [receipt]));
    assert.equal(fresh1.body.results[0].status, 'FRESH');
    assert.equal(fresh1.body.results[0].reasonCode, 'UNCHANGED_DEPENDENCIES');

    // 2b. Perform an UNRELATED edit: PATCH quantity on prescription
    const patchQty = await request(app)
      .patch(`/api/v1/cases/${cid}/extracted-fields/${rxFields.qty._id}`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({
        normalizedValue: '15',
        snapshotToken: snap1.body.snapshotToken
      });
    assert.equal(patchQty.status, 200);

    // Strength receipt must remain FRESH even though case evidenceRevision increased!
    const freshAfterUnrelated = await request(app)
      .post(`/api/v1/cases/${cid}/assistant/freshness`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({ receipts: [receipt] });
    assert.equal(freshAfterUnrelated.status, 200);
    assert.equal(freshAfterUnrelated.body.results[0].status, 'FRESH');
    assert.equal(freshAfterUnrelated.body.results[0].reasonCode, 'UNCHANGED_DEPENDENCIES');

    // 2c. Perform a DEPENDENT edit: PATCH dosage_strength on prescription
    const snap2 = await request(app)
      .get(`/api/v1/cases/${cid}/reconciliation`)
      .set('Authorization', `Bearer ${tokenPharmA}`);
    assert.equal(snap2.status, 200);

    const patchStrength = await request(app)
      .patch(`/api/v1/cases/${cid}/extracted-fields/${rxFields.str._id}`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({
        normalizedValue: '650 mg',
        snapshotToken: snap2.body.snapshotToken
      });
    assert.equal(patchStrength.status, 200);

    // Prior strength receipt must now be STALE (EVIDENCE_CHANGED)
    const staleRes = await request(app)
      .post(`/api/v1/cases/${cid}/assistant/freshness`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({ receipts: [receipt] });
    assert.equal(staleRes.status, 200);
    assert.equal(validateFreshnessSchema(staleRes.body), true);
    assert.equal(staleRes.body.results[0].status, 'STALE');
    assert.equal(staleRes.body.results[0].reasonCode, 'EVIDENCE_CHANGED');
    assert.ok(
      staleRes.body.results[0].changedDependencyKeys.includes(`field:${rxFields.str._id}`)
    );
  });

  await t.test('3. Genuine 500 mg vs 650 mg discrepancy preserved; patient is read-only; cross-user/forged receipts are UNVERIFIABLE', async () => {
    const { vCase } = await seedCaseWithMedicinePair({
      rxStrength: '500 mg',
      invStrength: '650 mg'
    });
    const cid = String(vCase._id);

    // Patient A can query own case assistant (read-only)
    const patAns = await request(app)
      .post(`/api/v1/cases/${cid}/assistant/answers`)
      .set('Authorization', `Bearer ${tokenPatientA}`)
      .send({ message: 'Compare the prescription and invoice medicines' });
    assert.equal(patAns.status, 200);
    assert.equal(patAns.body.mode, 'LOCAL_CASE_EVIDENCE');
    assert.equal(patAns.body.intent, 'COMPARISON');
    assert.match(patAns.body.reply, /MISMATCH/);
    assert.match(patAns.body.reply, /500\s*mg/i);
    assert.match(patAns.body.reply, /650\s*mg/i);

    const patReceipt = {
      answerId: patAns.body.answerId,
      bindingToken: patAns.body.bindingToken
    };

    // Pharmacist A submitting Patient A's receipt gets UNVERIFIABLE (bound to userId)
    const crossUserFresh = await request(app)
      .post(`/api/v1/cases/${cid}/assistant/freshness`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({ receipts: [patReceipt] });
    assert.equal(crossUserFresh.status, 200);
    assert.equal(crossUserFresh.body.results[0].status, 'UNVERIFIABLE');
    assert.equal(crossUserFresh.body.results[0].reasonCode, 'INVALID_RECEIPT');

    // Submitting a foreign case receipt to another accessible case returns UNVERIFIABLE without loading foreign case
    const { vCase: secondCase } = await seedCaseWithMedicinePair();
    const foreignCaseFresh = await request(app)
      .post(`/api/v1/cases/${secondCase._id}/assistant/freshness`)
      .set('Authorization', `Bearer ${tokenPatientA}`)
      .send({ receipts: [patReceipt] });
    assert.equal(foreignCaseFresh.status, 200);
    assert.equal(foreignCaseFresh.body.results[0].status, 'UNVERIFIABLE');
    assert.equal(foreignCaseFresh.body.results[0].reasonCode, 'INVALID_RECEIPT');

    // Revoking Pharmacist A's tenant access to the case causes subsequent freshness check to return 404
    vCase.organizationId = orgB._id;
    await vCase.save();
    const revokedFresh = await request(app)
      .post(`/api/v1/cases/${cid}/assistant/freshness`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({ receipts: [patReceipt] });
    assert.equal(revokedFresh.status, 404);
  });

  await t.test('4. Concurrent case lock returns 409 CASE_BUSY and zero outbound HTTP/HTTPS requests occur', async () => {
    const { vCase } = await seedCaseWithMedicinePair();
    const cid = String(vCase._id);

    let outboundCalls = 0;
    const origHttpReq = http.request;
    const origHttpsReq = https.request;

    http.request = function (...args) {
      const first = args[0];
      const host =
        typeof first === 'string'
          ? first
          : first?.hostname || first?.host || '';
      if (host && !/^(127\.0\.0\.1|localhost|::1)/i.test(host)) {
        outboundCalls++;
      }
      return origHttpReq.apply(this, args);
    };
    https.request = function (...args) {
      outboundCalls++;
      return origHttpsReq.apply(this, args);
    };

    try {
      let releaseHold;
      const holdPromise = new Promise((resolve) => {
        releaseHold = resolve;
      });

      const guardTask = withCaseMutationGuard(cid, async () => {
        await holdPromise;
      });

      const busyAns = await request(app)
        .post(`/api/v1/cases/${cid}/assistant/answers`)
        .set('Authorization', `Bearer ${tokenPharmA}`)
        .send({ message: 'Show the recorded prescription strength' });
      assert.equal(busyAns.status, 409);
      assert.equal(busyAns.body.code, 'CASE_BUSY');

      const busyFresh = await request(app)
        .post(`/api/v1/cases/${cid}/assistant/freshness`)
        .set('Authorization', `Bearer ${tokenPharmA}`)
        .send({
          receipts: [
            {
              answerId: '11111111-1111-4111-8111-111111111111',
              bindingToken: 'pvr1.dummy.dummy'
            }
          ]
        });
      assert.equal(busyFresh.status, 409);
      assert.equal(busyFresh.body.code, 'CASE_BUSY');

      releaseHold();
      await guardTask;

      const normalAns = await request(app)
        .post(`/api/v1/cases/${cid}/assistant/answers`)
        .set('Authorization', `Bearer ${tokenPharmA}`)
        .send({ message: 'What is the current case verification status?' });
      assert.equal(normalAns.status, 200);
      assert.equal(outboundCalls, 0, 'Private case assistant must make zero external HTTP/HTTPS calls');
    } finally {
      http.request = origHttpReq;
      https.request = origHttpsReq;
    }
  });
});
