'use strict';

// Real MongoDB tests for the tamper-evident audit chain. Needs MongoDB on 127.0.0.1:27017.
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_audit_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-audit-chain-000001';
process.env.GEMINI_API_KEY = 'test-only-gemini-key';

const app = require('../app');
const User = require('../models/userModel');
const AuditEvent = require('../models/auditEventModel');
const auditLoggerService = require('../services/trustRag/auditLoggerService');
const { verifyChain, HEAD_COLLECTION } = require('../services/platform/auditChain');
const { assertTestDatabase } = require('../utils/testDatabaseGuard');

const bearer = (user) => `Bearer ${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;

test('Audit chain: linked on write, concurrent-safe, detects edits and deletions', async (t) => {
  let superAdmin, auditor, pharmacist;

  t.before(async () => {
    assertTestDatabase(process.env.MONGO_URI);
    assertTestDatabase(await mongoose.connect(process.env.MONGO_URI));
    await mongoose.connection.dropDatabase();
    await AuditEvent.init();
    const mk = (name, role) => User.create({ name, email: `${name.toLowerCase().replace(/\s/g, '.')}@example.com`, password: 'password-for-tests-only', role });
    superAdmin = await mk('Audit Super', 'super_admin');
    auditor = await mk('Audit Auditor', 'auditor');
    pharmacist = await mk('Audit Pharmacist', 'pharmacist');
  });

  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  const log = (i) => auditLoggerService.logEvent({ actorId: pharmacist._id, actorRole: 'pharmacist', action: 'TEST_EVENT', targetType: 'Case', targetId: `case-${i}`, metadata: { i, nested: { at: new Date() } } });

  await t.test('events written through the logger and AuditEvent.create are chained in order, also in parallel', async () => {
    await log(0);
    await AuditEvent.create({ actorId: pharmacist._id, actorRole: 'pharmacist', action: 'DIRECT_CREATE', targetType: 'Document', targetId: 'd1', metadata: {} });
    await Promise.all(Array.from({ length: 25 }, (_, i) => log(i + 1)));
    const result = await verifyChain(AuditEvent);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.checked, 27);
    assert.equal(result.headSeq, 27);
    const seqs = (await AuditEvent.find().select('chainSeq').lean()).map((e) => e.chainSeq).sort((a, b) => a - b);
    assert.deepEqual(seqs, Array.from({ length: 27 }, (_, i) => i + 1));
  });

  await t.test('model hooks refuse updates', async () => {
    const one = await AuditEvent.findOne({ chainSeq: 3 });
    await assert.rejects(AuditEvent.updateMany({}, { action: 'X' }), /immutable/);
    await assert.rejects(AuditEvent.replaceOne({ _id: one._id }, { action: 'X' }), /immutable/);
  });

  await t.test('verify endpoint: super_admin and auditor only, and it reports intact chains', async () => {
    assert.equal((await request(app).get('/api/v1/audit/chain/verify').set('Authorization', bearer(pharmacist))).status, 403);
    const ok = await request(app).get('/api/v1/audit/chain/verify').set('Authorization', bearer(auditor));
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.ok, true);
    assert.equal((await request(app).get('/api/v1/audit/chain/verify?fromSeq=0').set('Authorization', bearer(superAdmin))).status, 400);
  });

  await t.test('a direct database edit is detected as HASH_MISMATCH', async () => {
    const target = await AuditEvent.findOne({ chainSeq: 5 }).lean();
    await AuditEvent.collection.updateOne({ _id: target._id }, { $set: { 'metadata.i': 999 } });
    const result = await verifyChain(AuditEvent);
    assert.equal(result.ok, false);
    assert.equal(result.problem, 'HASH_MISMATCH');
    assert.equal(result.seq, 5);
    await AuditEvent.collection.updateOne({ _id: target._id }, { $set: { metadata: target.metadata } });
    assert.equal((await verifyChain(AuditEvent)).ok, true, 'restoring the original content restores the chain');
  });

  await t.test('a deleted event (middle or newest) is detected', async () => {
    const middle = await AuditEvent.findOne({ chainSeq: 10 }).lean();
    await AuditEvent.collection.deleteOne({ _id: middle._id });
    let result = await verifyChain(AuditEvent);
    assert.equal(result.ok, false);
    assert.equal(result.problem, 'MISSING_EVENT');
    assert.equal(result.seq, 10);
    await AuditEvent.collection.insertOne(middle);

    const head = await mongoose.connection.db.collection(HEAD_COLLECTION).findOne({});
    const newest = await AuditEvent.findOne({ chainSeq: head.seq }).lean();
    await AuditEvent.collection.deleteOne({ _id: newest._id });
    result = await verifyChain(AuditEvent);
    assert.equal(result.ok, false);
    assert.equal(result.problem, 'MISSING_EVENT');
    await AuditEvent.collection.insertOne(newest);
    assert.equal((await verifyChain(AuditEvent)).ok, true);
  });
});
