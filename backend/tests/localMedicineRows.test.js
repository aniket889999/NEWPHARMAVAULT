'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractMedicineRows,
  buildProposedGroupsFromPersistedFields,
  normalizeBoundingBox,
  normalizeConfidence
} = require('../services/trustRag/localMedicineRowExtractor');
const localOcrService = require('../services/trustRag/localOcrService');

test('extractMedicineRows extracts 1, 2, and 3 explicit medicine rows on PRESCRIPTION and PHARMACY_INVOICE', () => {
  // 1 row pipe-delimited prescription
  const singleRx = extractMedicineRows(
    [
      {
        text: 'Prescription Date: 12/08/2026',
        pageNumber: 1,
        confidence: 0.94,
        bbox: { x0: 0.05, y0: 0.05, x1: 0.65, y1: 0.1 }
      },
      {
        text: '1. Amoxicillin | 500 mg | capsule | 21 capsules',
        pageNumber: 1,
        confidence: 0.92,
        bbox: [0.05, 0.15, 0.85, 0.22]
      }
    ],
    { documentType: 'PRESCRIPTION' }
  );

  assert.equal(singleRx.detectedRowCount, 1);
  assert.deepEqual(singleRx.extractionBlockers, []);
  assert.equal(singleRx.proposedGroups.length, 1);
  assert.equal(singleRx.proposedGroups[0].candidateRowKey, 'row_1');

  const singleRowFields = singleRx.fields.filter((f) => f.candidateRowKey === 'row_1');
  const byName = Object.fromEntries(singleRowFields.map((f) => [f.fieldName, f]));
  assert.equal(byName.medicine_name.normalizedValue, 'Amoxicillin');
  assert.equal(byName.dosage_strength.rawValue, '500 mg');
  assert.equal(byName.dosage_strength.normalizedValue, '500mg');
  assert.equal(byName.dosage_form.rawValue, 'capsule');
  assert.equal(byName.dosage_form.normalizedValue, 'Capsule');
  assert.equal(byName.quantity.normalizedValue, '21');
  assert.equal(byName.quantity_unit.normalizedValue, 'capsule');
  assert.deepEqual(byName.medicine_name.boundingBox, [0.05, 0.15, 0.85, 0.22]);
  assert.equal(byName.medicine_name.extractionConfidence, 0.92);

  // 2 rows natural inline prescription
  const twoRowRx = extractMedicineRows(
    [
      {
        text: 'Rx 1: Paracetamol 650 mg tablet Qty: 10 tablets',
        pageNumber: 1,
        confidence: 0.91,
        bbox: [0.05, 0.18, 0.82, 0.24]
      },
      {
        text: 'Rx 2: Metformin 500 mg SR tablet 2 strips of 10 tablets',
        pageNumber: 1,
        confidence: 0.89,
        bbox: [0.05, 0.26, 0.88, 0.32]
      }
    ],
    { documentType: 'PRESCRIPTION' }
  );

  assert.equal(twoRowRx.detectedRowCount, 2);
  assert.deepEqual(twoRowRx.extractionBlockers, []);
  assert.equal(twoRowRx.proposedGroups.length, 2);

  const row2Fields = Object.fromEntries(
    twoRowRx.fields.filter((f) => f.candidateRowKey === 'row_2').map((f) => [f.fieldName, f])
  );
  assert.equal(row2Fields.medicine_name.normalizedValue, 'Metformin');
  assert.equal(row2Fields.dosage_strength.rawValue, '500 mg');
  assert.equal(row2Fields.dosage_strength.normalizedValue, '500mg');
  assert.equal(row2Fields.release_type.normalizedValue, 'SR');
  assert.equal(row2Fields.dosage_form.rawValue, 'tablet');
  assert.equal(row2Fields.dosage_form.normalizedValue, 'Tablet');
  assert.equal(row2Fields.quantity.normalizedValue, '2');
  assert.equal(row2Fields.quantity_unit.normalizedValue, 'strip');
  assert.equal(row2Fields.pack_size.normalizedValue, '10');
  assert.equal(row2Fields.pack_unit.normalizedValue, 'tablet');

  // 3 rows invoice across pages 1 and 2
  const threeRowInv = extractMedicineRows(
    [
      {
        text: 'Pharmacy: Apollo Pharmacy',
        pageNumber: 1,
        confidence: 0.95,
        bbox: [0.05, 0.04, 0.55, 0.09]
      },
      {
        text: 'Invoice Date: 2026-08-12',
        pageNumber: 1,
        confidence: 0.94,
        bbox: [0.05, 0.1, 0.5, 0.15]
      },
      {
        text: '1. Crocin | 650 mg | tablet | 1 strip | 10 tablets per strip',
        pageNumber: 1,
        confidence: 0.9,
        bbox: [0.05, 0.2, 0.9, 0.26]
      },
      {
        text: '2. Azithral | 500 mg | tablet | 3 tablets',
        pageNumber: 1,
        confidence: 0.88,
        bbox: [0.05, 0.28, 0.8, 0.34]
      },
      {
        text: '3. Augmentin | 625 mg | tablet | 10 tablets',
        pageNumber: 2,
        confidence: 0.93,
        bbox: [0.05, 0.1, 0.82, 0.16]
      },
      {
        text: 'Total Amount: Rs. 485.00',
        pageNumber: 2,
        confidence: 0.96,
        bbox: [0.05, 0.4, 0.55, 0.46]
      }
    ],
    { documentType: 'PHARMACY_INVOICE' }
  );

  assert.equal(threeRowInv.detectedRowCount, 3);
  assert.deepEqual(threeRowInv.extractionBlockers, []);
  assert.equal(threeRowInv.proposedGroups.length, 3);

  // Brand name 'Crocin' must NOT be rewritten to 'paracetamol' inside row extractor
  const invRow1 = Object.fromEntries(
    threeRowInv.fields.filter((f) => f.candidateRowKey === 'row_1').map((f) => [f.fieldName, f])
  );
  assert.equal(invRow1.medicine_name.normalizedValue, 'Crocin');
  assert.equal(invRow1.medicine_name.rawValue, '1. Crocin');

  const invRow3 = Object.fromEntries(
    threeRowInv.fields.filter((f) => f.candidateRowKey === 'row_3').map((f) => [f.fieldName, f])
  );
  assert.equal(invRow3.medicine_name.normalizedValue, 'Augmentin');
  assert.equal(invRow3.medicine_name.pageNumber, 2);

  const docFields = Object.fromEntries(
    threeRowInv.fields.filter((f) => f.candidateRowKey === null).map((f) => [f.fieldName, f])
  );
  assert.equal(docFields.pharmacy_name.normalizedValue, 'Apollo Pharmacy');
  assert.equal(docFields.invoice_date.normalizedValue, '2026-08-12');
  assert.equal(docFields.total_amount.normalizedValue, '485.00');
});

