'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildDocumentMedicineItems } = require('../services/trustRag/medicineItemContract');
const {
  QUANTITY_STATUS,
  SUPPORTED_BASE_UNITS,
  INVALID_RECONCILIATION_INPUT,
  normalizeItemQuantity
} = require('../services/trustRag/medicineQuantityService');

const devFixtures = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, './fixtures/reconciliation-v2-development.json'), 'utf8')
);

const clone = value => JSON.parse(JSON.stringify(value));

function buildSyntheticItem(slots = {}, fieldOverrides = {}) {
  const caseId = 'case_qty_dev_01';
  const documentId = 'doc_qty_dev_01';
  const defaultSlots = {
    medicine_name: 'Paracetamol',
    dosage_strength: '500 mg',
    dosage_form: 'tablet',
    quantity: '10',
    quantity_unit: 'tablet',
    ...slots
  };

  const extractedFields = [];
  const fieldIds = [];
  let anchorFieldId = null;

  for (const [fieldType, val] of Object.entries(defaultSlots)) {
    if (val === null || val === undefined) continue;
    const id = `fld_${fieldType}_01`;
    if (fieldType === 'medicine_name') anchorFieldId = id;
    fieldIds.push(id);
    const override = fieldOverrides[fieldType] || {};
    extractedFields.push({
      id,
      caseId,
      documentId,
      fieldType,
      rawValue: String(val),
      normalizedValue: String(override.normalizedValue !== undefined ? override.normalizedValue : val),
      pageNumber: 1,
      extractionConfidence: override.extractionConfidence !== undefined ? override.extractionConfidence : 0.95,
      needsCorrection: override.needsCorrection !== undefined ? override.needsCorrection : false,
      correctedBy: override.correctedBy !== undefined ? override.correctedBy : null,
      correctedAt: override.correctedAt !== undefined ? override.correctedAt : null,
      boundingBox: [0.1, 0.1, 0.2, 0.2],
      extractionMethod: 'OCR'
    });
  }

  const envelope = buildDocumentMedicineItems({
    document: {
      id: documentId,
      caseId,
      type: 'PHARMACY_INVOICE',
      pageCount: 1,
      processedPageCount: 1,
      omittedPageCount: 0,
      pageCoverage: { status: 'COMPLETE', total: 1, processed: 1, omitted: 0 }
    },
    extractedFields,
    groups: [{ anchorFieldId, fieldIds }]
  });

  assert.equal(envelope.medicineItems.length, 1);
  return envelope.medicineItems[0];
}

test('Q01: development fixture quantity unit cases normalize or flag insufficient evidence as specified', () => {
  for (const testCase of devFixtures.quantityUnitCases) {
    const item = buildSyntheticItem({
      quantity: null,
      quantity_unit: null,
      pack_size: null,
      pack_unit: null,
      ...testCase.slots
    });
    const snapshot = clone(item);
    const result = normalizeItemQuantity(item);
    assert.equal(result.status, testCase.expected.status, testCase.id);
    assert.equal(result.baseQuantity, testCase.expected.baseQuantity, testCase.id);
    assert.equal(result.baseUnit, testCase.expected.baseUnit, testCase.id);
    for (const expectedCode of testCase.expected.reasonCodes) {
      assert.ok(result.reasonCodes.includes(expectedCode), `${testCase.id}: missing ${expectedCode}`);
    }
    assert.deepEqual(item, snapshot, `${testCase.id}: mutated input item`);
  }
});

test('Q02: supported direct base unit abbreviations and case variations normalize accurately', () => {
  const cases = [
    ['tablet', '14', SUPPORTED_BASE_UNITS.TABLET, 14],
    ['Tablets', '28', SUPPORTED_BASE_UNITS.TABLET, 28],
    ['TAB', '7', SUPPORTED_BASE_UNITS.TABLET, 7],
    ['tabs', '1', SUPPORTED_BASE_UNITS.TABLET, 1],
    ['capsule', '10', SUPPORTED_BASE_UNITS.CAPSULE, 10],
    ['Capsules', '20', SUPPORTED_BASE_UNITS.CAPSULE, 20],
    ['CAP', '5', SUPPORTED_BASE_UNITS.CAPSULE, 5],
    ['caps', '30', SUPPORTED_BASE_UNITS.CAPSULE, 30],
    ['ml', '100', SUPPORTED_BASE_UNITS.ML, 100],
    ['mL', '12.5', SUPPORTED_BASE_UNITS.ML, 12.5],
    ['ML', '0.5', SUPPORTED_BASE_UNITS.ML, 0.5]
  ];

  for (const [unitLabel, qtyStr, expectedUnit, expectedQty] of cases) {
    const item = buildSyntheticItem({ quantity: qtyStr, quantity_unit: unitLabel });
    const result = normalizeItemQuantity(item);
    assert.equal(result.status, QUANTITY_STATUS.NORMALIZED, `Failed unit ${unitLabel}`);
    assert.equal(result.baseUnit, expectedUnit);
    assert.equal(result.baseQuantity, expectedQty);
    assert.deepEqual(result.reasonCodes, []);
    assert.deepEqual(result.fieldIds, [item.fields.quantity.id, item.fields.quantity_unit.id]);
  }
});

