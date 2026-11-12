'use strict';

// Offline structured gold fixtures, not OCR output, clinical records or a matcher.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LABEL = 'SYNTHETIC — DEMO ONLY';
const FIXTURE_VERSION = 'foundation-v2-fixtures/1.0.0';
const clone = value => JSON.parse(JSON.stringify(value));
const id = (...parts) => crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
const slotMap = { name: 'medicine_name', strength: 'dosage_strength', form: 'dosage_form',
  releaseType: 'release_type', quantity: 'quantity', unit: 'quantity_unit', packSize: 'pack_size', packUnit: 'pack_unit' };
const fieldId = (family, side, key, property) => id(family, side, key, slotMap[property] || property);

function readManifest(split) {
  if (!['development', 'heldout'].includes(split)) throw new Error('Explicit development or heldout split required.');
  return JSON.parse(fs.readFileSync(path.join(__dirname, `${split}.manifest.json`), 'utf8'));
}

function makeDocument(family, side, items) {
  const document = { id: id(family.id, side), caseId: id(family.id, 'case'),
    type: side === 'rx' ? 'PRESCRIPTION' : 'PHARMACY_INVOICE', synthetic: true, label: LABEL,
    pageCount: 1, processedPageCount: 1, omittedPageCount: 0,
    pageCoverage: { total: 1, processed: 1, omitted: 0, status: 'COMPLETE' }, sourceRevision: 'r1',
    sourceText: `${LABEL}\nFictional family ${family.id}; ${side === 'rx' ? 'prescription' : 'invoice'} comparison template.\n` +
      items.map(item => [item.name, item.strength, item.form, item.releaseType, `${item.quantity} ${item.unit}`,
        item.packSize === undefined ? null : `Pack size: ${item.packSize} ${item.packUnit}`].filter(Boolean).join(' | ')).join('\n'),
    extractedFields: [], groups: family.legacy ? null : [] };
  for (const item of items) {
    const members = [];
    for (const [property, type] of Object.entries(slotMap)) {
      if (item[property] === undefined || item[property] === null) continue;
      const field = { id: fieldId(family.id, side, item.key, property), caseId: document.caseId,
        documentId: document.id, fixtureLineKey: item.key, fieldType: type,
        rawValue: String(item[property]), normalizedValue: String(item[property]), pageNumber: 1,
        extractionMethod: 'SYNTHETIC_GOLD', extractionConfidence: 0.9, needsCorrection: false,
        correctedBy: null, correctedAt: null };
      document.extractedFields.push(field); members.push(field.id);
    }
    if (document.groups) document.groups.push({ anchorFieldId: fieldId(family.id, side, item.key, 'name'), fieldIds: members });
  }
  return document;
}

function findField(document, type, key = 'A') {
  const result = document.extractedFields.find(field => field.fieldType === type && field.fixtureLineKey === key);
  if (!result) throw new Error(`Fixture references absent ${type} on ${key}.`);
  return result;
}

function omitField(document, type, key = 'A') {
  const removed = findField(document, type, key).id;
  document.extractedFields = document.extractedFields.filter(field => field.id !== removed);
  for (const group of document.groups || []) group.fieldIds = group.fieldIds.filter(member => member !== removed);
}

