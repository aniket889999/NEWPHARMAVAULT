'use strict';

// Run after Gemini's Session 2 handoff. No held-out fixtures, network, database or clinical scoring.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const Ajv2020 = createRequire(require.resolve('ajv-cli/package.json'))('ajv/dist/2020');
const { buildDocumentMedicineItems } = require('../../backend/services/trustRag/medicineItemContract.js');
const { loadScenarios } = require('../foundation-v2/fixtures.cjs');
const { reconcileMedicineDocuments } = require('../../backend/services/trustRag/medicineReconciliationService.js');
const { normalizeItemQuantity } = require('../../backend/services/trustRag/medicineQuantityService.js');

const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../contracts/schemas/medicine-reconciliation.schema.json'), 'utf8'));
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
const scenarios = loadScenarios('development');
const clone = value => JSON.parse(JSON.stringify(value));
const makeEnvelope = doc => doc ? buildDocumentMedicineItems({ document: doc, extractedFields: doc.extractedFields, groups: doc.groups }) : null;
function input(id = 'F02-01') {
  const scenario = scenarios.find(value => value.id === id);
  if (!scenario) throw new Error('Unknown development test case.');
  return { caseId: scenario.caseId, prescription: makeEnvelope(scenario.documents[0]), invoice: makeEnvelope(scenario.documents[1]) };
}
const text = field => field?.normalizedValue || field?.rawValue || '';
const allItems = request => [...(request.prescription?.medicineItems || []), ...(request.invoice?.medicineItems || [])];

function run(request) {
  const before = clone(request); const output = reconcileMedicineDocuments(request);
  assert.equal(output && typeof output.then, 'undefined', 'The pure matcher should return synchronously, not perform I/O.');
  assert.equal(validate(output), true, JSON.stringify(validate.errors)); assert.deepEqual(request, before);
  assert.equal(output.caseId, request.caseId); assert.equal(output.humanDecisionRequired, true);
  assert.equal(output.documentIds.prescription, request.prescription?.documentId || null);
  assert.equal(output.documentIds.invoice, request.invoice?.documentId || null);
  assert.equal(output.coverage.prescription, request.prescription?.coverage.status || 'MISSING');
  assert.equal(output.coverage.invoice, request.invoice?.coverage.status || 'MISSING');
  const rx = new Map((request.prescription?.medicineItems || []).map(item => [item.itemId, item]));
  const inv = new Map((request.invoice?.medicineItems || []).map(item => [item.itemId, item]));
  const seenRx = new Set(), seenInv = new Set(), seenRows = new Set();
  for (const row of output.rows) {
    assert.equal(seenRows.has(row.rowId), false); seenRows.add(row.rowId);
    const sources = [];
    if (row.prescriptionItemId) { assert.ok(rx.has(row.prescriptionItemId)); assert.equal(seenRx.has(row.prescriptionItemId), false); seenRx.add(row.prescriptionItemId); sources.push(rx.get(row.prescriptionItemId)); }
    if (row.invoiceItemId) { assert.ok(inv.has(row.invoiceItemId)); assert.equal(seenInv.has(row.invoiceItemId), false); seenInv.add(row.invoiceItemId); sources.push(inv.get(row.invoiceItemId)); }
    for (const ref of row.evidenceReferences) assert.ok(sources.some(item => item.documentId === ref.documentId && Object.values(item.fields).some(field => field && field.id === ref.fieldId && field.pageNumber === ref.pageNumber)), 'Evidence must belong to this row, not merely the same case.');
    for (const reason of row.reasonCodes) assert.ok(output.reasonCodes.includes(reason));
  }
  assert.equal(seenRx.size, rx.size, 'An observed prescribed item was dropped.');
  assert.equal(seenInv.size, inv.size, 'An observed invoice item was dropped.');
  const count = status => output.rows.filter(row => row.status === status).length;
  assert.equal(output.summary.consistent, count('CONSISTENT')); assert.equal(output.summary.mismatch, count('MISMATCH')); assert.equal(output.summary.insufficientEvidence, count('INSUFFICIENT_EVIDENCE'));
  if (output.status !== 'CONSISTENT' || output.hasInsufficientEvidence) assert.equal(output.reviewRequired, true);
  if (count('MISMATCH')) assert.equal(output.status, 'MISMATCH');
  assert.doesNotMatch(JSON.stringify(output), /objectStorageKey|localPath|storageRoot|storagePath/);
  return output;
}