test('Q03: strip and pack container units multiply quantity by explicit pack_size and preserve all 4 fieldIds', () => {
  for (const containerUnit of ['strip', 'strips', 'pack', 'packs', 'STRIP', 'Packs']) {
    const item = buildSyntheticItem({
      quantity: '3',
      quantity_unit: containerUnit,
      pack_size: '15',
      pack_unit: 'capsules'
    });
    const result = normalizeItemQuantity(item);
    assert.equal(result.status, QUANTITY_STATUS.NORMALIZED);
    assert.equal(result.baseQuantity, 45);
    assert.equal(result.baseUnit, SUPPORTED_BASE_UNITS.CAPSULE);
    assert.deepEqual(result.reasonCodes, []);
    assert.deepEqual(result.fieldIds, [
      item.fields.quantity.id,
      item.fields.quantity_unit.id,
      item.fields.pack_size.id,
      item.fields.pack_unit.id
    ]);
  }
});

test('Q04: strip/pack without explicit pack_size or pack_unit never invents a default pack size', () => {
  const missingPackSize = buildSyntheticItem({
    quantity: '2',
    quantity_unit: 'strip',
    pack_size: null,
    pack_unit: 'tablet'
  });
  const res1 = normalizeItemQuantity(missingPackSize);
  assert.equal(res1.status, QUANTITY_STATUS.INSUFFICIENT_EVIDENCE);
  assert.equal(res1.baseQuantity, null);
  assert.equal(res1.baseUnit, null);
  assert.ok(res1.reasonCodes.includes('UNKNOWN_PACK_SIZE'));

  const missingPackUnit = buildSyntheticItem({
    quantity: '2',
    quantity_unit: 'strip',
    pack_size: '10',
    pack_unit: null
  });
  const res2 = normalizeItemQuantity(missingPackUnit);
  assert.equal(res2.status, QUANTITY_STATUS.INSUFFICIENT_EVIDENCE);
  assert.equal(res2.baseQuantity, null);
  assert.equal(res2.baseUnit, null);
  assert.ok(res2.reasonCodes.includes('UNKNOWN_QUANTITY_UNIT'));

  const nestedContainerUnit = buildSyntheticItem({
    quantity: '2',
    quantity_unit: 'pack',
    pack_size: '5',
    pack_unit: 'strip'
  });
  const res3 = normalizeItemQuantity(nestedContainerUnit);
  assert.equal(res3.status, QUANTITY_STATUS.INSUFFICIENT_EVIDENCE);
  assert.ok(res3.reasonCodes.includes('UNKNOWN_QUANTITY_UNIT'));
});

test('Q05: missing quantity refuses dosage-frequency arithmetic from medicine_name', () => {
  const item = buildSyntheticItem({
    medicine_name: 'Paracetamol 500mg 1-0-1 x 5 days',
    quantity: null,
    quantity_unit: 'tablet'
  });
  const result = normalizeItemQuantity(item);
  assert.equal(result.status, QUANTITY_STATUS.INSUFFICIENT_EVIDENCE);
  assert.equal(result.baseQuantity, null);
  assert.equal(result.baseUnit, null);
  assert.ok(result.reasonCodes.includes('MISSING_QUANTITY'));
});