test('extractMedicineRows preserves null boundingBox and null confidence when absent without inventing defaults', () => {
  assert.equal(normalizeBoundingBox(null), null);
  assert.equal(normalizeBoundingBox([0, 0, 0, 0]), null);
  assert.equal(normalizeConfidence(undefined), null);
  assert.equal(normalizeConfidence(null), null);

  const extracted = extractMedicineRows(
    '1. Dolo | 650 mg | tablet | 10 tablets',
    { documentType: 'PRESCRIPTION', pageNumber: 1 }
  );

  assert.equal(extracted.detectedRowCount, 1);
  for (const field of extracted.fields) {
    assert.equal(field.boundingBox, null);
    assert.equal(field.extractionConfidence, null);
    assert.equal(field.needsCorrection, true);
  }
});

test('extractMedicineRows never extracts medicine rows or medicine fields on CLAIM_FORM', () => {
  const claimExtraction = extractMedicineRows(
    [
      {
        text: 'Claim Date: 2026-08-14',
        pageNumber: 1,
        confidence: 0.95,
        bbox: [10, 10, 200, 30]
      },
      {
        text: 'Claimed Amount: INR 485.00',
        pageNumber: 1,
        confidence: 0.94,
        bbox: [10, 40, 220, 60]
      },
      {
        text: '1. Paracetamol | 650 mg | tablet | 10 tablets',
        pageNumber: 1,
        confidence: 0.92,
        bbox: [10, 80, 320, 100]
      }
    ],
    { documentType: 'CLAIM_FORM' }
  );

  assert.equal(claimExtraction.detectedRowCount, 0);
  assert.deepEqual(claimExtraction.proposedGroups, []);
  assert.equal(
    claimExtraction.fields.some((f) => f.candidateRowKey !== null),
    false
  );
  const claimFieldNames = claimExtraction.fields.map((f) => f.fieldName);
  assert.deepEqual(claimFieldNames.sort(), ['claim_date', 'claimed_amount']);
});