function applyEffect(family, spec, rxItems, invoiceItems) {
  const target = spec.target || 'A';
  const invoice = invoiceItems.find(item => item.key === target);
  switch (spec.effect) {
    case 'STRENGTH_CONFLICT': invoice.strength = spec.value; break;
    case 'MISSING_QUANTITY': delete invoice.quantity; break;
    case 'REORDER': invoiceItems.reverse(); break;
    case 'MISSING_ITEM': invoiceItems.splice(invoiceItems.findIndex(item => item.key === target), 1); break;
    case 'EXTRA_ITEM': invoiceItems.push(clone(spec.item)); break;
    case 'UNKNOWN_PACK': delete invoice.packSize; break;
    case 'PACK_COUNT_CONFLICT': invoice.packSize = spec.value; break;
    case 'MISSING_FORM': delete invoice.form; break;
    case 'RELEASE_CONFLICT': invoice.releaseType = spec.value; break;
    case 'MISSING_RELEASE': delete invoice.releaseType; break;
    case 'FORM_CONFLICT': invoice.form = spec.value; break;
    case 'MISSING_STRENGTH': delete invoice.strength; break;
    case 'FOUR_GROUPS':
      for (const key of ['B', 'C', 'D']) invoiceItems.push({ key, name: `TEST-DRUG-${key}`, strength: '1 mg', form: 'tablet', quantity: 1, unit: 'tablet' });
      break;
    case 'TWO_CONFLICTS': invoiceItems[0].strength = spec.strength; invoiceItems[1].quantity = spec.quantity; break;
    case 'INCOMPATIBLE_UNIT': invoice.unit = spec.value; break;
    default: break; // Other controlled effects change coverage/field state below.
  }
  return { rxItems, invoiceItems };
}

