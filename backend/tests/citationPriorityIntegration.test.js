'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const mongoose = require('mongoose'), jwt = require('jsonwebtoken'), request = require('supertest');
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_smoke_test';
process.env.JWT_SECRET = 'synthetic-session6-http-only-signing-secret-32-characters';
process.env.GEMINI_API_KEY = 'synthetic-unused';
process.env.RAG_CHAT_LLM_ENABLED = 'true'; process.env.RAG_CHAT_PUBLIC_EXPORT_ALLOWED = 'true';
process.env.TRUSTRAG_LLM_ENABLED = 'true'; process.env.RATE_LIMIT_AI_MAX = '60';
const { assertTestDatabase } = require('../utils/testDatabaseGuard');
assertTestDatabase(process.env.MONGO_URI);
const app = require('../app'), User = require('../models/userModel'), Org = require('../models/organizationModel');
const Case = require('../models/verificationCaseModel'), Doc = require('../models/documentModel'), Field = require('../models/extractedFieldModel');
const Audit = require('../models/auditEventModel');
const { withCaseMutationGuard } = require('../services/trustRag/caseEvidenceMutationService');
const { parseCaseAnswer } = require('../../tests/rag-v2/load-client.cjs').loadClient('src/features/caseAssistant/contract.ts');
const { CITATION_POLICY } = require('../services/trustRag/citationPriorityPolicy');

