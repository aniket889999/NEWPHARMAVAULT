'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createRequire } = Module;
const esbuild = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Ajv2020 = createRequire(require.resolve('ajv-cli/package.json'))('ajv/dist/2020');
const { makeExample } = require('./synthetic-response-examples.cjs');

function load(entry) {
  const result = esbuild.buildSync({ entryPoints: [path.resolve(__dirname, '../../src/modules/verification/reconciliation', entry)], bundle: true,
    write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react-dom'], logLevel: 'silent' });
  const loaded = new Module(path.join(__dirname, 'in-memory-consumer.cjs'), module);
  loaded.filename = path.join(__dirname, 'in-memory-consumer.cjs'); loaded.paths = module.paths;
  loaded._compile(result.outputFiles[0].text, loaded.filename); return loaded.exports;
}
const { createComparisonView } = load('comparisonViewModel.ts');
const { MedicineComparisonPanel } = load('MedicineComparisonPanel.tsx');
const contract = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../contracts/schemas/medicine-reconciliation.schema.json'), 'utf8'));
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(contract);
const clone = value => JSON.parse(JSON.stringify(value));
const html = props => renderToStaticMarkup(React.createElement(MedicineComparisonPanel, props));

for (const kind of ['consistent', 'mismatch', 'pack', 'unknownPack', 'incomplete', 'missingInvoice']) test(`schema-valid synthetic consumer example: ${kind} (not a backend score)`, () => {
  const example = makeExample(kind);
  assert.equal(validate(example.result), true, JSON.stringify(validate.errors));
  const view = createComparisonView(example); assert.equal(view.state, 'ready');
  assert.equal(view.rows.length, example.result.rows.length);
});

test('consumer leaves result/input objects unchanged', () => {
  const example = makeExample('pack'); const before = clone(example);
  assert.equal(createComparisonView(example).state, 'ready'); assert.deepEqual(example, before);
});

test('missing result is empty, not a fabricated all-clear', () => {
  const example = makeExample(); example.result = null;
  assert.equal(createComparisonView(example).state, 'empty');
  const rendered = html(example); assert.match(rendered, /has not been loaded/); assert.doesNotMatch(rendered, /Checked fields agree/);
});

for (const [label, mutate] of [
  ['wrong selected case', value => { value.expectedCaseId = 'other_case'; }],
  ['wrong result case', value => { value.result.caseId = 'other_case'; }],
  ['wrong source case', value => { value.invoice.caseId = 'other_case'; }],
  ['wrong source document', value => { value.result.documentIds.invoice = 'other_document'; }],
  ['foreign linked field', value => { value.invoice.medicineItems[0].fields.quantity.documentId = 'other_document'; }],
  ['wrong source page', value => { value.result.rows[0].evidenceReferences[0].pageNumber = 99; }],
  ['foreign evidence', value => { value.result.rows[0].evidenceReferences[0].fieldId = 'foreign_field'; }],
  ['duplicated evidence', value => { value.result.rows[0].evidenceReferences.push(clone(value.result.rows[0].evidenceReferences[0])); }],
  ['unexpected storage field', value => { value.result.objectStorageKey = '/private/example'; }],
  ['unknown schema version', value => { value.result.schemaVersion = 'unreviewed-version'; }],
  ['unknown rule reason', value => { value.result.reasonCodes = ['CLAIM_APPROVED']; }],
  ['human boundary removed', value => { value.result.humanDecisionRequired = false; }],
  ['invalid aggregate count', value => { value.result.summary.consistent = 6; }],
  ['missing source item row', value => { value.result.rows = []; value.result.summary.consistent = 0; }],
  ['duplicate assignment', value => { const duplicate = clone(value.result.rows[0]); duplicate.rowId = 'mr_aaaaaaaaaaaaaaaaaaaaaaaa'; value.result.rows.push(duplicate); value.result.summary.consistent = 2; }],
  ['mismatched coverage', value => { value.result.coverage.invoice = 'INCOMPLETE'; }],
  ['invalid quantity', value => { value.result.rows[0].quantity.invoiceBaseQuantity = Infinity; }],
  ['unlabelled base quantities', value => { value.result.rows[0].quantity.baseUnit = null; }],
  ['storage metadata on a source envelope', value => { value.prescription.objectStorageKey = 'private-storage-value'; }],
  ['unacknowledged source issue', value => { value.prescription.issueCodes = ['FIELD_NEEDS_CORRECTION']; }],
  ['contradictory reported coverage', value => { value.invoice.coverage.reportedStatus = 'INCOMPLETE'; }],
]) test(`rejects ${label} without showing a plausible comparison`, () => {
  const example = makeExample(); mutate(example);
  assert.equal(createComparisonView(example).state, 'invalid');
  assert.doesNotMatch(html(example), /Checked fields agree|Medicine comparison 1/);
});

test('reasons cannot be removed from the aggregate while remaining on a row', () => {
  const example = makeExample('mismatch'); example.result.reasonCodes = [];
  assert.equal(createComparisonView(example).state, 'invalid');
});

test('a real field from the wrong medicine in the same case is not valid evidence for this row', () => {
  const example = makeExample('pack');
  example.result.rows[0].evidenceReferences[0] = clone(example.result.rows[1].evidenceReferences[0]);
  assert.equal(createComparisonView(example).state, 'invalid');
});

test('a multi-item result cannot silently omit an observed medicine pair', () => {
  const example = makeExample('pack'); example.result.rows.pop(); example.result.summary.consistent--;
  assert.equal(createComparisonView(example).state, 'invalid');
});

test('confirmed mismatch and uncertainty are displayed together', () => {
  const example = makeExample('mismatch'); example.invoice.coverage.status = 'INCOMPLETE';
  example.invoice.coverage.isComplete = false; example.invoice.coverage.total = 2; example.invoice.coverage.omitted = 1; example.invoice.coverage.reportedStatus = 'INCOMPLETE';
  example.invoice.reviewRequired = true; example.result.coverage.invoice = 'INCOMPLETE';
  example.result.hasInsufficientEvidence = true; example.result.reasonCodes.push('INCOMPLETE_PAGE_COVERAGE');
  assert.equal(createComparisonView(example).state, 'ready');
  const rendered = html(example); assert.match(rendered, /Difference found/); assert.match(rendered, /Evidence is incomplete or uncertain/); assert.match(rendered, /500 mg/); assert.match(rendered, /650 mg/);
});

test('source uncertainty cannot be hidden behind a consistent result', () => {
  const example = makeExample(); example.prescription.reviewRequired = true;
  assert.equal(createComparisonView(example).state, 'invalid');
});

test('preview and human decision boundaries remain visible with no approval button', () => {
  const rendered = html({ ...makeExample(), syntheticPreview: true });
  assert.match(rendered, /SYNTHETIC PREVIEW/); assert.match(rendered, /not connected to the case API/);
  assert.match(rendered, /authorised human makes the final review decision/); assert.match(rendered, /not medical advice/);
  assert.doesNotMatch(rendered, /<button[^>]*>[^<]*(Approve|Verify|Reject)/);
});

test('loading suppresses stale result details and evidence actions', () => {
  const rendered = html({ ...makeExample('mismatch'), loading: true, onInspectEvidence: () => {} });
  assert.match(rendered, /Loading current comparison/); assert.doesNotMatch(rendered, /500 mg|650 mg|Difference found|<button/);
});

test('source values are escaped, never rendered as document-supplied HTML', () => {
  const example = makeExample(); example.prescription.medicineItems[0].fields.medicine_name.normalizedValue = '<script>alert(1)</script>';
  const rendered = html(example); assert.doesNotMatch(rendered, /<script>/); assert.match(rendered, /&lt;script&gt;/);
});

test('evidence controls use a callback, never storage/URL links', () => {
  const rendered = html({ ...makeExample(), onInspectEvidence: () => {} });
  assert.match(rendered, /<button/); assert.match(rendered, /Prescription · Strength · p\. 1/);
  assert.doesNotMatch(rendered, /href=|objectStorageKey|file:\/\/|javascript:/);
});

test('schema rejects an all-clear with missing documents or human review disabled', () => {
  const example = makeExample('missingInvoice'); example.result.status = 'CONSISTENT';
  assert.equal(validate(example.result), false);
  const second = makeExample(); second.result.humanDecisionRequired = false;
  assert.equal(validate(second.result), false);
});
