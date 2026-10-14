const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const http = require('http');
const https = require('https');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_trustrag_evidence_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-evidence';
process.env.GEMINI_API_KEY = 'test-only-gemini-key';
process.env.TRUSTRAG_LLM_ENABLED = 'false'; // Disabled by default per requirements

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
const EvidenceItem = require('../models/evidenceItemModel');
const CanonicalMedicine = require('../models/canonicalMedicineModel');

const evidenceRoutingService = require('../services/trustRag/evidenceRoutingService');
const deterministicExplainabilityService = require('../services/trustRag/deterministicExplainabilityService');
const llmExplainabilityService = require('../services/trustRag/llmExplainabilityService');
const localOcrService = require('../services/trustRag/localOcrService');
const MockOcrProvider = require('../services/trustRag/mockOcrProvider');
const { seedCanonicalCatalogue } = require('../seeders/catalogueSeeder');

const validPdfBase64 = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 minimal test pdf %%EOF').toString('base64');
const validPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const createAuthToken = (user) => {
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

test('TrustRAG Evidence Routing & Explainability Test Suite (WO 3A.2)', async (t) => {
  let dbConnection;
  let testOrg;
  let patientUser, claimsReviewerUser;
  let patientToken, reviewerToken;

  t.before(async () => {
    dbConnection = await mongoose.connect(process.env.MONGO_URI);
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
      EvidenceItem.deleteMany({}),
      CanonicalMedicine.deleteMany({})
    ]);

    await seedCanonicalCatalogue({ silent: true });

    const ownerId = new mongoose.Types.ObjectId();
    testOrg = await Organization.create({
      name: 'TrustRAG Evidence Verification Center',
      owner: ownerId,
      plan: 'Enterprise',
      status: 'active'
    });

    patientUser = await User.create({
      _id: ownerId,
      name: 'Alice Patient',
      email: 'alice.evidence@example.com',
      password: 'Password123!',
      role: 'patient',
      organizationId: testOrg._id
    });

    claimsReviewerUser = await User.create({
      name: 'Adjudicator Bob',
      email: 'bob.reviewer@example.com',
      password: 'Password123!',
      role: 'claims_reviewer',
      organizationId: testOrg._id
    });

    patientToken = createAuthToken(patientUser);
    reviewerToken = createAuthToken(claimsReviewerUser);
  });

  t.after(async () => {
    if (dbConnection) {
      await mongoose.connection.close();
    }
  });

  // 1. Evidence Routing Across the 3 Controlled Sources
  await t.test('1. Evidence routing routes across all 3 controlled sources (Private Case, Canonical, Official Registry)', async () => {
    const vCase = await VerificationCase.create({
      organizationId: testOrg._id,
      createdBy: patientUser._id,
      subjectReference: 'anon-evidence-test',
      status: 'READY_FOR_PROCESSING',
      schemaVersion: '1.0'
    });

    const doc = await Document.create({
      caseId: vCase._id,
      type: 'PRESCRIPTION',
      objectStorageKey: `cases/${vCase._id}/test.pdf`,
      originalFilename: 'rx_official_test.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      uploadedBy: patientUser._id
    });

    const field = await ExtractedField.create({
      caseId: vCase._id,
      documentId: doc._id,
      fieldType: 'medicine_name',
      rawValue: 'Crocin 500mg',
      normalizedValue: 'Paracetamol',
      pageNumber: 1,
      boundingBox: [0.1, 0.1, 0.4, 0.2],
      extractionConfidence: 0.98
    });

    const resolutions = {
      PRESCRIPTION: {
        resolved: true,
        canonical: {
          _id: new mongoose.Types.ObjectId(),
          genericName: 'Paracetamol',
          brandName: 'Crocin',
          strength: '500',
          strengthUnit: 'mg',
          dosageForm: 'Tablet',
          manufacturer: 'GSK'
        }
      }
    };

    const evidenceList = await evidenceRoutingService.routeAllEvidence({
      caseId: vCase._id,
      documents: [doc],
      fields: [field],
      resolutions
    });

    assert.ok(evidenceList.length >= 3, `Expected at least 3 evidence items across the 3 sources, got ${evidenceList.length}`);

    // Verify Source A: Private Case Data
    const caseDocEvidence = evidenceList.find(e => e.sourceType === 'CASE_DOCUMENT');
    assert.ok(caseDocEvidence, 'Should contain CASE_DOCUMENT evidence');
    assert.strictEqual(caseDocEvidence.pageNumber, 1);
    assert.ok(caseDocEvidence.evidenceText.includes('Crocin 500mg'));
    assert.strictEqual(caseDocEvidence.trustTier, 4);

    // Verify Source B: Curated Medicine Knowledge
    const canonicalEvidence = evidenceList.find(e => e.sourceType === 'CANONICAL_CATALOG');
    assert.ok(canonicalEvidence, 'Should contain CANONICAL_CATALOG evidence');
    assert.ok(canonicalEvidence.evidenceText.includes('Paracetamol'));
    assert.strictEqual(canonicalEvidence.trustTier, 4);

    // Verify Source C: Approved Official Sources (CDSCO / IPC / WHO)
    const officialEvidence = evidenceList.find(e => e.sourceType === 'OFFICIAL_REGISTRY');
    assert.ok(officialEvidence, 'Should contain OFFICIAL_REGISTRY evidence');
    assert.ok(officialEvidence.sourceUrl.includes('cdsco.gov.in') || officialEvidence.sourceUrl.includes('ipc.gov.in'));
    assert.ok(officialEvidence.trustTier >= 4);
    assert.ok(officialEvidence.relevanceReason.length > 0);
  });

  // 2. No Outbound Web Requests Occur
  await t.test('2. Evidence routing makes zero outbound HTTP/HTTPS requests (Strict local registry)', async () => {
    let outboundCallMade = false;

    // Spy on http.request and https.request
    const originalHttpRequest = http.request;
    const originalHttpsRequest = https.request;

    http.request = function (...args) {
      outboundCallMade = true;
      throw new Error('Outbound HTTP request prohibited during evidence routing');
    };

    https.request = function (...args) {
      outboundCallMade = true;
      throw new Error('Outbound HTTPS request prohibited during evidence routing');
    };

    try {
      const vCase = await VerificationCase.create({
        organizationId: testOrg._id,
        createdBy: patientUser._id,
        status: 'READY_FOR_PROCESSING',
        schemaVersion: '1.0'
      });

      const resolutions = {
        CLAIM_FORM: {
          resolved: true,
          canonical: {
            genericName: 'Metformin',
            dosageForm: 'Tablet'
          }
        }
      };

      await evidenceRoutingService.routeApprovedOfficialSources({
        caseId: vCase._id,
        resolutions
      });

      assert.strictEqual(outboundCallMade, false, 'No outbound network call should be initiated during evidence routing');
    } finally {
      http.request = originalHttpRequest;
      https.request = originalHttpsRequest;
    }
  });

  // 3. Insufficient Evidence Fallback
  await t.test('3. Deterministic explainability returns insufficient evidence fallback when evidence is missing', () => {
    const vCase = { _id: 'fake-case-id', status: 'DRAFT' };

    // Case with zero evidence items
    const explanation = deterministicExplainabilityService.generateExplanation({
      vCase,
      documents: [],
      fields: [],
      checks: [],
      signals: [],
      evidenceItems: []
    });

    assert.strictEqual(explanation.summary, 'Insufficient evidence for verification.');
    assert.strictEqual(explanation.hasSufficientEvidence, false);
    assert.strictEqual(explanation.findings.length, 0);
    assert.strictEqual(explanation.citedEvidenceIds.length, 0);
    assert.ok(explanation.disclaimer.includes('Not medical advice'));
  });

  // 4. Grounded Explanation with Evidence Citations
  await t.test('4. Deterministic explainability generates structured explanation where every finding references EvidenceItem IDs', async () => {
    const ev1Id = new mongoose.Types.ObjectId();
    const ev2Id = new mongoose.Types.ObjectId();

    const mockEvidence = [
      {
        _id: ev1Id,
        id: ev1Id.toString(),
        sourceType: 'CASE_DOCUMENT',
        claimSupported: 'Document Field: medicine_name',
        evidenceText: 'Prescription indicates Paracetamol 500mg',
        trustTier: 4
      },
      {
        _id: ev2Id,
        id: ev2Id.toString(),
        sourceType: 'OFFICIAL_REGISTRY',
        claimSupported: 'Official Regulatory Formulary Status',
        evidenceText: 'CDSCO formulation approved for antipyretic indication',
        trustTier: 5
      }
    ];

    const mockChecks = [
      {
        checkType: 'MEDICINE_NAME_CONSISTENCY',
        status: 'PASS',
        severity: 'INFO',
        message: 'Prescription and Invoice medicine names align.',
        evidenceItemIds: [ev1Id]
      }
    ];

    const mockSignals = [
      {
        signalType: 'INSUFFICIENT_EVIDENCE',
        severity: 'LOW',
        description: 'Only 2 documents present.',
        evidenceItemIds: [ev1Id]
      }
    ];

    const explanation = deterministicExplainabilityService.generateExplanation({
      vCase: { status: 'NEEDS_REVIEW' },
      documents: [{ _id: 'doc1' }],
      fields: [],
      checks: mockChecks,
      signals: mockSignals,
      evidenceItems: mockEvidence
    });

    assert.strictEqual(explanation.hasSufficientEvidence, true);
    assert.ok(explanation.findings.length > 0);

    // Every finding must reference one or more EvidenceItem IDs
    for (const finding of explanation.findings) {
      assert.ok(Array.isArray(finding.evidenceItemIds));
      assert.ok(finding.evidenceItemIds.length > 0, 'Every finding must cite evidence IDs');
    }

    assert.ok(explanation.citedEvidenceIds.includes(ev1Id.toString()));
    assert.ok(explanation.summary.includes('Evidence items'));
  });

  // 5. LLM Adapter Guard: Rejects Ungrounded / Hallucinated Findings
  await t.test('5. LLM adapter falls back to deterministic explanation if LLM generates ungrounded findings', async () => {
    const validEvId = new mongoose.Types.ObjectId().toString();

    const context = {
      vCase: { status: 'NEEDS_REVIEW' },
      documents: [{ _id: 'doc1' }],
      fields: [],
      checks: [{ checkType: 'MEDICINE_NAME_CONSISTENCY', status: 'PASS', message: 'Aligned', evidenceItemIds: [validEvId] }],
      signals: [],
      evidenceItems: [
        {
          _id: validEvId,
          id: validEvId,
          sourceType: 'CASE_DOCUMENT',
          claimSupported: 'Medicine Name',
          evidenceText: 'Crocin 500mg'
        }
      ]
    };

    // Test with LLM disabled (default)
    const disabledResult = await llmExplainabilityService.generateExplanation(context);
    assert.strictEqual(disabledResult.generatedBy, 'DETERMINISTIC_ENGINE');

    // Test validator rejection of hallucinated finding (evidenceId not in ground truth set)
    const hallucinatedLlmOutput = {
      summary: 'Patient has diabetes (hallucinated finding)',
      findings: [
        {
          statement: 'Prescription verified',
          evidenceItemIds: ['hallucinated-fake-id-not-in-evidence'],
          status: 'VERIFIED'
        }
      ],
      evidenceItemIds: ['hallucinated-fake-id-not-in-evidence'],
      uncertainty: 'LOW'
    };

    const validIds = new Set([validEvId]);
    const isValid = llmExplainabilityService._validateLlmOutput(hallucinatedLlmOutput, validIds);
    assert.strictEqual(isValid, false, 'Validator must reject findings citing ungrounded evidence IDs');
  });

  // 6. Human-in-the-Loop Terminology: Public Action Labels Mapping
  await t.test('6. Reviewer action endpoint accepts public action labels (VERIFY, RETURN_FOR_CORRECTION, ESCALATE) with proper audit', async () => {
    // 6a. VERIFY action
    const caseVerify = await VerificationCase.create({
      organizationId: testOrg._id,
      createdBy: patientUser._id,
      status: 'NEEDS_REVIEW',
      reviewRequired: true,
      schemaVersion: '1.0'
    });

    const verifyRes = await request(app)
      .post(`/api/v1/cases/${caseVerify._id}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        action: 'VERIFY',
        reasonCode: 'CROSS_DOCUMENT_EVIDENCE_SATISFIED',
        notes: 'Clinical alignment confirmed against IP monograph.'
      });

    assert.strictEqual(verifyRes.status, 201);
    assert.strictEqual(verifyRes.body.publicAction, 'VERIFY');
    assert.strictEqual(verifyRes.body.decision, 'APPROVE'); // Internal backward compatible stored value
    assert.strictEqual(verifyRes.body.newCaseStatus, 'VERIFIED');

    const updatedCaseVerify = await VerificationCase.findById(caseVerify._id);
    assert.strictEqual(updatedCaseVerify.status, 'VERIFIED');
    assert.strictEqual(updatedCaseVerify.reviewRequired, false);

    // 6b. RETURN_FOR_CORRECTION action
    const caseReturn = await VerificationCase.create({
      organizationId: testOrg._id,
      createdBy: patientUser._id,
      status: 'NEEDS_REVIEW',
      reviewRequired: true,
      schemaVersion: '1.0'
    });

    const returnRes = await request(app)
      .post(`/api/v1/cases/${caseReturn._id}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        action: 'RETURN_FOR_CORRECTION',
        reasonCode: 'ILLEGIBLE_DOSAGE_STRENGTH',
        notes: 'User must clarify whether 500mg or 650mg.'
      });

    assert.strictEqual(returnRes.status, 201);
    assert.strictEqual(returnRes.body.publicAction, 'RETURN_FOR_CORRECTION');
    assert.strictEqual(returnRes.body.decision, 'REQUEST_CLARIFICATION'); // Internal backward compatible
    assert.strictEqual(returnRes.body.newCaseStatus, 'NEEDS_CORRECTION');

    const updatedCaseReturn = await VerificationCase.findById(caseReturn._id);
    assert.strictEqual(updatedCaseReturn.status, 'NEEDS_CORRECTION');
    assert.strictEqual(updatedCaseReturn.reviewRequired, true);

    // 6c. ESCALATE action
    const caseEscalate = await VerificationCase.create({
      organizationId: testOrg._id,
      createdBy: patientUser._id,
      status: 'NEEDS_REVIEW',
      reviewRequired: true,
      schemaVersion: '1.0'
    });

    const escalateRes = await request(app)
      .post(`/api/v1/cases/${caseEscalate._id}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        action: 'ESCALATE',
        reasonCode: 'POTENTIAL_OFF_LABEL_USE',
        notes: 'Escalated to senior medical director for review.'
      });

    assert.strictEqual(escalateRes.status, 201);
    assert.strictEqual(escalateRes.body.publicAction, 'ESCALATE');
    assert.strictEqual(escalateRes.body.decision, 'ESCALATE');
    assert.strictEqual(escalateRes.body.newCaseStatus, 'NEEDS_REVIEW');

    // 6d. Audit event verification for public action labels
    const auditEvent = await AuditEvent.findOne({
      caseId: caseVerify._id,
      action: 'REVIEW_DECISION_RECORDED'
    });
    assert.ok(auditEvent);
    assert.strictEqual(auditEvent.metadata.publicAction, 'VERIFY');
    assert.strictEqual(auditEvent.metadata.decision, 'APPROVE');
  });

  // 7. Full End-to-End Orchestration: Results Contain Grounded Explanation & Cited Evidence
  await t.test('7. End-to-End case processing outputs explainable result and cited evidence via /api/v1/results and /api/v1/evidence', async () => {
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
            { text: 'Crocin 500mg', confidence: 0.95, bbox: [0.1, 0.1, 0.4, 0.2] },
            { text: '500mg', confidence: 0.95, bbox: [0.7, 0.1, 0.8, 0.2] },
            { text: 'Qty: 10', confidence: 0.95, bbox: [0.5, 0.1, 0.6, 0.2] },
            { text: '2026-08-01', confidence: 0.95, bbox: [0.1, 0.3, 0.3, 0.4] }
          ],
          words: [],
          imageDimensions: { width: 1000, height: 1000 }
        };
      }
      // Invoice
      return {
        rawText: 'Crocin 500mg\n500mg\nQty: 10\nTotal: 150.00\n2026-08-02\nCity Pharmacy',
        confidence: 0.95,
        lines: [
          { text: 'Crocin 500mg', confidence: 0.95, bbox: [0.1, 0.1, 0.4, 0.2] },
          { text: '500mg', confidence: 0.95, bbox: [0.7, 0.1, 0.8, 0.2] },
          { text: 'Qty: 10', confidence: 0.95, bbox: [0.5, 0.1, 0.6, 0.2] },
          { text: 'Total: 150.00', confidence: 0.95, bbox: [0.1, 0.3, 0.3, 0.4] },
          { text: '2026-08-02', confidence: 0.95, bbox: [0.4, 0.3, 0.6, 0.4] }
        ],
        words: [],
        imageDimensions: { width: 1000, height: 1000 }
      };
    });
    localOcrService.setProvider(mockProvider);

    try {
      // 7a. Create case
      const caseRes = await request(app)
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ subjectReference: 'patient-wo3a2-e2e' });
      const caseId = caseRes.body.id;

      // 7b. Upload Prescription & Invoice
      await request(app)
        .post(`/api/v1/cases/${caseId}/documents`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          type: 'PRESCRIPTION',
          filename: 'rx_e2e.png',
          mimeType: 'image/png',
          file: validPngBase64
        });

      await request(app)
        .post(`/api/v1/cases/${caseId}/documents`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          type: 'PHARMACY_INVOICE',
          filename: 'inv_e2e.png',
          mimeType: 'image/png',
          file: validPngBase64
        });

      // 7c. Process case
      const procRes = await request(app)
        .post(`/api/v1/cases/${caseId}/process`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({});
      assert.strictEqual(procRes.status, 202);
      assert.ok(procRes.body.explanation);
      assert.ok(procRes.body.evidenceCount > 0);

      // 7d. Query /results
      const resultsRes = await request(app)
        .get(`/api/v1/cases/${caseId}/results`)
        .set('Authorization', `Bearer ${patientToken}`);
      assert.strictEqual(resultsRes.status, 200);
      assert.ok(resultsRes.body.explanation);
      assert.ok(resultsRes.body.explanation.summary.length > 0);
      assert.ok(Array.isArray(resultsRes.body.explanation.findings));
      assert.ok(Array.isArray(resultsRes.body.explanation.citedEvidenceIds));
      assert.ok(resultsRes.body.evidenceItems.length > 0);

      // 7e. Query /evidence
      const evidenceRes = await request(app)
        .get(`/api/v1/cases/${caseId}/evidence`)
        .set('Authorization', `Bearer ${patientToken}`);
      assert.strictEqual(evidenceRes.status, 200);
      assert.ok(evidenceRes.body.length >= 2);
      const sourceTypes = evidenceRes.body.map(e => e.sourceType);
      assert.ok(sourceTypes.includes('CASE_DOCUMENT'));
      assert.ok(sourceTypes.includes('CANONICAL_CATALOG'));
    } finally {
      localOcrService.setProvider(originalProvider);
    }
  });
});