for (const scenario of scenarios) test(`development reconciliation expectation: ${scenario.id} (${scenario.effect})`, () => {
  const result = run(input(scenario.id));
  assert.equal(result.status, scenario.gold.overall);
  for (const reason of scenario.gold.reasons) {
    const contractReason = { CONTRADICTORY_COVERAGE: 'CONTRADICTORY_PAGE_COVERAGE', UNKNOWN_COVERAGE: 'UNKNOWN_PAGE_COVERAGE' }[reason] || reason;
    assert.ok(result.reasonCodes.includes(contractReason), `Expected declared reason ${reason}.`);
  }
});

test('reordering item arrays preserves assigned identities and stable row IDs', () => {
  const original = input(); const reordered = clone(original);
  reordered.prescription.medicineItems.reverse(); reordered.invoice.medicineItems.reverse();
  const tuples = result => result.rows.map(row => [row.prescriptionItemId, row.invoiceItemId, row.rowId].join('|')).sort();
  assert.deepEqual(tuples(run(original)), tuples(run(reordered)));
});

test('genuine strength mismatch cites both actual strength fields', () => {
  const request = input('F01-02'); const result = run(request);
  const row = result.rows.find(value => value.reasonCodes.includes('STRENGTH_MISMATCH')); assert.ok(row);
  for (const source of allItems(request)) assert.ok(row.evidenceReferences.some(ref => ref.fieldId === source.fields.dosage_strength.id));
});

test('uncertainty does not erase a confirmed difference on another checked field', () => {
  const request = input('F01-02'); const field = request.invoice.medicineItems[0].fields.quantity;
  field.needsCorrection = true; request.invoice.medicineItems[0].needsCorrection = true; request.invoice.reviewRequired = true;
  const result = run(request); assert.equal(result.status, 'MISMATCH'); assert.equal(result.hasInsufficientEvidence, true);
  assert.ok(result.reasonCodes.includes('STRENGTH_MISMATCH')); assert.ok(result.reasonCodes.includes('FIELD_NEEDS_CORRECTION'));
});

test('incomplete coverage cannot turn an unobserved invoice item into a confirmed missing item', () => {
  const request = input('F02-03');
  request.invoice.coverage = { status: 'INCOMPLETE', isComplete: false, total: 2, processed: 1, omitted: 1, reportedStatus: 'INCOMPLETE' }; request.invoice.reviewRequired = true;
  const result = run(request); assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(result.reasonCodes.includes('MISSING_INVOICE_ITEM'), false);
});

test('an absent invoice is insufficient evidence, not a proven missing billed medicine', () => {
  const request = input(); request.invoice = null;
  const result = run(request); assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  assert.ok(result.reasonCodes.includes('MISSING_DOCUMENT')); assert.equal(result.reasonCodes.includes('MISSING_INVOICE_ITEM'), false);
});

test('missing both documents produces an honest empty insufficient result', () => {
  const request = { caseId: 'synthetic_empty_case', prescription: null, invoice: null };
  const result = run(request); assert.equal(result.status, 'INSUFFICIENT_EVIDENCE'); assert.equal(result.rows.length, 0);
});

test('duplicate candidate identities remain unpaired instead of using quantity/order to break ties', () => {
  const request = input();
  for (const item of allItems(request)) {
    item.fields.medicine_name.rawValue = item.fields.medicine_name.normalizedValue = 'Metformin';
    item.fields.dosage_strength.rawValue = item.fields.dosage_strength.normalizedValue = '500 mg';
  }
  const result = run(request); assert.equal(result.status, 'INSUFFICIENT_EVIDENCE'); assert.ok(result.reasonCodes.includes('AMBIGUOUS_MATCH'));
  assert.ok(result.rows.every(row => !row.prescriptionItemId || !row.invoiceItemId));
});

