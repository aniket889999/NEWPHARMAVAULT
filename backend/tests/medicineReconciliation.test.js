'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const Ajv2020 = createRequire(require.resolve('ajv-cli/package.json'))('ajv/dist/2020');
const addFormats = require('ajv-formats');

const { buildDocumentMedicineItems } = require('../services/trustRag/medicineItemContract');
const {
  COMPARISON_STATUS,
  CHECK_STATUS,
  INVALID_RECONCILIATION_INPUT,
  reconcileMedicineDocuments
} = require('../services/trustRag/medicineReconciliationService');
const { loadScenarios } = require('../../tests/foundation-v2/fixtures.cjs');

const reconciliationSchema = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../contracts/schemas/medicine-reconciliation.schema.json'),
    'utf8'
  )
);
const devFixtures = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, './fixtures/reconciliation-v2-development.json'), 'utf8')
);

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validateReconciliation = ajv.compile(reconciliationSchema);

const developmentScenarios = loadScenarios('development');
const scenarioById = Object.fromEntries(developmentScenarios.map(s => [s.id, s]));
const clone = value => JSON.parse(JSON.stringify(value));

function buildEnvelope(doc) {
  if (!doc) return null;
  return buildDocumentMedicineItems({
    document: doc,
    extractedFields: doc.extractedFields,
    groups: doc.groups
  });
}

function buildScenarioRequest(scenarioId) {
  const scenario = scenarioById[scenarioId];
  assert.ok(scenario, `Unknown scenario ${scenarioId}`);
  return {
    caseId: scenario.caseId,
    prescription: buildEnvelope(scenario.documents[0]),
    invoice: buildEnvelope(scenario.documents[1])
  };
}

function buildCustomEnvelope({ caseId, documentId, documentType, items, pageCoverage }) {
  const extractedFields = [];
  const groups = [];

  items.forEach((itemSpec, idx) => {
    const prefix = `${documentId}_item_${idx + 1}`;
    const fieldIds = [];
    const anchorFieldId = `${prefix}_medicine_name`;

    const slotEntries = [
      ['medicine_name', itemSpec.medicine_name],
      ['dosage_strength', itemSpec.dosage_strength],
      ['dosage_form', itemSpec.dosage_form],
      ['release_type', itemSpec.release_type],
      ['quantity', itemSpec.quantity],
      ['quantity_unit', itemSpec.quantity_unit],
      ['pack_size', itemSpec.pack_size],
      ['pack_unit', itemSpec.pack_unit]
    ];

    for (const [slot, val] of slotEntries) {
      if (val === undefined || val === null) continue;
      const fieldId = `${prefix}_${slot}`;
      fieldIds.push(fieldId);
      extractedFields.push({
        id: fieldId,
        caseId,
        documentId,
        fieldType: slot,
        rawValue: String(val),
        normalizedValue: String(val),
        pageNumber: 1,
        extractionConfidence: itemSpec.confidence ?? 0.95,
        needsCorrection: itemSpec.needsCorrection ?? false,
        correctedBy: null,
        correctedAt: null,
        boundingBox: [0.1, 0.1, 0.2, 0.2],
        extractionMethod: 'OCR'
      });
    }

    groups.push({ anchorFieldId, fieldIds });
  });

  const cov = pageCoverage || { status: 'COMPLETE', total: 1, processed: 1, omitted: 0 };
  return buildDocumentMedicineItems({
    document: {
      id: documentId,
      caseId,
      type: documentType,
      pageCount: cov.total,
      processedPageCount: cov.processed,
      omittedPageCount: cov.omitted,
      pageCoverage: cov
    },
    extractedFields,
    groups
  });
}

