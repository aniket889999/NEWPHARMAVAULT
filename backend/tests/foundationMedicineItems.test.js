const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('../../node_modules/ajv-cli/node_modules/ajv/dist/2020');
const addFormats = require('ajv-formats');

const {
  SCHEMA_VERSION,
  MAX_MEDICINE_ITEMS,
  GROUPING_STATUS,
  COVERAGE_STATUS,
  ISSUE_CODES,
  deriveMedicineItemId,
  buildDocumentMedicineItems
} = require('../services/trustRag/medicineItemContract');

const schemaPath = path.resolve(__dirname, '../../contracts/schemas/medicine-item.schema.json');
const medicineItemSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const fixturesPath = path.resolve(__dirname, './fixtures/foundation-v2-development.json');
const devFixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateEnvelope = ajv.compile(medicineItemSchema);

function assertValidSchema(envelope, contextLabel = 'envelope') {
  const valid = validateEnvelope(envelope);
  assert.equal(
    valid,
    true,
    `Expected ${contextLabel} to satisfy medicine-item.schema.json, but got errors: ${JSON.stringify(
      validateEnvelope.errors
    )}`
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }
  return value;
}

function resolveScenarioInput(family, variant) {
  let baseVariant = variant;
  if (variant.baseScenarioId) {
    baseVariant = family.variants.find(v => v.scenarioId === variant.baseScenarioId);
    assert.ok(baseVariant, `Missing baseScenarioId ${variant.baseScenarioId}`);
  }

  const document = JSON.parse(JSON.stringify(variant.document || baseVariant.document));
  let extractedFields = JSON.parse(JSON.stringify(variant.extractedFields || baseVariant.extractedFields));
  if (Array.isArray(variant.fieldOverrides)) {
    extractedFields = extractedFields.map(field => {
      const override = variant.fieldOverrides.find(o => o.id === field.id);
      return override ? { ...field, ...override } : field;
    });
  }
  const groups =
    variant.groups !== undefined
      ? JSON.parse(JSON.stringify(variant.groups))
      : baseVariant.groups !== undefined
      ? JSON.parse(JSON.stringify(baseVariant.groups))
      : undefined;

  return { document, extractedFields, groups };
}

test('development fixture manifest has 6 families and 24 development scenarios only', () => {
  assert.equal(devFixtures.split, 'DEVELOPMENT_ONLY');
  assert.equal(devFixtures.families.length, 6);
  const totalVariants = devFixtures.families.reduce((acc, fam) => acc + fam.variants.length, 0);
  assert.equal(totalVariants, 24);
});

for (const family of devFixtures.families) {
  for (const variant of family.variants) {
    test(`development fixture [${family.familyId} :: ${variant.scenarioId}] matches expected contract and JSON Schema`, () => {
      const input = resolveScenarioInput(family, variant);
      const snapshotBefore = JSON.stringify(input);
      deepFreeze(input);

      const envelope = buildDocumentMedicineItems(input);
      assertValidSchema(envelope, `${family.familyId}::${variant.scenarioId}`);

      assert.equal(JSON.stringify(input), snapshotBefore, 'Input objects must not be mutated');
      assert.equal(envelope.schemaVersion, SCHEMA_VERSION);
      assert.equal(envelope.maxAllowedItems, MAX_MEDICINE_ITEMS);
      assert.equal(envelope.groupingStatus, variant.expected.groupingStatus);
      assert.equal(envelope.detectedGroupCount, variant.expected.detectedGroupCount);
      assert.equal(envelope.medicineItems.length, variant.expected.itemCount);
      assert.equal(envelope.coverage.status, variant.expected.coverageStatus);
      assert.equal(envelope.reviewRequired, variant.expected.reviewRequired);
      assert.deepEqual(envelope.issueCodes, variant.expected.issueCodes);

      const serialized = JSON.stringify(envelope);
      assert.equal(serialized.includes('objectStorageKey'), false);
      assert.equal(serialized.includes('localPath'), false);
      assert.equal(serialized.includes('storageRoot'), false);
      assert.equal(serialized.includes('must-never-leak-to-dto'), false);
    });
  }
}

