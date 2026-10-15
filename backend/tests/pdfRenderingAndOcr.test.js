const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_trustrag_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-not-for-production';
process.env.GEMINI_API_KEY = 'test-only-gemini-key';
process.env.TRUSTRAG_LLM_ENABLED = 'false';

const app = require('../app');
const User = require('../models/userModel');
const Organization = require('../models/organizationModel');
const VerificationCase = require('../models/verificationCaseModel');
const Document = require('../models/documentModel');
const ExtractedField = require('../models/extractedFieldModel');
const EvidenceItem = require('../models/evidenceItemModel');
const RiskSignal = require('../models/riskSignalModel');

const storageService = require('../services/trustRag/storageService');
const pdfRenderingService = require('../services/trustRag/pdfRenderingService');
const localOcrService = require('../services/trustRag/localOcrService');
const documentExtractorService = require('../services/trustRag/documentExtractorService');
const trustRagOrchestrator = require('../services/trustRag/trustRagOrchestrator');
const generateToken = require('../utils/generateToken');

const { assertTestDatabase } = require('../utils/testDatabaseGuard');
const NodePdfRendererProvider = require('../services/trustRag/nodePdfRendererProvider');
const { getDocumentStorageRoot } = require('../config/documentStorage');

const { MockPdfRendererProvider, createMockPngBuffer } = require('../services/trustRag/mockPdfRendererProvider');
const MockOcrProvider = require('../services/trustRag/mockOcrProvider');

// Minimal valid 1-page PDF fixture
const minimalPdfFixture = Buffer.from(
  '%PDF-1.4\n' +
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n' +
  '3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R/Resources<<>>>>endobj\n' +
  'xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \n' +
  'trailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n'
);
const minimalPdfBase64 = `data:application/pdf;base64,${minimalPdfFixture.toString('base64')}`;

// Real synthetic 4-page PDF fixture
const syntheticMultiPagePdfFixture = Buffer.from(
  '%PDF-1.4\n' +
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Count 4/Kids[3 0 R 4 0 R 5 0 R 6 0 R]>>endobj\n' +
  '3 0 obj<</Type/Page/MediaBox[0 0 300 200]/Parent 2 0 R/Resources<<>>>>endobj\n' +
  '4 0 obj<</Type/Page/MediaBox[0 0 300 200]/Parent 2 0 R/Resources<<>>>>endobj\n' +
  '5 0 obj<</Type/Page/MediaBox[0 0 300 200]/Parent 2 0 R/Resources<<>>>>endobj\n' +
  '6 0 obj<</Type/Page/MediaBox[0 0 300 200]/Parent 2 0 R/Resources<<>>>>endobj\n' +
  'xref\n0 7\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000122 00000 n \n' +
  '0000000203 00000 n \n0000000284 00000 n \n0000000365 00000 n \n' +
  'trailer<</Size 7/Root 1 0 R>>\nstartxref\n446\n%%EOF\n'
);
const syntheticMultiPagePdfBase64 = `data:application/pdf;base64,${syntheticMultiPagePdfFixture.toString('base64')}`;

// Synthetic oversized PDF fixture (MediaBox 3000x3000 exceeds 2048px limit)
const syntheticOversizedPdfFixture = Buffer.from(
  '%PDF-1.4\n' +
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n' +
  '3 0 obj<</Type/Page/MediaBox[0 0 3000 3000]/Parent 2 0 R/Resources<<>>>>endobj\n' +
  'xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \n' +
  'trailer<</Size 4/Root 1 0 R>>\nstartxref\n179\n%%EOF\n'
);
const syntheticOversizedPdfBase64 = `data:application/pdf;base64,${syntheticOversizedPdfFixture.toString('base64')}`;

