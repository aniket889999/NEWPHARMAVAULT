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

const { MockPdfRendererProvider, createMockPngBuffer } = require('../services/trustRag/mockPdfRendererProvider');
const MockOcrProvider = require('../services/trustRag/mockOcrProvider');

// Minimal valid PDF header fixture
const minimalPdfFixture = Buffer.from(
  '%PDF-1.4\n' +
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n' +
  '3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R/Resources<<>>>>endobj\n' +
  'xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \n' +
  'trailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n'
);
const minimalPdfBase64 = `data:application/pdf;base64,${minimalPdfFixture.toString('base64')}`;

test('Work Order 5B: Secure PDF Page Rendering and Local OCR Test Suite', async (t) => {
  let orgA, orgB;
  let userA, userB;
  let tokenA, tokenB;
  let testCaseA, testCaseB;

  t.before(async () => {
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
});
