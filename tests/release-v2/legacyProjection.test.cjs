'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('node:path'), { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const service = backend('./services/trustRag/consistencyCheckService.js');
const { loadScenarios } = require('../foundation-v2/fixtures.cjs');
const { buildDocumentMedicineItems } = backend('./services/trustRag/medicineItemContract.js');
const { reconcileMedicineDocuments } = backend('./services/trustRag/medicineReconciliationService.js');
function example(change = () => {}) {
  const f = loadScenarios('development')[0]; change(f);
  const bundles = f.documents.filter(d => ['PRESCRIPTION', 'PHARMACY_INVOICE'].includes(d.type)).map(d => buildDocumentMedicineItems({ document: d, extractedFields: d.extractedFields, groups: d.groups }));
  return reconcileMedicineDocuments({ caseId: f.caseId, prescription: bundles[0], invoice: bundles[1] });
}
test('legacy projection reads the actual frozen reconciler dimensions', () => {
  const result = example(); assert.equal(result.status, 'CONSISTENT');
  for (const dimensions of [['identity'], ['strength'], ['form', 'release'], ['quantity']]) assert.equal(service._comparisonStatus(result, dimensions), 'PASS');
});
test('an actual explicit-unit quantity discrepancy becomes FAIL, not a false PASS', () => {
  const result = example(f => { const field = f.documents.find(d => d.type === 'PHARMACY_INVOICE').extractedFields.find(x => x.fieldType === 'quantity'); field.normalizedValue = '20'; field.rawValue = '20'; });
  assert.equal(result.rows[0].checks.quantity, 'MISMATCH');
  assert.equal(service._comparisonStatus(result, ['quantity']), 'FAIL');
});
test('unitless quantities remain inconclusive rather than inferring a clinical dispensing limit', () => {
  const result = example(f => { for (const doc of f.documents.filter(d => d.type !== 'CLAIM_FORM')) {
    const removed = doc.extractedFields.filter(x => x.fieldType === 'quantity_unit').map(x => x.id);
    doc.extractedFields = doc.extractedFields.filter(x => !removed.includes(x.id));
    doc.groups.forEach(g => { g.fieldIds = g.fieldIds.filter(id => !removed.includes(id)); });
  } });
  assert.equal(result.rows[0].checks.quantity, 'INSUFFICIENT_EVIDENCE');
  assert.equal(service._comparisonStatus(result, ['quantity']), 'INCONCLUSIVE');
});
test('unknown, missing and legacy-shaped dimension payloads never default to PASS', () => {
  for (const result of [null, { rows: [] }, { rows: [{ prescriptionItemId: 'a', invoiceItemId: 'b', issueCodes: [] }] },
    { rows: [{ prescriptionItemId: 'a', invoiceItemId: 'b', checks: { strength: 'NOT_APPLICABLE' } }] }]) {
    assert.equal(service._comparisonStatus(result, ['strength']), 'INCONCLUSIVE');
  }
});
test('confirmed dimensions fail on a mismatch even when another row is unresolved', () => {
  assert.equal(service._comparisonStatus({ rows: [
    { prescriptionItemId: 'a', invoiceItemId: 'b', checks: { strength: 'MISMATCH' } },
    { prescriptionItemId: 'c', invoiceItemId: null, checks: { strength: 'INSUFFICIENT_EVIDENCE' } },
  ] }, ['strength']), 'FAIL');
});
test('explicit missing invoice item is a name mismatch while unsupported identity stays inconclusive', () => {
  assert.equal(service._comparisonStatus({ rows: [{ prescriptionItemId: 'a', invoiceItemId: null, reasonCodes: ['MISSING_INVOICE_ITEM'], checks: { identity: 'INSUFFICIENT_EVIDENCE' } }] }, ['identity']), 'FAIL');
  assert.equal(service._comparisonStatus({ rows: [{ prescriptionItemId: 'a', invoiceItemId: null, reasonCodes: ['UNKNOWN_MEDICINE'], checks: { identity: 'INSUFFICIENT_EVIDENCE' } }] }, ['identity']), 'INCONCLUSIVE');
});
test('form/release uncertainty and confirmed mismatch cannot be reported as aligned', () => {
  const row = { prescriptionItemId: 'a', invoiceItemId: 'b', checks: { form: 'CONSISTENT', release: 'INSUFFICIENT_EVIDENCE' } };
  assert.equal(service._comparisonStatus({ rows: [row] }, ['form', 'release']), 'INCONCLUSIVE');
  row.checks.release = 'MISMATCH'; assert.equal(service._comparisonStatus({ rows: [row] }, ['form', 'release']), 'FAIL');
});

