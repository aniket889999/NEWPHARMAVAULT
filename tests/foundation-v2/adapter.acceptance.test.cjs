'use strict';

// Independent Session 1 adapter checks. Development inputs only; no database/model calls.
// Expected failures are release blockers, not skipped tests or successful benchmark scores.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const Ajv2020 = createRequire(require.resolve('ajv-cli/package.json'))('ajv/dist/2020');
const addFormats = require('ajv-formats');
const adapter = require('../../backend/services/trustRag/medicineItemContract.js');
const { loadScenarios } = require('./fixtures.cjs');

const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../contracts/schemas/medicine-item.schema.json'), 'utf8'));
const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv);
const validEnvelope = ajv.compile(schema);
const scenarios = Object.fromEntries(loadScenarios('development').map(value => [value.id, value]));
const clone = value => JSON.parse(JSON.stringify(value));
const coreSlots = ['medicine_name', 'dosage_strength', 'dosage_form', 'quantity'];

function input(scenarioId = 'F01-01', documentIndex = 0, coreOnly = true) {
  const source = clone(scenarios[scenarioId].documents[documentIndex]);
  const fields = coreOnly ? source.extractedFields.filter(field => coreSlots.includes(field.fieldType)) : source.extractedFields;
  const fieldIds = new Set(fields.map(field => field.id));
  const groups = source.groups?.map(group => ({ ...group, fieldIds: group.fieldIds.filter(id => fieldIds.has(id)) }));
  const { extractedFields: ignoredFields, groups: ignoredGroups, ...document } = source;
  return { document, extractedFields: fields, groups };
}

function build(value) {
  const output = adapter.buildDocumentMedicineItems(value);
  assert.equal(validEnvelope(output), true, JSON.stringify(validEnvelope.errors));
  return output;
}

function expectUnresolved(value, reason) {
  const output = build(value);
  assert.equal(output.groupingStatus, 'UNRESOLVED', reason);
  assert.equal(output.medicineItems.length, 0);
  assert.equal(output.reviewRequired, true);
  return output;
}

function field(value, type) { return value.extractedFields.find(entry => entry.fieldType === type); }
function addField(value, type, rawValue, suffix = 'a') {
  const added = { ...clone(value.extractedFields[0]), id: `independent_${suffix}_${type}`,
    fieldType: type, rawValue, normalizedValue: rawValue };
  value.extractedFields.push(added);
  return added;
}

test('A01: minimal legacy record preserves source fields without input mutation', () => {
  const value = input(); delete value.groups;
  const before = clone(value); const output = build(value);
  assert.equal(output.groupingStatus, 'LEGACY_SINGLE_ITEM'); assert.equal(output.medicineItems.length, 1);
  const medicine = output.medicineItems[0];
  assert.equal(medicine.fields.dosage_strength.rawValue, '500 mg');
  assert.equal(medicine.fields.medicine_name.id, field(value, 'medicine_name').id);
  assert.equal(medicine.fields.medicine_name.extractionConfidence, 0.9);
  assert.equal(medicine.fields.medicine_name.boundingBox, null);
  assert.deepEqual(value, before);
});

test('A02/A03: three explicit groups and field reordering preserve stable item identities', () => {
  const original = input('F03-01'); const reordered = clone(original);
  reordered.groups.reverse(); reordered.extractedFields.reverse();
  for (const group of reordered.groups) group.fieldIds.reverse();
  const first = build(original), second = build(reordered);
  assert.equal(first.groupingStatus, 'GROUPED'); assert.equal(first.medicineItems.length, 3);
  const ids = output => Object.fromEntries(output.medicineItems.map(item => [item.anchorFieldId, item.itemId]));
  assert.deepEqual(ids(first), ids(second));
  assert.equal(new Set(Object.values(ids(first))).size, 3);
});

