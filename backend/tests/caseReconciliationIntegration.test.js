'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { createRequire } = require('node:module');
const Ajv2020 = createRequire(require.resolve('ajv-cli/package.json'))('ajv/dist/2020');
const addFormats = require('ajv-formats');

const TEMP_STORAGE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'pharmavault-s3-test-'));

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_integration_v2_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-session3-integration';
process.env.GEMINI_API_KEY = 'test-only-gemini-key';
process.env.DOCUMENT_STORAGE_ROOT = TEMP_STORAGE_ROOT;

const app = require('../app');
const User = require('../models/userModel');
const Organization = require('../models/organizationModel');
const VerificationCase = require('../models/verificationCaseModel');
const Document = require('../models/documentModel');
const ExtractedField = require('../models/extractedFieldModel');
const EvidenceItem = require('../models/evidenceItemModel');
const ConsistencyCheck = require('../models/consistencyCheckModel');
const RiskSignal = require('../models/riskSignalModel');
const ReviewDecision = require('../models/reviewDecisionModel');
const AuditEvent = require('../models/auditEventModel');
const { assertTestDatabase } = require('../utils/testDatabaseGuard');
const { withCaseMutationGuard } = require('../services/trustRag/caseEvidenceMutationService');

const medicineItemSchema = require('../../contracts/schemas/medicine-item.schema.json');
const medicineReconciliationSchema = require('../../contracts/schemas/medicine-reconciliation.schema.json');
const { loadClient } = require('../../tests/integration-v2/load-client.cjs');
const { parseCaseSnapshot } = loadClient('integration/snapshot.ts');

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateMedicineItemEnvelope = ajv.compile(medicineItemSchema);
const validateMedicineReconciliation = ajv.compile(medicineReconciliationSchema);

const createAuthToken = (user) =>
  jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });

// Minimal valid 1x1 PNG buffer for upload tests
const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test('Session 3 Protected Case Integration and Human Review Suite', async (t) => {
  let dbConnection;
  const createdOrgIds = [];
  const createdUserIds = [];
  const createdCaseIds = [];

  let orgA, orgB;
  let patientOwner, otherPatient, pharmacistA, claimsReviewerA, orgAdminA, pharmacistB, superAdmin;
  let patientOwnerToken,
    otherPatientToken,
    pharmacistAToken,
    claimsReviewerAToken,
    orgAdminAToken,
    pharmacistBToken,
    superAdminToken;

  const trackCase = (vCase) => {
    createdCaseIds.push(vCase._id);
    return vCase;
  };

  t.before(async () => {
    assertTestDatabase(process.env.MONGO_URI);
    dbConnection = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 2000
    });
    assertTestDatabase(dbConnection);

    orgA = await Organization.create({
      name: 'Session 3 Test Org A',
      owner: new mongoose.Types.ObjectId(),
      plan: 'Enterprise',
      status: 'active'
    });
    createdOrgIds.push(orgA._id);

    orgB = await Organization.create({
      name: 'Session 3 Test Org B',
      owner: new mongoose.Types.ObjectId(),
      plan: 'Enterprise',
      status: 'active'
    });
    createdOrgIds.push(orgB._id);

    const uniqueSuffix = Date.now();

    patientOwner = await User.create({
      name: 'Patient Owner',
      email: `patient.owner.${uniqueSuffix}@example.com`,
      password: 'password123',
      role: 'patient',
      organizationId: orgA._id
    });
    createdUserIds.push(patientOwner._id);
    patientOwnerToken = createAuthToken(patientOwner);

    otherPatient = await User.create({
      name: 'Other Patient',
      email: `patient.other.${uniqueSuffix}@example.com`,
      password: 'password123',
      role: 'patient',
      organizationId: orgA._id
    });
    createdUserIds.push(otherPatient._id);
    otherPatientToken = createAuthToken(otherPatient);

    pharmacistA = await User.create({
      name: 'Pharmacist Org A',
      email: `pharmacist.a.${uniqueSuffix}@example.com`,
      password: 'password123',
      role: 'pharmacist',
      organizationId: orgA._id
    });
    createdUserIds.push(pharmacistA._id);
    pharmacistAToken = createAuthToken(pharmacistA);

    claimsReviewerA = await User.create({
      name: 'Claims Reviewer Org A',
      email: `claims.a.${uniqueSuffix}@example.com`,
      password: 'password123',
      role: 'claims_reviewer',
      organizationId: orgA._id
    });
    createdUserIds.push(claimsReviewerA._id);
    claimsReviewerAToken = createAuthToken(claimsReviewerA);

    orgAdminA = await User.create({
      name: 'Org Admin Org A',
      email: `orgadmin.a.${uniqueSuffix}@example.com`,
      password: 'password123',
      role: 'org_admin',
      organizationId: orgA._id
    });
    createdUserIds.push(orgAdminA._id);
    orgAdminAToken = createAuthToken(orgAdminA);

    pharmacistB = await User.create({
      name: 'Pharmacist Org B',
      email: `pharmacist.b.${uniqueSuffix}@example.com`,
      password: 'password123',
      role: 'pharmacist',
      organizationId: orgB._id
    });
    createdUserIds.push(pharmacistB._id);
    pharmacistBToken = createAuthToken(pharmacistB);

    superAdmin = await User.create({
      name: 'Super Admin',
      email: `superadmin.${uniqueSuffix}@example.com`,
      password: 'password123',
      role: 'super_admin'
    });
    createdUserIds.push(superAdmin._id);
    superAdminToken = createAuthToken(superAdmin);
  });

  t.after(async () => {
    if (dbConnection) {
      assertTestDatabase(dbConnection);
      if (createdCaseIds.length > 0) {
        await Promise.all([
          ExtractedField.deleteMany({ caseId: { $in: createdCaseIds } }),
          Document.deleteMany({ caseId: { $in: createdCaseIds } }),
          EvidenceItem.deleteMany({ caseId: { $in: createdCaseIds } }),
          ConsistencyCheck.deleteMany({ caseId: { $in: createdCaseIds } }),
          RiskSignal.deleteMany({ caseId: { $in: createdCaseIds } }),
          ReviewDecision.deleteMany({ caseId: { $in: createdCaseIds } }),
          AuditEvent.deleteMany({ caseId: { $in: createdCaseIds } }),
          VerificationCase.deleteMany({ _id: { $in: createdCaseIds } })
        ]);
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      if (createdOrgIds.length > 0) {
        await Organization.deleteMany({ _id: { $in: createdOrgIds } });
      }
      await mongoose.disconnect();
    }
    try {
      fs.rmSync(TEMP_STORAGE_ROOT, { recursive: true, force: true });
    } catch (_) {}
  });

  /**
   * Helper to create a case with a prescription and invoice document and extracted fields.
   */
  async function seedTwoItemCase(options = {}) {
    const vCase = trackCase(
      await VerificationCase.create({
        caseReference: `CASE-S3-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        organizationId: orgA._id,
        createdBy: patientOwner._id,
        subjectReference: 'subj-s3-test',
        status: options.status || 'NEEDS_REVIEW',
        reviewRequired: true,
        evidenceRevision: 1,
        metadata: {
          legacyFindingsRevision: 1
        }
      })
    );

    const rxDoc = await Document.create({
      caseId: vCase._id,
      type: 'PRESCRIPTION',
      originalFilename: 'rx.png',
      mimeType: 'image/png',
      fileSize: 1024,
      checksumSha256: 'a'.repeat(64),
      objectStorageKey: `cases/${vCase._id}/rx.png`,
      processingStatus: 'PROCESSED',
      pageCount: options.rxPageCount || 1,
      processedPageCount: options.rxProcessedPages || 1,
      omittedPageCount: options.rxOmittedPages || 0,
      pageCoverage: {
        total: options.rxPageCount || 1,
        processed: options.rxProcessedPages || 1,
        omitted: options.rxOmittedPages || 0,
        status: (options.rxOmittedPages || 0) > 0 ? 'INCOMPLETE' : 'COMPLETE'
      },
      uploadedBy: patientOwner._id
    });

    const invDoc = await Document.create({
      caseId: vCase._id,
      type: 'PHARMACY_INVOICE',
      originalFilename: 'invoice.png',
      mimeType: 'image/png',
      fileSize: 1024,
      checksumSha256: 'b'.repeat(64),
      objectStorageKey: `cases/${vCase._id}/invoice.png`,
      processingStatus: 'PROCESSED',
      pageCount: 1,
      processedPageCount: 1,
      omittedPageCount: 0,
      pageCoverage: {
        total: 1,
        processed: 1,
        omitted: 0,
        status: 'COMPLETE'
      },
      uploadedBy: patientOwner._id
    });

    const claimDoc = await Document.create({
      caseId: vCase._id,
      type: 'CLAIM_FORM',
      originalFilename: 'claim.png',
      mimeType: 'image/png',
      fileSize: 1024,
      checksumSha256: 'c'.repeat(64),
      objectStorageKey: `cases/${vCase._id}/claim.png`,
      processingStatus: 'PROCESSED',
      pageCount: 1,
      processedPageCount: 1,
      omittedPageCount: 0,
      pageCoverage: {
        total: 1,
        processed: 1,
        omitted: 0,
        status: 'COMPLETE'
      },
      uploadedBy: patientOwner._id
    });

    // Prescription: Row 1 = Paracetamol 650mg tablet qty 10, Row 2 = Azithromycin 500mg tablet qty 3
    const rxFields = await ExtractedField.insertMany([
      {
        caseId: vCase._id,
        documentId: rxDoc._id,
        fieldType: 'medicine_name',
        rawValue: '1. Paracetamol',
        normalizedValue: 'Paracetamol',
        pageNumber: 1,
        boundingBox: [0.1, 0.1, 0.5, 0.15],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: options.lowConfidenceRx ? 0.62 : 0.94,
        needsCorrection: Boolean(options.lowConfidenceRx),
        candidateRowKey: 'row_1'
      },
      {
        caseId: vCase._id,
        documentId: rxDoc._id,
        fieldType: 'dosage_strength',
        rawValue: '650 mg',
        normalizedValue: '650mg',
        pageNumber: 1,
        boundingBox: [0.1, 0.1, 0.5, 0.15],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.93,
        needsCorrection: false,
        candidateRowKey: 'row_1'
      },
      {
        caseId: vCase._id,
        documentId: rxDoc._id,
        fieldType: 'dosage_form',
        rawValue: 'tablet',
        normalizedValue: 'Tablet',
        pageNumber: 1,
        boundingBox: [0.1, 0.1, 0.5, 0.15],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.93,
        needsCorrection: false,
        candidateRowKey: 'row_1'
      },
      {
        caseId: vCase._id,
        documentId: rxDoc._id,
        fieldType: 'quantity',
        rawValue: '10',
        normalizedValue: '10',
        pageNumber: 1,
        boundingBox: [0.1, 0.1, 0.5, 0.15],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.92,
        needsCorrection: false,
        candidateRowKey: 'row_1'
      },
      {
        caseId: vCase._id,
        documentId: rxDoc._id,
        fieldType: 'quantity_unit',
        rawValue: 'tablets',
        normalizedValue: 'tablet',
        pageNumber: 1,
        boundingBox: [0.1, 0.1, 0.5, 0.15],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.92,
        needsCorrection: false,
        candidateRowKey: 'row_1'
      },
      {
        caseId: vCase._id,
        documentId: rxDoc._id,
        fieldType: 'medicine_name',
        rawValue: '2. Azithromycin',
        normalizedValue: 'Azithromycin',
        pageNumber: 1,
        boundingBox: [0.1, 0.2, 0.5, 0.25],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.91,
        needsCorrection: false,
        candidateRowKey: 'row_2'
      },
      {
        caseId: vCase._id,
        documentId: rxDoc._id,
        fieldType: 'dosage_strength',
        rawValue: '500 mg',
        normalizedValue: '500mg',
        pageNumber: 1,
        boundingBox: [0.1, 0.2, 0.5, 0.25],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.91,
        needsCorrection: false,
        candidateRowKey: 'row_2'
      },
      {
        caseId: vCase._id,
        documentId: rxDoc._id,
        fieldType: 'dosage_form',
        rawValue: 'tablet',
        normalizedValue: 'Tablet',
        pageNumber: 1,
        boundingBox: [0.1, 0.2, 0.5, 0.25],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.91,
        needsCorrection: false,
        candidateRowKey: 'row_2'
      },
      {
        caseId: vCase._id,
        documentId: rxDoc._id,
        fieldType: 'quantity',
        rawValue: '3',
        normalizedValue: '3',
        pageNumber: 1,
        boundingBox: [0.1, 0.2, 0.5, 0.25],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.91,
        needsCorrection: false,
        candidateRowKey: 'row_2'
      },
      {
        caseId: vCase._id,
        documentId: rxDoc._id,
        fieldType: 'quantity_unit',
        rawValue: 'tablets',
        normalizedValue: 'tablet',
        pageNumber: 1,
        boundingBox: [0.1, 0.2, 0.5, 0.25],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.91,
        needsCorrection: false,
        candidateRowKey: 'row_2'
      }
    ]);

    // Invoice in REVERSE row order:
    // Row 1 = Azee 500mg tablet qty 3 (or mismatched if options.mismatchStrength)
    // Row 2 = Dolo 650mg tablet 1 strip (pack_size 10 unless options.unknownPackCount)
    const invRow2Fields = [
      {
        caseId: vCase._id,
        documentId: invDoc._id,
        fieldType: 'medicine_name',
        rawValue: options.mismatchStrength ? '2. Crocin 500' : '2. Dolo 650',
        normalizedValue: options.mismatchStrength ? 'Crocin' : 'Dolo',
        pageNumber: 1,
        boundingBox: [0.1, 0.3, 0.5, 0.35],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.93,
        needsCorrection: false,
        candidateRowKey: 'row_2'
      },
      {
        caseId: vCase._id,
        documentId: invDoc._id,
        fieldType: 'dosage_strength',
        rawValue: options.mismatchStrength ? '500 mg' : '650 mg',
        normalizedValue: options.mismatchStrength ? '500mg' : '650mg',
        pageNumber: 1,
        boundingBox: [0.1, 0.3, 0.5, 0.35],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.93,
        needsCorrection: false,
        candidateRowKey: 'row_2'
      },
      {
        caseId: vCase._id,
        documentId: invDoc._id,
        fieldType: 'dosage_form',
        rawValue: 'tablet',
        normalizedValue: 'Tablet',
        pageNumber: 1,
        boundingBox: [0.1, 0.3, 0.5, 0.35],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.93,
        needsCorrection: false,
        candidateRowKey: 'row_2'
      },
      {
        caseId: vCase._id,
        documentId: invDoc._id,
        fieldType: 'quantity',
        rawValue: '1',
        normalizedValue: '1',
        pageNumber: 1,
        boundingBox: [0.1, 0.3, 0.5, 0.35],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.93,
        needsCorrection: false,
        candidateRowKey: 'row_2'
      },
      {
        caseId: vCase._id,
        documentId: invDoc._id,
        fieldType: 'quantity_unit',
        rawValue: 'strip',
        normalizedValue: 'strip',
        pageNumber: 1,
        boundingBox: [0.1, 0.3, 0.5, 0.35],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.93,
        needsCorrection: false,
        candidateRowKey: 'row_2'
      }
    ];

    if (!options.unknownPackCount) {
      invRow2Fields.push(
        {
          caseId: vCase._id,
          documentId: invDoc._id,
          fieldType: 'pack_size',
          rawValue: '10 tablets per strip',
          normalizedValue: '10',
          pageNumber: 1,
          boundingBox: [0.1, 0.3, 0.5, 0.35],
          extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
          extractionConfidence: 0.93,
          needsCorrection: false,
          candidateRowKey: 'row_2'
        },
        {
          caseId: vCase._id,
          documentId: invDoc._id,
          fieldType: 'pack_unit',
          rawValue: 'tablets',
          normalizedValue: 'tablet',
          pageNumber: 1,
          boundingBox: [0.1, 0.3, 0.5, 0.35],
          extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
          extractionConfidence: 0.93,
          needsCorrection: false,
          candidateRowKey: 'row_2'
        }
      );
    }

    const invFields = await ExtractedField.insertMany([
      {
        caseId: vCase._id,
        documentId: invDoc._id,
        fieldType: 'medicine_name',
        rawValue: '1. Azee 500',
        normalizedValue: 'Azee',
        pageNumber: 1,
        boundingBox: [0.1, 0.15, 0.5, 0.2],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.92,
        needsCorrection: false,
        candidateRowKey: 'row_1'
      },
      {
        caseId: vCase._id,
        documentId: invDoc._id,
        fieldType: 'dosage_strength',
        rawValue: '500 mg',
        normalizedValue: '500mg',
        pageNumber: 1,
        boundingBox: [0.1, 0.15, 0.5, 0.2],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.92,
        needsCorrection: false,
        candidateRowKey: 'row_1'
      },
      {
        caseId: vCase._id,
        documentId: invDoc._id,
        fieldType: 'dosage_form',
        rawValue: 'tablet',
        normalizedValue: 'Tablet',
        pageNumber: 1,
        boundingBox: [0.1, 0.15, 0.5, 0.2],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.92,
        needsCorrection: false,
        candidateRowKey: 'row_1'
      },
      {
        caseId: vCase._id,
        documentId: invDoc._id,
        fieldType: 'quantity',
        rawValue: '3',
        normalizedValue: '3',
        pageNumber: 1,
        boundingBox: [0.1, 0.15, 0.5, 0.2],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.92,
        needsCorrection: false,
        candidateRowKey: 'row_1'
      },
      {
        caseId: vCase._id,
        documentId: invDoc._id,
        fieldType: 'quantity_unit',
        rawValue: 'tablets',
        normalizedValue: 'tablet',
        pageNumber: 1,
        boundingBox: [0.1, 0.15, 0.5, 0.2],
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: 0.92,
        needsCorrection: false,
        candidateRowKey: 'row_1'
      },
      ...invRow2Fields
    ]);

    return { vCase, rxDoc, invDoc, claimDoc, rxFields, invFields };
  }

  function buildGroupsFromFields(fields) {
    const byRow = new Map();
    for (const f of fields) {
      if (!f.candidateRowKey) continue;
      if (!byRow.has(f.candidateRowKey)) byRow.set(f.candidateRowKey, []);
      byRow.get(f.candidateRowKey).push(f);
    }
    const groups = [];
    for (const [, rowFields] of byRow.entries()) {
      const anchor = rowFields.find((rf) => rf.fieldType === 'medicine_name');
      groups.push({
        anchorFieldId: String(anchor._id),
        fieldIds: rowFields.map((rf) => String(rf._id))
      });
    }
    return groups;
  }

  await t.test('1. Authentication, Tenant Isolation, and Role Permissions', async () => {
    const { vCase, rxDoc, rxFields } = await seedTwoItemCase();
    const rxGroups = buildGroupsFromFields(rxFields);

    // Unauthenticated -> 401
    await request(app).get(`/api/v1/cases/${vCase._id}/reconciliation`).expect(401);
    await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .send({ observedItemCount: 2, completenessAttested: true, groups: rxGroups })
      .expect(401);
    await request(app)
      .post(`/api/v1/cases/${vCase._id}/reviews`)
      .send({
        action: 'ESCALATE',
        snapshotToken: `rs_${'0'.repeat(64)}`,
        reasonCode: 'TEST_ESC',
        notes: 'Valid length notes for test.'
      })
      .expect(401);

    // Cross-tenant staff (Org B) -> 404 without leaking case existence
    await request(app)
      .get(`/api/v1/cases/${vCase._id}/reconciliation`)
      .set('Authorization', `Bearer ${pharmacistBToken}`)
      .expect(404);
    await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistBToken}`)
      .send({ observedItemCount: 2, completenessAttested: true, groups: rxGroups })
      .expect(404);
    await request(app)
      .post(`/api/v1/cases/${vCase._id}/reviews`)
      .set('Authorization', `Bearer ${pharmacistBToken}`)
      .send({
        action: 'ESCALATE',
        snapshotToken: `rs_${'0'.repeat(64)}`,
        reasonCode: 'TEST_ESC',
        notes: 'Valid length notes for test.'
      })
      .expect(404);

    // Other patient -> 404
    await request(app)
      .get(`/api/v1/cases/${vCase._id}/reconciliation`)
      .set('Authorization', `Bearer ${otherPatientToken}`)
      .expect(404);

    // Case-owning patient -> 200 on GET /reconciliation with read-only permissions
    const ownerRes = await request(app)
      .get(`/api/v1/cases/${vCase._id}/reconciliation`)
      .set('Authorization', `Bearer ${patientOwnerToken}`)
      .expect(200);

    assert.deepEqual(ownerRes.body.permissions, {
      canCorrectFields: false,
      canConfirmGroups: false,
      canReview: false
    });
    assert.deepEqual(ownerRes.body.reviewEligibility.allowedActions, []);
    assert.equal(ownerRes.body.reviewEligibility.canVerify, false);

    // Patient -> 403 on PUT /medicine-groups and POST /reviews
    await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${patientOwnerToken}`)
      .send({ observedItemCount: 2, completenessAttested: true, groups: rxGroups })
      .expect(403);

    await request(app)
      .post(`/api/v1/cases/${vCase._id}/reviews`)
      .set('Authorization', `Bearer ${patientOwnerToken}`)
      .send({
        action: 'ESCALATE',
        snapshotToken: ownerRes.body.snapshotToken,
        reasonCode: 'TEST_ESC',
        notes: 'Patient cannot submit review decisions.'
      })
      .expect(403);

    // super_admin -> 200 on GET /reconciliation with canConfirmGroups: false, 403 on PUT /medicine-groups
    const superSnap = await request(app)
      .get(`/api/v1/cases/${vCase._id}/reconciliation`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    assert.equal(superSnap.body.permissions.canConfirmGroups, false);
    assert.equal(superSnap.body.permissions.canReview, true);

    await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ observedItemCount: 2, completenessAttested: true, groups: rxGroups })
      .expect(403);
  });

  await t.test('2. Read-Only GET /reconciliation and Schema Conformance', async () => {
    const { vCase } = await seedTwoItemCase();

    const auditCountBefore = await AuditEvent.countDocuments({ caseId: vCase._id });

    const snap1 = await request(app)
      .get(`/api/v1/cases/${vCase._id}/reconciliation`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .expect(200);

    const snap2 = await request(app)
      .get(`/api/v1/cases/${vCase._id}/reconciliation`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .expect(200);

    const auditCountAfter = await AuditEvent.countDocuments({ caseId: vCase._id });
    assert.equal(auditCountAfter, auditCountBefore);
    assert.equal(snap1.body.snapshotToken, snap2.body.snapshotToken);
    assert.equal(snap1.body.evidenceRevision, snap2.body.evidenceRevision);
    assert.match(snap1.body.snapshotToken, /^rs_[a-f0-9]{64}$/);
    assert.equal(snap1.body.schemaVersion, '2.0.0-session3');

    // Validate Session 1 and Session 2 schemas with Ajv and GPT's parseCaseSnapshot
    assert.ok(parseCaseSnapshot(snap1.body, String(vCase._id)));
    assert.equal(
      validateMedicineItemEnvelope(snap1.body.prescription),
      true,
      JSON.stringify(validateMedicineItemEnvelope.errors)
    );
    assert.equal(
      validateMedicineItemEnvelope(snap1.body.invoice),
      true,
      JSON.stringify(validateMedicineItemEnvelope.errors)
    );
    assert.equal(
      validateMedicineReconciliation(snap1.body.comparison),
      true,
      JSON.stringify(validateMedicineReconciliation.errors)
    );

    // Before human confirmation, mode is AUTO_PROPOSED and GROUPING_CONFIRMATION_REQUIRED blocks VERIFY
    for (const gd of snap1.body.groupingDocuments) {
      assert.equal(gd.mode, 'AUTO_PROPOSED');
    }
    assert.equal(snap1.body.reviewEligibility.canVerify, false);
    assert.equal(
      snap1.body.reviewEligibility.blockerCodes.includes('GROUPING_CONFIRMATION_REQUIRED'),
      true
    );
  });

  await t.test('3. Grouping Validation, HUMAN_CONFIRMED Transition, and Stale Invalidation', async () => {
    const { vCase, rxDoc, invDoc, claimDoc, rxFields, invFields } = await seedTwoItemCase();
    const rxGroups = buildGroupsFromFields(rxFields);
    const invGroups = buildGroupsFromFields(invFields);

    const initSnap = await request(app)
      .get(`/api/v1/cases/${vCase._id}/reconciliation`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .expect(200);
    const initToken = initSnap.body.snapshotToken;

    // Reject missing snapshotToken -> 400 INVALID_SNAPSHOT_TOKEN
    const missingTokenRes = await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({ observedItemCount: 2, completenessAttested: true, groups: rxGroups })
      .expect(400);
    assert.equal(missingTokenRes.body.code, 'INVALID_SNAPSHOT_TOKEN');

    // Reject completenessAttested: false -> 400
    await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: initToken,
        observedItemCount: 2,
        completenessAttested: false,
        groups: rxGroups
      })
      .expect(400);

    // Reject observedItemCount > 3 -> 400 ITEM_LIMIT_EXCEEDED
    const limitRes = await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: initToken,
        observedItemCount: 4,
        completenessAttested: true,
        groups: rxGroups
      })
      .expect(400);
    assert.equal(limitRes.body.code, 'ITEM_LIMIT_EXCEEDED');

    // Reject groups.length !== observedItemCount -> 400
    await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: initToken,
        observedItemCount: 1,
        completenessAttested: true,
        groups: rxGroups
      })
      .expect(400);

    // Reject CLAIM_FORM target -> 400
    await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${claimDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: initToken,
        observedItemCount: 1,
        completenessAttested: true,
        groups: [rxGroups[0]]
      })
      .expect(400);

    // Reject cross-document field IDs -> 400
    await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: initToken,
        observedItemCount: 2,
        completenessAttested: true,
        groups: invGroups
      })
      .expect(400);

    // Reject ungrouped medicine field (dropping one field from group 2) -> 400
    const partialRxGroups = [
      rxGroups[0],
      {
        anchorFieldId: rxGroups[1].anchorFieldId,
        fieldIds: rxGroups[1].fieldIds.slice(0, -1)
      }
    ];
    await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: initToken,
        observedItemCount: 2,
        completenessAttested: true,
        groups: partialRxGroups
      })
      .expect(400);

    // Reject non-medicine_name anchor -> 400
    const nonNameAnchorGroups = [
      {
        anchorFieldId: rxGroups[0].fieldIds[1], // dosage_strength
        fieldIds: rxGroups[0].fieldIds
      },
      rxGroups[1]
    ];
    await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: initToken,
        observedItemCount: 2,
        completenessAttested: true,
        groups: nonNameAnchorGroups
      })
      .expect(400);

    // Reject unexpected top-level property -> 400
    await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: initToken,
        observedItemCount: 2,
        completenessAttested: true,
        groups: rxGroups,
        extraForbiddenKey: true
      })
      .expect(400);

    // Valid confirmation on rxDoc -> 200
    const confirmRxRes = await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: initToken,
        observedItemCount: 2,
        completenessAttested: true,
        groups: rxGroups
      })
      .expect(200);

    assert.ok(parseCaseSnapshot(confirmRxRes.body, String(vCase._id)));
    const rxGroupDoc = confirmRxRes.body.groupingDocuments.find(
      (gd) => gd.documentId === String(rxDoc._id)
    );
    assert.equal(rxGroupDoc.mode, 'HUMAN_CONFIRMED');
    assert.equal(rxGroupDoc.confirmedBy, String(pharmacistA._id));
    assert.ok(rxGroupDoc.confirmedAt);

    // Reject stale snapshotToken on invDoc confirmation -> 409 STALE_REVIEW_SNAPSHOT
    const staleConfirmRes = await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${invDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: initToken,
        observedItemCount: 2,
        completenessAttested: true,
        groups: invGroups
      })
      .expect(409);
    assert.equal(staleConfirmRes.body.code, 'STALE_REVIEW_SNAPSHOT');

    // Valid confirmation on invDoc with current snapshotToken -> 200
    const confirmInvRes = await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${invDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: confirmRxRes.body.snapshotToken,
        observedItemCount: 2,
        completenessAttested: true,
        groups: invGroups
      })
      .expect(200);

    assert.ok(parseCaseSnapshot(confirmInvRes.body, String(vCase._id)));
    assert.equal(confirmInvRes.body.reviewEligibility.canVerify, true);
    assert.deepEqual(confirmInvRes.body.reviewEligibility.blockerCodes, []);
    assert.equal(confirmInvRes.body.comparison.status, 'CONSISTENT');
    assert.equal(confirmInvRes.body.comparison.rows.length, 2);

    // Field correction rejects missing or stale snapshotToken
    const rxStrengthField = rxFields.find(
      (f) => f.candidateRowKey === 'row_1' && f.fieldType === 'dosage_strength'
    );
    const missingPatchToken = await request(app)
      .patch(`/api/v1/cases/${vCase._id}/extracted-fields/${rxStrengthField._id}`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({ normalizedValue: '650mg' })
      .expect(400);
    assert.equal(missingPatchToken.body.code, 'INVALID_SNAPSHOT_TOKEN');

    const stalePatchToken = await request(app)
      .patch(`/api/v1/cases/${vCase._id}/extracted-fields/${rxStrengthField._id}`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({ normalizedValue: '650mg', snapshotToken: initToken })
      .expect(409);
    assert.equal(stalePatchToken.body.code, 'STALE_REVIEW_SNAPSHOT');

    // Now patch a field on rxDoc with current snapshotToken -> rawValue preserved, evidenceRevision bumped, rxDoc grouping becomes STALE
    const patchRes = await request(app)
      .patch(`/api/v1/cases/${vCase._id}/extracted-fields/${rxStrengthField._id}`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        normalizedValue: '650mg',
        snapshotToken: confirmInvRes.body.snapshotToken
      })
      .expect(200);

    assert.equal(patchRes.body.rawValue, '650 mg');
    assert.equal(String(patchRes.body.correctedBy), String(pharmacistA._id));
    assert.ok(patchRes.body.correctedAt);

    const afterPatchSnap = await request(app)
      .get(`/api/v1/cases/${vCase._id}/reconciliation`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .expect(200);

    assert.ok(parseCaseSnapshot(afterPatchSnap.body, String(vCase._id)));
    assert.notEqual(afterPatchSnap.body.snapshotToken, confirmInvRes.body.snapshotToken);
    assert.equal(afterPatchSnap.body.evidenceRevision, confirmInvRes.body.evidenceRevision + 1);
    assert.equal(afterPatchSnap.body.legacyFindingsCurrent, false);

    const rxAfterPatch = afterPatchSnap.body.groupingDocuments.find(
      (gd) => gd.documentId === String(rxDoc._id)
    );
    assert.equal(rxAfterPatch.mode, 'STALE');
    assert.equal(afterPatchSnap.body.reviewEligibility.canVerify, false);
    assert.equal(
      afterPatchSnap.body.reviewEligibility.blockerCodes.includes('GROUPING_STALE'),
      true
    );
    assert.equal(
      afterPatchSnap.body.reviewEligibility.blockerCodes.includes('GROUPING_CONFIRMATION_REQUIRED'),
      true
    );
  });

  await t.test('4. Multi-Item Consistent Review Workflow and Finalised Case Immutability', async () => {
    const { vCase, rxDoc, invDoc, rxFields, invFields } = await seedTwoItemCase();
    const rxGroups = buildGroupsFromFields(rxFields);
    const invGroups = buildGroupsFromFields(invFields);

    const initSnap = await request(app)
      .get(`/api/v1/cases/${vCase._id}/reconciliation`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .expect(200);

    const rxConfirm = await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: initSnap.body.snapshotToken,
        observedItemCount: 2,
        completenessAttested: true,
        groups: rxGroups
      })
      .expect(200);

    const readySnap = await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${invDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: rxConfirm.body.snapshotToken,
        observedItemCount: 2,
        completenessAttested: true,
        groups: invGroups
      })
      .expect(200);

    assert.ok(parseCaseSnapshot(readySnap.body, String(vCase._id)));
    assert.equal(readySnap.body.reviewEligibility.canVerify, true);

    // Missing/malformed snapshotToken -> 400 INVALID_SNAPSHOT_TOKEN
    const badTokenRes = await request(app)
      .post(`/api/v1/cases/${vCase._id}/reviews`)
      .set('Authorization', `Bearer ${claimsReviewerAToken}`)
      .send({
        action: 'VERIFY',
        snapshotToken: 'not-a-valid-token',
        reasonCode: 'VERIFIED_MATCH',
        notes: 'All two items and quantities match.'
      })
      .expect(400);
    assert.equal(badTokenRes.body.code, 'INVALID_SNAPSHOT_TOKEN');

    // Stale snapshotToken -> 409 STALE_REVIEW_SNAPSHOT
    const staleRevRes = await request(app)
      .post(`/api/v1/cases/${vCase._id}/reviews`)
      .set('Authorization', `Bearer ${claimsReviewerAToken}`)
      .send({
        action: 'VERIFY',
        snapshotToken: `rs_${'f'.repeat(64)}`,
        reasonCode: 'VERIFIED_MATCH',
        notes: 'All two items and quantities match.'
      })
      .expect(409);
    assert.equal(staleRevRes.body.code, 'STALE_REVIEW_SNAPSHOT');

    // Short notes (< 10 chars) -> 400
    await request(app)
      .post(`/api/v1/cases/${vCase._id}/reviews`)
      .set('Authorization', `Bearer ${claimsReviewerAToken}`)
      .send({
        action: 'VERIFY',
        snapshotToken: readySnap.body.snapshotToken,
        reasonCode: 'VERIFIED_MATCH',
        notes: 'Too short'
      })
      .expect(400);

    // Invalid evidenceItemIds (passing ExtractedField ID instead of EvidenceItem ID) -> 400
    await request(app)
      .post(`/api/v1/cases/${vCase._id}/reviews`)
      .set('Authorization', `Bearer ${claimsReviewerAToken}`)
      .send({
        action: 'VERIFY',
        snapshotToken: readySnap.body.snapshotToken,
        reasonCode: 'VERIFIED_MATCH',
        notes: 'All two items and quantities match.',
        evidenceItemIds: [String(rxFields[0]._id)]
      })
      .expect(400);

    // Valid VERIFY decision -> 201 and transitions case to VERIFIED
    const verifyRes = await request(app)
      .post(`/api/v1/cases/${vCase._id}/reviews`)
      .set('Authorization', `Bearer ${claimsReviewerAToken}`)
      .send({
        action: 'VERIFY',
        snapshotToken: readySnap.body.snapshotToken,
        reasonCode: 'VERIFIED_MATCH',
        notes: 'Both medicine items and normalized quantities match across prescription and invoice.'
      })
      .expect(201);

    assert.equal(verifyRes.body.decision, 'APPROVE');
    assert.equal(verifyRes.body.publicAction, 'VERIFY');
    assert.equal(verifyRes.body.newCaseStatus, 'VERIFIED');

    // Subsequent mutations on VERIFIED case are rejected with 409
    await request(app)
      .patch(`/api/v1/cases/${vCase._id}/extracted-fields/${rxFields[0]._id}`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        normalizedValue: 'Paracetamol',
        snapshotToken: readySnap.body.snapshotToken
      })
      .expect(409);

    await request(app)
      .put(`/api/v1/cases/${vCase._id}/documents/${rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: readySnap.body.snapshotToken,
        observedItemCount: 2,
        completenessAttested: true,
        groups: rxGroups
      })
      .expect(409);

    await request(app)
      .post(`/api/v1/cases/${vCase._id}/documents`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        type: 'CLAIM_FORM',
        file: `data:image/png;base64,${VALID_PNG_BUFFER.toString('base64')}`,
        filename: 'extra.png',
        mimeType: 'image/png'
      })
      .expect(409);
  });

  await t.test('5. Blocked VERIFY Scenarios while RETURN_FOR_CORRECTION and ESCALATE Remain Available', async () => {
    // Scenario A: Strength mismatch -> COMPARISON_MISMATCH blocks VERIFY, allows RETURN_FOR_CORRECTION
    const mismatchCase = await seedTwoItemCase({ mismatchStrength: true });
    const mismatchInit = await request(app)
      .get(`/api/v1/cases/${mismatchCase.vCase._id}/reconciliation`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .expect(200);

    const mismatchRxConfirm = await request(app)
      .put(`/api/v1/cases/${mismatchCase.vCase._id}/documents/${mismatchCase.rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: mismatchInit.body.snapshotToken,
        observedItemCount: 2,
        completenessAttested: true,
        groups: buildGroupsFromFields(mismatchCase.rxFields)
      })
      .expect(200);

    const mismatchSnap = await request(app)
      .put(`/api/v1/cases/${mismatchCase.vCase._id}/documents/${mismatchCase.invDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        snapshotToken: mismatchRxConfirm.body.snapshotToken,
        observedItemCount: 2,
        completenessAttested: true,
        groups: buildGroupsFromFields(mismatchCase.invFields)
      })
      .expect(200);

    assert.ok(parseCaseSnapshot(mismatchSnap.body, String(mismatchCase.vCase._id)));
    assert.equal(mismatchSnap.body.reviewEligibility.canVerify, false);
    assert.equal(
      mismatchSnap.body.reviewEligibility.blockerCodes.includes('COMPARISON_MISMATCH'),
      true
    );

    const blockedVerify = await request(app)
      .post(`/api/v1/cases/${mismatchCase.vCase._id}/reviews`)
      .set('Authorization', `Bearer ${claimsReviewerAToken}`)
      .send({
        action: 'VERIFY',
        snapshotToken: mismatchSnap.body.snapshotToken,
        reasonCode: 'TRY_VERIFY',
        notes: 'Attempting to verify a case with a dosage strength mismatch.'
      })
      .expect(409);
    assert.equal(blockedVerify.body.code, 'REVIEW_BLOCKED');
    assert.equal(blockedVerify.body.blockerCodes.includes('COMPARISON_MISMATCH'), true);

    // RETURN_FOR_CORRECTION succeeds (201) and sets status to NEEDS_CORRECTION
    const returnRes = await request(app)
      .post(`/api/v1/cases/${mismatchCase.vCase._id}/reviews`)
      .set('Authorization', `Bearer ${claimsReviewerAToken}`)
      .send({
        action: 'RETURN_FOR_CORRECTION',
        snapshotToken: mismatchSnap.body.snapshotToken,
        reasonCode: 'STRENGTH_MISMATCH',
        notes: 'Invoice lists Dolo 500mg instead of prescribed Paracetamol 650mg.'
      })
      .expect(201);
    assert.equal(returnRes.body.newCaseStatus, 'NEEDS_CORRECTION');

    // Scenario B: Unknown pack count + low confidence field + incomplete page coverage -> blocks VERIFY, allows ESCALATE
    const incompleteCase = await seedTwoItemCase({
      unknownPackCount: true,
      lowConfidenceRx: true,
      rxPageCount: 4,
      rxProcessedPages: 3,
      rxOmittedPages: 1
    });

    const incInit = await request(app)
      .get(`/api/v1/cases/${incompleteCase.vCase._id}/reconciliation`)
      .set('Authorization', `Bearer ${orgAdminAToken}`)
      .expect(200);

    const incRxConfirm = await request(app)
      .put(`/api/v1/cases/${incompleteCase.vCase._id}/documents/${incompleteCase.rxDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${orgAdminAToken}`)
      .send({
        snapshotToken: incInit.body.snapshotToken,
        observedItemCount: 2,
        completenessAttested: true,
        groups: buildGroupsFromFields(incompleteCase.rxFields)
      })
      .expect(200);

    const incompleteSnap = await request(app)
      .put(`/api/v1/cases/${incompleteCase.vCase._id}/documents/${incompleteCase.invDoc._id}/medicine-groups`)
      .set('Authorization', `Bearer ${orgAdminAToken}`)
      .send({
        snapshotToken: incRxConfirm.body.snapshotToken,
        observedItemCount: 2,
        completenessAttested: true,
        groups: buildGroupsFromFields(incompleteCase.invFields)
      })
      .expect(200);

    assert.ok(parseCaseSnapshot(incompleteSnap.body, String(incompleteCase.vCase._id)));
    assert.equal(incompleteSnap.body.reviewEligibility.canVerify, false);
    assert.equal(
      incompleteSnap.body.reviewEligibility.blockerCodes.includes('COMPARISON_INSUFFICIENT'),
      true
    );
    assert.equal(
      incompleteSnap.body.reviewEligibility.blockerCodes.includes('FIELD_CORRECTION_REQUIRED'),
      true
    );
    assert.equal(
      incompleteSnap.body.reviewEligibility.blockerCodes.includes('PAGE_COVERAGE_INCOMPLETE'),
      true
    );

    const escalateRes = await request(app)
      .post(`/api/v1/cases/${incompleteCase.vCase._id}/reviews`)
      .set('Authorization', `Bearer ${orgAdminAToken}`)
      .send({
        action: 'ESCALATE',
        snapshotToken: incompleteSnap.body.snapshotToken,
        reasonCode: 'OMITTED_PAGE_AND_PACK',
        notes: 'Escalating because page 4 was omitted and pack size is not printed on invoice.'
      })
      .expect(201);
    assert.equal(escalateRes.body.decision, 'ESCALATE');
    assert.equal(escalateRes.body.newCaseStatus, 'NEEDS_REVIEW');

    // Scenario C: Multiple prescription documents -> MULTIPLE_DOCUMENTS_UNSUPPORTED blocks VERIFY
    await Document.create({
      caseId: incompleteCase.vCase._id,
      type: 'PRESCRIPTION',
      originalFilename: 'rx-second.png',
      mimeType: 'image/png',
      fileSize: 1024,
      checksumSha256: 'd'.repeat(64),
      objectStorageKey: `cases/${incompleteCase.vCase._id}/rx-second.png`,
      processingStatus: 'PROCESSED',
      pageCount: 1,
      processedPageCount: 1,
      omittedPageCount: 0,
      pageCoverage: { total: 1, processed: 1, omitted: 0, status: 'COMPLETE' },
      uploadedBy: patientOwner._id
    });

    const multiDocSnap = await request(app)
      .get(`/api/v1/cases/${incompleteCase.vCase._id}/reconciliation`)
      .set('Authorization', `Bearer ${orgAdminAToken}`)
      .expect(200);

    assert.ok(parseCaseSnapshot(multiDocSnap.body, String(incompleteCase.vCase._id)));
    assert.equal(
      multiDocSnap.body.reviewEligibility.blockerCodes.includes('MULTIPLE_DOCUMENTS_UNSUPPORTED'),
      true
    );
  });

  await t.test('6. Per-Case Concurrency Guard Rejects Overlapping Mutations with 409 CASE_BUSY', async () => {
    const { vCase, rxFields } = await seedTwoItemCase();
    const snap = await request(app)
      .get(`/api/v1/cases/${vCase._id}/reconciliation`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .expect(200);

    let releaseBarrier;
    const barrierPromise = new Promise((resolve) => {
      releaseBarrier = resolve;
    });

    // Hold the per-case lock while an HTTP mutation arrives
    const lockTask = withCaseMutationGuard(vCase._id, async () => {
      await barrierPromise;
    });

    try {
      const busyRes = await request(app)
        .patch(`/api/v1/cases/${vCase._id}/extracted-fields/${rxFields[0]._id}`)
        .set('Authorization', `Bearer ${pharmacistAToken}`)
        .send({
          normalizedValue: 'Paracetamol',
          snapshotToken: snap.body.snapshotToken
        })
        .expect(409);

      assert.equal(busyRes.body.code, 'CASE_BUSY');
    } finally {
      releaseBarrier();
      await lockTask;
    }
  });

  await t.test('7. Real Printed-Image OCR + POST /process + AUTO_PROPOSED Grouping + GET /results Grounding', async () => {
    const reqBackend = createRequire(require.resolve('../package.json'));
    const reqFromPdfToImg = createRequire(reqBackend.resolve('pdf-to-img'));
    const { createCanvas } = reqFromPdfToImg('@napi-rs/canvas');

    function renderPrintedPngBase64(lines) {
      const canvas = createCanvas(920, 360);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 920, 360);
      ctx.fillStyle = '#000000';
      ctx.font = '28px Arial';
      lines.forEach((line, idx) => {
        ctx.fillText(line, 40, 70 + idx * 75);
      });
      return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`;
    }

    const createRes = await request(app)
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({ subjectReference: 'subj-real-ocr-s3' })
      .expect(201);

    const caseId = createRes.body._id || createRes.body.id;
    trackCase({ _id: caseId });

    const rxPngBase64 = renderPrintedPngBase64([
      'Date: 2026-05-10',
      '1. Paracetamol 650 mg tablet Qty: 10 tablets',
      '2. Azithromycin 500 mg tablet Qty: 3 tablets'
    ]);
    const invPngBase64 = renderPrintedPngBase64([
      'Date: 2026-05-11',
      '1. Azee 500 mg tablet Qty: 3 tablets',
      '2. Dolo 650 mg tablet Qty: 10 tablets',
      'Total Amount: 145'
    ]);
    const claimPngBase64 = renderPrintedPngBase64([
      'Date: 2026-05-12',
      'Claimed Amount: 145'
    ]);

    await request(app)
      .post(`/api/v1/cases/${caseId}/documents`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        type: 'PRESCRIPTION',
        file: rxPngBase64,
        filename: 'printed-rx.png',
        mimeType: 'image/png'
      })
      .expect(201);

    await request(app)
      .post(`/api/v1/cases/${caseId}/documents`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        type: 'PHARMACY_INVOICE',
        file: invPngBase64,
        filename: 'printed-inv.png',
        mimeType: 'image/png'
      })
      .expect(201);

    await request(app)
      .post(`/api/v1/cases/${caseId}/documents`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({
        type: 'CLAIM_FORM',
        file: claimPngBase64,
        filename: 'printed-claim.png',
        mimeType: 'image/png'
      })
      .expect(201);

    const procRes = await request(app)
      .post(`/api/v1/cases/${caseId}/process`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .send({})
      .expect(202);

    assert.ok(['NEEDS_REVIEW', 'NEEDS_CORRECTION'].includes(procRes.body.status));
    assert.equal(procRes.body.reviewRequired, true);

    const snapRes = await request(app)
      .get(`/api/v1/cases/${caseId}/reconciliation`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .expect(200);

    assert.ok(parseCaseSnapshot(snapRes.body, String(caseId)));
    assert.equal(snapRes.body.groupingDocuments.length, 2);
    for (const gd of snapRes.body.groupingDocuments) {
      assert.equal(gd.mode, 'AUTO_PROPOSED');
      assert.equal(gd.groups.length, 2);
    }
    assert.equal(snapRes.body.reviewEligibility.canVerify, false);
    assert.equal(
      snapRes.body.reviewEligibility.blockerCodes.includes('GROUPING_CONFIRMATION_REQUIRED'),
      true
    );

    const resultsRes = await request(app)
      .get(`/api/v1/cases/${caseId}/results`)
      .set('Authorization', `Bearer ${pharmacistAToken}`)
      .expect(200);

    assert.ok(resultsRes.body.reconciliation);
    assert.equal(resultsRes.body.reconciliation.caseId, String(caseId));
    assert.equal(typeof resultsRes.body.legacyFindingsCurrent, 'boolean');
  });
});