function materialize(family, spec, split) {
  const rxItems = clone(family.items);
  const invoiceItems = family.items.map(item => ({ ...clone(item), ...clone(family.invoiceOverrides?.[item.key] || {}) }));
  applyEffect(family, spec, rxItems, invoiceItems);
  const rx = makeDocument(family, 'rx', rxItems);
  const invoice = makeDocument(family, 'invoice', invoiceItems);
  const documents = [rx, invoice];
  const context = { previousDocuments: null, dependencyFieldIds: [], distractor: null };

  switch (spec.effect) {
    case 'LOW_CONFIDENCE': {
      const field = findField(invoice, 'dosage_strength');
      field.extractionConfidence = 0.3; field.needsCorrection = true;
      break;
    }
    case 'CONTRADICTORY_COVERAGE':
      invoice.pageCount = 3; invoice.processedPageCount = 1; invoice.omittedPageCount = 2;
      invoice.pageCoverage = { total: 3, processed: 1, omitted: 2, status: 'COMPLETE' };
      break;
    case 'UNKNOWN_COVERAGE':
      for (const key of ['pageCount', 'processedPageCount', 'omittedPageCount', 'pageCoverage']) delete invoice[key];
      break;
    case 'OMITTED_ITEM_PAGE': {
      const removed = new Set(invoice.extractedFields.filter(field => field.fixtureLineKey === spec.target).map(field => field.id));
      invoice.extractedFields = invoice.extractedFields.filter(field => !removed.has(field.id));
      invoice.groups = invoice.groups.filter(group => !removed.has(group.anchorFieldId));
      invoice.pageCount = 5; invoice.processedPageCount = 3; invoice.omittedPageCount = 2;
      invoice.pageCoverage = { total: 5, processed: 3, omitted: 2, status: 'INCOMPLETE' };
      invoice.sourceText += '\n[Fixture oracle note: final item exists on omitted page 5; no extracted fields from that page are supplied.]';
      break;
    }
    case 'MISSING_INVOICE': documents.pop(); break;
    case 'DUPLICATE_LEGACY_NAME': {
      const duplicate = clone(findField(invoice, 'medicine_name'));
      duplicate.id = id(family.id, 'invoice', 'unassigned-second-name');
      duplicate.rawValue = duplicate.normalizedValue = 'TEST-DRUG-UNASSIGNED';
      delete duplicate.fixtureLineKey;
      invoice.extractedFields.push(duplicate);
      break;
    }
    case 'CLAIM_WITHOUT_MEDICINES': {
      const claim = makeDocument(family, 'claim', []);
      claim.type = 'CLAIM_FORM'; claim.groups = [];
      claim.sourceText = `${LABEL}\nFictional claim reference: DEMO-${family.id}. No medicine lines stated.`;
      claim.extractedFields = [{ id: id(family.id, 'claim', 'reference'), caseId: claim.caseId, documentId: claim.id,
        fieldType: 'claim_reference', rawValue: `DEMO-${family.id}`, normalizedValue: `DEMO-${family.id}`,
        pageNumber: 1, extractionMethod: 'SYNTHETIC_GOLD', extractionConfidence: 0.9, needsCorrection: false }];
      documents.push(claim); break;
    }
    case 'WRONG_ITEM_EVIDENCE':
      context.distractor = { id: id(family.id, 'distractor'), sourceType: 'SYNTHETIC_PUBLIC_REFERENCE',
        medicineName: 'Metformin', text: `${LABEL}: this fictional passage concerns Metformin, not Cetirizine.` };
      break;
    case 'CORRECT_STRENGTH':
    case 'CORRECT_QUANTITY': {
      const type = spec.effect === 'CORRECT_STRENGTH' ? 'dosage_strength' : 'quantity';
      const current = findField(invoice, type);
      const correctedValue = current.normalizedValue;
      context.previousDocuments = clone(documents);
      const previous = findField(context.previousDocuments[1], type);
      previous.rawValue = previous.normalizedValue = String(spec.previousValue);
      previous.extractionConfidence = 0.3; previous.needsCorrection = true;
      current.rawValue = String(spec.previousValue); current.normalizedValue = correctedValue;
      current.correctedBy = id('synthetic-reviewer'); current.correctedAt = '2026-11-09T00:00:00.000Z';
      invoice.sourceRevision = 'r2'; context.dependencyFieldIds = [current.id];
      break;
    }
    case 'UNRELATED_EDIT': {
      rx.extractedFields.push({ id: id(family.id, 'rx', 'review-note'), caseId: rx.caseId, documentId: rx.id,
        fieldType: 'administrative_note', rawValue: 'DEMO note one', normalizedValue: 'DEMO note one',
        pageNumber: 1, extractionMethod: 'SYNTHETIC_GOLD', extractionConfidence: 0.9, needsCorrection: false });
      context.previousDocuments = clone(documents);
      const note = rx.extractedFields.find(field => field.fieldType === 'administrative_note');
      note.rawValue = note.normalizedValue = 'DEMO note two';
      rx.sourceRevision = 'r2';
      context.dependencyFieldIds = [findField(invoice, 'dosage_strength').id];
      break;
    }
    default: break;
  }

  const missing = spec.expected.missingInvoiceKeys || [];
  const unobserved = spec.expected.unobservedInvoiceKeys || [];
  const expectedPairs = spec.expected.noAssignedPairs ? [] : family.items
    .filter(item => !missing.includes(item.key) && !unobserved.includes(item.key))
    .map(item => ({ prescriptionAnchorFieldId: fieldId(family.id, 'rx', item.key, 'name'),
      invoiceAnchorFieldId: fieldId(family.id, 'invoice', item.key, 'name'),
      status: spec.expected.pairOverrides?.[item.key] || 'CONSISTENT' }));
  return { fixtureVersion: FIXTURE_VERSION, id: spec.id, familyId: family.id, split, synthetic: true, label: LABEL,
    effect: spec.effect, caseId: id(family.id, 'case'), documents, context,
    gold: { ...clone(spec.expected), expectedPairs,
      answerAction: spec.expected.overall === 'INSUFFICIENT_EVIDENCE' ? 'REQUEST_EVIDENCE' : 'EXPLAIN_WITH_EVIDENCE',
      humanDecisionRequired: true } };
}

function loadScenarios(split = 'development') {
  const manifest = readManifest(split);
  return manifest.families.flatMap(family => family.scenarios.map(spec => materialize(family, spec, split)));
}

module.exports = { LABEL, FIXTURE_VERSION, readManifest, loadScenarios, materialize, fieldId };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && !args[0].startsWith('--split='))) {
    process.stderr.write('Usage: node tests/foundation-v2/fixtures.cjs [--split=development|heldout]\n');
    process.exitCode = 1;
  } else {
    const split = args[0]?.slice('--split='.length) || 'development';
    try { process.stdout.write(JSON.stringify(loadScenarios(split), null, 2) + '\n'); }
    catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
  }
}