test('Work Order 5B / U3: Bounded PDF Processing and Trustworthy Evidence Closure Test Suite', async (t) => {
  let orgA, orgB;
  let userA, userB;
  let tokenA, tokenB;
  let testCaseA, testCaseB;

  t.before(async () => {
    // Confirm target database is strictly a permitted disposable test database
    assertTestDatabase(process.env.MONGO_URI);
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Setup Org A and Reviewer User A
    orgA = await Organization.findOne({ name: 'Apex General Hospital' });
    if (!orgA) {
      orgA = await Organization.create({
        name: 'Apex General Hospital',
        owner: new mongoose.Types.ObjectId(),
        plan: 'Enterprise',
        status: 'active'
      });
    }

    userA = await User.findOne({ email: 'dr_reviewer_a@apex.org' });
    if (!userA) {
      userA = await User.create({
        name: 'Dr. Reviewer A',
        email: 'dr_reviewer_a@apex.org',
        password: 'password123',
        role: 'claims_reviewer',
        organizationId: orgA._id
      });
    } else {
      userA.organizationId = orgA._id;
      await userA.save();
    }
    tokenA = generateToken(userA._id);

    // Setup Org B and Reviewer User B (Tenant Isolation)
    orgB = await Organization.findOne({ name: 'Beacon Health Center' });
    if (!orgB) {
      orgB = await Organization.create({
        name: 'Beacon Health Center',
        owner: new mongoose.Types.ObjectId(),
        plan: 'Enterprise',
        status: 'active'
      });
    }

    userB = await User.findOne({ email: 'dr_reviewer_b@beacon.org' });
    if (!userB) {
      userB = await User.create({
        name: 'Dr. Reviewer B',
        email: 'dr_reviewer_b@beacon.org',
        password: 'password123',
        role: 'claims_reviewer',
        organizationId: orgB._id
      });
    } else {
      userB.organizationId = orgB._id;
      await userB.save();
    }
    tokenB = generateToken(userB._id);

    testCaseA = await VerificationCase.create({
      organizationId: orgA._id,
      createdBy: userA._id,
      subjectReference: 'patient-5b-case-a',
      status: 'DOCUMENTS_PENDING'
    });

    testCaseB = await VerificationCase.create({
      organizationId: orgB._id,
      createdBy: userB._id,
      subjectReference: 'patient-5b-case-b',
      status: 'DOCUMENTS_PENDING'
    });
  });

  t.after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // 1. Valid one-page and multi-page PDF rendering through a mocked renderer/provider
  await t.test('1. Valid one-page and multi-page PDF rendering executes sequentially with correct page count', async () => {
    const mockProvider = new MockPdfRendererProvider({ pageCount: 2 });
    pdfRenderingService.setProvider(mockProvider);

    const storedPdf = await storageService.storeDocument({
      caseId: testCaseA._id,
      filename: 'prescription_two_page.pdf',
      content: minimalPdfBase64
    });

    const doc = await Document.create({
      caseId: testCaseA._id,
      type: 'PRESCRIPTION',
      objectStorageKey: storedPdf.objectStorageKey,
      originalFilename: 'prescription_two_page.pdf',
      mimeType: 'application/pdf',
      sizeBytes: storedPdf.sizeBytes,
      sha256: storedPdf.sha256,
      uploadedBy: userA._id
    });

    const pdfBuffer = await storageService.getDocumentBuffer(testCaseA._id, doc.objectStorageKey);
    const renderResult = await pdfRenderingService.renderDocumentPages(testCaseA._id, doc._id, pdfBuffer);

    assert.strictEqual(renderResult.pageCount, 2, 'True pageCount must be 2');
    assert.strictEqual(renderResult.pagesRendered, 2, 'Rendered pages count must be 2');
    assert.strictEqual(renderResult.pages.length, 2);

    // Verify sequential execution
    assert.strictEqual(mockProvider.renderCalls.length, 2);
    assert.strictEqual(mockProvider.renderCalls[0].pageNumber, 1);
    assert.strictEqual(mockProvider.renderCalls[1].pageNumber, 2);
    assert.ok(mockProvider.renderCalls[1].timestamp >= mockProvider.renderCalls[0].timestamp);
  });

  // 2. Maximum three-page limit
  await t.test('2. Multi-page document with 5 pages renders at most 3 pages while preserving true total pageCount', async () => {
    const mockProvider = new MockPdfRendererProvider({ pageCount: 5 });
    pdfRenderingService.setProvider(mockProvider);

    const storedPdf = await storageService.storeDocument({
      caseId: testCaseA._id,
      filename: 'invoice_five_page.pdf',
      content: minimalPdfBase64
    });

    const doc = await Document.create({
      caseId: testCaseA._id,
      type: 'PHARMACY_INVOICE',
      objectStorageKey: storedPdf.objectStorageKey,
      originalFilename: 'invoice_five_page.pdf',
      mimeType: 'application/pdf',
      sizeBytes: storedPdf.sizeBytes,
      sha256: storedPdf.sha256,
      uploadedBy: userA._id
    });

    const pdfBuffer = await storageService.getDocumentBuffer(testCaseA._id, doc.objectStorageKey);
    const renderResult = await pdfRenderingService.renderDocumentPages(testCaseA._id, doc._id, pdfBuffer);

    assert.strictEqual(renderResult.pageCount, 5, 'Stored page count must record true document length (5)');
    assert.strictEqual(renderResult.pagesRendered, 3, 'Must render at most 3 pages in MVP');
    assert.strictEqual(renderResult.pages.length, 3);
    assert.deepStrictEqual(renderResult.pages.map(p => p.pageNumber), [1, 2, 3]);
  });

  // 3. Password-protected and malformed PDF gives controlled errors
  await t.test('3. Password-protected or malformed PDF returns controlled error without leaking paths or keys', async () => {
    const mockProvider = new MockPdfRendererProvider({ pageCount: 1 });
    mockProvider.setSimulatePasswordProtected(true);
    pdfRenderingService.setProvider(mockProvider);

    const storedPdf = await storageService.storeDocument({
      caseId: testCaseA._id,
      filename: 'encrypted.pdf',
      content: minimalPdfBase64
    });

    const doc = await Document.create({
      caseId: testCaseA._id,
      type: 'PRESCRIPTION',
      objectStorageKey: storedPdf.objectStorageKey,
      originalFilename: 'encrypted.pdf',
      mimeType: 'application/pdf',
      sizeBytes: storedPdf.sizeBytes,
      sha256: storedPdf.sha256,
      uploadedBy: userA._id
    });

    await assert.rejects(
      async () => {
        await documentExtractorService.extractFields(doc);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 422);
        assert.match(err.message, /Password-protected PDF documents are not supported/i);
        // Guarantee no leakage of internal storage key or filesystem paths
        assert.ok(!err.message.includes(doc.objectStorageKey));
        assert.ok(!err.message.includes('/storage/'));
        return true;
      }
    );

    const docAfter = await Document.findById(doc._id);
    assert.strictEqual(docAfter.processingStatus, 'FAILED');

    // Test malformed PDF
    mockProvider.setSimulatePasswordProtected(false);
    mockProvider.setSimulateMalformed(true);

    const malformedDoc = await Document.create({
      caseId: testCaseA._id,
      type: 'CLAIM_FORM',
      objectStorageKey: storedPdf.objectStorageKey,
      originalFilename: 'corrupt.pdf',
      mimeType: 'application/pdf',
      sizeBytes: storedPdf.sizeBytes,
      sha256: storedPdf.sha256,
      uploadedBy: userA._id
    });

    await assert.rejects(
      async () => {
        await documentExtractorService.extractFields(malformedDoc);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 422);
        assert.match(err.message, /Malformed or corrupted PDF document/i);
        assert.ok(!err.message.includes(malformedDoc.objectStorageKey));
        return true;
      }
    );
  });

  // 4. Safe image limits: oversized page gives controlled error
  await t.test('4. Oversized PDF page (> 2048px or > 6M pixels) is rejected with controlled error', async () => {
    const mockProvider = new MockPdfRendererProvider({ pageCount: 1 });
    mockProvider.setSimulateOversized(true);
    pdfRenderingService.setProvider(mockProvider);

    const storedPdf = await storageService.storeDocument({
      caseId: testCaseA._id,
      filename: 'giant_page.pdf',
      content: minimalPdfBase64
    });

    const doc = await Document.create({
      caseId: testCaseA._id,
      type: 'PRESCRIPTION',
      objectStorageKey: storedPdf.objectStorageKey,
      originalFilename: 'giant_page.pdf',
      mimeType: 'application/pdf',
      sizeBytes: storedPdf.sizeBytes,
      sha256: storedPdf.sha256,
      uploadedBy: userA._id
    });

    await assert.rejects(
      async () => {
        await documentExtractorService.extractFields(doc);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 422);
        assert.match(err.message, /Rendered PDF page exceeds safe dimensions/i);
        return true;
      }
    );
  });

  // 5. PDF OCR fields retain correct page numbers and normalized boxes
  await t.test('5. PDF OCR fields retain correct page numbers and normalized bounding boxes', async () => {
    const mockPdfProvider = new MockPdfRendererProvider({ pageCount: 2 });
    pdfRenderingService.setProvider(mockPdfProvider);

    // Page 1 has medicine name and dosage; Page 2 has quantity and date
    let pageInvocation = 0;
    const mockOcrProvider = new MockOcrProvider();
    mockOcrProvider.recognize = async () => {
      pageInvocation++;
      if (pageInvocation === 1) {
        return {
          rawText: 'Tab. Amoxicillin 500mg\n500 mg',
          confidence: 0.94,
          lines: [
            { text: 'Tab. Amoxicillin 500mg', confidence: 0.95, bbox: [0.1, 0.15, 0.45, 0.2] },
            { text: '500 mg', confidence: 0.93, bbox: [0.5, 0.15, 0.65, 0.2] }
          ],
          words: []
        };
      } else {
        return {
          rawText: 'Qty: 20\nDate: 2026-05-10',
          confidence: 0.92,
          lines: [
            { text: 'Qty: 20', confidence: 0.92, bbox: [0.1, 0.3, 0.3, 0.35] },
            { text: 'Date: 2026-05-10', confidence: 0.92, bbox: [0.4, 0.3, 0.7, 0.35] }
          ],
          words: []
        };
      }
    };
    localOcrService.setProvider(mockOcrProvider);

    const storedPdf = await storageService.storeDocument({
      caseId: testCaseA._id,
      filename: 'multipage_rx.pdf',
      content: minimalPdfBase64
    });

    const doc = await Document.create({
      caseId: testCaseA._id,
      type: 'PRESCRIPTION',
      objectStorageKey: storedPdf.objectStorageKey,
      originalFilename: 'multipage_rx.pdf',
      mimeType: 'application/pdf',
      sizeBytes: storedPdf.sizeBytes,
      sha256: storedPdf.sha256,
      uploadedBy: userA._id
    });

    const fields = await documentExtractorService.extractFields(doc);
    assert.strictEqual(fields.length, 5);

    const medField = fields.find(f => f.fieldType === 'medicine_name');
    assert.ok(medField);
    assert.strictEqual(medField.pageNumber, 1, 'Medicine name must be attributed to Page 1');
    assert.deepStrictEqual(medField.boundingBox, [0.1, 0.15, 0.45, 0.2]);
    assert.strictEqual(medField.extractionMethod, 'LOCAL_TESSERACT_PDF_OCR');

    const strengthField = fields.find(f => f.fieldType === 'dosage_strength');
    assert.ok(strengthField);
    assert.strictEqual(strengthField.pageNumber, 1, 'Dosage strength must be attributed to Page 1');

    const qtyField = fields.find(f => f.fieldType === 'quantity');
    assert.ok(qtyField);
    assert.strictEqual(qtyField.pageNumber, 2, 'Quantity must be attributed to Page 2');
    assert.deepStrictEqual(qtyField.boundingBox, [0.1, 0.3, 0.3, 0.35]);

    const dateField = fields.find(f => f.fieldType === 'prescription_date');
    assert.ok(dateField);
    assert.strictEqual(dateField.pageNumber, 2, 'Date must be attributed to Page 2');

    // Verify EvidenceItems citation text contains page number
    const evidences = await EvidenceItem.find({ documentId: doc._id });
    assert.strictEqual(evidences.length, 5);
    const qtyEvidence = evidences.find(e => String(e.sourceId) === String(qtyField._id));
    assert.ok(qtyEvidence);
    assert.strictEqual(qtyEvidence.pageNumber, 2);
    assert.match(qtyEvidence.evidenceText, /Document page 2/);
  });

  // 6. Conflicting multi-page values require correction and generate CONFLICTING_MULTI_PAGE_DATA risk signal
  await t.test('6. Conflicting multi-page values require correction and generate CONFLICTING_MULTI_PAGE_DATA risk signal', async () => {
    const conflictCase = await VerificationCase.create({
      organizationId: orgA._id,
      createdBy: userA._id,
      subjectReference: 'patient-conflict-test',
      status: 'DOCUMENTS_PENDING'
    });

    const mockPdfProvider = new MockPdfRendererProvider({ pageCount: 2 });
    pdfRenderingService.setProvider(mockPdfProvider);

    // Page 1 says 500 mg, Page 2 says 650 mg (Conflict on dosage_strength)
    let pageCountInvocation = 0;
    const mockOcrProvider = new MockOcrProvider();
    mockOcrProvider.recognize = async () => {
      pageCountInvocation++;
      if (pageCountInvocation === 1) {
        return {
          rawText: 'Tab. Paracetamol 500mg\n500 mg',
          confidence: 0.95,
          lines: [
            { text: 'Tab. Paracetamol 500mg', confidence: 0.95, bbox: [0.1, 0.1, 0.5, 0.15] },
            { text: '500 mg', confidence: 0.95, bbox: [0.55, 0.1, 0.7, 0.15] }
          ],
          words: []
        };
      } else {
        return {
          rawText: 'Tab. Paracetamol 650mg\n650 mg',
          confidence: 0.95,
          lines: [
            { text: 'Tab. Paracetamol 650mg', confidence: 0.95, bbox: [0.1, 0.2, 0.5, 0.25] },
            { text: '650 mg', confidence: 0.95, bbox: [0.55, 0.2, 0.7, 0.25] }
          ],
          words: []
        };
      }
    };
    localOcrService.setProvider(mockOcrProvider);

    const storedPdf = await storageService.storeDocument({
      caseId: conflictCase._id,
      filename: 'conflicting_rx.pdf',
      content: minimalPdfBase64
    });

    const doc = await Document.create({
      caseId: conflictCase._id,
      type: 'PRESCRIPTION',
      objectStorageKey: storedPdf.objectStorageKey,
      originalFilename: 'conflicting_rx.pdf',
      mimeType: 'application/pdf',
      sizeBytes: storedPdf.sizeBytes,
      sha256: storedPdf.sha256,
      uploadedBy: userA._id
    });

    conflictCase.documentIds = [doc._id];
    await conflictCase.save();

    const fields = await documentExtractorService.extractFields(doc);
    const strengthFields = fields.filter(f => f.fieldType === 'dosage_strength');
    assert.ok(strengthFields.length >= 2, 'Must extract strength fields from both pages');

    // Both conflicting fields must be marked as needing correction
    assert.ok(strengthFields.every(f => f.needsCorrection === true), 'Conflicting multi-page fields must have needsCorrection: true');

    // Run end-to-end case process to evaluate risk signal
    const processRes = await request(app)
      .post(`/api/v1/cases/${conflictCase._id}/process`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    assert.strictEqual(processRes.status, 202);
    assert.strictEqual(processRes.body.status, 'NEEDS_CORRECTION');
    assert.strictEqual(processRes.body.reviewRequired, true);

    // Verify CONFLICTING_MULTI_PAGE_DATA risk signal was created
    const signals = await RiskSignal.find({ caseId: conflictCase._id });
    const conflictSignal = signals.find(s => s.signalType === 'CONFLICTING_MULTI_PAGE_DATA');
    assert.ok(conflictSignal, 'Must emit CONFLICTING_MULTI_PAGE_DATA risk signal');
    assert.strictEqual(conflictSignal.severity, 'HIGH');
    assert.strictEqual(conflictSignal.reviewRequired, true);
    assert.match(conflictSignal.description, /Conflicting values for "dosage_strength"/);
  });

  // 7. Preview endpoint tests
  await t.test('7. Preview endpoint: unauthenticated 401, cross-tenant 404, valid PNG bytes, safe headers, invalid page 404', async () => {
    const mockPdfProvider = new MockPdfRendererProvider({ pageCount: 2 });
    pdfRenderingService.setProvider(mockPdfProvider);

    const storedPdf = await storageService.storeDocument({
      caseId: testCaseA._id,
      filename: 'sample_preview.pdf',
      content: minimalPdfBase64
    });

    const doc = await Document.create({
      caseId: testCaseA._id,
      type: 'PRESCRIPTION',
      objectStorageKey: storedPdf.objectStorageKey,
      originalFilename: 'sample_preview.pdf',
      mimeType: 'application/pdf',
      sizeBytes: storedPdf.sizeBytes,
      sha256: storedPdf.sha256,
      pageCount: 2,
      uploadedBy: userA._id
    });

    // 7a. Unauthenticated access returns HTTP 401
    const unauthRes = await request(app)
      .get(`/api/v1/cases/${testCaseA._id}/documents/${doc._id}/pages/1/preview`);
    assert.strictEqual(unauthRes.status, 401);

    // 7b. Cross-tenant access returns opaque HTTP 404
    const crossTenantRes = await request(app)
      .get(`/api/v1/cases/${testCaseA._id}/documents/${doc._id}/pages/1/preview`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert.strictEqual(crossTenantRes.status, 404);

    // 7c. Authorized same-tenant returns valid PNG bytes and safe headers
    const validRes = await request(app)
      .get(`/api/v1/cases/${testCaseA._id}/documents/${doc._id}/pages/1/preview`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert.strictEqual(validRes.status, 200);
    assert.strictEqual(validRes.headers['content-type'], 'image/png');
    assert.strictEqual(validRes.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(validRes.headers['cache-control'], 'private, no-store');
    assert.strictEqual(validRes.headers['content-disposition'], 'inline');
    assert.ok(Buffer.isBuffer(validRes.body));
    assert.ok(validRes.body.length > 24);

    // Verify PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)
    assert.strictEqual(validRes.body[0], 0x89);
    assert.strictEqual(validRes.body[1], 0x50);
    assert.strictEqual(validRes.body[2], 0x4e);
    assert.strictEqual(validRes.body[3], 0x47);

    // Never reveals internal storage key or filesystem paths
    assert.ok(!JSON.stringify(validRes.headers).includes(doc.objectStorageKey));

    // 7d. Page 2 returns valid PNG bytes
    const page2Res = await request(app)
      .get(`/api/v1/cases/${testCaseA._id}/documents/${doc._id}/pages/2/preview`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.strictEqual(page2Res.status, 200);

    // 7e. Invalid page number (page 3 when pageCount is 2) returns HTTP 404
    const invalidPageRes = await request(app)
      .get(`/api/v1/cases/${testCaseA._id}/documents/${doc._id}/pages/3/preview`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.strictEqual(invalidPageRes.status, 404);

    // 7f. Page 0 or negative page returns HTTP 404
    const zeroPageRes = await request(app)
      .get(`/api/v1/cases/${testCaseA._id}/documents/${doc._id}/pages/0/preview`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.strictEqual(zeroPageRes.status, 404);
  });

  // 8. Viewer uses authenticated Blob previews and revokes Object URLs
  await t.test('8. Frontend viewer source code uses authenticated getDocumentPagePreview Blob API and revokes Object URLs', () => {
    const viewerSource = fs.readFileSync(
      path.resolve(__dirname, '../../src/modules/verification/components/DocumentEvidenceViewer.tsx'),
      'utf8'
    );

    assert.ok(
      viewerSource.includes('verificationApi.getDocumentPagePreview'),
      'DocumentEvidenceViewer must call verificationApi.getDocumentPagePreview for PDFs'
    );
    assert.ok(
      viewerSource.includes('URL.revokeObjectURL(currentObjectUrl)'),
      'DocumentEvidenceViewer must revoke temporary Object URLs on cleanup'
    );
    assert.ok(
      viewerSource.includes('Local PDF rendering and OCR — reviewer validation required.'),
      'DocumentEvidenceViewer must prominently display reviewer validation notice'
    );
    assert.ok(
      viewerSource.includes('Source location unavailable'),
      'DocumentEvidenceViewer must display honest missing coordinates notice'
    );
  });

  // 9. Zero leakage of document content, OCR text, or storage keys in logs or errors
  await t.test('9. No raw document content, OCR text, or storage keys appear in errors', async () => {
    const mockProvider = new MockPdfRendererProvider({ pageCount: 1 });
    mockProvider.setSimulateError(new Error('Internal engine fault'));
    pdfRenderingService.setProvider(mockProvider);

    const storedPdf = await storageService.storeDocument({
      caseId: testCaseA._id,
      filename: 'fault.pdf',
      content: minimalPdfBase64
    });

    const doc = await Document.create({
      caseId: testCaseA._id,
      type: 'CLAIM_FORM',
      objectStorageKey: storedPdf.objectStorageKey,
      originalFilename: 'fault.pdf',
      mimeType: 'application/pdf',
      sizeBytes: storedPdf.sizeBytes,
      sha256: storedPdf.sha256,
      uploadedBy: userA._id
    });

    try {
      await documentExtractorService.extractFields(doc);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(!err.message.includes(doc.objectStorageKey), 'Error message must not include objectStorageKey');
      assert.ok(!err.message.includes('cases/'), 'Error message must not include storage paths');
      assert.ok(!err.message.includes(minimalPdfFixture.toString('ascii').slice(0, 20)), 'Error message must not include raw bytes');
    }
  });

  // 10. Real-Provider Synthetic PDF Tests (NodePdfRendererProvider)
  await t.test('10. Real provider synthetic PDF tests: 1-page render, 4-page bounded limit, and oversized MediaBox rejection', async () => {
    const realProvider = new NodePdfRendererProvider();
    pdfRenderingService.setProvider(realProvider);

    // 10a. Real synthetic 1-page PDF rendering
    const realDoc1 = await Document.create({
      caseId: testCaseA._id,
      type: 'PRESCRIPTION',
      objectStorageKey: 'synthetic_real_page1.pdf',
      originalFilename: 'synthetic_real_page1.pdf',
      mimeType: 'application/pdf',
      sizeBytes: minimalPdfFixture.length,
      uploadedBy: userA._id
    });

    const res1 = await pdfRenderingService.renderDocumentPages(testCaseA._id, realDoc1._id, minimalPdfFixture);
    assert.strictEqual(res1.pageCount, 1);
    assert.strictEqual(res1.pagesRendered, 1);
    assert.strictEqual(res1.pages.length, 1);
    assert.strictEqual(res1.pages[0].width, 450);
    assert.strictEqual(res1.pages[0].height, 216);
    // Verify PNG magic bytes
    assert.strictEqual(res1.pages[0].buffer[0], 0x89);
    assert.strictEqual(res1.pages[0].buffer[1], 0x50);
    assert.strictEqual(res1.pages[0].buffer[2], 0x4e);
    assert.strictEqual(res1.pages[0].buffer[3], 0x47);

    // 10b. Real synthetic 4-page PDF bounded processing (max 3 pages rendered)
    const realDoc4 = await Document.create({
      caseId: testCaseA._id,
      type: 'PHARMACY_INVOICE',
      objectStorageKey: 'synthetic_real_page4.pdf',
      originalFilename: 'synthetic_real_page4.pdf',
      mimeType: 'application/pdf',
      sizeBytes: syntheticMultiPagePdfFixture.length,
      uploadedBy: userA._id
    });

    const res4 = await pdfRenderingService.renderDocumentPages(testCaseA._id, realDoc4._id, syntheticMultiPagePdfFixture);
    assert.strictEqual(res4.pageCount, 4, 'True page count must be 4');
    assert.strictEqual(res4.pagesRendered, 3, 'Must bound rendering to 3 pages in MVP');
    assert.strictEqual(res4.pages.length, 3);
    assert.deepStrictEqual(res4.pages.map(p => p.pageNumber), [1, 2, 3]);

    // 10c. Real synthetic oversized PDF (MediaBox 3000x3000) rejected BEFORE canvas allocation
    const realDocGiant = await Document.create({
      caseId: testCaseA._id,
      type: 'CLAIM_FORM',
      objectStorageKey: 'synthetic_real_giant.pdf',
      originalFilename: 'synthetic_real_giant.pdf',
      mimeType: 'application/pdf',
      sizeBytes: syntheticOversizedPdfFixture.length,
      uploadedBy: userA._id
    });

    await assert.rejects(
      async () => {
        await pdfRenderingService.renderDocumentPages(testCaseA._id, realDocGiant._id, syntheticOversizedPdfFixture);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 422);
        assert.match(err.message, /Rendered PDF page exceeds safe dimensions/i);
        return true;
      }
    );
  });

  // 11. Controlled Edge-Case: Pre-Allocation Dimension & Pixel Limits (Mock)
  await t.test('11. Controlled Edge-Case: Pre-allocation dimension checks reject oversized width/height and pixel count', async () => {
    const mockProvider = new MockPdfRendererProvider({ pageCount: 1 });
    mockProvider.setSimulateOversized(true);
    pdfRenderingService.setProvider(mockProvider);

    await assert.rejects(
      async () => {
        await pdfRenderingService.renderDocumentPages(testCaseA._id, 'doc-oversized-1', minimalPdfFixture);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 422);
        assert.match(err.message, /Rendered PDF page exceeds safe dimensions/i);
        return true;
      }
    );

    // Test pixel count exceeding 6,000,000 pixels (e.g. 2000 x 3100 = 6,200,000 px)
    mockProvider.setSimulateOversized(false);
    mockProvider.setPageDimensions(1, { width: 2000, height: 3100 });

    await assert.rejects(
      async () => {
        await pdfRenderingService.renderDocumentPages(testCaseA._id, 'doc-oversized-2', minimalPdfFixture);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 422);
        assert.match(err.message, /Rendered PDF page exceeds safe dimensions/i);
        return true;
      }
    );
  });

  // 12. Controlled Edge-Case: Bounded Rendering Time, Timeout and Active Cancellation
  await t.test('12. Controlled Edge-Case: Rendering timeout cancels ongoing work actively and returns HTTP 504', async () => {
    const slowMockProvider = new MockPdfRendererProvider({ pageCount: 1 });
    slowMockProvider.setRenderDelayMs(500);

    const boundedService = new (pdfRenderingService.constructor)(slowMockProvider, {
      timeoutMs: 100 // 100ms timeout
    });

    await assert.rejects(
      async () => {
        await boundedService.getPagePreview(testCaseA._id, 'doc-timeout', 1, async () => minimalPdfFixture);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 504);
        assert.strictEqual(err.code, 'PDF_RENDER_TIMEOUT');
        assert.match(err.message, /timed out after 100ms/i);
        return true;
      }
    );

    // Verify active cancellation was invoked on the provider
    assert.strictEqual(slowMockProvider.wasCancelled, true, 'Provider must receive active cancellation on timeout');
  });

  // 13. Controlled Edge-Case: Global Concurrency and Queue Limits
  await t.test('13. Controlled Edge-Case: Global concurrency limit queues tasks; exceeding queue length rejects with HTTP 503', async () => {
    const slowProvider = new MockPdfRendererProvider({ pageCount: 1 });
    slowProvider.setRenderDelayMs(150);

    // Limit concurrency to 1 and queue length to 2
    const limitedService = new (pdfRenderingService.constructor)(slowProvider, {
      maxConcurrency: 1,
      maxQueueLength: 2,
      timeoutMs: 3000
    });

    // Launch task 1 (occupies worker)
    const task1 = limitedService.getPagePreview(testCaseA._id, 'doc-q1', 1, async () => minimalPdfFixture);

    // Launch task 2 & 3 (fill queue)
    const task2 = limitedService.getPagePreview(testCaseA._id, 'doc-q2', 1, async () => minimalPdfFixture);
    const task3 = limitedService.getPagePreview(testCaseA._id, 'doc-q3', 1, async () => minimalPdfFixture);

    // Launch task 4: queue limit (2) is exceeded! Must immediately reject with 503
    await assert.rejects(
      async () => {
        await limitedService.getPagePreview(testCaseA._id, 'doc-q4', 1, async () => minimalPdfFixture);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 503);
        assert.match(err.message, /queue limit exceeded/i);
        return true;
      }
    );

    // Tasks 1, 2, and 3 should complete successfully
    const [res1, res2, res3] = await Promise.all([task1, task2, task3]);
    assert.ok(Buffer.isBuffer(res1));
    assert.ok(Buffer.isBuffer(res2));
    assert.ok(Buffer.isBuffer(res3));
  });

  // 14. Controlled Edge-Case: Bounded Memory Preview Cache & LRU Eviction
  await t.test('14. Controlled Edge-Case: In-memory preview cache bounds pages and bytes with LRU eviction', async () => {
    const mockProvider = new MockPdfRendererProvider({ pageCount: 3 });
    const cacheService = new (pdfRenderingService.constructor)(mockProvider, {
      maxCachePages: 2,
      maxCacheBytes: 2500
    });

    const buf1 = createMockPngBuffer(100, 100); // ~113 bytes
    const buf2 = createMockPngBuffer(100, 100);
    const buf3 = createMockPngBuffer(100, 100);

    await cacheService.storePagePreview('case-lru', 'doc-1', 1, buf1);
    await cacheService.storePagePreview('case-lru', 'doc-1', 2, buf2);

    assert.strictEqual(cacheService._memoryPreviewCache.size, 2);

    // Adding 3rd preview triggers LRU eviction of 1st preview
    await cacheService.storePagePreview('case-lru', 'doc-1', 3, buf3);

    assert.strictEqual(cacheService._memoryPreviewCache.size, 2);
    assert.strictEqual(cacheService._memoryPreviewCache.has('case-lru:doc-1:1'), false, 'Oldest preview 1 must be evicted');
    assert.strictEqual(cacheService._memoryPreviewCache.has('case-lru:doc-1:2'), true);
    assert.strictEqual(cacheService._memoryPreviewCache.has('case-lru:doc-1:3'), true);
  });

  // 15. Controlled Edge-Case: Storage-Root Integration and Private Disk Retention Eviction without Deleting Original Documents
  await t.test('15. Controlled Edge-Case: Uses getDocumentStorageRoot, enforces private permissions, evicts only previews without deleting original documents', async () => {
    const storageRoot = getDocumentStorageRoot();
    assert.strictEqual(pdfRenderingService.storageRoot, storageRoot);

    const testCaseId = new mongoose.Types.ObjectId().toString();
    const testDocId = new mongoose.Types.ObjectId().toString();

    // 15a. Store an original document outside previews/
    const caseDir = path.join(storageRoot, testCaseId);
    fs.mkdirSync(caseDir, { recursive: true, mode: 0o700 });
    const originalDocPath = path.join(caseDir, 'original_prescription.pdf');
    fs.writeFileSync(originalDocPath, minimalPdfFixture, { mode: 0o600 });
    assert.ok(fs.existsSync(originalDocPath), 'Original document must exist');

    // 15b. Create limited disk preview service (max 2 disk previews)
    const diskService = new (pdfRenderingService.constructor)(new MockPdfRendererProvider(), {
      maxDiskPreviews: 2,
      storageRoot
    });

    const mockPng = createMockPngBuffer(50, 50);
    await diskService.storePagePreview(testCaseId, testDocId, 1, mockPng);
    await diskService.storePagePreview(testCaseId, testDocId, 2, mockPng);

    const preview1 = path.join(storageRoot, testCaseId, 'previews', testDocId, 'page_1.png');
    const preview2 = path.join(storageRoot, testCaseId, 'previews', testDocId, 'page_2.png');
    assert.ok(fs.existsSync(preview1));
    assert.ok(fs.existsSync(preview2));

    // Storing page 3 preview exceeds maxDiskPreviews (2) -> triggers eviction of page 1 preview
    await diskService.storePagePreview(testCaseId, testDocId, 3, mockPng);
    const preview3 = path.join(storageRoot, testCaseId, 'previews', testDocId, 'page_3.png');
    assert.ok(fs.existsSync(preview3));

    // Page 1 preview should be evicted from disk
    assert.strictEqual(fs.existsSync(preview1), false, 'Oldest preview file must be evicted from disk');

    // CRITICAL SAFETY CHECK: Original document MUST NOT be deleted
    assert.ok(fs.existsSync(originalDocPath), 'Original document must NEVER be deleted during preview cache eviction');

    // Cleanup test files
    try {
      fs.unlinkSync(originalDocPath);
      if (fs.existsSync(preview2)) fs.unlinkSync(preview2);
      if (fs.existsSync(preview3)) fs.unlinkSync(preview3);
      fs.rmdirSync(path.join(storageRoot, testCaseId, 'previews', testDocId));
      fs.rmdirSync(path.join(storageRoot, testCaseId, 'previews'));
      fs.rmdirSync(caseDir);
    } catch (_) {}
  });

  // 16. Controlled Edge-Case: Page Coverage Contract & Schema Compliance
  await t.test('16. Controlled Edge-Case: Records total, processed, and omitted page coverage; incomplete documents require human review and never described as fully analyzed', async () => {
    const coverageCase = await VerificationCase.create({
      organizationId: orgA._id,
      createdBy: userA._id,
      subjectReference: 'patient-coverage-test',
      status: 'DOCUMENTS_PENDING'
    });

    const mockPdfProvider = new MockPdfRendererProvider({ pageCount: 5 });
    pdfRenderingService.setProvider(mockPdfProvider);

    const storedPdf = await storageService.storeDocument({
      caseId: coverageCase._id,
      filename: 'prescription_five_pages.pdf',
      content: minimalPdfBase64
    });

    const doc = await Document.create({
      caseId: coverageCase._id,
      type: 'PRESCRIPTION',
      objectStorageKey: storedPdf.objectStorageKey,
      originalFilename: 'prescription_five_pages.pdf',
      mimeType: 'application/pdf',
      sizeBytes: storedPdf.sizeBytes,
      sha256: storedPdf.sha256,
      uploadedBy: userA._id
    });

    coverageCase.documentIds = [doc._id];
    await coverageCase.save();

    // Field extraction sets coverage metrics
    await documentExtractorService.extractFields(doc);

    const docAfter = await Document.findById(doc._id);
    assert.strictEqual(docAfter.pageCount, 5, 'pageCount must be 5');
    assert.strictEqual(docAfter.processedPageCount, 3, 'processedPageCount must be 3');
    assert.strictEqual(docAfter.omittedPageCount, 2, 'omittedPageCount must be 2');
    assert.deepStrictEqual(docAfter.pageCoverage.toObject(), {
      total: 5,
      processed: 3,
      omitted: 2,
      status: 'INCOMPLETE'
    });
    assert.strictEqual(docAfter.metadata.incompleteCoverage, true);

    // Process case and verify human review is required and never described as fully analyzed
    const procRes = await request(app)
      .post(`/api/v1/cases/${coverageCase._id}/process`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    assert.strictEqual(procRes.status, 202);
    assert.strictEqual(procRes.body.reviewRequired, true);

    const vCaseAfter = await VerificationCase.findById(coverageCase._id);
    assert.strictEqual(vCaseAfter.reviewRequired, true);
    assert.strictEqual(vCaseAfter.metadata.hasIncompleteCoverage, true);

    // Verify INSUFFICIENT_EVIDENCE risk signal was emitted for incomplete coverage
    const signals = await RiskSignal.find({ caseId: coverageCase._id });
    const covSignal = signals.find(s => s.signalType === 'INSUFFICIENT_EVIDENCE' && s.description.includes('exceeding the 3-page processing limit'));
    assert.ok(covSignal, 'Must emit INSUFFICIENT_EVIDENCE signal for omitted pages');
    assert.strictEqual(covSignal.severity, 'HIGH');
    assert.strictEqual(covSignal.reviewRequired, true);

    // Verify explanation never claims fully analyzed
    const resultsRes = await request(app)
      .get(`/api/v1/cases/${coverageCase._id}/results`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert.strictEqual(resultsRes.status, 200);
    assert.ok(resultsRes.body.explanation.summary.includes('incomplete') || resultsRes.body.explanation.summary.includes('omitted'));
    assert.ok(!resultsRes.body.explanation.summary.toLowerCase().includes('fully analyzed'));
  });

  // 17. Controlled Edge-Case: Evidence-Reference Validity & Honest Missing-Information Evidence
  await t.test('17. Controlled Edge-Case: RiskSignal.evidenceItemIds reference actual same-case EvidenceItems; missing information has honest coverage without fake coordinates', async () => {
    const missingCase = await VerificationCase.create({
      organizationId: orgA._id,
      createdBy: userA._id,
      subjectReference: 'patient-missing-fields-test',
      status: 'DOCUMENTS_PENDING'
    });

    const mockPdfProvider = new MockPdfRendererProvider({ pageCount: 1 });
    pdfRenderingService.setProvider(mockPdfProvider);

    // Create an invoice missing required quantity and invoice_date
    const storedPdf = await storageService.storeDocument({
      caseId: missingCase._id,
      filename: 'invoice_incomplete.pdf',
      content: minimalPdfBase64
    });

    const doc = await Document.create({
      caseId: missingCase._id,
      type: 'PHARMACY_INVOICE',
      objectStorageKey: storedPdf.objectStorageKey,
      originalFilename: 'invoice_incomplete.pdf',
      mimeType: 'application/pdf',
      sizeBytes: storedPdf.sizeBytes,
      sha256: storedPdf.sha256,
      uploadedBy: userA._id
    });

    missingCase.documentIds = [doc._id];
    await missingCase.save();

    await request(app)
      .post(`/api/v1/cases/${missingCase._id}/process`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    const allSignals = await RiskSignal.find({ caseId: missingCase._id });
    assert.ok(allSignals.length > 0);

    for (const signal of allSignals) {
      assert.ok(signal.evidenceItemIds.length > 0, `Signal ${signal.signalType} must have evidenceItemIds`);
      for (const evId of signal.evidenceItemIds) {
        // 1. Must be a valid EvidenceItem
        const evItem = await EvidenceItem.findById(evId);
        assert.ok(evItem, `EvidenceItem ${evId} must exist in database`);

        // 2. Must belong strictly to the SAME case
        assert.strictEqual(String(evItem.caseId), String(missingCase._id), 'EvidenceItem must belong to the SAME case');

        // 3. Must NEVER be an ExtractedField ID
        const fieldCheck = await ExtractedField.findById(evId);
        assert.strictEqual(fieldCheck, null, 'evidenceItemId must NOT reference an ExtractedField ID');
      }
    }

    // Inspect MISSING_REQUIRED_FIELD signal's evidence item
    const missingSignal = allSignals.find(s => s.signalType === 'MISSING_REQUIRED_FIELD');
    assert.ok(missingSignal);
    const missingEv = await EvidenceItem.findById(missingSignal.evidenceItemIds[0]);
    assert.ok(missingEv);
    assert.match(missingEv.claimSupported, /Missing required field/i);
    assert.match(missingEv.evidenceText, /analyzed/i);
    assert.deepStrictEqual(missingEv.boundingBox, [0, 0, 0, 0], 'Missing field evidence must NOT invent bounding box coordinates');
  });

  // 18. Controlled Edge-Case: Clearance of Obsolete Document Correction Flags After Legitimate Reprocessing
  await t.test('18. Controlled Edge-Case: Obsolete document correction flags are cleared after legitimate correction & reprocessing without stale/duplicate findings', async () => {
    const retryCase = await VerificationCase.create({
      organizationId: orgA._id,
      createdBy: userA._id,
      subjectReference: 'patient-correction-retry-test',
      status: 'DOCUMENTS_PENDING'
    });

    const mockPdfProvider = new MockPdfRendererProvider({ pageCount: 2 });
    pdfRenderingService.setProvider(mockPdfProvider);

    // Page 1: 500mg, Page 2: 650mg -> creates conflict
    let count = 0;
    const mockOcrProvider = new MockOcrProvider();
    mockOcrProvider.recognize = async () => {
      count++;
      return {
        rawText: count === 1 ? 'Tab. Paracetamol 500mg\n500 mg' : 'Tab. Paracetamol 650mg\n650 mg',
        confidence: 0.95,
        lines: [
          { text: count === 1 ? 'Tab. Paracetamol 500mg' : 'Tab. Paracetamol 650mg', confidence: 0.95, bbox: [0.1, 0.1, 0.5, 0.15] },
          { text: count === 1 ? '500 mg' : '650 mg', confidence: 0.95, bbox: [0.55, 0.1, 0.7, 0.15] }
        ],
        words: []
      };
    };
    localOcrService.setProvider(mockOcrProvider);

    const storedPdf = await storageService.storeDocument({
      caseId: retryCase._id,
      filename: 'retry_conflict_rx.pdf',
      content: minimalPdfBase64
    });

    const doc = await Document.create({
      caseId: retryCase._id,
      type: 'PRESCRIPTION',
      objectStorageKey: storedPdf.objectStorageKey,
      originalFilename: 'retry_conflict_rx.pdf',
      mimeType: 'application/pdf',
      sizeBytes: storedPdf.sizeBytes,
      sha256: storedPdf.sha256,
      uploadedBy: userA._id
    });

    retryCase.documentIds = [doc._id];
    await retryCase.save();

    // 1st run: produces conflict
    await request(app)
      .post(`/api/v1/cases/${retryCase._id}/process`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    const docBefore = await Document.findById(doc._id);
    assert.strictEqual(docBefore.metadata.hasMultiPageConflict, true);
    assert.strictEqual(docBefore.metadata.needsCorrection, true);

    const signalsBefore = await RiskSignal.find({ caseId: retryCase._id });
    assert.ok(signalsBefore.some(s => s.signalType === 'CONFLICTING_MULTI_PAGE_DATA'));

    // Legitimate correction: update page 2 field to match 500mg
    const fields = await ExtractedField.find({ caseId: retryCase._id, fieldType: 'dosage_strength' });
    const page2Field = fields.find(f => f.pageNumber === 2);
    assert.ok(page2Field);

    const correctRes = await request(app)
      .patch(`/api/v1/cases/${retryCase._id}/extracted-fields/${page2Field._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ normalizedValue: '500 mg' });

    assert.strictEqual(correctRes.status, 200);

    // Verify original extraction is preserved
    const page2FieldAfter = await ExtractedField.findById(page2Field._id);
    assert.strictEqual(page2FieldAfter.rawValue, page2Field.rawValue, 'Original extraction rawValue must be preserved');
    assert.strictEqual(page2FieldAfter.normalizedValue, '500 mg', 'Normalized value must reflect correction');
    assert.strictEqual(page2FieldAfter.needsCorrection, false);
    assert.strictEqual(String(page2FieldAfter.correctedBy), String(userA._id));

    // Also correct page 1 field if marked needsCorrection so all fields on doc are resolved
    const page1Field = fields.find(f => f.pageNumber === 1);
    if (page1Field && page1Field.needsCorrection) {
      await request(app)
        .patch(`/api/v1/cases/${retryCase._id}/extracted-fields/${page1Field._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ normalizedValue: '500 mg' });
    }

    // 2nd run: reprocessing after legitimate correction
    const reprocessRes = await request(app)
      .post(`/api/v1/cases/${retryCase._id}/process`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    assert.strictEqual(reprocessRes.status, 202);

    // Obsolete document correction flags must be cleared
    const docAfter = await Document.findById(doc._id);
    assert.strictEqual(docAfter.metadata.hasMultiPageConflict, false, 'hasMultiPageConflict flag must be cleared');
    assert.strictEqual(docAfter.metadata.needsCorrection, false, 'needsCorrection flag must be cleared');

    // CONFLICTING_MULTI_PAGE_DATA signal must no longer be present
    const signalsAfter = await RiskSignal.find({ caseId: retryCase._id });
    assert.strictEqual(
      signalsAfter.some(s => s.signalType === 'CONFLICTING_MULTI_PAGE_DATA'),
      false,
      'CONFLICTING_MULTI_PAGE_DATA risk signal must be removed on retry'
    );
  });
});

