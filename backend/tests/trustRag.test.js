const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_trustrag_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-trustrag';
process.env.GEMINI_API_KEY = 'test-only-gemini-key';

const app = require('../app');
const User = require('../models/userModel');
const Organization = require('../models/organizationModel');
const VerificationCase = require('../models/verificationCaseModel');
const Document = require('../models/documentModel');
const ExtractedField = require('../models/extractedFieldModel');
const ConsistencyCheck = require('../models/consistencyCheckModel');
const RiskSignal = require('../models/riskSignalModel');
const ReviewDecision = require('../models/reviewDecisionModel');
const AuditEvent = require('../models/auditEventModel');
const CanonicalMedicine = require('../models/canonicalMedicineModel');

const localOcrService = require('../services/trustRag/localOcrService');
const MockOcrProvider = require('../services/trustRag/mockOcrProvider');
const { seedCanonicalCatalogue } = require('../seeders/catalogueSeeder');
const { assertTestDatabase } = require('../utils/testDatabaseGuard');

const createAuthToken = (user) => {
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

const validPdfBase64 = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 minimal test pdf %%EOF').toString('base64');
const validPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('TrustRAG Verification Case MVP Test Suite', async (t) => {
  let dbConnection;
  let orgA, orgB;
  let patient1, patient2, pharmacistA, claimsReviewerA, pharmacistB;
  let tokenP1, tokenP2, tokenPharmA, tokenClaimsA, tokenPharmB;

  t.before(async () => {
    assertTestDatabase(process.env.MONGO_URI);
    dbConnection = await mongoose.connect(process.env.MONGO_URI);
    assertTestDatabase(dbConnection);
    // Clean collections before test run
    await Promise.all([
      User.deleteMany({}),
      Organization.deleteMany({}),
      VerificationCase.deleteMany({}),
      Document.deleteMany({}),
      ExtractedField.deleteMany({}),
      ConsistencyCheck.deleteMany({}),
      RiskSignal.deleteMany({}),
      ReviewDecision.deleteMany({}),
      AuditEvent.deleteMany({}),
      CanonicalMedicine.deleteMany({})
    ]);

    await seedCanonicalCatalogue({ silent: true });

    const ownerIdA = new mongoose.Types.ObjectId();
    const ownerIdB = new mongoose.Types.ObjectId();

    // Setup Organizations
    orgA = await Organization.create({
      name: 'City Care Hospital Pharmacy',
      owner: ownerIdA,
      plan: 'Enterprise',
      status: 'active'
    });

    orgB = await Organization.create({
      name: 'Apex Health Network',
      owner: ownerIdB,
      plan: 'Enterprise',
      status: 'active'
    });

    // Setup Users
    patient1 = await User.create({
      _id: ownerIdA,
      name: 'John Doe',
      email: 'john.doe@example.com',
      password: 'Password123!',
      role: 'patient',
      organizationId: orgA._id
    });

    patient2 = await User.create({
      _id: ownerIdB,
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      password: 'Password123!',
      role: 'patient',
      organizationId: orgB._id
    });

    pharmacistA = await User.create({
      name: 'Dr. Sarah Connor',
      email: 'sarah.pharm@orgA.com',
      password: 'Password123!',
      role: 'pharmacist',
      organizationId: orgA._id
    });

    claimsReviewerA = await User.create({
      name: 'Adjudicator Mike',
      email: 'mike.claims@orgA.com',
      password: 'Password123!',
      role: 'claims_reviewer',
      organizationId: orgA._id
    });

    pharmacistB = await User.create({
      name: 'Dr. Kevin Patel',
      email: 'kevin.pharm@orgB.com',
      password: 'Password123!',
      role: 'pharmacist',
      organizationId: orgB._id
    });

    tokenP1 = createAuthToken(patient1);
    tokenP2 = createAuthToken(patient2);
    tokenPharmA = createAuthToken(pharmacistA);
    tokenClaimsA = createAuthToken(claimsReviewerA);
    tokenPharmB = createAuthToken(pharmacistB);
  });

  t.after(async () => {
    if (dbConnection) {
      await mongoose.connection.close();
    }
  });

  // 1. Unauthenticated Access
  await t.test('1. Unauthenticated access returns 401 on /api/v1 endpoints', async () => {
    const endpoints = [
      { method: 'post', path: '/api/v1/cases' },
      { method: 'get', path: '/api/v1/cases' },
      { method: 'get', path: '/api/v1/review-queue' }
    ];

    for (const ep of endpoints) {
      const res = await request(app)[ep.method](ep.path);
      assert.strictEqual(res.status, 401, `Expected 401 for ${ep.method.toUpperCase()} ${ep.path}`);
      assert.strictEqual(res.body.message, 'Not authorized, no token');
    }
  });

  // 2. Patient Ownership Isolation
  await t.test('2. Patient ownership isolation: Patient A cannot access Patient B case', async () => {
    // Patient 1 creates a case
    const createRes = await request(app)
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${tokenP1}`)
      .send({ subjectReference: 'patient-anon-001' });

    assert.strictEqual(createRes.status, 201);
    const caseIdP1 = createRes.body.id;
    assert.ok(caseIdP1);

    // Patient 2 attempts to get Patient 1's case -> 404 (isolated)
    const getResP2 = await request(app)
      .get(`/api/v1/cases/${caseIdP1}`)
      .set('Authorization', `Bearer ${tokenP2}`);
    assert.strictEqual(getResP2.status, 404);

    // Patient 2 lists cases -> should not include Patient 1's case
    const listResP2 = await request(app)
      .get('/api/v1/cases')
      .set('Authorization', `Bearer ${tokenP2}`);
    assert.strictEqual(listResP2.status, 200);
    const foundInP2 = listResP2.body.some(c => c.id === caseIdP1 || c._id === caseIdP1);
    assert.strictEqual(foundInP2, false, "Patient 1 case should not appear in Patient 2's list");
  });

  // 3. Multi-Tenant Isolation
  await t.test('3. Tenant isolation: Staff in Org B cannot access Org A case', async () => {
    // Create case in Org A
    const caseA = await VerificationCase.create({
      organizationId: orgA._id,
      createdBy: patient1._id,
      subjectReference: 'anon-tenant-test',
      status: 'DRAFT',
      schemaVersion: '1.0'
    });

    // Pharmacist B (Org B) requests Org A's case -> 404 (tenant isolation obscurity)
    const resB = await request(app)
      .get(`/api/v1/cases/${caseA._id}`)
      .set('Authorization', `Bearer ${tokenPharmB}`);
    assert.strictEqual(resB.status, 404, 'Org B staff should receive 404 for Org A case');

    // Pharmacist A (Org A) requests Org A's case -> 200 OK
    const resA = await request(app)
      .get(`/api/v1/cases/${caseA._id}`)
      .set('Authorization', `Bearer ${tokenPharmA}`);
    assert.strictEqual(resA.status, 200, 'Org A staff should access Org A case');
  });

  // 4. Role Permissions: Review Queue & Adjudication
  await t.test('4. Review queue & review action access control', async () => {
    // Patient attempts to access review queue -> 403 Forbidden
    const patientQueueRes = await request(app)
      .get('/api/v1/review-queue')
      .set('Authorization', `Bearer ${tokenP1}`);
    assert.strictEqual(patientQueueRes.status, 403);

    // Pharmacist A accesses review queue -> 200 OK
    const pharmQueueRes = await request(app)
      .get('/api/v1/review-queue')
      .set('Authorization', `Bearer ${tokenPharmA}`);
    assert.strictEqual(pharmQueueRes.status, 200);

    // Claims Reviewer accesses review queue -> 200 OK
    const claimsQueueRes = await request(app)
      .get('/api/v1/review-queue')
      .set('Authorization', `Bearer ${tokenClaimsA}`);
    assert.strictEqual(claimsQueueRes.status, 200);

    // Create a dummy case in NEEDS_REVIEW
    const reviewCase = await VerificationCase.create({
      organizationId: orgA._id,
      createdBy: patient1._id,
      subjectReference: 'anon-hitl-test',
      status: 'NEEDS_REVIEW',
      reviewRequired: true,
      schemaVersion: '1.0'
    });

    // Patient attempts to submit review -> 403 Forbidden
    const patientReviewRes = await request(app)
      .post(`/api/v1/cases/${reviewCase._id}/reviews`)
      .set('Authorization', `Bearer ${tokenP1}`)
      .send({ decision: 'APPROVE', reasonCode: 'SELF_APPROVAL_ATTEMPT' });
    assert.strictEqual(patientReviewRes.status, 403, 'Patient cannot review cases');
  });

  // 5. Invalid Lifecycle Transitions
  await t.test('5. Invalid lifecycle transitions are rejected with 400', async () => {
    const draftCase = await VerificationCase.create({
      organizationId: orgA._id,
      createdBy: patient1._id,
      status: 'DRAFT',
      schemaVersion: '1.0'
    });

    // 5a. Patient attempting to patch case -> 403 Forbidden
    const patientPatchRes = await request(app)
      .patch(`/api/v1/cases/${draftCase._id}`)
      .set('Authorization', `Bearer ${tokenP1}`)
      .send({ status: 'CLOSED' });
    assert.strictEqual(patientPatchRes.status, 403, 'Patient cannot patch case directly');

    // 5b. Staff closing a DRAFT case directly -> 400 Bad Request
    const closeRes = await request(app)
      .patch(`/api/v1/cases/${draftCase._id}`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({ status: 'CLOSED' });
    assert.strictEqual(closeRes.status, 400, 'Cannot close case in DRAFT state');

    // 5c. Staff attempting to bypass ReviewDecision to set VERIFIED -> 400 Bad Request
    const setVerifiedRes = await request(app)
      .patch(`/api/v1/cases/${draftCase._id}`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({ status: 'VERIFIED' });
    assert.strictEqual(setVerifiedRes.status, 400, 'Cannot set VERIFIED via case PATCH');

    // 5d. Staff attempting to inject internal explanation metadata -> 400 Bad Request
    const injectMetaRes = await request(app)
      .patch(`/api/v1/cases/${draftCase._id}`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({ metadata: { explanation: 'tampered-explanation' } });
    assert.strictEqual(injectMetaRes.status, 400, 'Cannot inject internal explanation metadata');

    // 5b. Processing a case with no documents
    const procRes = await request(app)
      .post(`/api/v1/cases/${draftCase._id}/process`)
      .set('Authorization', `Bearer ${tokenP1}`);
    assert.strictEqual(procRes.status, 400, 'Cannot process case without documents');

    // 5c. Reviewing a DRAFT case
    const reviewDraftRes = await request(app)
      .post(`/api/v1/cases/${draftCase._id}/reviews`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({ decision: 'APPROVE', reasonCode: 'PREMATURE_REVIEW' });
    assert.strictEqual(reviewDraftRes.status, 400, 'Cannot review case in DRAFT state');

    // 5d. Uploading document with absent file content returns 400
    const emptyUploadRes = await request(app)
      .post(`/api/v1/cases/${draftCase._id}/documents`)
      .set('Authorization', `Bearer ${tokenP1}`)
      .send({ type: 'PRESCRIPTION' });
    assert.strictEqual(emptyUploadRes.status, 400, 'Empty document upload must return 400');
    assert.match(emptyUploadRes.body.message, /file payload is required/i);

    // 5e. Uploading document with empty string file returns 400
    const emptyStringRes = await request(app)
      .post(`/api/v1/cases/${draftCase._id}/documents`)
      .set('Authorization', `Bearer ${tokenP1}`)
      .send({ type: 'PRESCRIPTION', file: '   ' });
    assert.strictEqual(emptyStringRes.status, 400, 'Blank document file must return 400');
    assert.match(emptyStringRes.body.message, /cannot be empty/i);

    // 5f. Uploading document with malformed base64 data returns 400
    const malformedRes = await request(app)
      .post(`/api/v1/cases/${draftCase._id}/documents`)
      .set('Authorization', `Bearer ${tokenP1}`)
      .send({ type: 'PRESCRIPTION', file: 'data:application/pdf;base64,' });
    assert.strictEqual(malformedRes.status, 400, 'Malformed base64 URI must return 400');
    assert.match(malformedRes.body.message, /malformed/i);
  });

  // 6. Complete Golden Workflow: End-to-End TrustRAG Case
  await t.test('6. Complete Golden Workflow: Ingestion -> Extraction -> Checks -> Signals -> HITL Adjudication', async () => {
    const originalProvider = localOcrService.getProvider();
    const mockProvider = new MockOcrProvider();
    let callIdx = 0;
    mockProvider.setMockResult(() => {
      callIdx++;
      if (callIdx === 1) {
        // Prescription
        return {
          rawText: 'Crocin 500mg\n500mg\nQty: 10\n2026-08-01\nDr. Sharma',
          confidence: 0.95,
          lines: [
            { text: 'Crocin 500mg', confidence: 0.95, bbox: [0.1, 0.2, 0.4, 0.25] },
            { text: '500mg', confidence: 0.95, bbox: [0.45, 0.2, 0.55, 0.25] },
            { text: 'Qty: 10', confidence: 0.95, bbox: [0.6, 0.2, 0.7, 0.25] },
            { text: '2026-08-01', confidence: 0.95, bbox: [0.75, 0.1, 0.9, 0.15] },
            { text: 'Dr. Sharma', confidence: 0.95, bbox: [0.1, 0.5, 0.3, 0.55] }
          ],
          words: [],
          imageDimensions: { width: 1000, height: 1000 }
        };
      }
      if (callIdx === 2) {
        // Invoice
        return {
          rawText: 'Crocin 500mg\n500mg\nQty: 10\nTotal: 150.00\n2026-08-02\nCity Pharmacy',
          confidence: 0.95,
          lines: [
            { text: 'Crocin 500mg', confidence: 0.95, bbox: [0.1, 0.2, 0.4, 0.25] },
            { text: '500mg', confidence: 0.95, bbox: [0.45, 0.2, 0.55, 0.25] },
            { text: 'Qty: 10', confidence: 0.95, bbox: [0.6, 0.2, 0.7, 0.25] },
            { text: 'Total: 150.00', confidence: 0.95, bbox: [0.75, 0.1, 0.9, 0.15] },
            { text: '2026-08-02', confidence: 0.95, bbox: [0.75, 0.1, 0.9, 0.15] },
            { text: 'City Pharmacy', confidence: 0.95, bbox: [0.1, 0.5, 0.3, 0.55] }
          ],
          words: [],
          imageDimensions: { width: 1000, height: 1000 }
        };
      }
      // Claim form
      return {
        rawText: 'Crocin 500mg\n500mg\nQty: 10\nClaimed: 150.00\n2026-08-03',
        confidence: 0.95,
        lines: [
          { text: 'Crocin 500mg', confidence: 0.95, bbox: [0.1, 0.2, 0.4, 0.25] },
          { text: '500mg', confidence: 0.95, bbox: [0.45, 0.2, 0.55, 0.25] },
          { text: 'Qty: 10', confidence: 0.95, bbox: [0.6, 0.2, 0.7, 0.25] },
          { text: 'Claimed: 150.00', confidence: 0.95, bbox: [0.75, 0.1, 0.9, 0.15] },
          { text: '2026-08-03', confidence: 0.95, bbox: [0.75, 0.1, 0.9, 0.15] }
        ],
        words: [],
        imageDimensions: { width: 1000, height: 1000 }
      };
    });
    localOcrService.setProvider(mockProvider);

    try {
      // Step 1: Create Case
      const createCaseRes = await request(app)
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${tokenP1}`)
        .send({ subjectReference: 'patient-golden-flow-001' });

      assert.strictEqual(createCaseRes.status, 201);
      const caseId = createCaseRes.body.id;
      assert.strictEqual(createCaseRes.body.status, 'DRAFT');

      // Step 2: Upload 3 Supported Documents
      // 2a. Prescription
      const rxRes = await request(app)
        .post(`/api/v1/cases/${caseId}/documents`)
        .set('Authorization', `Bearer ${tokenP1}`)
        .send({
          type: 'PRESCRIPTION',
          filename: 'prescription_rx1.png',
          mimeType: 'image/png',
          file: validPngBase64
        });
      assert.strictEqual(rxRes.status, 201);
      assert.strictEqual(rxRes.body.type, 'PRESCRIPTION');

      // 2b. Pharmacy Invoice
      const invRes = await request(app)
        .post(`/api/v1/cases/${caseId}/documents`)
        .set('Authorization', `Bearer ${tokenP1}`)
        .send({
          type: 'PHARMACY_INVOICE',
          filename: 'invoice_inv1.png',
          mimeType: 'image/png',
          file: validPngBase64
        });
      assert.strictEqual(invRes.status, 201);

      // 2c. Claim Form
      const clmRes = await request(app)
        .post(`/api/v1/cases/${caseId}/documents`)
        .set('Authorization', `Bearer ${tokenP1}`)
        .send({
          type: 'CLAIM_FORM',
          filename: 'claim_clm1.png',
          mimeType: 'image/png',
          file: validPngBase64
        });
      assert.strictEqual(clmRes.status, 201);

      // Verify Case is now READY_FOR_PROCESSING
      const caseAfterDocs = await request(app)
        .get(`/api/v1/cases/${caseId}`)
        .set('Authorization', `Bearer ${tokenP1}`);
      assert.strictEqual(caseAfterDocs.status, 200);
      assert.strictEqual(caseAfterDocs.body.status, 'READY_FOR_PROCESSING');

      // Step 3: Trigger Processing Pipeline
      const procRes = await request(app)
        .post(`/api/v1/cases/${caseId}/process`)
        .set('Authorization', `Bearer ${tokenP1}`)
        .send({});
      assert.strictEqual(procRes.status, 202);

    // Verify Case transitioned to NEEDS_REVIEW or NEEDS_CORRECTION (System NEVER auto-approves or auto-rejects)
    const caseAfterProc = await request(app)
      .get(`/api/v1/cases/${caseId}`)
      .set('Authorization', `Bearer ${tokenP1}`);
    assert.ok(
      ['NEEDS_REVIEW', 'NEEDS_CORRECTION'].includes(caseAfterProc.body.status),
      `Expected NEEDS_REVIEW or NEEDS_CORRECTION, got ${caseAfterProc.body.status}`
    );
    assert.strictEqual(caseAfterProc.body.reviewRequired, true);

    // Step 4: Inspect Results & Lineage
    const resultsRes = await request(app)
      .get(`/api/v1/cases/${caseId}/results`)
      .set('Authorization', `Bearer ${tokenP1}`);
    assert.strictEqual(resultsRes.status, 200);
    assert.ok(resultsRes.body.consistencyChecks.length > 0, 'Should have executed consistency checks');
    assert.ok(resultsRes.body.extractedFields.length > 0, 'Should have extracted document fields');

    // Step 5: Test Extracted Field Correction (HITL)
    const firstField = resultsRes.body.extractedFields[0];

    // Patient cannot correct extracted fields -> 403 Forbidden
    const patientCorrectRes = await request(app)
      .patch(`/api/v1/cases/${caseId}/extracted-fields/${firstField._id || firstField.id}`)
      .set('Authorization', `Bearer ${tokenP1}`)
      .send({ normalizedValue: 'Patient Attempted Edit' });
    assert.strictEqual(patientCorrectRes.status, 403, 'Patient cannot correct extracted field');

    // Pharmacist A performs authorized field correction -> 200 OK
    const correctRes = await request(app)
      .patch(`/api/v1/cases/${caseId}/extracted-fields/${firstField._id || firstField.id}`)
      .set('Authorization', `Bearer ${tokenPharmA}`)
      .send({ normalizedValue: 'Paracetamol Verified' });
    assert.strictEqual(correctRes.status, 200);
    assert.strictEqual(correctRes.body.normalizedValue, 'Paracetamol Verified');
    assert.strictEqual(correctRes.body.needsCorrection, false);

    // Step 6: Pharmacist/Claims Reviewer Adjudication
    const reviewRes = await request(app)
      .post(`/api/v1/cases/${caseId}/reviews`)
      .set('Authorization', `Bearer ${tokenClaimsA}`)
      .send({
        decision: 'APPROVE',
        reasonCode: 'CONSISTENCY_VERIFIED_BY_REVIEWER',
        notes: 'Cross-document quantity and medicine alignment reviewed and confirmed.'
      });
    assert.strictEqual(reviewRes.status, 201);
    assert.strictEqual(reviewRes.body.decision, 'APPROVE');

    // Verify Case is now VERIFIED
    const caseVerified = await request(app)
      .get(`/api/v1/cases/${caseId}`)
      .set('Authorization', `Bearer ${tokenP1}`);
    assert.strictEqual(caseVerified.body.status, 'VERIFIED');

    // Step 7: Close Verified Case
    // Patient cannot close case directly -> 403 Forbidden
    const patientCloseRes = await request(app)
      .patch(`/api/v1/cases/${caseId}`)
      .set('Authorization', `Bearer ${tokenP1}`)
      .send({ status: 'CLOSED' });
    assert.strictEqual(patientCloseRes.status, 403, 'Patient cannot patch case directly');

    // Authorized claims reviewer closes verified case -> 200 OK
    const closeRes = await request(app)
      .patch(`/api/v1/cases/${caseId}`)
      .set('Authorization', `Bearer ${tokenClaimsA}`)
      .send({ status: 'CLOSED' });
    assert.strictEqual(closeRes.status, 200);
    assert.strictEqual(closeRes.body.status, 'CLOSED');
    } finally {
      localOcrService.setProvider(originalProvider);
    }
  });

  // 7. Audit Event Creation & Immutability
  await t.test('7. Immutable Audit Events are recorded for all lifecycle steps', async () => {
    // Find audit events recorded in previous test
    const events = await AuditEvent.find({}).sort('createdAt');
    assert.ok(events.length >= 5, `Expected at least 5 audit events, got ${events.length}`);

    const actions = events.map(e => e.action);
    assert.ok(actions.includes('CASE_CREATED'), 'Should record CASE_CREATED');
    assert.ok(actions.includes('DOCUMENT_UPLOADED'), 'Should record DOCUMENT_UPLOADED');
    assert.ok(actions.includes('PROCESSING_TRIGGERED'), 'Should record PROCESSING_TRIGGERED');
    assert.ok(actions.includes('PROCESSING_COMPLETED'), 'Should record PROCESSING_COMPLETED');
    assert.ok(actions.includes('REVIEW_DECISION_RECORDED'), 'Should record REVIEW_DECISION_RECORDED');
    assert.ok(actions.includes('CASE_CLOSED'), 'Should record CASE_CLOSED');

    // Verify immutability: attempting to update an audit event fails
    const sampleEvent = events[0];
    let updateFailed = false;
    try {
      await AuditEvent.updateOne({ _id: sampleEvent._id }, { action: 'MUTATED_ACTION' });
    } catch (e) {
      updateFailed = true;
      assert.match(e.message, /immutable/i);
    }
    assert.strictEqual(updateFailed, true, 'Updating audit event must throw error');

    // Test GET /api/v1/cases/:caseId/audit-trail endpoint
    if (sampleEvent.caseId) {
      const auditRes = await request(app)
        .get(`/api/v1/cases/${sampleEvent.caseId}/audit-trail`)
        .set('Authorization', `Bearer ${tokenP1}`);
      assert.strictEqual(auditRes.status, 200);
      assert.ok(Array.isArray(auditRes.body));
      assert.ok(auditRes.body.length > 0);
      const jsonStr = JSON.stringify(auditRes.body);
      assert.doesNotMatch(jsonStr, /jwt_secret|password|bearer/i);
    }
  });

  // 8. Risk Signals: Quantity Mismatch & Low Confidence Detection
  await t.test('8. Risk signal detection: triggers QUANTITY_MISMATCH when invoice exceeds rx', async () => {
    const originalProvider = localOcrService.getProvider();
    const mockProvider = new MockOcrProvider();
    let callIdx = 0;
    mockProvider.setMockResult(() => {
      callIdx++;
      if (callIdx === 1) {
        // Prescription (Quantity: 5)
        return {
          rawText: 'Crocin 500mg\n500mg\nQty: 5\n2026-08-01\nDr. Sharma',
          confidence: 0.95,
          lines: [
            { text: 'Crocin 500mg', confidence: 0.95, bbox: [0.1, 0.1, 0.4, 0.2] },
            { text: '500mg', confidence: 0.95, bbox: [0.7, 0.1, 0.8, 0.2] },
            { text: 'Qty: 5', confidence: 0.95, bbox: [0.5, 0.1, 0.6, 0.2] },
            { text: '2026-08-01', confidence: 0.95, bbox: [0.1, 0.3, 0.3, 0.4] }
          ],
          words: [],
          imageDimensions: { width: 1000, height: 1000 }
        };
      }
      // Invoice (Quantity: 20)
      return {
        rawText: 'Crocin 500mg\n500mg\nQty: 20\nTotal: 300.00\n2026-08-02\nCity Pharmacy',
        confidence: 0.95,
        lines: [
          { text: 'Crocin 500mg', confidence: 0.95, bbox: [0.1, 0.1, 0.4, 0.2] },
          { text: '500mg', confidence: 0.95, bbox: [0.7, 0.1, 0.8, 0.2] },
          { text: 'Qty: 20', confidence: 0.95, bbox: [0.5, 0.1, 0.6, 0.2] },
          { text: 'Total: 300.00', confidence: 0.95, bbox: [0.1, 0.3, 0.3, 0.4] },
          { text: '2026-08-02', confidence: 0.95, bbox: [0.4, 0.3, 0.6, 0.4] }
        ],
        words: [],
        imageDimensions: { width: 1000, height: 1000 }
      };
    });
    localOcrService.setProvider(mockProvider);

    try {
      // Create new case
      const caseRes = await request(app)
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${tokenP1}`)
        .send({ subjectReference: 'risk-signal-test' });
      const caseId = caseRes.body.id;

      // Upload Prescription (Quantity: 5)
      await request(app)
        .post(`/api/v1/cases/${caseId}/documents`)
        .set('Authorization', `Bearer ${tokenP1}`)
        .send({
          type: 'PRESCRIPTION',
          filename: 'rx_mismatch.png',
          mimeType: 'image/png',
          file: validPngBase64
        });

      // Upload Invoice (Quantity: 20 -> excessive dispensing)
      await request(app)
        .post(`/api/v1/cases/${caseId}/documents`)
        .set('Authorization', `Bearer ${tokenP1}`)
        .send({
          type: 'PHARMACY_INVOICE',
          filename: 'inv_mismatch.png',
          mimeType: 'image/png',
          file: validPngBase64
        });

      // Process case
      await request(app)
        .post(`/api/v1/cases/${caseId}/process`)
        .set('Authorization', `Bearer ${tokenP1}`)
        .send({});

      // Check risk signals in results
      const results = await request(app)
        .get(`/api/v1/cases/${caseId}/results`)
        .set('Authorization', `Bearer ${tokenP1}`);

      const hasQtyMismatch = results.body.activeSignals.some(s => s.signalType === 'QUANTITY_MISMATCH');
      assert.strictEqual(hasQtyMismatch, true, 'Should detect QUANTITY_MISMATCH signal when invoiced exceeds prescribed');
    } finally {
      localOcrService.setProvider(originalProvider);
    }
  });

  // 9. Synthetic FHIR Bundle Export
  await t.test('9. FHIR R4 Bundle endpoint exports structured standard representation', async () => {
    const listRes = await request(app)
      .get('/api/v1/cases')
      .set('Authorization', `Bearer ${tokenP1}`);
    const caseId = listRes.body[0].id || listRes.body[0]._id;

    const fhirRes = await request(app)
      .get(`/api/v1/cases/${caseId}/fhir-bundle`)
      .set('Authorization', `Bearer ${tokenP1}`);

    assert.strictEqual(fhirRes.status, 200);
    assert.strictEqual(fhirRes.body.resourceType, 'Bundle');
    assert.strictEqual(fhirRes.body.type, 'collection');
    assert.ok(Array.isArray(fhirRes.body.entry));
  });
});