function assertValidReconciliationOutput(request, output) {
  assert.equal(
    validateReconciliation(output),
    true,
    `Schema validation failed: ${JSON.stringify(validateReconciliation.errors)}`
  );
  assert.equal(output.schemaVersion, '2.0.0-session2');
  assert.equal(output.rulesetVersion, 'academic-reconciliation/1.0.0');
  assert.equal(output.caseId, request.caseId);
  assert.equal(output.humanDecisionRequired, true);
  assert.equal(output.documentIds.prescription, request.prescription?.documentId ?? null);
  assert.equal(output.documentIds.invoice, request.invoice?.documentId ?? null);

  const rxMap = new Map((request.prescription?.medicineItems ?? []).map(i => [i.itemId, i]));
  const invMap = new Map((request.invoice?.medicineItems ?? []).map(i => [i.itemId, i]));
  const seenRx = new Set();
  const seenInv = new Set();
  const seenRowIds = new Set();

  for (const row of output.rows) {
    assert.equal(seenRowIds.has(row.rowId), false, 'Duplicate rowId');
    seenRowIds.add(row.rowId);

    const rowItems = [];
    if (row.prescriptionItemId !== null) {
      assert.ok(rxMap.has(row.prescriptionItemId), 'Unknown prescriptionItemId');
      assert.equal(seenRx.has(row.prescriptionItemId), false, 'Prescription item matched twice');
      seenRx.add(row.prescriptionItemId);
      rowItems.push(rxMap.get(row.prescriptionItemId));
    }
    if (row.invoiceItemId !== null) {
      assert.ok(invMap.has(row.invoiceItemId), 'Unknown invoiceItemId');
      assert.equal(seenInv.has(row.invoiceItemId), false, 'Invoice item matched twice');
      seenInv.add(row.invoiceItemId);
      rowItems.push(invMap.get(row.invoiceItemId));
    }
    assert.ok(rowItems.length >= 1, 'Row must have at least one item side');

    for (const ref of row.evidenceReferences) {
      const belongsToRowItem = rowItems.some(
        item =>
          item.documentId === ref.documentId &&
          Object.values(item.fields).some(
            f => f && f.id === ref.fieldId && f.pageNumber === ref.pageNumber
          )
      );
      assert.equal(belongsToRowItem, true, 'Evidence reference must belong to row source item(s)');
    }

    for (const reason of row.reasonCodes) {
      assert.ok(output.reasonCodes.includes(reason), `Row reason ${reason} missing from aggregate`);
    }
  }

  assert.equal(seenRx.size, rxMap.size, 'All prescription items must appear in rows');
  assert.equal(seenInv.size, invMap.size, 'All invoice items must appear in rows');

  assert.equal(
    output.summary.consistent,
    output.rows.filter(r => r.status === 'CONSISTENT').length
  );
  assert.equal(output.summary.mismatch, output.rows.filter(r => r.status === 'MISMATCH').length);
  assert.equal(
    output.summary.insufficientEvidence,
    output.rows.filter(r => r.status === 'INSUFFICIENT_EVIDENCE').length
  );
}

for (const scenario of developmentScenarios) {
  test(`R01 [${scenario.id}]: Foundation development scenario (${scenario.effect}) matches expected outcome`, () => {
    const request = buildScenarioRequest(scenario.id);
    const before = clone(request);
    const output = reconcileMedicineDocuments(request);

    assertValidReconciliationOutput(request, output);
    assert.deepEqual(request, before, 'Input envelopes must not be mutated');
    assert.equal(output.status, scenario.gold.overall);

    for (const reason of scenario.gold.reasons) {
      const mappedReason =
        {
          CONTRADICTORY_COVERAGE: 'CONTRADICTORY_PAGE_COVERAGE',
          UNKNOWN_COVERAGE: 'UNKNOWN_PAGE_COVERAGE'
        }[reason] || reason;
      assert.ok(
        output.reasonCodes.includes(mappedReason),
        `Expected reason ${mappedReason} in ${JSON.stringify(output.reasonCodes)}`
      );
    }

    if (scenario.gold.noAssignedPairs) {
      assert.ok(
        output.rows.every(r => r.prescriptionItemId === null || r.invoiceItemId === null),
        'Expected no assigned pairs for unknown/unresolved scenario'
      );
    }
  });
}

