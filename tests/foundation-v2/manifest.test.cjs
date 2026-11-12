'use strict';

// This suite validates our test data, NOT the product's reconciliation behaviour.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
// ajv-cli is an existing direct dev dependency; the root Ajv is an older ESLint dependency.
const Ajv2020 = createRequire(require.resolve('ajv-cli/package.json'))('ajv/dist/2020');
const { LABEL, readManifest, loadScenarios } = require('./fixtures.cjs');
const { ACADEMIC_MEDICINE_CATALOGUE } = require('../../backend/data/academicMedicineCatalogue.js');

const development = readManifest('development');
const heldout = readManifest('heldout');
const manifests = [development, heldout];
const scenarios = [...loadScenarios('development'), ...loadScenarios('heldout')];
const byId = Object.fromEntries(scenarios.map(scenario => [scenario.id, scenario]));
const statuses = ['CONSISTENT', 'MISMATCH', 'INSUFFICIENT_EVIDENCE'];
const normalize = value => String(value).toLowerCase().replace(/\s+/g, '');
const getField = (scenario, side, type, key = 'A') => scenario.documents
  .find(document => document.type === (side === 'rx' ? 'PRESCRIPTION' : 'PHARMACY_INVOICE'))
  .extractedFields.find(field => field.fieldType === type && field.fixtureLineKey === key);

test('frozen dataset bytes and materialised gold match the versioned lock', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset-lock.json'), 'utf8'));
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(lock.synthetic, true); assert.equal(lock.scenarioCount, 40);
  assert.equal(lock.developmentCount, 24); assert.equal(lock.heldoutCount, 16);
  for (const [file, expectedHash] of Object.entries(lock.files)) {
    assert.equal(hash(fs.readFileSync(path.join(__dirname, file))), expectedHash, `${file} changed: document and version the dataset before rescoring.`);
  }
  assert.equal(hash(JSON.stringify(scenarios)), lock.materializedSha256);
});

test('manifest schema accepts both splits and rejects fabricated real-data labels', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.schema.json'), 'utf8')));
  for (const manifest of manifests) assert.equal(validate(manifest), true, JSON.stringify(validate.errors));
  const invalid = JSON.parse(JSON.stringify(development)); invalid.synthetic = false;
  assert.equal(validate(invalid), false);
});

test('exactly ten disjoint families and forty scenarios, split 24/16 without sibling leakage', () => {
  assert.equal(development.families.length, 6); assert.equal(heldout.families.length, 4);
  assert.equal(loadScenarios('development').length, 24); assert.equal(loadScenarios('heldout').length, 16);
  const familyIds = manifests.flatMap(manifest => manifest.families.map(family => family.id));
  assert.equal(new Set(familyIds).size, 10); assert.equal(new Set(scenarios.map(scenario => scenario.id)).size, 40);
  for (const family of [...development.families, ...heldout.families]) {
    assert.equal(family.scenarios.length, 4);
    for (const scenario of family.scenarios) assert.ok(scenario.id.startsWith(family.id + '-'));
    assert.equal(new Set(scenarios.filter(scenario => scenario.familyId === family.id).map(scenario => scenario.split)).size, 1);
  }
});

test('fixture materialisation is deterministic and isolated between calls', () => {
  const first = loadScenarios('development');
  assert.deepEqual(first, loadScenarios('development'));
  first[0].documents[0].extractedFields[0].rawValue = 'mutated caller copy';
  assert.notEqual(loadScenarios('development')[0].documents[0].extractedFields[0].rawValue, 'mutated caller copy');
  assert.throws(() => loadScenarios('all'), /Explicit/);
});

test('fixture CLI defaults to development and rejects an implicit combined evaluation split', () => {
  const cli = path.join(__dirname, 'fixtures.cjs');
  const result = spawnSync(process.execPath, [cli], { encoding: 'utf8', maxBuffer: 2_000_000 });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.length, 24); assert.ok(output.every(scenario => scenario.split === 'development'));
  const invalid = spawnSync(process.execPath, [cli, '--split=all'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1); assert.match(invalid.stderr, /Explicit/);
});

test('base item profiles are not duplicated across families', () => {
  const profiles = manifests.flatMap(manifest => manifest.families.map(family => JSON.stringify([family.items, family.invoiceOverrides || {}])));
  assert.equal(new Set(profiles).size, 10);
});

test('non-fictional baseline name/strength/form entries exist in the local academic catalogue', () => {
  for (const family of manifests.flatMap(manifest => manifest.families)) for (const item of family.items) {
    if (item.name.startsWith('TEST-DRUG-')) continue;
    assert.ok(ACADEMIC_MEDICINE_CATALOGUE.some(record => normalize(record.genericName) === normalize(item.name) &&
      normalize(record.strength) === normalize(item.strength) && normalize(record.dosageForm) === normalize(item.form)), `${family.id}: ${JSON.stringify(item)}`);
  }
});

