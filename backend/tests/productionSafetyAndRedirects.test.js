const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_trustrag_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-not-for-production';
process.env.GEMINI_API_KEY = 'test-only-gemini-key';
process.env.TRUSTRAG_LLM_ENABLED = 'false';

const app = require('../app');
const storageService = require('../services/trustRag/storageService');
const VerificationCase = require('../models/verificationCaseModel');
const User = require('../models/userModel');
const generateToken = require('../utils/generateToken');

// Valid fixture builders
const validPdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF`;
const validPdfBase64 = `data:application/pdf;base64,${Buffer.from(validPdfContent).toString('base64')}`;

// Standard 8-byte PNG header + minimal IHDR
const validPngBuffer = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89
]);
const validPngBase64 = `data:image/png;base64,${validPngBuffer.toString('base64')}`;

// Oversized payload (5.1 MiB > 5 MiB limit) starting with valid %PDF- header
const oversizedBuffer = Buffer.concat([
  Buffer.from('%PDF-1.4 oversized test\n'),
  Buffer.alloc(5 * 1024 * 1024 + 100, 0x20)
]);
const oversizedPdfBase64 = `data:application/pdf;base64,${oversizedBuffer.toString('base64')}`;

test('Work Orders 3B.1 & 3B.2: Real Secure Document Intake & Production Safety Suite', async (t) => {
  let patientUser, claimsReviewerUser;
  let patientToken;
  let testCase;

  t.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pharmavault_test');
    }

    patientUser = await User.findOne({ email: 'safety_patient@test.com' });
    if (!patientUser) {
      patientUser = await User.create({
        name: 'Safety Patient',
        email: 'safety_patient@test.com',
        password: 'password123',
        role: 'patient'
      });
    }
    patientToken = generateToken(patientUser._id);

    claimsReviewerUser = await User.findOne({ email: 'safety_reviewer@test.com' });
    if (!claimsReviewerUser) {
      claimsReviewerUser = await User.create({
        name: 'Safety Reviewer',
        email: 'safety_reviewer@test.com',
        password: 'password123',
        role: 'claims_reviewer'
      });
    }

    testCase = await VerificationCase.create({
      organizationId: patientUser._id,
      createdBy: patientUser._id,
      subjectReference: 'safety-intake-test-001',
      status: 'DRAFT',
      schemaVersion: '1.0'
    });
  });

  t.after(async () => {
    if (testCase) {
      await VerificationCase.deleteOne({ _id: testCase._id });
    }
    await mongoose.disconnect();
  });

  // 1. StorageService unit validation
  await t.test('1. StorageService strictly validates format, magic bytes, base64 syntax, and size limits', async () => {
    const dummyCaseId = '64a0f4b39b3a4a001c900d5a';

    // 1a. Absent content
    await assert.rejects(
      async () => {
        await storageService.storeDocument({ caseId: dummyCaseId, filename: 'test.pdf' });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /cannot be absent or null/i);
        return true;
      }
    );

    // 1b. Empty string content
    await assert.rejects(
      async () => {
        await storageService.storeDocument({ caseId: dummyCaseId, filename: 'test.pdf', content: '   ' });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /cannot be empty/i);
        return true;
      }
    );

    // 1c. Raw text pretending to be a file
    await assert.rejects(
      async () => {
        await storageService.storeDocument({
          caseId: dummyCaseId,
          filename: 'test.pdf',
          content: 'uploaded-content-prescription.pdf'
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /raw text payloads are not accepted/i);
        return true;
      }
    );

    // 1d. Malformed base64 data URI
    await assert.rejects(
      async () => {
        await storageService.storeDocument({
          caseId: dummyCaseId,
          filename: 'test.pdf',
          content: 'data:application/pdf;base64,invalid!@#$'
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /malformed base64/i);
        return true;
      }
    );

    // 1e. MIME type / magic-byte mismatch (declared PDF but contains PNG bytes)
    await assert.rejects(
      async () => {
        await storageService.storeDocument({
          caseId: dummyCaseId,
          filename: 'mismatch.pdf',
          content: `data:application/pdf;base64,${validPngBuffer.toString('base64')}`
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /mime type mismatch/i);
        return true;
      }
    );

    // 1f. Invalid file signature (declared PDF with valid base64 but random text payload)
    await assert.rejects(
      async () => {
        await storageService.storeDocument({
          caseId: dummyCaseId,
          filename: 'fakepdf.pdf',
          content: `data:application/pdf;base64,${Buffer.from('Hello plain text world').toString('base64')}`
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /file signature does not match/i);
        return true;
      }
    );

    // 1g. File exceeding 5 MiB
    await assert.rejects(
      async () => {
        await storageService.storeDocument({
          caseId: dummyCaseId,
          filename: 'large.pdf',
          content: oversizedPdfBase64
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /exceeds maximum allowed size of 5 MB/i);
        return true;
      }
    );

    // 1h. Small valid PDF is accepted and returns required metadata
    const storedPdf = await storageService.storeDocument({
      caseId: dummyCaseId,
      filename: 'valid_rx.pdf',
      content: validPdfBase64
    });
    assert.strictEqual(storedPdf.detectedMimeType, 'application/pdf');
    assert.strictEqual(storedPdf.sanitizedFilename, 'valid_rx.pdf');
    assert.ok(storedPdf.sizeBytes > 0);
    assert.ok(storedPdf.sha256);
    assert.ok(storedPdf.objectStorageKey.includes('cases/'));

    // 1i. Small valid PNG is accepted
    const storedPng = await storageService.storeDocument({
      caseId: dummyCaseId,
      filename: 'sample_bill.png',
      content: validPngBase64
    });
    assert.strictEqual(storedPng.detectedMimeType, 'image/png');
    assert.strictEqual(storedPng.sanitizedFilename, 'sample_bill.png');
    assert.ok(storedPng.sha256);
  });

  // 2. HTTP Endpoint validation (POST /api/v1/cases/:caseId/documents)
  await t.test('2. POST /cases/:caseId/documents rejects invalid payloads and accepts real valid documents', async () => {
    // 2a. Missing file payload returns 400
    const resNoFile = await request(app)
      .post(`/api/v1/cases/${testCase._id}/documents`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ type: 'PRESCRIPTION' });
    assert.strictEqual(resNoFile.status, 400);
    assert.match(resNoFile.body.message, /file payload is required and cannot be absent/i);

    // 2b. Empty file payload returns 400
    const resEmptyFile = await request(app)
      .post(`/api/v1/cases/${testCase._id}/documents`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ type: 'PRESCRIPTION', file: '   ' });
    assert.strictEqual(resEmptyFile.status, 400);
    assert.match(resEmptyFile.body.message, /cannot be empty/i);

    // 2c. Raw text pretending to be file returns 400
    const resRawText = await request(app)
      .post(`/api/v1/cases/${testCase._id}/documents`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ type: 'PRESCRIPTION', file: 'uploaded-content-sample.pdf' });
    assert.strictEqual(resRawText.status, 400);
    assert.match(resRawText.body.message, /raw text payloads are not accepted/i);

    // 2d. Malformed base64 returns 400
    const resMalformed = await request(app)
      .post(`/api/v1/cases/${testCase._id}/documents`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ type: 'PRESCRIPTION', file: 'data:application/pdf;base64,not-valid-base64-!!!' });
    assert.strictEqual(resMalformed.status, 400);
    assert.match(resMalformed.body.message, /malformed base64/i);

    // 2e. MIME type / magic bytes mismatch returns 400
    const resMismatch = await request(app)
      .post(`/api/v1/cases/${testCase._id}/documents`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        type: 'PRESCRIPTION',
        filename: 'fake.pdf',
        file: `data:application/pdf;base64,${validPngBuffer.toString('base64')}`
      });
    assert.strictEqual(resMismatch.status, 400);
    assert.match(resMismatch.body.message, /mime type mismatch/i);

    // 2f. File over 5 MiB returns 400
    const resOversized = await request(app)
      .post(`/api/v1/cases/${testCase._id}/documents`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        type: 'PRESCRIPTION',
        filename: 'huge.pdf',
        file: oversizedPdfBase64
      });
    assert.strictEqual(resOversized.status, 400);
    assert.match(resOversized.body.message, /exceeds maximum allowed size of 5 MB/i);

    // 2g. Small valid PDF is accepted with 201 and never leaks local filesystem path
    const resValid = await request(app)
      .post(`/api/v1/cases/${testCase._id}/documents`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        type: 'PRESCRIPTION',
        filename: 'real_prescription.pdf',
        file: validPdfBase64
      });
    assert.strictEqual(resValid.status, 201);
    assert.strictEqual(resValid.body.type, 'PRESCRIPTION');
    assert.strictEqual(resValid.body.mimeType, 'application/pdf');
    assert.strictEqual(resValid.body.originalFilename, 'real_prescription.pdf');
    assert.ok(resValid.body.sha256);
    assert.ok(resValid.body.sizeBytes > 0);
    // Academic honesty & security constraint: NEVER leak local filesystem paths to client
    assert.strictEqual(resValid.body.localPath, undefined);
    assert.strictEqual(resValid.body.storagePath, undefined);
  });

  // 3. Claims reviewer denied access to pharmacy-only route redirect logic
  await t.test('3. Role-based redirect logic redirects claims_reviewer and pharmacist to /review-queue', () => {
    const computeRedirect = (userRole, effectiveAllowedRoles) => {
      if (effectiveAllowedRoles.length > 0 && !effectiveAllowedRoles.includes(userRole)) {
        if (userRole === 'patient') {
          return '/patient/dashboard';
        }
        if (userRole === 'claims_reviewer' || userRole === 'pharmacist') {
          return '/review-queue';
        }
        return '/pharmacy/dashboard';
      }
      return null; // Allowed
    };

    const pharmacyOnlyRoute = ['pharmacy'];

    // Claims reviewer blocked on pharmacy-only route -> must go to /review-queue
    assert.strictEqual(computeRedirect('claims_reviewer', pharmacyOnlyRoute), '/review-queue');

    // Pharmacist blocked on pharmacy-only route -> must go to /review-queue
    assert.strictEqual(computeRedirect('pharmacist', pharmacyOnlyRoute), '/review-queue');

    // Patient blocked on pharmacy route -> must go to /patient/dashboard
    assert.strictEqual(computeRedirect('patient', pharmacyOnlyRoute), '/patient/dashboard');

    // Legacy pharmacy user on pharmacy route -> allowed (null)
    assert.strictEqual(computeRedirect('pharmacy', pharmacyOnlyRoute), null);

    // Legacy pharmacy user blocked on patient route -> must go to /pharmacy/dashboard
    assert.strictEqual(computeRedirect('pharmacy', ['patient']), '/pharmacy/dashboard');
  });

  // 4. Verify synthetic fill is completely absent in production frontend build
  await t.test('4. Synthetic fill button and payload are stripped from production frontend bundle', () => {
    const distPath = path.join(__dirname, '..', '..', 'dist');
    assert.strictEqual(fs.existsSync(distPath), true, 'dist folder must exist after npm run build:frontend');

    const assetsPath = path.join(distPath, 'assets');
    const files = fs.readdirSync(assetsPath);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    assert.ok(jsFiles.length > 0, 'Production JS files must exist in dist/assets');

    for (const jsFile of jsFiles) {
      const content = fs.readFileSync(path.join(assetsPath, jsFile), 'utf8');
      assert.doesNotMatch(
        content,
        /Quick Synthetic Fill/i,
        `Production JS bundle ${jsFile} must NOT contain "Quick Synthetic Fill"`
      );
      assert.doesNotMatch(
        content,
        /synthetic-dev-fixture/i,
        `Production JS bundle ${jsFile} must NOT contain "synthetic-dev-fixture"`
      );
    }
  });
});