test('R02: development fixture reconciliation edge cases (incompatible units, non-convertible concentrations, combination products)', () => {
  for (const edgeCase of devFixtures.reconciliationEdgeCases) {
    const prescription = buildCustomEnvelope({
      caseId: edgeCase.caseId,
      documentId: `${edgeCase.caseId}_rx`,
      documentType: 'PRESCRIPTION',
      items: edgeCase.prescriptionItems
    });
    const invoice = buildCustomEnvelope({
      caseId: edgeCase.caseId,
      documentId: `${edgeCase.caseId}_inv`,
      documentType: 'PHARMACY_INVOICE',
      items: edgeCase.invoiceItems
    });

    const request = { caseId: edgeCase.caseId, prescription, invoice };
    const output = reconcileMedicineDocuments(request);
    assertValidReconciliationOutput(request, output);
    assert.equal(output.status, edgeCase.expected.status, edgeCase.id);
    for (const reason of edgeCase.expected.reasonCodes) {
      assert.ok(output.reasonCodes.includes(reason), `${edgeCase.id}: missing ${reason}`);
    }
    for (const forbidden of edgeCase.expected.forbiddenReasonCodes || []) {
      assert.equal(
        output.reasonCodes.includes(forbidden),
        false,
        `${edgeCase.id}: unexpected ${forbidden}`
      );
    }

    if (edgeCase.id === 'REC-DEV-01') {
      assert.equal(output.rows.length, 1);
      assert.deepEqual(output.rows[0].quantity, {
        prescriptionBaseQuantity: null,
        invoiceBaseQuantity: null,
        baseUnit: null
      });
    }
  }
});

test('R03: order-independent 1-to-1 matching produces identical rows and rowIds when item arrays are reversed or permuted', () => {
  const original = buildScenarioRequest('F03-01');
  const reversed = clone(original);
  reversed.prescription.medicineItems.reverse();
  reversed.invoice.medicineItems.reverse();

  const outOriginal = reconcileMedicineDocuments(original);
  const outReversed = reconcileMedicineDocuments(reversed);

  assertValidReconciliationOutput(original, outOriginal);
  assertValidReconciliationOutput(reversed, outReversed);
  assert.deepEqual(outOriginal, outReversed);
});

test('R04: brand/alias resolution matches across brand families and detects brand/field attribute conflicts', () => {
  const caseId = 'case_brand_alias_01';
  const rx = buildCustomEnvelope({
    caseId,
    documentId: 'doc_rx_brand',
    documentType: 'PRESCRIPTION',
    items: [
      {
        medicine_name: 'Crocin 500',
        dosage_strength: '500 mg',
        dosage_form: 'tablet',
        quantity: '10',
        quantity_unit: 'tablet'
      }
    ]
  });
  const invConsistent = buildCustomEnvelope({
    caseId,
    documentId: 'doc_inv_brand_ok',
    documentType: 'PHARMACY_INVOICE',
    items: [
      {
        medicine_name: 'Pacimol 500',
        dosage_strength: '500 mg',
        dosage_form: 'tablet',
        quantity: '10',
        quantity_unit: 'tablet'
      }
    ]
  });

  const resConsistent = reconcileMedicineDocuments({
    caseId,
    prescription: rx,
    invoice: invConsistent
  });
  assertValidReconciliationOutput({ caseId, prescription: rx, invoice: invConsistent }, resConsistent);
  assert.equal(resConsistent.status, COMPARISON_STATUS.CONSISTENT);
  assert.equal(resConsistent.rows[0].genericName, 'Paracetamol');

  // Brand alias Dolo 650 (650mg in catalogue) contradicting extracted dosage_strength "500 mg"
  const invConflict = buildCustomEnvelope({
    caseId,
    documentId: 'doc_inv_brand_conflict',
    documentType: 'PHARMACY_INVOICE',
    items: [
      {
        medicine_name: 'Dolo 650',
        dosage_strength: '500 mg',
        dosage_form: 'tablet',
        quantity: '10',
        quantity_unit: 'tablet'
      }
    ]
  });
  const resConflict = reconcileMedicineDocuments({
    caseId,
    prescription: rx,
    invoice: invConflict
  });
  assertValidReconciliationOutput({ caseId, prescription: rx, invoice: invConflict }, resConflict);
  assert.equal(resConflict.status, COMPARISON_STATUS.INSUFFICIENT_EVIDENCE);
  assert.ok(resConflict.reasonCodes.includes('IDENTITY_ATTRIBUTE_CONFLICT'));
  assert.equal(resConflict.rows[0].checks.identity, CHECK_STATUS.INSUFFICIENT_EVIDENCE);
  assert.equal(resConflict.rows[0].checks.strength, CHECK_STATUS.INSUFFICIENT_EVIDENCE);
});