test('Session 6 real protected HTTP priority, freshness and rate controls', async t => {
  const orgs = [], users = [], cases = []; let vCase, actors, tokens, fields, rxItem;
  let outbound = 0;
  const http = require('node:http'), https = require('node:https');
  const original = { fetch: global.fetch, http: http.request, httpGet: http.get, https: https.request, httpsGet: https.get };
  const deny = () => { outbound++; throw new Error('Outbound network prohibited in synthetic private-case tests.'); };
  t.before(async () => {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2000 }); assertTestDatabase(mongoose.connection);
    const tag = new mongoose.Types.ObjectId().toString();
    for (const label of ['A', 'B']) orgs.push(await Org.create({ name: 'SYNTHETIC S6 ' + label + tag, owner: new mongoose.Types.ObjectId() }));
    actors = {};
    for (const [key, role, organizationId] of [['owner', 'patient', orgs[0]._id], ['reviewer', 'pharmacist', orgs[0]._id], ['foreign', 'pharmacist', orgs[1]._id], ['otherPatient', 'patient', orgs[0]._id]]) {
      actors[key] = await User.create({ name: 'SYNTHETIC ' + key, email: key + '.' + tag + '@example.invalid', password: 'synthetic-only-password', role, organizationId });
      users.push(actors[key]._id);
    }
    tokens = Object.fromEntries(Object.entries(actors).map(([key, user]) => [key, jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '1h' })]));
    vCase = await Case.create({ organizationId: orgs[0]._id, createdBy: actors.owner._id, subjectReference: 'SYNTHETIC S6 HTTP', status: 'NEEDS_REVIEW', reviewRequired: true });
    cases.push(vCase._id); fields = {};
    for (const [type, strength] of [['PRESCRIPTION', '500 mg'], ['PHARMACY_INVOICE', '650 mg']]) {
      const doc = await Doc.create({ caseId: vCase._id, type, objectStorageKey: 'synthetic-unread-fixture-' + type,
        originalFilename: 'SYNTHETIC.png', mimeType: 'image/png', sizeBytes: 100, sha256: (type === 'PRESCRIPTION' ? '1' : '2').repeat(64),
        uploadedBy: actors.owner._id, processingStatus: 'PROCESSED', pageCount: 1, processedPageCount: 1, omittedPageCount: 0,
        pageCoverage: { total: 1, processed: 1, omitted: 0, status: 'COMPLETE' } });
      const values = { medicine_name: 'Paracetamol', dosage_strength: strength, dosage_form: 'tablet', quantity: '10', quantity_unit: 'tablet' };
      fields[type] = await Field.insertMany(Object.entries(values).map(([fieldType, value]) => ({ caseId: vCase._id, documentId: doc._id, fieldType,
        rawValue: value, normalizedValue: value, pageNumber: 1, extractionConfidence: 0.95, needsCorrection: false, candidateRowKey: 'row_1' })));
      vCase.documentIds.push(doc._id);
    }
    await vCase.save();
    const snapshot = await request(app).get('/api/v1/cases/' + vCase._id + '/reconciliation').set('Authorization', 'Bearer ' + tokens.reviewer);
    assert.equal(snapshot.status, 200); rxItem = snapshot.body.prescription.medicineItems[0].itemId;
    // Public-generation flags deliberately remain enabled, but private requests
    // must not call fetch or a non-loopback HTTP/HTTPS endpoint.
    global.fetch = async () => deny();
    http.request = function (...args) {
      const first = args[0];
      const host = first instanceof URL ? first.hostname : typeof first === 'string' ? new URL(first).hostname : first?.hostname || first?.host || '';
      if (host && !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) return deny();
      return original.http.apply(this, args);
    };
    https.request = deny; http.get = deny; https.get = deny;
  });
  t.after(async () => {
    global.fetch = original.fetch; http.request = original.http; http.get = original.httpGet; https.request = original.https; https.get = original.httpsGet;
    if (mongoose.connection.readyState === 1) {
      assertTestDatabase(mongoose.connection);
      const owned = await Case.find({ _id: { $in: cases }, createdBy: actors?.owner?._id, organizationId: orgs[0]?._id }).select('_id');
      const ids = owned.map(c => c._id);
      for (const model of [Doc, Field, Audit]) await model.deleteMany({ caseId: { $in: ids } });
      await Case.deleteMany({ _id: { $in: ids } });
      await User.deleteMany({ _id: { $in: users } }); await Org.deleteMany({ _id: { $in: orgs.map(o => o._id) } });
      await mongoose.disconnect();
    }
  });
  const base = () => '/api/v1/cases/' + vCase._id + '/assistant';
  const ask = (token = tokens.reviewer, body = { message: 'Compare recorded dosage strength across prescription and invoice', medicineItemId: rxItem }) =>
    request(app).post(base() + '/prioritized-answers').set('Authorization', 'Bearer ' + token).send(body);
  let signed;
  await t.test('new route requires authentication and current case/tenant access', async () => {
    const unauthenticated = await request(app).post(base() + '/prioritized-answers').send({ message: 'strength' });
    assert.equal(unauthenticated.status, 401); assert.match(unauthenticated.headers['cache-control'], /private, no-store/);
    for (const token of [tokens.foreign, tokens.otherPatient]) assert.equal((await ask(token)).status, 404);
  });
  await t.test('real new response is decoder-compatible, balanced and preserves genuine mismatch; legacy endpoint is unchanged', async () => {
    const response = await ask(); assert.equal(response.status, 200);
    assert.equal(response.headers['x-pharmavault-citation-policy'], CITATION_POLICY);
    assert.match(response.headers['cache-control'], /private, no-store/);
    assert.ok(parseCaseAnswer(response.body, String(vCase._id), rxItem));
    assert.match(response.body.sources[0].title, /^Prescription dosage strength/);
    assert.match(response.body.sources[1].title, /^Pharmacy Invoice dosage strength/);
    assert.match(response.body.reply, /500 mg/); assert.match(response.body.reply, /650 mg/); assert.match(response.body.reply, /MISMATCH/);
    assert.equal(response.body.sources.length, 10); signed = response.body;
    const old = await request(app).post(base() + '/answers').set('Authorization', 'Bearer ' + tokens.reviewer)
      .send({ message: 'Compare recorded dosage strength across prescription and invoice', medicineItemId: rxItem });
    assert.equal(old.status, 200); assert.match(old.body.sources[0].title, /^Prescription medicine name/);
  });
  await t.test('patients can only read their own evidence, input overrides are rejected, and medicine scope conflicts clarify', async () => {
    assert.equal((await ask(tokens.owner)).status, 200);
    assert.equal((await ask(tokens.reviewer, { message: 'strength', userRole: 'admin' })).status, 400);
    assert.equal((await ask(tokens.reviewer, { message: 'x'.repeat(2001) })).status, 400);
    const snap = await request(app).get('/api/v1/cases/' + vCase._id + '/reconciliation').set('Authorization', 'Bearer ' + tokens.reviewer);
    const conflict = await ask(tokens.reviewer, { message: 'Show recorded prescription strength', medicineItemId: snap.body.invoice.medicineItems[0].itemId });
    assert.equal(conflict.status, 200); assert.equal(conflict.body.mode, 'CLARIFY'); assert.deepEqual(conflict.body.sources, []);
    const correction = await request(app).patch('/api/v1/cases/' + vCase._id + '/extracted-fields/' + fields.PRESCRIPTION[1]._id)
      .set('Authorization', 'Bearer ' + tokens.owner).send({ normalizedValue: '650 mg', snapshotToken: snap.body.snapshotToken });
    assert.equal(correction.status, 403);
  });
  await t.test('prioritized narrow answer retains unrelated-edit freshness and becomes stale after its cited correction', async () => {
    const response = await ask(tokens.reviewer, { message: 'Show recorded prescription strength', medicineItemId: rxItem });
    assert.equal(response.status, 200);
    const receipts = [{ answerId: response.body.answerId, bindingToken: response.body.bindingToken }];
    const fresh = () => request(app).post(base() + '/freshness').set('Authorization', 'Bearer ' + tokens.reviewer).send({ receipts });
    for (const [fieldType, normalizedValue, expected] of [['quantity', '12', 'FRESH'], ['dosage_strength', '650 mg', 'STALE']]) {
      const snapshot = await request(app).get('/api/v1/cases/' + vCase._id + '/reconciliation').set('Authorization', 'Bearer ' + tokens.reviewer);
      const field = fields.PRESCRIPTION.find(f => f.fieldType === fieldType);
      const patch = await request(app).patch('/api/v1/cases/' + vCase._id + '/extracted-fields/' + field._id)
        .set('Authorization', 'Bearer ' + tokens.reviewer).send({ normalizedValue, snapshotToken: snapshot.body.snapshotToken });
      assert.equal(patch.status, 200); const checked = await fresh(); assert.equal(checked.status, 200); assert.equal(checked.body.results[0].status, expected);
    }
    const foreignReceipt = await request(app).post(base() + '/freshness').set('Authorization', 'Bearer ' + tokens.owner).send({ receipts });
    assert.equal(foreignReceipt.status, 200); assert.equal(foreignReceipt.body.results[0].status, 'UNVERIFIABLE');
  });
  await t.test('busy case returns controlled 409 and no private fetch/HTTP/HTTPS egress occurs', async () => {
    let release;
    const task = withCaseMutationGuard(String(vCase._id), () => new Promise(resolve => { release = resolve; }));
    try { const response = await ask(); assert.equal(response.status, 409); assert.equal(response.body.code, 'CASE_BUSY'); }
    finally { release(); await task; }
    assert.equal(outbound, 0);
    const check = await request(app).post(base() + '/freshness').set('Authorization', 'Bearer ' + tokens.reviewer)
      .send({ receipts: [{ answerId: signed.answerId, bindingToken: 'forged' }] });
    assert.equal(check.status, 200); assert.equal(check.body.results[0].status, 'UNVERIFIABLE');
  });
  await t.test('new route has the real AI limiter and eventually returns private no-store 429', async () => {
    let response;
    for (let i = 0; i < 61; i++) { response = await ask(); if (response.status === 429) break; assert.equal(response.status, 200); }
    assert.equal(response.status, 429); assert.match(response.headers['cache-control'], /private, no-store/);
    assert.equal(outbound, 0);
  });
});