test('legacy one-item compatibility links all four medicine slots, preserves provenance, and strips storage keys', () => {
  const family1 = devFixtures.families.find(f => f.familyId === 'dev_family_1_legacy_single_item');
  const v1 = family1.variants.find(v => v.scenarioId === 'v1_prescription_complete');
  const { document, extractedFields } = resolveScenarioInput(family1, v1);

  const result = buildDocumentMedicineItems({ document, extractedFields });
  assertValidSchema(result);

  assert.equal(result.groupingStatus, GROUPING_STATUS.LEGACY_SINGLE_ITEM);
  assert.equal(result.medicineItems.length, 1);

  const item = result.medicineItems[0];
  assert.equal(item.caseId, '661000000000000000000001');
  assert.equal(item.documentId, '661000000000000000000101');
  assert.equal(item.documentType, 'PRESCRIPTION');
  assert.equal(item.groupingMode, 'LEGACY_SINGLE_ITEM');
  assert.equal(item.anchorFieldId, '661000000000000000001001');
  assert.deepEqual(item.fieldIds, [
    '661000000000000000001001',
    '661000000000000000001002',
    '661000000000000000001003',
    '661000000000000000001004'
  ]);
  assert.deepEqual(item.pageNumbers, [1]);
  assert.equal(item.needsCorrection, false);

  assert.equal(item.fields.medicine_name.rawValue, 'Tab. Dolo 650');
  assert.equal(item.fields.medicine_name.normalizedValue, 'Paracetamol');
  assert.equal(item.fields.medicine_name.extractionConfidence, 0.94);
  assert.deepEqual(item.fields.medicine_name.boundingBox, [42, 110, 280, 138]);
  assert.equal(item.fields.medicine_name.resolution.canonical.genericName, 'Paracetamol');

  assert.equal(item.fields.dosage_strength.rawValue, '650 mg');
  assert.equal(item.fields.dosage_form.rawValue, 'Tablet');
  assert.equal(item.fields.quantity.rawValue, 'Qty: 10');
});

test('three explicit groups keep identical itemIds across group reordering, field reordering, value correction, and spoofed group IDs', () => {
  const family2 = devFixtures.families.find(f => f.familyId === 'dev_family_2_explicit_three_groups');
  const v1 = resolveScenarioInput(family2, family2.variants[0]);
  const v2 = resolveScenarioInput(family2, family2.variants[1]);
  const v3 = resolveScenarioInput(family2, family2.variants[2]);
  const v4 = resolveScenarioInput(family2, family2.variants[3]);

  // Also reverse extractedFields order in v2 to verify field-array position independence
  v2.extractedFields.reverse();

  const resCanonical = buildDocumentMedicineItems(v1);
  const resReordered = buildDocumentMedicineItems(v2);
  const resCorrected = buildDocumentMedicineItems(v3);
  const resSpoofed = buildDocumentMedicineItems(v4);

  assertValidSchema(resCanonical);
  assertValidSchema(resReordered);
  assertValidSchema(resCorrected);
  assertValidSchema(resSpoofed);

  const byAnchor = res =>
    Object.fromEntries(res.medicineItems.map(item => [item.anchorFieldId, item]));

  const mapCanonical = byAnchor(resCanonical);
  const mapReordered = byAnchor(resReordered);
  const mapCorrected = byAnchor(resCorrected);
  const mapSpoofed = byAnchor(resSpoofed);

  for (const anchorId of [
    '661000000000000000002001',
    '661000000000000000002011',
    '661000000000000000002021'
  ]) {
    const expectedId = deriveMedicineItemId({
      caseId: '661000000000000000000002',
      documentId: '661000000000000000000201',
      anchorFieldId: anchorId
    });
    assert.equal(mapCanonical[anchorId].itemId, expectedId);
    assert.equal(mapReordered[anchorId].itemId, expectedId);
    assert.equal(mapCorrected[anchorId].itemId, expectedId);
    assert.equal(mapSpoofed[anchorId].itemId, expectedId);
    assert.deepEqual(mapCanonical[anchorId].fieldIds, mapReordered[anchorId].fieldIds);
  }

  // Verify corrected values and audit markers are preserved on v3 without changing itemId
  const correctedItem1 = mapCorrected['661000000000000000002001'];
  assert.equal(correctedItem1.fields.medicine_name.normalizedValue, 'Paracetamol 650mg');
  assert.equal(correctedItem1.fields.medicine_name.correctedBy, '661000000000000000000099');
  assert.equal(correctedItem1.fields.medicine_name.correctedAt, '2026-11-09T12:00:00.000Z');
  assert.equal(correctedItem1.fields.dosage_strength.normalizedValue, '650mg');
});