test('extractMedicineRows flags ITEM_LIMIT_EXCEEDED when more than 3 medicine rows are detected', () => {
  const fourRowRx = extractMedicineRows(
    [
      '1. Paracetamol | 500 mg | tablet | 10 tablets',
      '2. Cetirizine | 10 mg | tablet | 10 tablets',
      '3. Pantoprazole | 40 mg | tablet | 10 tablets',
      '4. Azithromycin | 500 mg | tablet | 3 tablets'
    ].join('\n'),
    { documentType: 'PRESCRIPTION', confidence: 0.92 }
  );

  assert.equal(fourRowRx.detectedRowCount, 4);
  assert.equal(fourRowRx.extractionBlockers.includes('ITEM_LIMIT_EXCEEDED'), true);
  assert.deepEqual(fourRowRx.proposedGroups, []);
  // Only up to 3 rows are emitted as fields, all marked needsCorrection
  const rowKeys = new Set(fourRowRx.fields.filter((f) => f.candidateRowKey).map((f) => f.candidateRowKey));
  assert.equal(rowKeys.size, 3);
  for (const field of fourRowRx.fields.filter((f) => f.candidateRowKey)) {
    assert.equal(field.needsCorrection, true);
  }
});

test('extractMedicineRows flags UNSUPPORTED_LAYOUT on flat multi-medicine lines, competing strengths, and orphan attribute lines', () => {
  // Flat multi-medicine list on one line
  const flatMultiLine = extractMedicineRows(
    'Medicines: Paracetamol, Azithromycin, Pantoprazole',
    { documentType: 'PRESCRIPTION', confidence: 0.9 }
  );
  assert.equal(flatMultiLine.extractionBlockers.includes('UNSUPPORTED_LAYOUT'), true);
  assert.deepEqual(flatMultiLine.proposedGroups, []);

  // Competing strengths on one line
  const competingStrengths = extractMedicineRows(
    '1. Paracetamol 500 mg 650 mg tablet 10 tablets',
    { documentType: 'PRESCRIPTION', confidence: 0.9 }
  );
  assert.equal(competingStrengths.extractionBlockers.includes('UNSUPPORTED_LAYOUT'), true);
  assert.deepEqual(competingStrengths.proposedGroups, []);

  // Orphan attribute line with no prior medicine row
  const orphanAttribute = extractMedicineRows(
    'Strength: 500 mg\nDosage Form: tablet',
    { documentType: 'PRESCRIPTION', confidence: 0.9 }
  );
  assert.equal(orphanAttribute.extractionBlockers.includes('UNSUPPORTED_LAYOUT'), true);
  assert.deepEqual(orphanAttribute.proposedGroups, []);

  // Competing slot values across continuation lines of the same medicine row
  const competingRowContinuation = extractMedicineRows(
    [
      '1. Paracetamol 500 mg tablet',
      'Strength: 650 mg'
    ],
    { documentType: 'PRESCRIPTION', confidence: 0.9 }
  );
  assert.equal(competingRowContinuation.extractionBlockers.includes('UNSUPPORTED_LAYOUT'), true);
  assert.deepEqual(competingRowContinuation.proposedGroups, []);
});