test('Q06: rejects invalid, signed, zero, negative, ranged, hex, scientific, decimal-count, and overflow quantities', () => {
  const invalidDiscreteValues = [
    '0',
    '00',
    '-5',
    '+10',
    '1.5',
    '0.5',
    '10-20',
    '1e2',
    '1E4',
    '0x10',
    'NaN',
    'Infinity',
    '-Infinity',
    '1,000',
    '10 tablets',
    '1000001'
  ];

  for (const badQty of invalidDiscreteValues) {
    const item = buildSyntheticItem({ quantity: badQty, quantity_unit: 'tablet' });
    const result = normalizeItemQuantity(item);
    assert.equal(result.status, QUANTITY_STATUS.INSUFFICIENT_EVIDENCE, `Should reject ${badQty}`);
    assert.equal(result.baseQuantity, null);
    assert.equal(result.baseUnit, null);
    assert.ok(result.reasonCodes.includes('INVALID_QUANTITY'), `Expected INVALID_QUANTITY for ${badQty}`);
  }

  // Product overflow: 500001 strips * 2 tablets = 1,000,002 > 1,000,000
  const overflowPack = buildSyntheticItem({
    quantity: '500001',
    quantity_unit: 'strip',
    pack_size: '2',
    pack_unit: 'tablet'
  });
  const overflowRes = normalizeItemQuantity(overflowPack);
  assert.equal(overflowRes.status, QUANTITY_STATUS.INSUFFICIENT_EVIDENCE);
  assert.equal(overflowRes.baseQuantity, null);
  assert.ok(overflowRes.reasonCodes.includes('INVALID_QUANTITY'));

  // Exact upper bound 1,000,000 is allowed
  const boundaryItem = buildSyntheticItem({ quantity: '1000000', quantity_unit: 'tablet' });
  const boundaryRes = normalizeItemQuantity(boundaryItem);
  assert.equal(boundaryRes.status, QUANTITY_STATUS.NORMALIZED);
  assert.equal(boundaryRes.baseQuantity, 1000000);
});

test('Q07: needsCorrection or unreviewed low confidence on any quantity field yields INSUFFICIENT_EVIDENCE', () => {
  const needsCorrItem = buildSyntheticItem(
    { quantity: '10', quantity_unit: 'tablet' },
    { quantity: { needsCorrection: true } }
  );
  const res1 = normalizeItemQuantity(needsCorrItem);
  assert.equal(res1.status, QUANTITY_STATUS.INSUFFICIENT_EVIDENCE);
  assert.equal(res1.baseQuantity, null);
  assert.ok(res1.reasonCodes.includes('FIELD_NEEDS_CORRECTION'));

  const lowConfUnitItem = buildSyntheticItem(
    { quantity: '10', quantity_unit: 'tablet' },
    { quantity_unit: { extractionConfidence: 0.4, needsCorrection: false } }
  );
  const res2 = normalizeItemQuantity(lowConfUnitItem);
  assert.equal(res2.status, QUANTITY_STATUS.INSUFFICIENT_EVIDENCE);
  assert.ok(res2.reasonCodes.includes('FIELD_NEEDS_CORRECTION'));

  // Complete human correction clears low confidence and uses updated normalizedValue
  const correctedItem = buildSyntheticItem(
    { quantity: '10', quantity_unit: 'tablet' },
    {
      quantity: {
        normalizedValue: '20',
        extractionConfidence: 0.4,
        needsCorrection: false,
        correctedBy: 'staff_reviewer_1',
        correctedAt: '2026-11-12T10:00:00.000Z'
      }
    }
  );
  const res3 = normalizeItemQuantity(correctedItem);
  assert.equal(res3.status, QUANTITY_STATUS.NORMALIZED);
  assert.equal(res3.baseQuantity, 20);
  assert.equal(res3.baseUnit, 'tablet');
});

test('Q08: malformed item or cross-context quantity field throws INVALID_RECONCILIATION_INPUT without echoing secrets', () => {
  for (const badInput of [null, undefined, 'string', 123, [], {}, { fields: null }, { fields: [] }]) {
    assert.throws(
      () => normalizeItemQuantity(badInput),
      err => err.code === INVALID_RECONCILIATION_INPUT
    );
  }

  const item = buildSyntheticItem({ quantity: '10', quantity_unit: 'tablet' });
  item.fields.quantity.caseId = 'secret_foreign_case_999';
  assert.throws(
    () => normalizeItemQuantity(item),
    err =>
      err.code === INVALID_RECONCILIATION_INPUT &&
      !String(err.message).includes('secret_foreign_case_999')
  );
});