test('omitted slots stay null without dosage inference, and modified-release formulation text is preserved verbatim', () => {
  const family1 = devFixtures.families.find(f => f.familyId === 'dev_family_1_legacy_single_item');
  const v2 = resolveScenarioInput(family1, family1.variants[1]);
  const resInvoice = buildDocumentMedicineItems(v2);

  assertValidSchema(resInvoice);
  const invoiceItem = resInvoice.medicineItems[0];
  assert.equal(invoiceItem.fields.medicine_name.rawValue, 'Dolo 650 1-0-1 x 5 days');
  assert.equal(invoiceItem.fields.dosage_strength, null, 'Must not infer 650mg from medicine_name text');
  assert.equal(invoiceItem.fields.dosage_form, null, 'Must not infer dosage form');
  assert.equal(invoiceItem.fields.quantity, null, 'Must not infer quantity 10 from 1-0-1 x 5 days');

  const family2 = devFixtures.families.find(f => f.familyId === 'dev_family_2_explicit_three_groups');
  const v1 = resolveScenarioInput(family2, family2.variants[0]);
  const resGrouped = buildDocumentMedicineItems(v1);

  const srItem = resGrouped.medicineItems.find(i => i.anchorFieldId === '661000000000000000002011');
  assert.equal(srItem.fields.dosage_form.rawValue, 'Sustained Release Tablet (SR)');
  assert.equal(srItem.fields.dosage_form.normalizedValue, 'Sustained Release Tablet (SR)');

  const ecItem = resGrouped.medicineItems.find(i => i.anchorFieldId === '661000000000000000002021');
  assert.equal(ecItem.fields.dosage_form.rawValue, 'Enteric Coated Capsule');
  assert.equal(ecItem.fields.quantity, null);
  assert.deepEqual(ecItem.pageNumbers, [2]);
});

test('flat multi-medicine strings (comma, semicolon, newline, numbered list, multi-form) remain UNRESOLVED', () => {
  const baseDoc = {
    id: '661000000000000000000701',
    caseId: '661000000000000000000007',
    type: 'PRESCRIPTION',
    pageCount: 1,
    processedPageCount: 1,
    omittedPageCount: 0,
    pageCoverage: { total: 1, processed: 1, omitted: 0, status: 'COMPLETE' }
  };

  const multiMedicineStrings = [
    'Paracetamol 500mg, Azithromycin 250mg',
    'Dolo 650; Pan 40',
    'Tab Dolo 650\nTab Cetirizine 10mg',
    '1. Dolo 650 2. Okacet 10mg',
    'Tab Dolo 650 + Cap Omez 20',
    'Paracetamol 500mg and Cetirizine 10mg',
    'Paracetamol 500mg and Ibuprofen 200mg'
  ];

  for (const rawValue of multiMedicineStrings) {
    const res = buildDocumentMedicineItems({
      document: baseDoc,
      extractedFields: [
        {
          id: '661000000000000000007001',
          caseId: baseDoc.caseId,
          documentId: baseDoc.id,
          fieldType: 'medicine_name',
          rawValue,
          normalizedValue: rawValue,
          pageNumber: 1,
          extractionConfidence: 0.91,
          needsCorrection: false
        }
      ]
    });

    assertValidSchema(res);
    assert.equal(res.groupingStatus, GROUPING_STATUS.UNRESOLVED, `Expected UNRESOLVED for "${rawValue}"`);
    assert.equal(res.medicineItems.length, 0);
    assert.ok(res.issueCodes.includes(ISSUE_CODES.FLAT_MULTI_MEDICINE_VALUE));
  }
});