test('R05: ambiguous catalogue alias mapping across multiple generics flags AMBIGUOUS_MEDICINE without pairing', () => {
  const caseId = 'case_ambig_alias_01';
  const customCatalogue = [
    {
      genericName: 'Paracetamol',
      brandName: 'DualBrand',
      strength: '500mg',
      dosageForm: 'Tablet',
      aliases: ['SharedAlias']
    },
    {
      genericName: 'Metformin',
      brandName: 'DualBrand Met',
      strength: '500mg',
      dosageForm: 'Tablet',
      aliases: ['SharedAlias']
    }
  ];

  const rx = buildCustomEnvelope({
    caseId,
    documentId: 'doc_rx_ambig',
    documentType: 'PRESCRIPTION',
    items: [
      {
        medicine_name: 'SharedAlias',
        dosage_strength: '500 mg',
        dosage_form: 'tablet',
        quantity: '10',
        quantity_unit: 'tablet'
      }
    ]
  });
  const inv = buildCustomEnvelope({
    caseId,
    documentId: 'doc_inv_ambig',
    documentType: 'PHARMACY_INVOICE',
    items: [
      {
        medicine_name: 'SharedAlias',
        dosage_strength: '500 mg',
        dosage_form: 'tablet',
        quantity: '10',
        quantity_unit: 'tablet'
      }
    ]
  });

  const res = reconcileMedicineDocuments({
    caseId,
    prescription: rx,
    invoice: inv,
    catalogue: customCatalogue
  });
  assertValidReconciliationOutput({ caseId, prescription: rx, invoice: inv }, res);
  assert.equal(res.status, COMPARISON_STATUS.INSUFFICIENT_EVIDENCE);
  assert.ok(res.reasonCodes.includes('AMBIGUOUS_MEDICINE'));
  assert.equal(res.rows.length, 2);
  assert.ok(res.rows.every(r => r.prescriptionItemId === null || r.invoiceItemId === null));
});

test('R06: same-generic distinct strengths pair unambiguously while duplicate candidates stay unpaired with AMBIGUOUS_MATCH', () => {
  const caseId = 'case_multi_metformin_01';
  const rxDistinct = buildCustomEnvelope({
    caseId,
    documentId: 'doc_rx_distinct',
    documentType: 'PRESCRIPTION',
    items: [
      {
        medicine_name: 'Metformin',
        dosage_strength: '500 mg',
        dosage_form: 'tablet',
        quantity: '14',
        quantity_unit: 'tablet'
      },
      {
        medicine_name: 'Metformin',
        dosage_strength: '850 mg',
        dosage_form: 'tablet',
        quantity: '14',
        quantity_unit: 'tablet'
      }
    ]
  });
  const invDistinct = buildCustomEnvelope({
    caseId,
    documentId: 'doc_inv_distinct',
    documentType: 'PHARMACY_INVOICE',
    items: [
      {
        medicine_name: 'Glycomet 850',
        dosage_strength: '850 mg',
        dosage_form: 'tablet',
        quantity: '14',
        quantity_unit: 'tablet'
      },
      {
        medicine_name: 'Glycomet 500',
        dosage_strength: '500 mg',
        dosage_form: 'tablet',
        quantity: '14',
        quantity_unit: 'tablet'
      }
    ]
  });

  const resDistinct = reconcileMedicineDocuments({
    caseId,
    prescription: rxDistinct,
    invoice: invDistinct
  });
  assertValidReconciliationOutput(
    { caseId, prescription: rxDistinct, invoice: invDistinct },
    resDistinct
  );
  assert.equal(resDistinct.status, COMPARISON_STATUS.CONSISTENT);
  assert.equal(resDistinct.rows.length, 2);

  // Duplicate identical candidates on both sides
  const rxDup = buildCustomEnvelope({
    caseId,
    documentId: 'doc_rx_dup',
    documentType: 'PRESCRIPTION',
    items: [
      {
        medicine_name: 'Metformin',
        dosage_strength: '500 mg',
        dosage_form: 'tablet',
        quantity: '10',
        quantity_unit: 'tablet'
      },
      {
        medicine_name: 'Metformin',
        dosage_strength: '500 mg',
        dosage_form: 'tablet',
        quantity: '20',
        quantity_unit: 'tablet'
      }
    ]
  });
  const invDup = buildCustomEnvelope({
    caseId,
    documentId: 'doc_inv_dup',
    documentType: 'PHARMACY_INVOICE',
    items: [
      {
        medicine_name: 'Metformin',
        dosage_strength: '500 mg',
        dosage_form: 'tablet',
        quantity: '20',
        quantity_unit: 'tablet'
      },
      {
        medicine_name: 'Metformin',
        dosage_strength: '500 mg',
        dosage_form: 'tablet',
        quantity: '10',
        quantity_unit: 'tablet'
      }
    ]
  });

  const resDup = reconcileMedicineDocuments({ caseId, prescription: rxDup, invoice: invDup });
  assertValidReconciliationOutput({ caseId, prescription: rxDup, invoice: invDup }, resDup);
  assert.equal(resDup.status, COMPARISON_STATUS.INSUFFICIENT_EVIDENCE);
  assert.ok(resDup.reasonCodes.includes('AMBIGUOUS_MATCH'));
  assert.equal(resDup.rows.length, 4);
  assert.ok(resDup.rows.every(r => r.prescriptionItemId === null || r.invoiceItemId === null));
});