test('A04: correcting a field value does not change an item ID or discard raw OCR', () => {
  const before = input(); const after = clone(before);
  const strength = field(after, 'dosage_strength');
  strength.normalizedValue = '650 mg'; strength.correctedBy = 'synthetic_staff'; strength.correctedAt = '2026-11-09T00:00:00.000Z';
  const oldOutput = build(before), newOutput = build(after);
  assert.equal(oldOutput.medicineItems[0].itemId, newOutput.medicineItems[0].itemId);
  assert.equal(newOutput.medicineItems[0].fields.dosage_strength.rawValue, '500 mg');
  assert.equal(newOutput.medicineItems[0].fields.dosage_strength.normalizedValue, '650 mg');
});

test('A05: repeated ungrouped medicine-name fields are not silently reduced to one', () => {
  const value = input(); delete value.groups;
  addField(value, 'medicine_name', 'Cetirizine', 'second_name'); expectUnresolved(value);
});

test('A06: an explicit comma-separated list is unresolved', () => {
  const value = input(); delete value.groups;
  field(value, 'medicine_name').rawValue = field(value, 'medicine_name').normalizedValue = 'Paracetamol 500 mg, Metformin 500 mg';
  expectUnresolved(value);
});

test('A06b: a combination-partner keyword must not certify an unverified flat list as one medicine', () => {
  const value = input(); delete value.groups;
  field(value, 'medicine_name').rawValue = field(value, 'medicine_name').normalizedValue = 'Paracetamol 500mg and Ibuprofen 200mg';
  expectUnresolved(value, 'A partner-word heuristic is not evidence of one fixed-dose product; this pilot does not establish combination equivalence.');
});

test('A07: competing strength fields for a single legacy item are rejected', () => {
  const value = input(); delete value.groups;
  addField(value, 'dosage_strength', '650 mg', 'conflicting_strength'); expectUnresolved(value);
});

for (const property of ['caseId', 'documentId']) test(`A08: a ${property} mismatch cannot publish a foreign linked field`, () => {
  const value = input(); field(value, 'dosage_strength')[property] = 'foreign_scope';
  const output = expectUnresolved(value);
  assert.equal(output.medicineItems.length, 0);
  assert.ok(output.issues.length > 0);
});

test('A09: repeated anchor and cross-group field membership are rejected', () => {
  const value = input('F03-01');
  value.groups[1].fieldIds.push(value.groups[0].fieldIds[1]); expectUnresolved(value);
  const repeated = input('F03-01'); repeated.groups[1].anchorFieldId = repeated.groups[0].anchorFieldId;
  expectUnresolved(repeated);
});

test('A10: a four-group document produces no silently truncated item list', () => {
  const value = input('F05-04', 1);
  const output = expectUnresolved(value);
  assert.equal(output.detectedGroupCount, 4); assert.ok(output.issueCodes.includes('GROUP_LIMIT_EXCEEDED'));
});

test('A11: missing strength/form/quantity remain null rather than being inferred', () => {
  const value = input(); delete value.groups;
  value.extractedFields = value.extractedFields.filter(entry => entry.fieldType === 'medicine_name');
  const output = build(value);
  assert.equal(output.medicineItems[0].fields.dosage_strength, null);
  assert.equal(output.medicineItems[0].fields.dosage_form, null);
  assert.equal(output.medicineItems[0].fields.quantity, null);
});

test('A11b: missing essential medicine slots require human clarification, not a cleared envelope', () => {
  const value = input(); delete value.groups;
  value.extractedFields = value.extractedFields.filter(entry => entry.fieldType === 'medicine_name');
  assert.equal(build(value).reviewRequired, true, 'Unknown essential fields must not advertise reviewRequired=false.');
});

test('A11c: absent server extractionConfidence is not fabricated from frontend confidenceScore', () => {
  const value = input(); delete field(value, 'dosage_strength').extractionConfidence;
  field(value, 'dosage_strength').confidenceScore = 0.99;
  expectUnresolved(value);
});