test('invalid group structures, non-medicine anchors, and non-medicine member slots fail safely as UNRESOLVED', () => {
  const doc = {
    id: '661000000000000000000801',
    caseId: '661000000000000000000008',
    type: 'PRESCRIPTION',
    pageCount: 1,
    processedPageCount: 1,
    omittedPageCount: 0,
    pageCoverage: { total: 1, processed: 1, omitted: 0, status: 'COMPLETE' }
  };
  const fields = [
    {
      id: '661000000000000000008001',
      caseId: doc.caseId,
      documentId: doc.id,
      fieldType: 'medicine_name',
      rawValue: 'Dolo 650',
      normalizedValue: 'Paracetamol',
      pageNumber: 1,
      extractionConfidence: 0.95,
      needsCorrection: false
    },
    {
      id: '661000000000000000008002',
      caseId: doc.caseId,
      documentId: doc.id,
      fieldType: 'dosage_strength',
      rawValue: '650mg',
      normalizedValue: '650mg',
      pageNumber: 1,
      extractionConfidence: 0.94,
      needsCorrection: false
    },
    {
      id: '661000000000000000008003',
      caseId: doc.caseId,
      documentId: doc.id,
      fieldType: 'prescription_date',
      rawValue: '2026-11-01',
      normalizedValue: '2026-11-01',
      pageNumber: 1,
      extractionConfidence: 0.96,
      needsCorrection: false
    }
  ];

  // 1. Empty groups array
  const emptyGroupsRes = buildDocumentMedicineItems({ document: doc, extractedFields: fields, groups: [] });
  assertValidSchema(emptyGroupsRes);
  assert.equal(emptyGroupsRes.groupingStatus, GROUPING_STATUS.UNRESOLVED);
  assert.ok(emptyGroupsRes.issueCodes.includes(ISSUE_CODES.EMPTY_GROUPS));

  // 2. Non-array groups
  const badGroupsRes = buildDocumentMedicineItems({ document: doc, extractedFields: fields, groups: { bad: true } });
  assertValidSchema(badGroupsRes);
  assert.equal(badGroupsRes.groupingStatus, GROUPING_STATUS.UNRESOLVED);
  assert.ok(badGroupsRes.issueCodes.includes(ISSUE_CODES.INVALID_GROUP_STRUCTURE));

  // 3. Anchor is dosage_strength instead of medicine_name, and prescription_date included in group
  const wrongAnchorRes = buildDocumentMedicineItems({
    document: doc,
    extractedFields: fields,
    groups: [
      {
        anchorFieldId: '661000000000000000008002',
        fieldIds: ['661000000000000000008002', '661000000000000000008003']
      }
    ]
  });
  assertValidSchema(wrongAnchorRes);
  assert.equal(wrongAnchorRes.groupingStatus, GROUPING_STATUS.UNRESOLVED);
  assert.ok(wrongAnchorRes.issueCodes.includes(ISSUE_CODES.INVALID_GROUP_ANCHOR));
  assert.ok(wrongAnchorRes.issueCodes.includes(ISSUE_CODES.INVALID_GROUP_MEMBERSHIP));
});

test('Mongoose-like document wrapper with _doc does not mask unknown pageCoverage via toObject defaults', () => {
  const mongooseLikeDoc = {
    _doc: {
      _id: '661000000000000000000901',
      caseId: '661000000000000000000009',
      type: 'PRESCRIPTION',
      pageCount: 2,
      objectStorageKey: 'cases/secret.pdf'
    },
    toObject() {
      throw new Error('Adapter must not call document.toObject()');
    }
  };

  const fields = [
    {
      _doc: {
        _id: '661000000000000000009001',
        caseId: '661000000000000000000009',
        documentId: '661000000000000000000901',
        fieldType: 'medicine_name',
        rawValue: 'Losar 50',
        normalizedValue: 'Losartan',
        pageNumber: 1,
        extractionConfidence: 0.92,
        needsCorrection: false
      }
    }
  ];

  const res = buildDocumentMedicineItems({ document: mongooseLikeDoc, extractedFields: fields });
  assertValidSchema(res);
  assert.equal(res.coverage.status, COVERAGE_STATUS.UNKNOWN);
  assert.equal(res.coverage.isComplete, false);
  assert.ok(res.issueCodes.includes(ISSUE_CODES.UNKNOWN_PAGE_COVERAGE));
});