test('R07: confirmed mismatch coexists with incomplete coverage or field uncertainty without suppressing MISMATCH', () => {
  const req = buildScenarioRequest('F01-02');
  req.invoice.coverage = {
    status: 'INCOMPLETE',
    isComplete: false,
    total: 2,
    processed: 1,
    omitted: 1,
    reportedStatus: 'INCOMPLETE'
  };
  req.invoice.reviewRequired = true;

  const res = reconcileMedicineDocuments(req);
  assertValidReconciliationOutput(req, res);
  assert.equal(res.status, COMPARISON_STATUS.MISMATCH);
  assert.equal(res.hasInsufficientEvidence, true);
  assert.equal(res.reviewRequired, true);
  assert.ok(res.reasonCodes.includes('STRENGTH_MISMATCH'));
  assert.ok(res.reasonCodes.includes('INCOMPLETE_PAGE_COVERAGE'));
});

test('R08: cross-case, cross-document, forged itemId, duplicate documentId, and storage metadata throw INVALID_RECONCILIATION_INPUT', () => {
  const base = buildScenarioRequest('F01-01');

  const crossCase = clone(base);
  crossCase.prescription.caseId = 'foreign_case_id_secret';
  assert.throws(
    () => reconcileMedicineDocuments(crossCase),
    err =>
      err.code === INVALID_RECONCILIATION_INPUT &&
      !String(err.message).includes('foreign_case_id_secret')
  );

  const forgedFieldDoc = clone(base);
  forgedFieldDoc.invoice.medicineItems[0].fields.dosage_strength.documentId = 'foreign_doc_secret';
  assert.throws(
    () => reconcileMedicineDocuments(forgedFieldDoc),
    err =>
      err.code === INVALID_RECONCILIATION_INPUT &&
      !String(err.message).includes('foreign_doc_secret')
  );

  const forgedItemId = clone(base);
  forgedItemId.invoice.medicineItems[0].itemId = 'mi_000000000000000000000000';
  assert.throws(
    () => reconcileMedicineDocuments(forgedItemId),
    err => err.code === INVALID_RECONCILIATION_INPUT
  );

  const sameDocId = clone(base);
  sameDocId.invoice.documentId = sameDocId.prescription.documentId;
  for (const item of sameDocId.invoice.medicineItems) {
    item.documentId = sameDocId.prescription.documentId;
    for (const f of Object.values(item.fields)) {
      if (f) f.documentId = sameDocId.prescription.documentId;
    }
  }
  assert.throws(
    () => reconcileMedicineDocuments(sameDocId),
    err => err.code === INVALID_RECONCILIATION_INPUT
  );

  const storageInjected = clone(base);
  storageInjected.prescription.objectStorageKey = '/private/bucket/secret.pdf';
  assert.throws(
    () => reconcileMedicineDocuments(storageInjected),
    err =>
      err.code === INVALID_RECONCILIATION_INPUT &&
      !String(err.message).includes('/private/bucket/secret.pdf')
  );
});

