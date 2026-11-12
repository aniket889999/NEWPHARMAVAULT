'use strict';

// Authored UI examples, not output from the Session 2 matcher and not scored gold.
const crypto = require('node:crypto');
const { loadScenarios } = require('../foundation-v2/fixtures.cjs');
const { buildDocumentMedicineItems } = require('../../backend/services/trustRag/medicineItemContract.js');
const clone = value => JSON.parse(JSON.stringify(value));
const digest = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 24);

function envelope(document) {
  if (!document) return null;
  return buildDocumentMedicineItems({ document, extractedFields: document.extractedFields, groups: document.groups });
}

function makeExample(kind = 'consistent') {
  const scenarioIds = { consistent: 'F01-01', mismatch: 'F01-02', pack: 'F03-01', unknownPack: 'F03-02', incomplete: 'F06-03', missingInvoice: 'F01-01' };
  if (!scenarioIds[kind]) throw new Error('Unknown synthetic response example.');
  const scenario = clone(loadScenarios('development').find(value => value.id === scenarioIds[kind]));
  const prescription = envelope(scenario.documents[0]);
  const invoice = kind === 'missingInvoice' ? null : envelope(scenario.documents[1]);
  const rows = prescription.medicineItems.map((rx, index) => {
    const inv = invoice?.medicineItems[index] || null;
    const reasons = kind === 'mismatch' ? ['STRENGTH_MISMATCH'] : kind === 'unknownPack' && index === 0 ? ['UNKNOWN_PACK_SIZE'] : !inv ? ['MISSING_DOCUMENT'] : [];
    const status = kind === 'mismatch' ? 'MISMATCH' : reasons.length ? 'INSUFFICIENT_EVIDENCE' : 'CONSISTENT';
    const quantity = (kind === 'pack' || kind === 'unknownPack') ? [12, 20, 6][index] : kind === 'incomplete' ? 15 : 10;
    return {
      rowId: 'mr_' + digest(`${scenario.caseId}|${rx.itemId}|${inv?.itemId || 'missing'}`),
      prescriptionItemId: rx.itemId, invoiceItemId: inv?.itemId || null,
      genericName: rx.fields.medicine_name.normalizedValue || rx.fields.medicine_name.rawValue,
      status,
      checks: { identity: inv ? 'CONSISTENT' : 'INSUFFICIENT_EVIDENCE', strength: kind === 'mismatch' ? 'MISMATCH' : inv ? 'CONSISTENT' : 'INSUFFICIENT_EVIDENCE',
        form: inv ? 'CONSISTENT' : 'INSUFFICIENT_EVIDENCE', release: 'NOT_APPLICABLE', quantity: reasons.includes('UNKNOWN_PACK_SIZE') || !inv ? 'INSUFFICIENT_EVIDENCE' : 'CONSISTENT' },
      quantity: { prescriptionBaseQuantity: quantity, invoiceBaseQuantity: reasons.includes('UNKNOWN_PACK_SIZE') || !inv ? null : quantity, baseUnit: kind === 'incomplete' ? 'capsule' : 'tablet' },
      reasonCodes: reasons,
      evidenceReferences: [rx, inv].filter(Boolean).flatMap(item => Object.values(item.fields).filter(Boolean).map(field => ({ documentId: field.documentId, fieldId: field.id, pageNumber: field.pageNumber }))),
    };
  });
  const sourceUnknown = !invoice || prescription.reviewRequired || invoice.reviewRequired;
  const hasInsufficientEvidence = sourceUnknown || rows.some(row => row.status === 'INSUFFICIENT_EVIDENCE');
  const reasonCodes = [...new Set(rows.flatMap(row => row.reasonCodes))];
  if (kind === 'incomplete') reasonCodes.push('CONTRADICTORY_PAGE_COVERAGE');
  const result = {
    schemaVersion: '2.0.0-session2', rulesetVersion: 'academic-reconciliation/1.0.0', caseId: scenario.caseId,
    documentIds: { prescription: prescription.documentId, invoice: invoice?.documentId || null },
    status: rows.some(row => row.status === 'MISMATCH') ? 'MISMATCH' : hasInsufficientEvidence ? 'INSUFFICIENT_EVIDENCE' : 'CONSISTENT',
    reviewRequired: hasInsufficientEvidence || rows.some(row => row.status === 'MISMATCH'), humanDecisionRequired: true,
    coverage: { prescription: prescription.coverage.status, invoice: invoice?.coverage.status || 'MISSING' },
    hasInsufficientEvidence, reasonCodes, rows,
    summary: { consistent: rows.filter(row => row.status === 'CONSISTENT').length, mismatch: rows.filter(row => row.status === 'MISMATCH').length, insufficientEvidence: rows.filter(row => row.status === 'INSUFFICIENT_EVIDENCE').length },
  };
  return { expectedCaseId: scenario.caseId, prescription, invoice, result };
}

module.exports = { makeExample };