test('mutating returned DTO arrays/objects does not mutate input extractedFields or document', () => {
  const family1 = devFixtures.families.find(f => f.familyId === 'dev_family_1_legacy_single_item');
  const { document, extractedFields } = resolveScenarioInput(family1, family1.variants[0]);

  const res = buildDocumentMedicineItems({ document, extractedFields });
  res.medicineItems[0].fields.medicine_name.boundingBox[0] = 9999;
  res.medicineItems[0].fieldIds.push('mutated_id');
  res.issueCodes.push('MUTATED');

  assert.deepEqual(extractedFields[0].boundingBox, [42, 110, 280, 138]);
});

test('JSON Schema actively rejects invalid or tampered adapter outputs', () => {
  const family1 = devFixtures.families.find(f => f.familyId === 'dev_family_1_legacy_single_item');
  const { document, extractedFields } = resolveScenarioInput(family1, family1.variants[0]);
  const validEnvelope = buildDocumentMedicineItems({ document, extractedFields });
  assertValidSchema(validEnvelope);

  // 1. Leaked storage identifier on envelope
  const withStorageKey = { ...validEnvelope, objectStorageKey: 'cases/leak.pdf' };
  assert.equal(validateEnvelope(withStorageKey), false, 'Schema must reject leaked objectStorageKey');

  // 2. CLAIM_FORM with a medicine item
  const claimWithItem = {
    ...validEnvelope,
    documentType: 'CLAIM_FORM',
    groupingStatus: 'NOT_APPLICABLE',
    medicineItems: [validEnvelope.medicineItems[0]]
  };
  assert.equal(validateEnvelope(claimWithItem), false, 'Schema must reject CLAIM_FORM with medicineItems');

  // 3. UNRESOLVED status with a non-empty medicineItems array
  const unresolvedWithItem = {
    ...validEnvelope,
    groupingStatus: 'UNRESOLVED',
    medicineItems: [validEnvelope.medicineItems[0]]
  };
  assert.equal(validateEnvelope(unresolvedWithItem), false, 'Schema must reject UNRESOLVED with medicineItems');

  // 4. More than 3 medicine items in GROUPED status
  const item = validEnvelope.medicineItems[0];
  const fourItemsEnvelope = {
    ...validEnvelope,
    groupingStatus: 'GROUPED',
    detectedGroupCount: 4,
    medicineItems: [
      item,
      { ...item, itemId: 'mi_111111111111111111111111' },
      { ...item, itemId: 'mi_222222222222222222222222' },
      { ...item, itemId: 'mi_333333333333333333333333' }
    ]
  };
  assert.equal(validateEnvelope(fourItemsEnvelope), false, 'Schema must reject > 3 medicineItems');

  // 5. Incomplete coverage claiming isComplete: true
  const contradictoryCoverageEnvelope = {
    ...validEnvelope,
    coverage: {
      status: 'INCOMPLETE',
      isComplete: true,
      total: 4,
      processed: 3,
      omitted: 1,
      reportedStatus: 'INCOMPLETE'
    }
  };
  assert.equal(
    validateEnvelope(contradictoryCoverageEnvelope),
    false,
    'Schema must reject INCOMPLETE coverage with isComplete: true'
  );

  // 6. UNRESOLVED grouping status with reviewRequired: false
  const unresolvedCleared = {
    ...validEnvelope,
    groupingStatus: 'UNRESOLVED',
    medicineItems: [],
    reviewRequired: false
  };
  assert.equal(
    validateEnvelope(unresolvedCleared),
    false,
    'Schema must reject UNRESOLVED envelope with reviewRequired: false'
  );

  // 7. Non-complete coverage with reviewRequired: false
  const incompleteCoverageCleared = {
    ...validEnvelope,
    reviewRequired: false,
    coverage: {
      status: 'INCOMPLETE',
      isComplete: false,
      total: 4,
      processed: 3,
      omitted: 1,
      reportedStatus: 'INCOMPLETE'
    }
  };
  assert.equal(
    validateEnvelope(incompleteCoverageCleared),
    false,
    'Schema must reject non-complete coverage with reviewRequired: false'
  );

  // 8. Item needing correction with reviewRequired: false
  const itemNeedsCorrectionCleared = {
    ...validEnvelope,
    reviewRequired: false,
    medicineItems: [
      {
        ...item,
        needsCorrection: true
      }
    ]
  };
  assert.equal(
    validateEnvelope(itemNeedsCorrectionCleared),
    false,
    'Schema must reject item.needsCorrection=true when envelope reviewRequired=false'
  );

  // 9. Missing essential slot (dosage_strength: null) with reviewRequired: false
  const missingEssentialCleared = {
    ...validEnvelope,
    reviewRequired: false,
    medicineItems: [
      {
        ...item,
        fields: {
          ...item.fields,
          dosage_strength: null
        }
      }
    ]
  };
  assert.equal(
    validateEnvelope(missingEssentialCleared),
    false,
    'Schema must reject missing essential slot when envelope reviewRequired=false'
  );
});