test('same-generic distinct strengths use mutually unique attributes rather than first-match pairing', () => {
  const request = input();
  for (const item of allItems(request)) item.fields.medicine_name.rawValue = item.fields.medicine_name.normalizedValue = 'Metformin';
  request.prescription.medicineItems[1].fields.dosage_strength.rawValue = request.prescription.medicineItems[1].fields.dosage_strength.normalizedValue = '850 mg';
  request.invoice.medicineItems[1].fields.dosage_strength.rawValue = request.invoice.medicineItems[1].fields.dosage_strength.normalizedValue = '850 mg';
  request.invoice.medicineItems.reverse();
  const result = run(request); assert.equal(result.status, 'CONSISTENT');
  for (const row of result.rows) {
    const rx = request.prescription.medicineItems.find(item => item.itemId === row.prescriptionItemId);
    const inv = request.invoice.medicineItems.find(item => item.itemId === row.invoiceItemId);
    assert.equal(text(rx.fields.dosage_strength), text(inv.fields.dosage_strength));
  }
});

test('fresh identity is not taken from an obsolete cached resolution', () => {
  const request = input('F01-01');
  for (const item of allItems(request)) {
    item.fields.medicine_name.rawValue = item.fields.medicine_name.normalizedValue = 'TEST-UNKNOWN-CURRENT';
    item.fields.medicine_name.resolution = { resolved: true, canonical: { genericName: 'Paracetamol' } };
  }
  const result = run(request); assert.equal(result.status, 'INSUFFICIENT_EVIDENCE'); assert.ok(result.reasonCodes.includes('UNKNOWN_MEDICINE'));
});

test('an exact alias must not hide contradiction with its own extracted strength', () => {
  const request = input('F01-01');
  request.invoice.medicineItems[0].fields.medicine_name.rawValue = request.invoice.medicineItems[0].fields.medicine_name.normalizedValue = 'Dolo 650';
  const result = run(request); assert.equal(result.status, 'INSUFFICIENT_EVIDENCE'); assert.ok(result.reasonCodes.includes('IDENTITY_ATTRIBUTE_CONFLICT'));
});

for (const property of ['caseId', 'documentId']) test(`rejects forged ${property} on a linked field without echoing foreign content`, () => {
  const request = input(); request.invoice.medicineItems[0].fields.quantity[property] = 'foreign_context_secret';
  assert.throws(() => reconcileMedicineDocuments(request), error => error.code === 'INVALID_RECONCILIATION_INPUT' && !String(error.message).includes('foreign_context_secret'));
});

test('rejects a cross-case envelope rather than returning an authorised-looking empty result', () => {
  const request = input(); request.invoice.caseId = 'foreign_case_secret';
  assert.throws(() => reconcileMedicineDocuments(request), error => error.code === 'INVALID_RECONCILIATION_INPUT' && !String(error.message).includes('foreign_case_secret'));
});

function quantityItem() { return clone(input('F03-01').invoice.medicineItems[0]); }
function set(item, slot, value) { item.fields[slot].rawValue = item.fields[slot].normalizedValue = value; }

test('quantity helper uses explicit pack count and returns the relevant provenance', () => {
  const item = quantityItem(); const before = clone(item); const result = normalizeItemQuantity(item);
  assert.equal(result.status, 'NORMALIZED'); assert.equal(result.baseQuantity, 12); assert.equal(result.baseUnit, 'tablet');
  for (const slot of ['quantity', 'quantity_unit', 'pack_size', 'pack_unit']) assert.ok(result.fieldIds.includes(item.fields[slot].id));
  assert.deepEqual(item, before);
});

test('unknown pack count is never replaced with a default ten', () => {
  const item = quantityItem(); item.fields.pack_size = null;
  const result = normalizeItemQuantity(item); assert.equal(result.status, 'INSUFFICIENT_EVIDENCE'); assert.equal(result.baseQuantity, null); assert.ok(result.reasonCodes.includes('UNKNOWN_PACK_SIZE'));
});

for (const raw of ['0', '-1', '+2', '1e3', '0x10', 'NaN', 'Infinity', '1-2', '1000001', '1.5']) test(`invalid discrete pack quantity stays unresolved: ${raw}`, () => {
  const item = quantityItem(); set(item, 'quantity', raw);
  const result = normalizeItemQuantity(item); assert.equal(result.status, 'INSUFFICIENT_EVIDENCE'); assert.equal(result.baseQuantity, null);
});

test('quantity multiplication cannot overflow the declared supported bound', () => {
  const item = quantityItem(); set(item, 'quantity', '1000000');
  const result = normalizeItemQuantity(item); assert.equal(result.status, 'INSUFFICIENT_EVIDENCE'); assert.equal(result.baseQuantity, null);
});