for (const scenario of scenarios) test(`synthetic fixture integrity: ${scenario.id} (${scenario.effect})`, () => {
  assert.equal(scenario.synthetic, true); assert.equal(scenario.label, LABEL);
  assert.match(scenario.caseId, /^[a-f0-9]{24}$/);
  assert.ok(statuses.includes(scenario.gold.overall)); assert.equal(scenario.gold.humanDecisionRequired, true);
  assert.equal(scenario.gold.answerAction, scenario.gold.overall === 'INSUFFICIENT_EVIDENCE' ? 'REQUEST_EVIDENCE' : 'EXPLAIN_WITH_EVIDENCE');
  const fieldIds = new Set();
  for (const document of scenario.documents) {
    assert.equal(document.synthetic, true); assert.equal(document.label, LABEL); assert.ok(document.sourceText.startsWith(LABEL));
    assert.equal(document.caseId, scenario.caseId);
    for (const forbidden of ['objectStorageKey', 'localPath', 'storageRoot', 'storagePath']) assert.equal(forbidden in document, false);
    for (const field of document.extractedFields) {
      assert.equal(field.caseId, scenario.caseId); assert.equal(field.documentId, document.id);
      assert.match(field.id, /^[a-f0-9]{24}$/); assert.equal(fieldIds.has(field.id), false); fieldIds.add(field.id);
      assert.equal(field.extractionMethod, 'SYNTHETIC_GOLD'); assert.equal('boundingBox' in field, false);
      assert.ok(field.extractionConfidence >= 0 && field.extractionConfidence <= 1);
      assert.ok(Number.isInteger(field.pageNumber) && field.pageNumber >= 1);
      if (document.processedPageCount !== undefined) assert.ok(field.pageNumber <= document.processedPageCount);
    }
    const used = new Set();
    for (const group of document.groups || []) {
      assert.ok(group.fieldIds.includes(group.anchorFieldId));
      const anchor = document.extractedFields.find(field => field.id === group.anchorFieldId);
      assert.equal(anchor.fieldType, 'medicine_name');
      for (const member of group.fieldIds) {
        assert.ok(document.extractedFields.some(field => field.id === member));
        assert.equal(used.has(member), false); used.add(member);
      }
    }
    if (document.type === 'CLAIM_FORM') assert.ok(document.extractedFields.every(field => field.fieldType !== 'medicine_name'));
  }
  for (const pair of scenario.gold.expectedPairs) {
    assert.ok(fieldIds.has(pair.prescriptionAnchorFieldId)); assert.ok(fieldIds.has(pair.invoiceAnchorFieldId));
    assert.ok(statuses.includes(pair.status));
    assert.ok(scenario.documents.find(document => document.type === 'PRESCRIPTION').extractedFields.some(field => field.id === pair.prescriptionAnchorFieldId));
    assert.ok(scenario.documents.find(document => document.type === 'PHARMACY_INVOICE').extractedFields.some(field => field.id === pair.invoiceAnchorFieldId));
  }
  if (scenario.gold.overall !== 'CONSISTENT') assert.ok(scenario.gold.reasons.length > 0);
});

test('reordering invoice rows preserves every field identity and the expected pair links', () => {
  for (const prefix of ['F02', 'F07']) {
    const base = byId[prefix + '-01'], reordered = byId[prefix + '-02'];
    const ids = scenario => scenario.documents[1].extractedFields.map(field => field.id);
    assert.deepEqual([...ids(base)].sort(), [...ids(reordered)].sort());
    assert.notDeepEqual(ids(base), ids(reordered));
    assert.deepEqual(base.gold.expectedPairs, reordered.gold.expectedPairs);
  }
});

test('strength mismatch fixture really differs and is not silently normalised to equality', () => {
  const scenario = byId['F01-02'];
  assert.equal(getField(scenario, 'rx', 'dosage_strength').normalizedValue, '500 mg');
  assert.equal(getField(scenario, 'invoice', 'dosage_strength').normalizedValue, '650 mg');
  assert.equal(scenario.gold.overall, 'MISMATCH');
});

test('known-pack gold equality is explicit; the unknown-pack variant omits the count', () => {
  const known = byId['F03-01'], unknown = byId['F03-02'];
  const amount = Number(getField(known, 'invoice', 'quantity').normalizedValue);
  const pack = Number(getField(known, 'invoice', 'pack_size').normalizedValue);
  assert.equal(amount * pack, Number(getField(known, 'rx', 'quantity').normalizedValue));
  assert.equal(getField(unknown, 'invoice', 'pack_size'), undefined);
  assert.equal(unknown.gold.overall, 'INSUFFICIENT_EVIDENCE');
  assert.equal(Number(getField(byId['F03-03'], 'invoice', 'pack_size').normalizedValue) * amount, 10);
  assert.equal(byId['F03-03'].gold.overall, 'MISMATCH');
});

test('release/form contradictions and missing attributes remain distinct fixtures', () => {
  assert.equal(getField(byId['F04-02'], 'rx', 'release_type').normalizedValue, 'IR');
  assert.equal(getField(byId['F04-02'], 'invoice', 'release_type').normalizedValue, 'SR');
  assert.equal(getField(byId['F04-03'], 'invoice', 'release_type'), undefined);
  assert.notEqual(getField(byId['F04-04'], 'rx', 'dosage_form').normalizedValue, getField(byId['F04-04'], 'invoice', 'dosage_form').normalizedValue);
});

