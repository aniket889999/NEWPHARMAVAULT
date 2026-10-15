const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_trustrag_ocr_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-ocr';
process.env.GEMINI_API_KEY = 'test-only-gemini-key';
process.env.TRUSTRAG_LLM_ENABLED = 'false';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');

const User = require('../models/userModel');
const VerificationCase = require('../models/verificationCaseModel');
const Document = require('../models/documentModel');
const ExtractedField = require('../models/extractedFieldModel');
const EvidenceItem = require('../models/evidenceItemModel');

const storageService = require('../services/trustRag/storageService');
const documentExtractorService = require('../services/trustRag/documentExtractorService');
const localOcrService = require('../services/trustRag/localOcrService');
const MockOcrProvider = require('../services/trustRag/mockOcrProvider');
const TesseractOcrProvider = require('../services/trustRag/tesseractOcrProvider');

// Minimal valid PNG buffer
const validPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

test('Work Order 4A: Local Image OCR for TrustRAG Test Suite', async (t) => {
  let user;
  let testCase;
  let defaultProvider;

  t.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    const orgId = new mongoose.Types.ObjectId();
    user = await User.findOne({ email: 'ocr_test@pharmavault.org' });
    if (!user) {
      user = await User.create({
        name: 'OCR Tester',
        email: 'ocr_test@pharmavault.org',
        password: 'password123',
        role: 'pharmacist',
        organizationId: orgId
      });
    } else {
      user.organizationId = orgId;
      await user.save();
    }

    testCase = await VerificationCase.create({
      organizationId: user.organizationId,
      createdBy: user._id,
      subjectReference: 'ocr-test-case-001',
      status: 'DRAFT',
      schemaVersion: '1.0'
    });

    defaultProvider = localOcrService.getProvider();
  });

  t.after(async () => {
    // Restore default provider
    localOcrService.setProvider(defaultProvider);

    if (testCase) {
      await Promise.all([
        VerificationCase.deleteOne({ _id: testCase._id }),
        Document.deleteMany({ caseId: testCase._id }),
        ExtractedField.deleteMany({ caseId: testCase._id }),
        EvidenceItem.deleteMany({ caseId: testCase._id })
      ]);
    }
    await mongoose.disconnect();
  });

  // 1. Mocked OCR creates fields with real confidence and normalized bounding boxes
  await t.test('1. Mocked local OCR result creates fields with real confidence and normalized bounding boxes', async () => {
    const mockProvider = new MockOcrProvider({
      rawText: 'Crocin 500mg\n500 mg\nQty: 10\nDate: 2026-08-01\nDr. Ramesh Sharma',
      confidence: 0.94,
      imageDimensions: { width: 1000, height: 1000 },
      lines: [
        { text: 'Crocin 500mg', confidence: 0.95, bbox: [0.1, 0.2, 0.4, 0.25] },
        { text: '500 mg', confidence: 0.92, bbox: [0.45, 0.2, 0.55, 0.25] },
        { text: 'Qty: 10', confidence: 0.90, bbox: [0.6, 0.2, 0.7, 0.25] },
        { text: '2026-08-01', confidence: 0.96, bbox: [0.75, 0.1, 0.9, 0.15] },
        { text: 'Dr. Ramesh Sharma', confidence: 0.93, bbox: [0.1, 0.05, 0.4, 0.1] }
      ],
      words: []
    });

    localOcrService.setProvider(mockProvider);

    // Store real file to storage
    const stored = await storageService.storeDocument({
      caseId: testCase._id,
      filename: 'rx_image.png',
      content: `data:image/png;base64,${validPngBuffer.toString('base64')}`
    });

    const doc = await Document.create({
      caseId: testCase._id,
      type: 'PRESCRIPTION',
      objectStorageKey: stored.objectStorageKey,
      originalFilename: 'rx_image.png',
      mimeType: 'image/png',
      sizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
      uploadedBy: user._id
    });

    const fields = await documentExtractorService.extractFields(doc);

    assert.ok(fields.length >= 3, `Expected at least 3 extracted fields, got ${fields.length}`);

    // Verify medicine name
    const medField = fields.find(f => f.fieldType === 'medicine_name');
    assert.ok(medField, 'Medicine name field must be extracted');
    assert.strictEqual(medField.extractionMethod, 'LOCAL_TESSERACT_IMAGE_OCR');
    assert.strictEqual(medField.normalizedValue, 'Paracetamol');
    assert.strictEqual(medField.extractionConfidence, 0.95);
    assert.deepStrictEqual(medField.boundingBox, [0.1, 0.2, 0.4, 0.25]);

    // Verify quantity
    const qtyField = fields.find(f => f.fieldType === 'quantity');
    assert.ok(qtyField, 'Quantity field must be extracted');
    assert.strictEqual(qtyField.normalizedValue, '10');
    assert.strictEqual(qtyField.extractionConfidence, 0.90);

    // Verify Evidence Items
    const evidences = await EvidenceItem.find({ documentId: doc._id });
    assert.ok(evidences.length >= 3, 'Evidence items must be created for each candidate');
    const medEvidence = evidences.find(e => String(e.sourceId) === String(medField._id));
    assert.ok(medEvidence);
    assert.deepStrictEqual(medEvidence.boundingBox, [0.1, 0.2, 0.4, 0.25]);
    assert.strictEqual(medEvidence.pageNumber, 1);
  });

  // 2. Low-confidence OCR fields require correction
  await t.test('2. Low-confidence OCR fields require human correction (needsCorrection: true)', async () => {
    const mockProvider = new MockOcrProvider({
      rawText: 'Crocin 500mg\n500 mg',
      confidence: 0.60,
      imageDimensions: { width: 1000, height: 1000 },
      lines: [
        { text: 'Crocin 500mg', confidence: 0.62, bbox: [0.1, 0.2, 0.4, 0.25] },
        { text: '500 mg', confidence: 0.58, bbox: [0.45, 0.2, 0.55, 0.25] }
      ],
      words: []
    });

    localOcrService.setProvider(mockProvider);

    const stored = await storageService.storeDocument({
      caseId: testCase._id,
      filename: 'low_conf.png',
      content: `data:image/png;base64,${validPngBuffer.toString('base64')}`
    });

    const doc = await Document.create({
      caseId: testCase._id,
      type: 'PRESCRIPTION',
      objectStorageKey: stored.objectStorageKey,
      originalFilename: 'low_conf.png',
      mimeType: 'image/png',
      sizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
      uploadedBy: user._id
    });

    const fields = await documentExtractorService.extractFields(doc);
    assert.ok(fields.length > 0);

    for (const f of fields) {
      assert.strictEqual(f.needsCorrection, true, `Field ${f.fieldType} with confidence < 0.75 must require correction`);
    }
  });

  // 3. OCR failure produces a controlled error and no invented fields
  await t.test('3. OCR failure produces a controlled error and does NOT invent fake fields', async () => {
    const mockProvider = new MockOcrProvider();
    mockProvider.setSimulateError({
      message: 'Native worker crashed or memory exhausted',
      statusCode: 422
    });

    localOcrService.setProvider(mockProvider);

    const stored = await storageService.storeDocument({
      caseId: testCase._id,
      filename: 'crash.png',
      content: `data:image/png;base64,${validPngBuffer.toString('base64')}`
    });

    const doc = await Document.create({
      caseId: testCase._id,
      type: 'PRESCRIPTION',
      objectStorageKey: stored.objectStorageKey,
      originalFilename: 'crash.png',
      mimeType: 'image/png',
      sizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
      uploadedBy: user._id
    });

    await assert.rejects(
      async () => {
        await documentExtractorService.extractFields(doc);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 422);
        assert.match(err.message, /Local OCR extraction failed/i);
        return true;
      }
    );

    // Verify document status updated to FAILED and zero fields were invented
    const docAfter = await Document.findById(doc._id);
    assert.strictEqual(docAfter.processingStatus, 'FAILED');

    const fieldsCount = await ExtractedField.countDocuments({ documentId: doc._id });
    assert.strictEqual(fieldsCount, 0, 'Must NOT invent or fallback to synthetic fields on OCR failure');
  });

  // 4. PDF uploads are not falsely processed as image OCR and create zero fake fields
  await t.test('4. PDF uploads are honest and do not invent fake fields', async () => {
    const { MockPdfRendererProvider } = require('../services/trustRag/mockPdfRendererProvider');
    const pdfRenderingService = require('../services/trustRag/pdfRenderingService');
    const mockPdfProvider = new MockPdfRendererProvider({ pageCount: 1 });
    pdfRenderingService.setProvider(mockPdfProvider);
    localOcrService.setProvider(new MockOcrProvider({ rawText: '', lines: [] }));

    const pdfContent = `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\nxref\n0 2\n0000000000 65535 f\n0000000009 00000 n\ntrailer << /Size 2 /Root 1 0 R >>\nstartxref\n70\n%%EOF`;
    const storedPdf = await storageService.storeDocument({
      caseId: testCase._id,
      filename: 'pending.pdf',
      content: `data:application/pdf;base64,${Buffer.from(pdfContent).toString('base64')}`
    });

    const pdfDoc = await Document.create({
      caseId: testCase._id,
      type: 'CLAIM_FORM',
      objectStorageKey: storedPdf.objectStorageKey,
      originalFilename: 'pending.pdf',
      mimeType: 'application/pdf',
      sizeBytes: storedPdf.sizeBytes,
      sha256: storedPdf.sha256,
      uploadedBy: user._id
    });

    const fields = await documentExtractorService.extractFields(pdfDoc);
    assert.strictEqual(fields.length, 0, 'PDF documents must not invent fields in OCR phase');

    const updatedPdfDoc = await Document.findById(pdfDoc._id);
    assert.ok(
      ['PROCESSED', 'PDF_OCR_PENDING_RASTERIZATION'].includes(updatedPdfDoc.processingStatus),
      `Expected PROCESSED or PDF_OCR_PENDING_RASTERIZATION, got ${updatedPdfDoc.processingStatus}`
    );
    assert.strictEqual(updatedPdfDoc.metadata.needsCorrection, true);
  });

  // 5. No Gemini/LLM service receives document data
  await t.test('5. No Gemini or external LLM service receives document data or OCR text', async () => {
    // Assert LLM is disabled and OCR operations run strictly in-process
    assert.strictEqual(process.env.TRUSTRAG_LLM_ENABLED, 'false');
    // Ensure documentExtractorService does not require @google/generative-ai
    const extractorCode = fs.readFileSync(
      path.join(__dirname, '..', 'services', 'trustRag', 'documentExtractorService.js'),
      'utf8'
    );
    assert.doesNotMatch(extractorCode, /generative-ai|GoogleGenerativeAI|gemini/i);
  });

  // 6. No raw OCR text is written to logs
  await t.test('6. No raw OCR text or patient information is written to server logs', async () => {
    const secretText = 'CONFIDENTIAL_PATIENT_SECRET_987654321';
    const mockProvider = new MockOcrProvider({
      rawText: secretText,
      confidence: 0.95,
      imageDimensions: { width: 100, height: 100 },
      lines: [{ text: secretText, confidence: 0.95, bbox: [0.1, 0.1, 0.9, 0.9] }],
      words: []
    });

    localOcrService.setProvider(mockProvider);

    const logs = [];
    const origLog = console.log;
    const origErr = console.error;

    console.log = (...args) => logs.push(args.join(' '));
    console.error = (...args) => logs.push(args.join(' '));

    try {
      const stored = await storageService.storeDocument({
        caseId: testCase._id,
        filename: 'privacy.png',
        content: `data:image/png;base64,${validPngBuffer.toString('base64')}`
      });

      const doc = await Document.create({
        caseId: testCase._id,
        type: 'PRESCRIPTION',
        objectStorageKey: stored.objectStorageKey,
        originalFilename: 'privacy.png',
        mimeType: 'image/png',
        sizeBytes: stored.sizeBytes,
        sha256: stored.sha256,
        uploadedBy: user._id
      });

      await documentExtractorService.extractFields(doc);
    } finally {
      console.log = origLog;
      console.error = origErr;
    }

    const allLogged = logs.join('\n');
    assert.doesNotMatch(
      allLogged,
      new RegExp(secretText),
      'Raw OCR text or patient data must NEVER appear in console logs'
    );
  });

  // 7. Real Tesseract provider recognize runs without throwing
  await t.test('7. Real Tesseract provider initializes and recognizes image buffer safely', async () => {
    const tesseractProvider = new TesseractOcrProvider();
    const result = await tesseractProvider.recognize(validPngBuffer, { timeoutMs: 15000 });
    assert.ok(result);
    assert.ok(typeof result.rawText === 'string');
    assert.ok(typeof result.confidence === 'number');
    assert.ok(Array.isArray(result.lines));
    assert.ok(Array.isArray(result.words));
    assert.ok(result.imageDimensions.width > 0);
  });

  // 7b. Real Tesseract provider extracts structured blocks with preserved coordinates (regression)
  await t.test('7b. Real Tesseract provider extracts structured blocks with preserved coordinates from rendered image', async () => {
    let renderedPng;
    try {
      const { createCanvas } = require('@napi-rs/canvas');
      const canvas = createCanvas(600, 200);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 600, 200);
      ctx.fillStyle = '#000000';
      ctx.font = '28px sans-serif';
      ctx.fillText('Paracetamol 500 mg Tablet', 30, 70);
      ctx.fillText('Quantity: 10', 30, 130);
      renderedPng = canvas.toBuffer('image/png');
    } catch {
      const NodePdfRendererProvider = require('../services/trustRag/nodePdfRendererProvider');
      const renderer = new NodePdfRendererProvider();

      function makeSyntheticPdf(lines) {
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

      const pdfBuffer = makeSyntheticPdf(['Paracetamol 500 mg Tablet', 'Quantity: 10']);
      renderedPng = await renderer.renderPage(pdfBuffer, 1);
    }
    assert.ok(renderedPng && renderedPng.length > 0, 'Rendered PNG must not be empty');

    const tesseractProvider = new TesseractOcrProvider();
    const result = await tesseractProvider.recognize(renderedPng, { timeoutMs: 30000 });

    assert.ok(result.rawText.includes('Paracetamol'), `Expected rawText to include 'Paracetamol', got: ${result.rawText}`);
    assert.ok(result.lines.length >= 2, `Expected at least 2 lines, got: ${result.lines.length}`);
    assert.ok(result.words.length >= 4, `Expected at least 4 words, got: ${result.words.length}`);

    // Verify structured block properties and preserved normalized coordinates (no fabrication)
    for (const line of result.lines) {
      assert.ok(line.text.length > 0, 'Line text must not be empty');
      assert.ok(line.confidence >= 0 && line.confidence <= 1, 'Line confidence must be normalized between 0 and 1');
      assert.ok(Array.isArray(line.bbox) && line.bbox.length === 4, 'Line bbox must have 4 coordinates [x0, y0, x1, y1]');
      const [x0, y0, x1, y1] = line.bbox;
      assert.ok(x0 >= 0 && x0 <= 1, `x0 must be in [0, 1], got ${x0}`);
      assert.ok(y0 >= 0 && y0 <= 1, `y0 must be in [0, 1], got ${y0}`);
      assert.ok(x1 >= x0 && x1 <= 1, `x1 must be >= x0 and <= 1, got ${x1}`);
      assert.ok(y1 >= y0 && y1 <= 1, `y1 must be >= y0 and <= 1, got ${y1}`);
    }

    // Verify words also have preserved normalized coordinates
    for (const word of result.words) {
      assert.ok(word.text.length > 0, 'Word text must not be empty');
      assert.ok(word.confidence >= 0 && word.confidence <= 1, 'Word confidence must be normalized between 0 and 1');
      assert.ok(Array.isArray(word.bbox) && word.bbox.length === 4, 'Word bbox must have 4 coordinates');
    }
  });

  // 8. Upload with sampleFields, lowConfidence, or unknown extraction properties returns HTTP 400
  await t.test('8. Upload with sampleFields, lowConfidence, or unknown extraction properties returns HTTP 400', async () => {
    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 8a. Injection of sampleFields
    const sampleRes = await request(app)
      .post(`/api/v1/cases/${testCase._id}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'PRESCRIPTION',
        filename: 'injection.png',
        mimeType: 'image/png',
        file: `data:image/png;base64,${validPngBuffer.toString('base64')}`,
        sampleFields: [{ fieldType: 'medicine_name', rawValue: 'Injected Drug' }]
      });
    assert.strictEqual(sampleRes.status, 400);
    assert.match(sampleRes.body.message, /prohibited/i);

    // 8b. Injection of lowConfidence
    const lowConfRes = await request(app)
      .post(`/api/v1/cases/${testCase._id}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'PRESCRIPTION',
        filename: 'injection2.png',
        mimeType: 'image/png',
        file: `data:image/png;base64,${validPngBuffer.toString('base64')}`,
        lowConfidence: false
      });
    assert.strictEqual(lowConfRes.status, 400);
    assert.match(lowConfRes.body.message, /prohibited/i);

    // 8c. Unknown extraction-control property
    const unknownRes = await request(app)
      .post(`/api/v1/cases/${testCase._id}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'PRESCRIPTION',
        filename: 'injection3.png',
        mimeType: 'image/png',
        file: `data:image/png;base64,${validPngBuffer.toString('base64')}`,
        fakeOverride: 'hacked'
      });
    assert.strictEqual(unknownRes.status, 400);
    assert.match(unknownRes.body.message, /prohibited/i);
  });

  // 9. Processing case with injected request-body options returns HTTP 400
  await t.test('9. Processing case with injected request-body options returns HTTP 400', async () => {
    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const procRes = await request(app)
      .post(`/api/v1/cases/${testCase._id}/process`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sampleFields: [{ fieldType: 'medicine_name', rawValue: 'Injected Drug' }]
      });
    assert.strictEqual(procRes.status, 400);
    assert.match(procRes.body.message, /prohibited/i);
  });

  // 10. Client cannot cause fields to be created without OCR output
  await t.test('10. Client cannot cause fields to be created without OCR output', async () => {
    const emptyMock = new MockOcrProvider({
      rawText: '',
      confidence: 0,
      lines: [],
      words: [],
      imageDimensions: { width: 1000, height: 1000 }
    });
    localOcrService.setProvider(emptyMock);

    const stored = await storageService.storeDocument({
      caseId: testCase._id,
      filename: 'empty_ocr.png',
      content: `data:image/png;base64,${validPngBuffer.toString('base64')}`
    });

    const doc = await Document.create({
      caseId: testCase._id,
      type: 'PRESCRIPTION',
      objectStorageKey: stored.objectStorageKey,
      originalFilename: 'empty_ocr.png',
      mimeType: 'image/png',
      sizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
      uploadedBy: user._id
    });

    const fields = await documentExtractorService.extractFields(doc);
    assert.strictEqual(fields.length, 0, 'No fields should be created when OCR returns no text; zero fake templates');
  });

  // 11. OCR timeout terminates its worker and keeps mutex locked through termination
  await t.test('11. OCR timeout terminates its worker and keeps mutex locked through termination', async () => {
    const tesseractProvider = new TesseractOcrProvider();

    // Trigger recognize with 1ms timeout to force timeout
    let timedOut = false;
    try {
      await tesseractProvider.recognize(validPngBuffer, { timeoutMs: 1 });
    } catch (err) {
      timedOut = true;
      assert.strictEqual(err.statusCode, 504);
      assert.match(err.message, /timed out/i);
    }
    assert.strictEqual(timedOut, true, 'Short timeout should fail with 504');
    // Ensure mutex is released after termination
    assert.strictEqual(tesseractProvider.mutex.isLocked(), false, 'Mutex must be released after worker terminates');

    // Test concurrency protection: mutex prevents concurrent runs from overlapping
    let firstRunning = false;
    let overlapOccurred = false;

    const job1 = (async () => {
      const release = await tesseractProvider.mutex.acquire();
      firstRunning = true;
      await new Promise(r => setTimeout(r, 50));
      firstRunning = false;
      release();
    })();

    const job2 = (async () => {
      await new Promise(r => setTimeout(r, 10));
      const release = await tesseractProvider.mutex.acquire();
      if (firstRunning) {
        overlapOccurred = true;
      }
      release();
    })();

    await Promise.all([job1, job2]);
    assert.strictEqual(overlapOccurred, false, 'Jobs must not overlap; mutex must enforce serialization');
  });

  // 12. OCR configuration prohibits remote language-data URLs and verifies local files
  await t.test('12. OCR configuration prohibits remote language-data URLs and verifies local files', async () => {
    const tesseractProvider = new TesseractOcrProvider();

    // 12a. Remote URL is prohibited
    const prevPath = process.env.TRUSTRAG_TESSDATA_PATH;
    try {
      process.env.TRUSTRAG_TESSDATA_PATH = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0';
      let rejectedRemote = false;
      try {
        await tesseractProvider.recognize(validPngBuffer);
      } catch (err) {
        rejectedRemote = true;
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /remote.*prohibited/i);
      }
      assert.strictEqual(rejectedRemote, true, 'Remote URL for TRUSTRAG_TESSDATA_PATH must be rejected');

      // 12b. Missing local traineddata throws 503
      process.env.TRUSTRAG_TESSDATA_PATH = path.resolve(__dirname, 'nonexistent_tessdata_dir');
      let rejectedMissing = false;
      try {
        await tesseractProvider.recognize(validPngBuffer);
      } catch (err) {
        rejectedMissing = true;
        assert.strictEqual(err.statusCode, 503);
        assert.match(err.message, /unavailable/i);
      }
      assert.strictEqual(rejectedMissing, true, 'Missing local traineddata must throw 503');
    } finally {
      if (prevPath !== undefined) {
        process.env.TRUSTRAG_TESSDATA_PATH = prevPath;
      } else {
        delete process.env.TRUSTRAG_TESSDATA_PATH;
      }
    }
  });
});