test('quantity helper refuses dosage-schedule inference when an explicit quantity is absent', () => {
  const item = quantityItem(); item.fields.quantity = null;
  item.fields.medicine_name.rawValue = item.fields.medicine_name.normalizedValue = 'Paracetamol 1-0-1 for five days';
  const result = normalizeItemQuantity(item); assert.equal(result.status, 'INSUFFICIENT_EVIDENCE'); assert.equal(result.baseQuantity, null); assert.ok(result.reasonCodes.includes('MISSING_QUANTITY'));
});

test('a correction-required pack count cannot yield a trustworthy normalised quantity', () => {
  const item = quantityItem(); item.fields.pack_size.needsCorrection = true; item.needsCorrection = true;
  const result = normalizeItemQuantity(item); assert.equal(result.status, 'INSUFFICIENT_EVIDENCE'); assert.equal(result.baseQuantity, null);
});

function markNameUncertain(request, side) {
  const source = request[side]; const item = source.medicineItems[0];
  const name = item.fields.medicine_name;
  name.extractionConfidence = 0.3; name.needsCorrection = true; name.correctedBy = null; name.correctedAt = null;
  item.needsCorrection = true; source.reviewRequired = true;
}

test('an uncertain invoice medicine name cannot prove which prescribed item is missing', () => {
  const request = input('F02-03'); markNameUncertain(request, 'invoice');
  const result = run(request);
  assert.ok(result.reasonCodes.includes('FIELD_NEEDS_CORRECTION'));
  assert.equal(result.reasonCodes.includes('MISSING_INVOICE_ITEM'), false,
    'The invoice name still needs correction, so its provisional family cannot establish that the other prescription medicine is absent.');
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
});

test('an uncertain prescription medicine name cannot prove which billed item is extra', () => {
  const request = input('F02-04'); markNameUncertain(request, 'prescription');
  const result = run(request);
  assert.ok(result.reasonCodes.includes('FIELD_NEEDS_CORRECTION'));
  assert.equal(result.reasonCodes.includes('EXTRA_INVOICE_ITEM'), false,
    'The uncertain prescription name may belong to another observed invoice item; do not label a particular medicine definitely extra.');
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
});

test('an uncertain invoice name does not suppress an independently supported sibling strength difference', () => {
  const request = input('F02-01'); markNameUncertain(request, 'invoice');
  const reliableRx = request.prescription.medicineItems[1];
  const reliableInvoice = request.invoice.medicineItems[1];
  reliableInvoice.fields.dosage_strength.rawValue = reliableInvoice.fields.dosage_strength.normalizedValue = '20 mg';
  const result = run(request);
  assert.equal(result.status, 'MISMATCH'); assert.equal(result.hasInsufficientEvidence, true);
  assert.ok(result.reasonCodes.includes('FIELD_NEEDS_CORRECTION'));
  const supported = result.rows.find(row => row.prescriptionItemId === reliableRx.itemId && row.invoiceItemId === reliableInvoice.itemId);
  assert.ok(supported); assert.equal(supported.checks.identity, 'CONSISTENT');
  assert.equal(supported.checks.strength, 'MISMATCH'); assert.ok(supported.reasonCodes.includes('STRENGTH_MISMATCH'));
  for (const source of [reliableRx, reliableInvoice]) assert.ok(supported.evidenceReferences.some(ref => ref.fieldId === source.fields.dosage_strength.id));
});

test('all 24 actual development engine results satisfy the independent UI reference/context guard', () => {
  const esbuild = require('esbuild'); const Module = require('node:module');
  const built = esbuild.buildSync({ entryPoints: [path.resolve(__dirname, '../../src/modules/verification/reconciliation/comparisonViewModel.ts')],
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const loaded = new Module(path.join(__dirname, 'in-memory-bridge.cjs'), module);
  loaded.filename = path.join(__dirname, 'in-memory-bridge.cjs'); loaded.paths = module.paths;
  loaded._compile(built.outputFiles[0].text, loaded.filename);
  for (const scenario of scenarios) {
    const request = input(scenario.id); const result = run(request);
    const view = loaded.exports.createComparisonView({ expectedCaseId: request.caseId, prescription: request.prescription, invoice: request.invoice, result });
    assert.equal(view.state, 'ready', `${scenario.id}: actual engine output cannot be safely consumed.`);
  }
});