test('A11d: low confidence with an explicit false default still needs review when uncorrected', () => {
  const value = input(); const strength = field(value, 'dosage_strength');
  strength.extractionConfidence = 0.3; strength.needsCorrection = false; strength.correctedBy = null; strength.correctedAt = null;
  assert.equal(build(value).reviewRequired, true, 'A default false flag must not override an unreviewed low-confidence field.');
});

test('A11e: correctedBy alone does not clear a low-confidence field without a correction timestamp', () => {
  const value = input(); const strength = field(value, 'dosage_strength');
  strength.extractionConfidence = 0.3; delete strength.needsCorrection; strength.correctedBy = 'synthetic_staff'; strength.correctedAt = null;
  assert.equal(build(value).reviewRequired, true, 'Partial correction metadata does not establish a completed correction.');
});

test('A11f: a complete human-correction marker can clear the low-confidence review flag', () => {
  const value = input(); const strength = field(value, 'dosage_strength');
  strength.extractionConfidence = 0.3; strength.needsCorrection = false;
  strength.correctedBy = 'synthetic_staff'; strength.correctedAt = '2026-11-09T00:00:00.000Z';
  const output = build(value);
  assert.equal(output.medicineItems[0].fields.dosage_strength.extractionConfidence, 0.3);
  assert.equal(output.medicineItems[0].fields.dosage_strength.needsCorrection, false);
});

for (const scenarioId of ['F06-03', 'F06-04']) test(`A12: ${scenarioId} coverage is never advertised complete`, () => {
  const output = build(input(scenarioId, 1));
  assert.equal(output.coverage.isComplete, false); assert.equal(output.reviewRequired, true);
  assert.notEqual(output.coverage.status, 'COMPLETE');
});

test('A12b: fields outside processed pages trigger a coverage problem', () => {
  const value = input(); field(value, 'dosage_strength').pageNumber = 2;
  const output = build(value);
  assert.equal(output.coverage.isComplete, false); assert.equal(output.reviewRequired, true);
});

test('A13: a claim form never acquires invented medicine items', () => {
  const value = input(); value.document.type = 'CLAIM_FORM';
  const output = build(value);
  assert.equal(output.groupingStatus, 'NOT_APPLICABLE'); assert.deepEqual(output.medicineItems, []);
});

test('A14: explicit DTO sanitisation omits storage paths and arbitrary metadata', () => {
  const value = input();
  value.document.objectStorageKey = 'private-case-storage-secret'; value.document.localPath = '/private/not-for-clients/file.png';
  value.document.metadata = { storageRoot: '/private/not-for-clients' };
  field(value, 'medicine_name').metadata = { objectStorageKey: 'private-case-storage-secret' };
  field(value, 'medicine_name').resolution = { resolved: true, canonical: { genericName: 'Paracetamol', objectStorageKey: 'private-case-storage-secret' } };
  const text = JSON.stringify(build(value));
  assert.doesNotMatch(text, /objectStorageKey|localPath|storageRoot|private-case-storage-secret|not-for-clients/);
});

test('A15: changing returned nested objects cannot mutate input field resolution', () => {
  const value = input();
  field(value, 'medicine_name').resolution = { resolved: true, canonical: { genericName: 'Paracetamol', aliases: ['Example'] } };
  const before = clone(value); const output = build(value);
  output.medicineItems[0].fields.medicine_name.resolution.canonical.aliases.push('mutated');
  assert.deepEqual(value, before);
});

test('F2 provenance: a separate release_type field survives explicit grouping verbatim', () => {
  const value = input(); const release = addField(value, 'release_type', 'SR', 'release'); value.groups[0].fieldIds.push(release.id);
  const output = build(value);
  assert.equal(output.groupingStatus, 'GROUPED', 'release_type is required provenance, not invalid group membership.');
  assert.equal(output.medicineItems[0].fields.release_type.rawValue, 'SR');
});