test('explicit and legacy modes preserve release_type, quantity_unit, pack_size, and pack_unit, and reject unclaimed attributes', () => {
  const doc = {
    id: '661000000000000000000951',
    caseId: '661000000000000000000095',
    type: 'PHARMACY_INVOICE',
    pageCount: 1,
    processedPageCount: 1,
    omittedPageCount: 0,
    pageCoverage: { total: 1, processed: 1, omitted: 0, status: 'COMPLETE' }
  };

  const makeField = (idSuffix, fieldType, rawValue, normalizedValue = rawValue) => ({
    id: `6610000000000000000095${idSuffix}`,
    caseId: doc.caseId,
    documentId: doc.id,
    fieldType,
    rawValue,
    normalizedValue,
    pageNumber: 1,
    extractionConfidence: 0.94,
    needsCorrection: false
  });

  const fields = [
    makeField('01', 'medicine_name', 'Glycomet 500 SR', 'Metformin'),
    makeField('02', 'dosage_strength', '500 mg', '500mg'),
    makeField('03', 'dosage_form', 'Tablet', 'Tablet'),
    makeField('04', 'release_type', 'SR', 'SR'),
    makeField('05', 'quantity', '2', '2'),
    makeField('06', 'quantity_unit', 'strips', 'strip'),
    makeField('07', 'pack_size', '10', '10'),
    makeField('08', 'pack_unit', 'tablets', 'tablet')
  ];

  // 1. Explicit group with all 8 slots
  const groupedRes = buildDocumentMedicineItems({
    document: doc,
    extractedFields: fields,
    groups: [
      {
        anchorFieldId: fields[0].id,
        fieldIds: fields.map(f => f.id)
      }
    ]
  });
  assertValidSchema(groupedRes);
  assert.equal(groupedRes.groupingStatus, GROUPING_STATUS.GROUPED);
  assert.equal(groupedRes.reviewRequired, false);
  const groupedItem = groupedRes.medicineItems[0];
  assert.equal(groupedItem.fieldIds.length, 8);
  assert.equal(groupedItem.fields.release_type.rawValue, 'SR');
  assert.equal(groupedItem.fields.quantity_unit.normalizedValue, 'strip');
  assert.equal(groupedItem.fields.pack_size.normalizedValue, '10');
  assert.equal(groupedItem.fields.pack_unit.normalizedValue, 'tablet');

  // 2. Legacy single-item mode with all 8 slots
  const legacyRes = buildDocumentMedicineItems({
    document: doc,
    extractedFields: fields
  });
  assertValidSchema(legacyRes);
  assert.equal(legacyRes.groupingStatus, GROUPING_STATUS.LEGACY_SINGLE_ITEM);
  assert.equal(legacyRes.reviewRequired, false);
  assert.equal(legacyRes.medicineItems[0].fields.release_type.rawValue, 'SR');
  assert.equal(legacyRes.medicineItems[0].fields.pack_size.normalizedValue, '10');

  // 3. Ungrouped release_type in explicit mode is refused as UNGROUPED_MEDICINE_FIELD
  const ungroupedReleaseRes = buildDocumentMedicineItems({
    document: doc,
    extractedFields: fields,
    groups: [
      {
        anchorFieldId: fields[0].id,
        fieldIds: fields.filter(f => f.fieldType !== 'release_type').map(f => f.id)
      }
    ]
  });
  assertValidSchema(ungroupedReleaseRes);
  assert.equal(ungroupedReleaseRes.groupingStatus, GROUPING_STATUS.UNRESOLVED);
  assert.equal(ungroupedReleaseRes.reviewRequired, true);
  assert.ok(ungroupedReleaseRes.issueCodes.includes(ISSUE_CODES.UNGROUPED_MEDICINE_FIELD));
});