test('unknown fictional medicines and four-group inputs cannot have complete gold outcomes', () => {
  for (const scenario of scenarios.filter(value => value.familyId === 'F05')) {
    assert.equal(scenario.gold.overall, 'INSUFFICIENT_EVIDENCE'); assert.equal(scenario.gold.expectedPairs.length, 0);
  }
  assert.equal(byId['F05-04'].documents[1].groups.length, 4);
});

test('incomplete, contradictory and absent coverage are different negative controls', () => {
  const contradictory = byId['F06-03'].documents[1];
  assert.equal(contradictory.pageCoverage.status, 'COMPLETE');
  assert.ok(contradictory.processedPageCount < contradictory.pageCount);
  assert.equal(byId['F06-03'].gold.overall, 'INSUFFICIENT_EVIDENCE');
  assert.equal(byId['F06-04'].documents[1].pageCoverage, undefined);
  const omitted = byId['F07-04'];
  assert.equal(omitted.documents[1].omittedPageCount, 2);
  assert.equal(omitted.documents[1].extractedFields.some(field => field.fixtureLineKey === 'C'), false);
  assert.equal(omitted.gold.missingInvoiceKeys, undefined);
  assert.deepEqual(omitted.gold.unobservedInvoiceKeys, ['C']);
});

test('missing complete invoice item is not confused with an omitted page or missing document', () => {
  assert.deepEqual(byId['F02-03'].gold.missingInvoiceKeys, ['B']);
  assert.equal(byId['F02-03'].documents[1].pageCoverage.status, 'COMPLETE');
  assert.equal(byId['F09-04'].documents.some(document => document.type === 'PHARMACY_INVOICE'), false);
  assert.equal(byId['F09-04'].gold.overall, 'INSUFFICIENT_EVIDENCE');
});

test('low confidence is not just a label: the supporting field requests correction', () => {
  for (const scenarioId of ['F05-03', 'F08-03']) {
    const field = getField(byId[scenarioId], 'invoice', 'dosage_strength');
    assert.equal(field.needsCorrection, true); assert.equal(field.extractionConfidence, 0.3);
    assert.equal(byId[scenarioId].gold.overall, 'INSUFFICIENT_EVIDENCE');
  }
});

test('dependent corrections preserve source IDs, raw OCR and old snapshots', () => {
  for (const [scenarioId, type, expectedValue] of [['F01-04', 'dosage_strength', '500 mg'], ['F09-03', 'quantity', '100']]) {
    const scenario = byId[scenarioId];
    const before = scenario.context.previousDocuments[1].extractedFields.find(field => field.fieldType === type);
    const after = getField(scenario, 'invoice', type);
    assert.equal(before.id, after.id); assert.equal(after.rawValue, before.rawValue);
    assert.notEqual(before.normalizedValue, after.normalizedValue); assert.equal(after.normalizedValue, expectedValue);
    assert.ok(after.correctedBy); assert.ok(after.correctedAt);
    assert.deepEqual(scenario.context.dependencyFieldIds, [after.id]);
    assert.equal(scenario.gold.freshness, 'DEPENDENT_ANSWER_STALE');
  }
});

test('unrelated edit changes only administrative evidence, not medicine dependencies', () => {
  const scenario = byId['F08-04'];
  const previous = scenario.context.previousDocuments;
  for (const dependency of scenario.context.dependencyFieldIds) {
    const before = previous.flatMap(document => document.extractedFields).find(field => field.id === dependency);
    const after = scenario.documents.flatMap(document => document.extractedFields).find(field => field.id === dependency);
    assert.deepEqual(before, after);
  }
  const note = documents => documents[0].extractedFields.find(field => field.fieldType === 'administrative_note').normalizedValue;
  assert.notEqual(note(previous), note(scenario.documents));
  assert.equal(scenario.gold.freshness, 'DEPENDENT_ANSWER_CURRENT');
});

test('wrong-medicine distractor and metadata-only claim do not change gold comparison truth', () => {
  assert.equal(byId['F10-03'].context.distractor.medicineName, 'Metformin');
  assert.equal(getField(byId['F10-03'], 'rx', 'medicine_name').normalizedValue, 'Cetirizine');
  assert.equal(byId['F10-03'].gold.chatAction, 'REJECT_DISTRACTOR');
  assert.equal(byId['F10-04'].documents[2].type, 'CLAIM_FORM');
  assert.equal(byId['F10-04'].gold.claimGrouping, 'NOT_APPLICABLE');
  assert.equal(byId['F10-04'].gold.overall, 'CONSISTENT');
});

test('legacy ambiguity is represented by two actual name fields, not a fictional successful grouping', () => {
  const scenario = byId['F10-02'];
  assert.equal(scenario.documents[1].groups, null);
  assert.equal(scenario.documents[1].extractedFields.filter(field => field.fieldType === 'medicine_name').length, 2);
  assert.equal(scenario.gold.expectedPairs.length, 0);
});