test('real isolated DB/HTTP legacy result projections and cache revision', async t => {
  process.env.NODE_ENV = 'test';
  process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_integration_v2_test';
  process.env.JWT_SECRET = 'synthetic-legacy-projection-test-only-secret';
  process.env.GEMINI_API_KEY = 'synthetic-unused';
  process.env.TRUSTRAG_LLM_ENABLED = 'false'; process.env.TRUSTRAG_LLM_EXPORT_ALLOWED = 'false';
  const mongoose = backend('mongoose'), request = backend('supertest'), jwt = backend('jsonwebtoken');
  const { assertTestDatabase } = backend('./utils/testDatabaseGuard.js');
  const Case = backend('./models/verificationCaseModel.js'), User = backend('./models/userModel.js'), Org = backend('./models/organizationModel.js');
  const Doc = backend('./models/documentModel.js'), Field = backend('./models/extractedFieldModel.js');
  const Evidence = backend('./models/evidenceItemModel.js'), Check = backend('./models/consistencyCheckModel.js'), Risk = backend('./models/riskSignalModel.js');
  const riskService = backend('./services/trustRag/riskSignalService.js'), app = backend('./app.js');
  const { bumpCaseEvidenceRevision } = backend('./services/trustRag/caseEvidenceMutationService.js');
  const cases = []; let org, user, token, connected = false;
  t.after(async () => {
    if (!connected) return; assertTestDatabase(mongoose.connection);
    for (const M of [Doc, Field, Evidence, Check, Risk]) await M.deleteMany({ caseId: { $in: cases } });
    await Case.deleteMany({ _id: { $in: cases } });
    if (user) await User.deleteOne({ _id: user._id }); if (org) await Org.deleteOne({ _id: org._id }); await mongoose.disconnect();
  });
  assertTestDatabase(process.env.MONGO_URI); await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2000 }); connected = true; assertTestDatabase(mongoose.connection);
  const uid = new mongoose.Types.ObjectId();
  org = await Org.create({ name: 'SYNTHETIC projection regression', owner: uid, plan: 'Enterprise', status: 'active' });
  user = await User.create({ _id: uid, name: 'SYNTHETIC reviewer', email: 'projection-' + uid + '@example.invalid', password: 'synthetic-only-pass', role: 'pharmacist', organizationId: org._id });
  token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '5m' });
  async function seed({ quantity = '10', unitless = false } = {}) {
    const c = await Case.create({ organizationId: org._id, createdBy: user._id, status: 'NEEDS_REVIEW', reviewRequired: true }); cases.push(c._id);
    const f = loadScenarios('development')[0], documents = [], fields = [], envelopes = [];
    for (const original of f.documents.filter(d => d.type !== 'CLAIM_FORM')) {
      const doc = await Doc.create({ caseId: c._id, type: original.type, originalFilename: 'SYNTHETIC.pdf', objectStorageKey: 'synthetic-only-unread', mimeType: 'application/pdf', processingStatus: 'PROCESSED', pageCount: 1, processedPageCount: 1, omittedPageCount: 0, pageCoverage: { total: 1, processed: 1, omitted: 0, status: 'COMPLETE' }, uploadedBy: user._id });
      const rows = await Field.insertMany(original.extractedFields.filter(x => !unitless || x.fieldType !== 'quantity_unit').map(x => {
        const value = original.type === 'PHARMACY_INVOICE' && x.fieldType === 'quantity' ? quantity : x.normalizedValue;
        return { caseId: c._id, documentId: doc._id, fieldType: x.fieldType, rawValue: value, normalizedValue: value, pageNumber: 1, extractionConfidence: 0.95, needsCorrection: false };
      }));
      const groups = [{ anchorFieldId: String(rows.find(x => x.fieldType === 'medicine_name')._id), fieldIds: rows.map(x => String(x._id)) }];
      doc.metadata = { proposedMedicineGrouping: { groups } }; await doc.save();
      envelopes.push(buildDocumentMedicineItems({ document: doc, extractedFields: rows, groups })); documents.push(doc); fields.push(...rows);
    }
    for (const doc of documents) {
      const date = doc.type === 'PRESCRIPTION' ? ['prescription_date', '2026-11-01'] : ['invoice_date', '2026-11-02'];
      const extra = [{ fieldType: date[0], rawValue: date[1], normalizedValue: date[1] }];
      if (doc.type === 'PHARMACY_INVOICE') extra.push({ fieldType: 'total_amount', rawValue: '100', normalizedValue: '100' });
      fields.push(...await Field.insertMany(extra.map(field => ({ ...field, caseId: c._id, documentId: doc._id, pageNumber: 1, extractionConfidence: 0.95, needsCorrection: false }))));
    }
    const comparison = reconcileMedicineDocuments({ caseId: String(c._id), prescription: envelopes[0], invoice: envelopes[1] });
    const snapshot = { prescription: envelopes[0], invoice: envelopes[1], comparison };
    const checks = await service.runChecks({ caseId: c._id, documents, fields, reconciliationSnapshot: snapshot });
    const signals = await riskService.evaluateRiskSignals({ caseId: c._id, documents, fields, checks, reconciliationSnapshot: snapshot });
    return { c, documents, fields, checks, signals };
  }
  await t.test('stored checks/risk flags agree with explicit-unit frozen quantity output', async () => {
    const result = await seed({ quantity: '20' });
    assert.equal(result.checks.find(x => x.checkType === 'QUANTITY_CONSISTENCY').status, 'FAIL');
    assert.ok(result.signals.some(x => x.signalType === 'QUANTITY_MISMATCH'));
    const ids = new Set((await Evidence.find({ caseId: result.c._id })).map(e => String(e._id)));
    assert.ok(result.signals.every(s => s.evidenceItemIds.every(id => ids.has(String(id)))));
  });
  await t.test('unitless quantities are stored as inconclusive with insufficient evidence, not a proven mismatch', async () => {
    const result = await seed({ quantity: '20', unitless: true });
    assert.equal(result.checks.find(x => x.checkType === 'QUANTITY_CONSISTENCY').status, 'INCONCLUSIVE');
    assert.ok(!result.signals.some(x => x.signalType === 'QUANTITY_MISMATCH'));
    assert.ok(result.signals.some(x => x.signalType === 'INSUFFICIENT_EVIDENCE'));
  });
  await t.test('a complete consistent medicine pair does not require an optional claim form', async () => {
    const result = await seed();
    assert.ok(!result.signals.some(x => x.signalType === 'INSUFFICIENT_EVIDENCE'));
    assert.ok(result.checks.every(x => x.status === 'PASS'));
  });
  await t.test('GET results uses the actual processed revision marker and rejects that cache after mutation', async () => {
    const { c } = await seed(); bumpCaseEvidenceRevision(c, { markLegacyFindingsProcessed: true });
    c.metadata.explanation = { summary: 'SYNTHETIC_CACHE_MARKER — uninspected pages omitted; human review required.', findings: [] }; c.markModified('metadata'); await c.save();
    const read = () => request(app).get('/api/v1/cases/' + c._id + '/results').set('Authorization', 'Bearer ' + token);
    const current = await read().expect(200); assert.match(current.body.explanation.summary, /SYNTHETIC_CACHE_MARKER/);
    bumpCaseEvidenceRevision(c); await c.save();
    const changed = await read().expect(200); assert.doesNotMatch(changed.body.explanation.summary, /SYNTHETIC_CACHE_MARKER/); assert.equal(changed.body.explanation.legacyFindingsStale, true);
  });
});