test('F4 provenance: explicit quantity_unit, pack_size and pack_unit fields survive grouping', () => {
  const value = input('F03-01', 1, false);
  const output = build(value);
  assert.equal(output.groupingStatus, 'GROUPED', 'Do not reject explicit administrative pack information.');
  const medicine = output.medicineItems.find(item => item.anchorFieldId === value.groups[0].anchorFieldId);
  assert.equal(medicine.fields.quantity_unit.normalizedValue, 'strip');
  assert.equal(medicine.fields.pack_size.normalizedValue, '6');
  assert.equal(medicine.fields.pack_unit.normalizedValue, 'tablet');
});

test('F2 provenance: an ungrouped release attribute cannot disappear behind an apparently complete item', () => {
  const value = input(); addField(value, 'release_type', 'SR', 'unclaimed_release');
  const output = build(value);
  const preserved = output.medicineItems.some(item => item.fields.release_type);
  assert.ok(preserved || (output.groupingStatus === 'UNRESOLVED' && output.reviewRequired), 'An unclaimed release_type was silently dropped.');
});

test('A16: schema rejects UNRESOLVED outputs that claim no human review is required', () => {
  const value = input(); delete value.groups; addField(value, 'medicine_name', 'Metformin', 'schema_unresolved');
  const output = build(value); output.reviewRequired = false;
  assert.equal(validEnvelope(output), false, 'Encode the reviewRequired implication in the contract, not only implementation comments.');
});

test('A16b: schema rejects incomplete coverage with reviewRequired=false', () => {
  const output = build(input('F06-03', 1)); output.reviewRequired = false;
  assert.equal(validEnvelope(output), false, 'Noncomplete coverage must not claim no review is needed.');
});

test('correction regression: an explicit true flag survives complete human-correction metadata', () => {
  const value = input(); const strength = field(value, 'dosage_strength');
  strength.needsCorrection = true; strength.correctedBy = 'synthetic_staff';
  strength.correctedAt = '2026-11-12T00:00:00.000Z';
  const output = build(value);
  assert.equal(output.medicineItems[0].fields.dosage_strength.needsCorrection, true);
  assert.equal(output.medicineItems[0].needsCorrection, true);
  assert.equal(output.reviewRequired, true);
});

test('eight-slot regression: a complete item preserves all eight field references within the schema cap', () => {
  const value = input('F03-01', 1, false);
  const release = addField(value, 'release_type', 'SR', 'all_eight');
  value.groups[0].fieldIds.push(release.id);
  const output = build(value);
  assert.equal(output.groupingStatus, 'GROUPED');
  const medicine = output.medicineItems.find(item => item.anchorFieldId === value.groups[0].anchorFieldId);
  const expectedSlots = ['medicine_name', 'dosage_strength', 'dosage_form', 'release_type', 'quantity', 'quantity_unit', 'pack_size', 'pack_unit'];
  assert.deepEqual(Object.keys(medicine.fields).sort(), [...expectedSlots].sort());
  assert.equal(medicine.fieldIds.length, 8);
  assert.equal(new Set(medicine.fieldIds).size, 8);
  assert.deepEqual(new Set(medicine.fieldIds), new Set(Object.values(medicine.fields).map(value => value.id)));
});

test('schema regression: cleared envelopes cannot hide missing essential slots or uncertain linked fields', () => {
  const base = build(input()); assert.equal(base.reviewRequired, false);
  const missing = clone(base); missing.medicineItems[0].fields.dosage_strength = null;
  assert.equal(validEnvelope(missing), false);
  const contradictory = clone(base); contradictory.medicineItems[0].fields.dosage_strength.needsCorrection = true;
  assert.equal(validEnvelope(contradictory), false);
  const lowConfidence = clone(base); lowConfidence.medicineItems[0].fields.dosage_strength.extractionConfidence = 0.3;
  assert.equal(validEnvelope(lowConfidence), false);
});