test('R09: negative schema validation rejects tampered reconciliation outputs', () => {
  const validOutput = reconcileMedicineDocuments(buildScenarioRequest('F01-01'));
  assert.equal(validateReconciliation(validOutput), true);

  const noHumanBoundary = clone(validOutput);
  noHumanBoundary.humanDecisionRequired = false;
  assert.equal(validateReconciliation(noHumanBoundary), false);

  const consistentWithInsufficient = clone(validOutput);
  consistentWithInsufficient.hasInsufficientEvidence = true;
  assert.equal(validateReconciliation(consistentWithInsufficient), false);

  const consistentWithIncompleteCov = clone(validOutput);
  consistentWithIncompleteCov.coverage.invoice = 'INCOMPLETE';
  assert.equal(validateReconciliation(consistentWithIncompleteCov), false);

  const unlabelledBaseUnit = clone(validOutput);
  unlabelledBaseUnit.rows[0].quantity.baseUnit = null;
  assert.equal(validateReconciliation(unlabelledBaseUnit), false);

  const emptyRowSides = clone(validOutput);
  emptyRowSides.rows[0].prescriptionItemId = null;
  emptyRowSides.rows[0].invoiceItemId = null;
  assert.equal(validateReconciliation(emptyRowSides), false);
});

test('R10: uncertain invoice medicine_name does not prove another prescribed medicine is MISSING_INVOICE_ITEM', () => {
  const req = buildScenarioRequest('F02-03');
  const invItem = req.invoice.medicineItems[0];
  invItem.fields.medicine_name.extractionConfidence = 0.3;
  invItem.fields.medicine_name.needsCorrection = true;
  invItem.fields.medicine_name.correctedBy = null;
  invItem.fields.medicine_name.correctedAt = null;
  invItem.needsCorrection = true;
  req.invoice.reviewRequired = true;

  const res = reconcileMedicineDocuments(req);
  assertValidReconciliationOutput(req, res);
  assert.equal(res.status, COMPARISON_STATUS.INSUFFICIENT_EVIDENCE);
  assert.equal(res.hasInsufficientEvidence, true);
  assert.ok(res.reasonCodes.includes('FIELD_NEEDS_CORRECTION'));
  assert.equal(res.reasonCodes.includes('MISSING_INVOICE_ITEM'), false);
});

test('R11: uncertain prescription medicine_name does not prove an unmatched billed medicine is EXTRA_INVOICE_ITEM', () => {
  const req = buildScenarioRequest('F02-04');
  const rxItem = req.prescription.medicineItems[0];
  rxItem.fields.medicine_name.extractionConfidence = 0.3;
  rxItem.fields.medicine_name.needsCorrection = true;
  rxItem.fields.medicine_name.correctedBy = null;
  rxItem.fields.medicine_name.correctedAt = null;
  rxItem.needsCorrection = true;
  req.prescription.reviewRequired = true;

  const res = reconcileMedicineDocuments(req);
  assertValidReconciliationOutput(req, res);
  assert.equal(res.status, COMPARISON_STATUS.INSUFFICIENT_EVIDENCE);
  assert.equal(res.hasInsufficientEvidence, true);
  assert.ok(res.reasonCodes.includes('FIELD_NEEDS_CORRECTION'));
  assert.equal(res.reasonCodes.includes('EXTRA_INVOICE_ITEM'), false);
});

test('R12: non-suppression control — uncertain name on one row blocks omission/extra claim but preserves confirmed mismatch on a reliable sibling pair', () => {
  const req = buildScenarioRequest('F02-04');
  // Row 0 (Metformin): uncertain prescription medicine_name
  const rxItem0 = req.prescription.medicineItems[0];
  rxItem0.fields.medicine_name.extractionConfidence = 0.3;
  rxItem0.fields.medicine_name.needsCorrection = true;
  rxItem0.fields.medicine_name.correctedBy = null;
  rxItem0.fields.medicine_name.correctedAt = null;
  rxItem0.needsCorrection = true;
  req.prescription.reviewRequired = true;

  // Row 1 (Cetirizine): reliable medicine_name on both sides, but invoice strength is 20 mg vs 10 mg
  const invCetirizine = req.invoice.medicineItems.find(
    item => item.fields.medicine_name.normalizedValue === 'Cetirizine'
  );
  invCetirizine.fields.dosage_strength.rawValue = '20 mg';
  invCetirizine.fields.dosage_strength.normalizedValue = '20 mg';

  const res = reconcileMedicineDocuments(req);
  assertValidReconciliationOutput(req, res);
  assert.equal(res.status, COMPARISON_STATUS.MISMATCH);
  assert.equal(res.hasInsufficientEvidence, true);
  assert.ok(res.reasonCodes.includes('STRENGTH_MISMATCH'));
  assert.ok(res.reasonCodes.includes('FIELD_NEEDS_CORRECTION'));
  assert.equal(res.reasonCodes.includes('EXTRA_INVOICE_ITEM'), false);
});
