'use strict';

// Database-free tests: document encryption at rest, migration script and retention rules.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const documentCrypto = require('../services/platform/documentCrypto');
const { migrate } = require('../scripts/encryptStoredDocuments');
const retention = require('../services/platform/retentionService');

const KEY = documentCrypto.keyFrom('test-only-document-key-0123456789abcdef');
const PDF = Buffer.from('%PDF-1.7 synthetic test document');

test('document envelope: round trip, random IV, tamper and wrong key rejected', () => {
  const a = documentCrypto.encrypt(PDF, KEY);
  const b = documentCrypto.encrypt(PDF, KEY);
  assert.ok(documentCrypto.isEncrypted(a));
  assert.notDeepEqual(a, b, 'fresh IV per file');
  assert.equal(a.includes(Buffer.from('synthetic')), false, 'no plaintext on disk');
  assert.deepEqual(documentCrypto.decrypt(a, KEY), PDF);

  const tampered = Buffer.from(a);
  tampered[tampered.length - 1] ^= 0x01;
  assert.throws(() => documentCrypto.decrypt(tampered, KEY), { code: 'DOCUMENT_INTEGRITY_FAILED' });
  assert.throws(() => documentCrypto.decrypt(a, documentCrypto.keyFrom('another-test-key-0123456789abcdefghij')), { code: 'DOCUMENT_INTEGRITY_FAILED' });
  assert.throws(() => documentCrypto.decrypt(a, null), { statusCode: 503 });
});

test('legacy plaintext files stay readable; short keys are refused', () => {
  assert.equal(documentCrypto.decrypt(PDF, KEY), PDF);
  assert.equal(documentCrypto.decrypt(PDF, null), PDF);
  assert.equal(documentCrypto.keyFrom('too-short'), null);
  assert.equal(documentCrypto.configuredKey({ DOCUMENT_ENCRYPTION_KEY: '' }), null);
});

test('storage service encrypts on write and decrypts on read when a key is set', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-store-'));
  const previous = { root: process.env.DOCUMENT_STORAGE_ROOT, key: process.env.DOCUMENT_ENCRYPTION_KEY };
  process.env.DOCUMENT_STORAGE_ROOT = root;
  process.env.DOCUMENT_ENCRYPTION_KEY = 'test-only-document-key-0123456789abcdef';
  try {
    delete require.cache[require.resolve('../services/trustRag/storageService')];
    const storage = require('../services/trustRag/storageService');
    const caseId = '65a0000000000000000000aa';
    const stored = await storage.storeDocument({ caseId, filename: 'rx.pdf', content: `data:application/pdf;base64,${PDF.toString('base64')}` });
    assert.equal(stored.sha256, require('node:crypto').createHash('sha256').update(PDF).digest('hex'), 'hash is of the plaintext');
    assert.ok(documentCrypto.isEncrypted(fs.readFileSync(stored.localPath)), 'ciphertext on disk');
    assert.deepEqual(await storage.getDocumentBuffer(caseId, stored.objectStorageKey), PDF);
  } finally {
    if (previous.root === undefined) delete process.env.DOCUMENT_STORAGE_ROOT; else process.env.DOCUMENT_STORAGE_ROOT = previous.root;
    if (previous.key === undefined) delete process.env.DOCUMENT_ENCRYPTION_KEY; else process.env.DOCUMENT_ENCRYPTION_KEY = previous.key;
    delete require.cache[require.resolve('../services/trustRag/storageService')];
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('migration: dry run changes nothing, apply encrypts once and is idempotent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-migrate-'));
  try {
    const dir = path.join(root, '65a0000000000000000000bb', 'previews', 'doc1');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(root, '65a0000000000000000000bb', 'a.pdf'), PDF);
    fs.writeFileSync(path.join(dir, 'page_1.png'), Buffer.from('PNG-preview'));

    assert.deepEqual(migrate({ root, key: KEY, apply: false }), { scanned: 2, alreadyEncrypted: 0, encrypted: 0, wouldEncrypt: 2, failed: 0 });
    assert.deepEqual(fs.readFileSync(path.join(root, '65a0000000000000000000bb', 'a.pdf')), PDF);

    assert.equal(migrate({ root, key: KEY, apply: true }).encrypted, 2);
    const sealed = fs.readFileSync(path.join(root, '65a0000000000000000000bb', 'a.pdf'));
    assert.deepEqual(documentCrypto.decrypt(sealed, KEY), PDF);
    assert.equal(migrate({ root, key: KEY, apply: true }).alreadyEncrypted, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('retention eligibility: finished, old, not purged, no open or recent claims', () => {
  const now = Date.parse('2026-11-18T00:00:00Z');
  const { caseCutoff } = retention.cutoffs({ caseDays: 365, notificationDays: 180 }, now);
  const old = '2025-06-01T00:00:00Z';
  const recent = '2026-10-01T00:00:00Z';
  const base = { status: 'VERIFIED', updatedAt: old, purgedAt: null };

  assert.equal(retention.isCaseEligible(base, [], caseCutoff), true);
  assert.equal(retention.isCaseEligible({ ...base, status: 'NEEDS_REVIEW' }, [], caseCutoff), false);
  assert.equal(retention.isCaseEligible({ ...base, updatedAt: recent }, [], caseCutoff), false);
  assert.equal(retention.isCaseEligible({ ...base, purgedAt: old }, [], caseCutoff), false);
  assert.equal(retention.isCaseEligible(base, [{ status: 'QUERY_RAISED', updatedAt: old }], caseCutoff), false);
  assert.equal(retention.isCaseEligible(base, [{ status: 'APPROVED', updatedAt: old }], caseCutoff), false, 'approved but unsettled');
  assert.equal(retention.isCaseEligible(base, [{ status: 'SETTLED', updatedAt: recent }], caseCutoff), false, 'recent claim activity');
  assert.equal(retention.isCaseEligible(base, [{ status: 'SETTLED', updatedAt: old }, { status: 'WITHDRAWN', updatedAt: old }], caseCutoff), true);
});

test('retention policy has safe minimums and file removal stays inside the storage root', () => {
  assert.deepEqual(retention.readPolicy({}), { caseDays: 365, notificationDays: 180, batchSize: 200 });
  assert.throws(() => retention.readPolicy({ RETENTION_CASE_DAYS: '7' }), /at least 30/);
  assert.throws(() => retention.readPolicy({ RETENTION_NOTIFICATION_DAYS: 'abc' }), /integer/);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-ret-'));
  try {
    const caseDir = path.join(root, '65a0000000000000000000cc');
    fs.mkdirSync(caseDir);
    fs.writeFileSync(path.join(caseDir, 'x.pdf'), PDF);
    assert.equal(retention.removeCaseFiles(root, '../../etc'), false, 'traversal refused');
    assert.equal(retention.removeCaseFiles(root, '65a0000000000000000000cc'), true);
    assert.equal(fs.existsSync(caseDir), false);
    assert.equal(retention.removeCaseFiles(root, '65a0000000000000000000cc'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