test('buildProposedGroupsFromPersistedFields links persisted ExtractedField IDs into candidate groups', () => {
  const persistedFields = [
    {
      _id: '64b000000000000000000001',
      fieldName: 'medicine_name',
      candidateRowKey: 'row_1',
      pageNumber: 1
    },
    {
      _id: '64b000000000000000000002',
      fieldName: 'dosage_strength',
      candidateRowKey: 'row_1',
      pageNumber: 1
    },
    {
      _id: '64b000000000000000000003',
      fieldName: 'prescription_date',
      candidateRowKey: null,
      pageNumber: 1
    }
  ];

  const groups = buildProposedGroupsFromPersistedFields(persistedFields, {
    extractionBlockers: []
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].candidateRowKey, 'row_1');
  assert.equal(groups[0].anchorFieldId, '64b000000000000000000001');
  assert.deepEqual(groups[0].fieldIds, [
    '64b000000000000000000001',
    '64b000000000000000000002'
  ]);
  assert.deepEqual(groups[0].pageNumbers, [1]);

  // Suppresses proposed groups when blockers exist
  const blockedGroups = buildProposedGroupsFromPersistedFields(persistedFields, {
    extractionBlockers: ['UNSUPPORTED_LAYOUT']
  });
  assert.deepEqual(blockedGroups, []);
});

test('localOcrService.extractDocumentRows delegates to localMedicineRowExtractor', () => {
  const result = localOcrService.extractDocumentRows(
    {
      text: '1. Calpol | 500 mg | tablet | 15 tablets',
      confidence: 0.91,
      lines: [
        {
          text: '1. Calpol | 500 mg | tablet | 15 tablets',
          confidence: 0.91,
          bbox: [0.05, 0.1, 0.8, 0.16]
        }
      ]
    },
    'PRESCRIPTION',
    1
  );

  assert.equal(result.detectedRowCount, 1);
  assert.equal(result.fields.length, 5);
  assert.equal(result.fields[0].candidateRowKey, 'row_1');
});

test('real TesseractOcrProvider + extractMedicineRows extracts 2 printed English medicine rows with valid normalized bounding boxes', async () => {
  const { createRequire } = require('node:module');
  const reqBackend = createRequire(require.resolve('../package.json'));
  const reqFromPdfToImg = createRequire(reqBackend.resolve('pdf-to-img'));
  const { createCanvas } = reqFromPdfToImg('@napi-rs/canvas');
  const TesseractOcrProvider = require('../services/trustRag/tesseractOcrProvider');

  const canvas = createCanvas(900, 320);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 900, 320);
  ctx.fillStyle = '#000000';
  ctx.font = '28px Arial';
  ctx.fillText('Date: 2026-05-10', 40, 60);
  ctx.fillText('1. Paracetamol 650 mg tablet Qty: 10 tablets', 40, 140);
  ctx.fillText('2. Azithromycin 500 mg tablet Qty: 3 tablets', 40, 220);

  const pngBuffer = canvas.toBuffer('image/png');
  const provider = new TesseractOcrProvider();
  const ocrResult = await provider.recognize(pngBuffer);

  const extracted = extractMedicineRows(ocrResult, {
    documentType: 'PRESCRIPTION',
    pageNumber: 1
  });

  assert.equal(extracted.detectedRowCount, 2);
  assert.deepEqual(extracted.extractionBlockers, []);
  assert.equal(extracted.proposedGroups.length, 2);

  const row1Fields = extracted.fields.filter((f) => f.candidateRowKey === 'row_1');
  const row2Fields = extracted.fields.filter((f) => f.candidateRowKey === 'row_2');
  assert.equal(row1Fields.length, 5);
  assert.equal(row2Fields.length, 5);

  const r1Name = row1Fields.find((f) => f.fieldType === 'medicine_name');
  assert.equal(r1Name.normalizedValue, 'Paracetamol');
  assert.ok(Array.isArray(r1Name.boundingBox) && r1Name.boundingBox.length === 4);
  assert.ok(r1Name.boundingBox[0] >= 0 && r1Name.boundingBox[2] <= 1 && r1Name.boundingBox[0] < r1Name.boundingBox[2]);
  assert.ok(r1Name.boundingBox[1] >= 0 && r1Name.boundingBox[3] <= 1 && r1Name.boundingBox[1] < r1Name.boundingBox[3]);

  const r2Name = row2Fields.find((f) => f.fieldType === 'medicine_name');
  assert.equal(r2Name.normalizedValue, 'Azithromycin');
});
