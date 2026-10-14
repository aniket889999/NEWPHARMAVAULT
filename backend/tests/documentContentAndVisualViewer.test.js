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
const storageService = require('../services/trustRag/storageService');
const generateToken = require('../utils/generateToken');

// Valid 1x1 PNG fixture bytes
const validPngBuffer = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89
]);
const validPngBase64 = `data:image/png;base64,${validPngBuffer.toString('base64')}`;

test('Work Order 4B: Secure Visual Evidence Content Endpoint & Evidence Viewer Tests', async (t) => {
  let orgA, orgB;
  let reviewerUserA, reviewerUserB;
  let tokenA, tokenB;
  let caseA, caseB;
  let docA;

  t.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Setup Org A and User A (reviewer in Org A)
    orgA = await Organization.findOne({ name: 'Hospital Org A' });
    if (!orgA) {
      orgA = await Organization.create({
        name: 'Hospital Org A',
        owner: new mongoose.Types.ObjectId(),
        plan: 'Enterprise',
        status: 'active'
      });
    }

    reviewerUserA = await User.findOne({ email: 'reviewer_a@hospital.com' });
    if (!reviewerUserA) {
      reviewerUserA = await User.create({
        name: 'Reviewer A',
        email: 'reviewer_a@hospital.com',
        password: 'password123',
        role: 'claims_reviewer',
        organizationId: orgA._id
      });
    } else {
      reviewerUserA.organizationId = orgA._id;
      await reviewerUserA.save();
    }
    tokenA = generateToken(reviewerUserA._id);

    // Setup Org B and User B (reviewer in Org B)
    orgB = await Organization.findOne({ name: 'Hospital Org B' });
    if (!orgB) {
      orgB = await Organization.create({
        name: 'Hospital Org B',
        owner: new mongoose.Types.ObjectId(),
        plan: 'Enterprise',
        status: 'active'
      });
    }

    reviewerUserB = await User.findOne({ email: 'reviewer_b@hospital.com' });
    if (!reviewerUserB) {
      reviewerUserB = await User.create({
        name: 'Reviewer B',
        email: 'reviewer_b@hospital.com',
        password: 'password123',
        role: 'claims_reviewer',
        organizationId: orgB._id
      });
    } else {
      reviewerUserB.organizationId = orgB._id;
      await reviewerUserB.save();
    }
    tokenB = generateToken(reviewerUserB._id);

    // Create Case in Org A
    caseA = await VerificationCase.create({
      organizationId: orgA._id,
      createdBy: reviewerUserA._id,
      subjectReference: 'patient-case-a',
      status: 'DOCUMENTS_PENDING'
    });

    // Create Case in Org B
    caseB = await VerificationCase.create({
      organizationId: orgB._id,
      createdBy: reviewerUserB._id,
      subjectReference: 'patient-case-b',
      status: 'DOCUMENTS_PENDING'
    });

    // Upload a valid PNG to Case A
    const uploadRes = await request(app)
      .post(`/api/v1/cases/${caseA._id}/documents`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'PRESCRIPTION',
        file: validPngBase64,
        filename: 'rx_evidence_sample.png',
        mimeType: 'image/png'
      });

    assert.strictEqual(uploadRes.status, 201);
    docA = uploadRes.body;
  });

  t.after(async () => {
    if (caseA) await VerificationCase.deleteOne({ _id: caseA._id });
    if (caseB) await VerificationCase.deleteOne({ _id: caseB._id });
    if (docA) await Document.deleteOne({ _id: docA.id || docA._id });
    await mongoose.disconnect();
  });

  await t.test('1. Unauthenticated access returns HTTP 401', async () => {
    const res = await request(app)
      .get(`/api/v1/cases/${caseA._id}/documents/${docA.id || docA._id}/content`);

    assert.strictEqual(res.status, 401);
    assert.ok(res.body.message, '401 should return error message');
  });

  await t.test('2. Authorized same-tenant user receives correct content type, length, and exact stored bytes', async () => {
    const res = await request(app)
      .get(`/api/v1/cases/${caseA._id}/documents/${docA.id || docA._id}/content`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'], 'image/png');
    assert.strictEqual(res.headers['content-disposition'], 'inline');
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['cache-control'], 'private, no-store');
    assert.strictEqual(parseInt(res.headers['content-length'], 10), validPngBuffer.length);

    // Verify buffer payload matches exactly
    const receivedBuffer = Buffer.from(res.body);
    assert.strictEqual(receivedBuffer.length, validPngBuffer.length);
    assert.deepStrictEqual(receivedBuffer, validPngBuffer);
  });

  await t.test('3. Cross-tenant document request returns opaque HTTP 404', async () => {
    // User B from Org B tries to access Case A in Org A
    const res = await request(app)
      .get(`/api/v1/cases/${caseA._id}/documents/${docA.id || docA._id}/content`)
      .set('Authorization', `Bearer ${tokenB}`);

    assert.strictEqual(res.status, 404);
    assert.ok(res.body.message, '404 should return message');
  });

  await t.test('4. Request for document belonging to different case returns HTTP 404', async () => {
    // Case B does not own docA
    const res = await request(app)
      .get(`/api/v1/cases/${caseB._id}/documents/${docA.id || docA._id}/content`)
      .set('Authorization', `Bearer ${tokenB}`);

    assert.strictEqual(res.status, 404);
    assert.ok(res.body.message, '404 should return message');
  });

  await t.test('5. Non-existent document ID returns HTTP 404', async () => {
    const fakeDocId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/v1/cases/${caseA._id}/documents/${fakeDocId}/content`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert.strictEqual(res.status, 404);
    assert.ok(res.body.message, '404 should return message');
  });

  await t.test('6. Response never reveals local filesystem paths or internal storage keys', async () => {
    const res = await request(app)
      .get(`/api/v1/cases/${caseA._id}/documents/${docA.id || docA._id}/content`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Verify headers do not leak storage keys or internal paths
    const headerKeys = Object.keys(res.headers);
    for (const key of headerKeys) {
      const val = String(res.headers[key]);
      assert.strictEqual(val.includes('localPath'), false, `Header ${key} leaked localPath`);
      assert.strictEqual(val.includes('objectStorageKey'), false, `Header ${key} leaked objectStorageKey`);
      assert.strictEqual(val.includes(storageService.storageRoot), false, `Header ${key} leaked storage root`);
    }

    // Check 404 error responses don't leak paths either
    const errRes = await request(app)
      .get(`/api/v1/cases/${caseA._id}/documents/nonexistent-id/content`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert.strictEqual(errRes.status, 404);
    const bodyStr = JSON.stringify(errRes.body);
    assert.strictEqual(bodyStr.includes('localPath'), false);
    assert.strictEqual(bodyStr.includes('storageRoot'), false);
    assert.strictEqual(bodyStr.includes('objectStorageKey'), false);
  });

  await t.test('7. Document content rate limiter is attached to route', async () => {
    const res = await request(app)
      .get(`/api/v1/cases/${caseA._id}/documents/${docA.id || docA._id}/content`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert.strictEqual(res.status, 200);
    // express-rate-limit sets ratelimit headers or standard limit info
    assert.ok(
      res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit'] !== undefined,
      'Rate limit header should be present'
    );
  });

  await t.test('8. Frontend verificationApi fetches document content as an authenticated Blob', () => {
    const apiFile = fs.readFileSync(
      path.resolve(__dirname, '../../src/modules/verification/api/verificationApi.ts'),
      'utf8'
    );
    assert.ok(
      apiFile.includes("getDocumentContent(caseId: string, documentId: string): Promise<Blob>"),
      'verificationApi must expose getDocumentContent returning a Blob'
    );
    assert.ok(
      apiFile.includes("responseType: 'blob'"),
      'verificationApi must use Axios responseType: blob'
    );
  });

  await t.test('9. Frontend DocumentEvidenceViewer manages Object URL lifecycle (creates & revokes)', () => {
    const viewerFile = fs.readFileSync(
      path.resolve(__dirname, '../../src/modules/verification/components/DocumentEvidenceViewer.tsx'),
      'utf8'
    );
    assert.ok(
      viewerFile.includes('URL.createObjectURL(blob)'),
      'DocumentEvidenceViewer must call URL.createObjectURL'
    );
    assert.ok(
      viewerFile.includes('URL.revokeObjectURL'),
      'DocumentEvidenceViewer must call URL.revokeObjectURL to prevent memory leaks'
    );
  });

  await t.test('10. Frontend DocumentEvidenceViewer never renders false highlight on missing or [0,0,0,0] coordinates', () => {
    const viewerFile = fs.readFileSync(
      path.resolve(__dirname, '../../src/modules/verification/components/DocumentEvidenceViewer.tsx'),
      'utf8'
    );
    assert.ok(
      viewerFile.includes('hasValidBoundingBox'),
      'DocumentEvidenceViewer must guard bounding box rendering with hasValidBoundingBox'
    );
    assert.ok(
      viewerFile.includes('Source location unavailable'),
      'DocumentEvidenceViewer must display "Source location unavailable" when bbox is invalid or [0,0,0,0]'
    );
  });

  await t.test('11. Frontend PDF handling is honest (no bounding boxes, displays planned notice)', () => {
    const viewerFile = fs.readFileSync(
      path.resolve(__dirname, '../../src/modules/verification/components/DocumentEvidenceViewer.tsx'),
      'utf8'
    );
    assert.ok(
      viewerFile.includes('PDF stored securely. Page rendering and PDF OCR are planned.'),
      'DocumentEvidenceViewer must display honest PDF placeholder message'
    );
  });

  await t.test('12. POST /cases/:caseId/documents response never includes objectStorageKey or localPath', async () => {
    const uploadRes = await request(app)
      .post(`/api/v1/cases/${caseA._id}/documents`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'CLAIM_FORM',
        file: validPngBase64,
        filename: 'claim_sanitize_check.png',
        mimeType: 'image/png'
      });

    assert.strictEqual(uploadRes.status, 201);
    assert.strictEqual(uploadRes.body.objectStorageKey, undefined, 'POST response must not expose objectStorageKey');
    assert.strictEqual(uploadRes.body.localPath, undefined, 'POST response must not expose localPath');
    assert.strictEqual(uploadRes.body.storageRoot, undefined, 'POST response must not expose storageRoot');
    const bodyStr = JSON.stringify(uploadRes.body);
    assert.strictEqual(bodyStr.includes('objectStorageKey'), false);
    assert.strictEqual(bodyStr.includes(storageService.storageRoot), false);
  });

  await t.test('13. GET /cases/:caseId/documents response never includes objectStorageKey or localPath', async () => {
    const listRes = await request(app)
      .get(`/api/v1/cases/${caseA._id}/documents`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body));
    assert.ok(listRes.body.length > 0);

    for (const doc of listRes.body) {
      assert.strictEqual(doc.objectStorageKey, undefined, 'GET list item must not expose objectStorageKey');
      assert.strictEqual(doc.localPath, undefined, 'GET list item must not expose localPath');
      assert.strictEqual(doc.storageRoot, undefined, 'GET list item must not expose storageRoot');
    }

    const bodyStr = JSON.stringify(listRes.body);
    assert.strictEqual(bodyStr.includes('objectStorageKey'), false);
    assert.strictEqual(bodyStr.includes(storageService.storageRoot), false);
  });

  await t.test('14. Case results and evidence endpoints never expose objectStorageKey or internal paths', async () => {
    const resultsRes = await request(app)
      .get(`/api/v1/cases/${caseA._id}/results`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert.strictEqual(resultsRes.status, 200);
    const resultsBodyStr = JSON.stringify(resultsRes.body);
    assert.strictEqual(resultsBodyStr.includes('objectStorageKey'), false);
    assert.strictEqual(resultsBodyStr.includes(storageService.storageRoot), false);

    const evidenceRes = await request(app)
      .get(`/api/v1/cases/${caseA._id}/evidence`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert.strictEqual(evidenceRes.status, 200);
    const evidenceBodyStr = JSON.stringify(evidenceRes.body);
    assert.strictEqual(evidenceBodyStr.includes('objectStorageKey'), false);
    assert.strictEqual(evidenceBodyStr.includes(storageService.storageRoot), false);
  });

  await t.test('15. Deliberately missing stored file returns safe 404 without storage key, filename, or storage root', async () => {
    // Create a document record pointing to a non-existent storage key
    const missingFileDoc = await Document.create({
      caseId: caseA._id,
      type: 'PHARMACY_INVOICE',
      objectStorageKey: `cases/${caseA._id}/non_existent_file_${Date.now()}.png`,
      originalFilename: 'missing_sample_invoice.png',
      mimeType: 'image/png',
      sizeBytes: 1234,
      sha256: 'fakehash123',
      uploadStatus: 'COMPLETED',
      processingStatus: 'PENDING',
      uploadedBy: reviewerUserA._id
    });

    const res = await request(app)
      .get(`/api/v1/cases/${caseA._id}/documents/${missingFileDoc._id}/content`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.message, 'Document content is unavailable.');

    // Ensure error payload does NOT expose key, filename, or server path
    const bodyStr = JSON.stringify(res.body);
    assert.strictEqual(bodyStr.includes('non_existent_file_'), false, 'Response leaked filename');
    assert.strictEqual(bodyStr.includes('objectStorageKey'), false, 'Response leaked objectStorageKey');
    assert.strictEqual(bodyStr.includes(storageService.storageRoot), false, 'Response leaked storageRoot');
    if (res.body.stack) {
      assert.strictEqual(res.body.stack.includes('non_existent_file_'), false, 'Error stack leaked filename');
    }

    // Clean up
    await Document.deleteOne({ _id: missingFileDoc._id });
  });
});