test('conservative derived review flags enforce low-confidence review and coherent correction markers', () => {
  const family1 = devFixtures.families.find(f => f.familyId === 'dev_family_1_legacy_single_item');
  const base = resolveScenarioInput(family1, family1.variants[0]);

  // 1. Default needsCorrection=false on low-confidence uncorrected field still requires review
  const lowConfDefaultFalse = JSON.parse(JSON.stringify(base));
  lowConfDefaultFalse.extractedFields[1].extractionConfidence = 0.3;
  lowConfDefaultFalse.extractedFields[1].needsCorrection = false;
  lowConfDefaultFalse.extractedFields[1].correctedBy = null;
  lowConfDefaultFalse.extractedFields[1].correctedAt = null;
  const res1 = buildDocumentMedicineItems(lowConfDefaultFalse);
  assertValidSchema(res1);
  assert.equal(res1.medicineItems[0].fields.dosage_strength.needsCorrection, true);
  assert.equal(res1.medicineItems[0].needsCorrection, true);
  assert.equal(res1.reviewRequired, true);

  // 2. Partial correction metadata (correctedBy without correctedAt) does not clear low confidence
  const partialCorr = JSON.parse(JSON.stringify(base));
  partialCorr.extractedFields[1].extractionConfidence = 0.3;
  delete partialCorr.extractedFields[1].needsCorrection;
  partialCorr.extractedFields[1].correctedBy = '661000000000000000000099';
  partialCorr.extractedFields[1].correctedAt = null;
  const res2 = buildDocumentMedicineItems(partialCorr);
  assertValidSchema(res2);
  assert.equal(res2.medicineItems[0].fields.dosage_strength.needsCorrection, true);
  assert.equal(res2.reviewRequired, true);

  // 3. Complete human correction pair (correctedBy + correctedAt) with needsCorrection=false clears low-confidence review flag
  const fullCorr = JSON.parse(JSON.stringify(base));
  fullCorr.extractedFields[1].extractionConfidence = 0.3;
  fullCorr.extractedFields[1].needsCorrection = false;
  fullCorr.extractedFields[1].correctedBy = '661000000000000000000099';
  fullCorr.extractedFields[1].correctedAt = '2026-11-09T12:00:00.000Z';
  const res3 = buildDocumentMedicineItems(fullCorr);
  assertValidSchema(res3);
  assert.equal(res3.medicineItems[0].fields.dosage_strength.needsCorrection, false);
  assert.equal(res3.medicineItems[0].needsCorrection, false);
  assert.equal(res3.reviewRequired, false);

  // 4. Explicit needsCorrection=true is never cleared automatically even with correctedBy + correctedAt
  const explicitTrue = JSON.parse(JSON.stringify(fullCorr));
  explicitTrue.extractedFields[1].needsCorrection = true;
  const res4 = buildDocumentMedicineItems(explicitTrue);
  assertValidSchema(res4);
  assert.equal(res4.medicineItems[0].fields.dosage_strength.needsCorrection, true);
  assert.equal(res4.reviewRequired, true);
});
