'use strict';
// Offline synthetic evaluation adapter. Does not load .env, touch MongoDB, call a model or change production policy.
const crypto = require('node:crypto'), path = require('node:path'), { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const { buildDocumentMedicineItems, RECOGNIZED_MEDICINE_SLOTS } = backend('./services/trustRag/medicineItemContract.js');
const { reconcileMedicineDocuments } = backend('./services/trustRag/medicineReconciliationService.js');
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const ACTOR = sha('SYNTHETIC evaluation actor').slice(0, 24);
function snapshotFromFixture(fixture) {
  const documents = fixture.documents.filter(d => ['PRESCRIPTION', 'PHARMACY_INVOICE'].includes(d.type));
  const envelopes = new Map(documents.map(document => [document.type, buildDocumentMedicineItems({ document, extractedFields: document.extractedFields,
    ...(Array.isArray(document.groups) ? { groups: document.groups } : {}) })]));
  const prescription = envelopes.get('PRESCRIPTION') || null, invoice = envelopes.get('PHARMACY_INVOICE') || null;
  const comparison = reconcileMedicineDocuments({ caseId: fixture.caseId, prescription, invoice });
  const groupingDocuments = documents.map(document => {
    const envelope = envelopes.get(document.type);
    return { documentId: document.id, documentType: document.type, processingStatus: 'PROCESSED',
      mode: envelope.groupingStatus === 'UNRESOLVED' ? 'UNCONFIRMED' : 'HUMAN_CONFIRMED',
      observedItemCount: envelope.medicineItems.length, confirmedBy: ACTOR, confirmedAt: '2026-11-16T12:00:00.000Z',
      groups: envelope.medicineItems.map(item => ({ anchorFieldId: item.anchorFieldId, fieldIds: [...item.fieldIds] })),
      fields: document.extractedFields.filter(f => RECOGNIZED_MEDICINE_SLOTS.includes(f.fieldType)).map(f => ({
        id: f.id, caseId: f.caseId, documentId: f.documentId, fieldType: f.fieldType, rawValue: f.rawValue,
        normalizedValue: f.normalizedValue, pageNumber: f.pageNumber, extractionConfidence: f.extractionConfidence,
        needsCorrection: f.needsCorrection, correctedBy: f.correctedBy ?? null, correctedAt: f.correctedAt ?? null
      })) };
  });
  const notices = fixture.documents.flatMap(document => {
    const c = document.pageCoverage;
    const complete = Number.isInteger(document.pageCount) && document.pageCount >= 1 &&
      document.processedPageCount === document.pageCount && document.omittedPageCount === 0 &&
      c?.total === document.pageCount && c?.processed === document.processedPageCount && c?.omitted === 0 && c?.status === 'COMPLETE';
    return complete ? [] : [{ code: 'PAGE_COVERAGE_INCOMPLETE', documentId: document.id, message: 'Synthetic source has incomplete, unknown or contradictory page coverage.' }];
  });
  const canVerify = notices.length === 0 && comparison.status === 'CONSISTENT' && !comparison.reviewRequired && groupingDocuments.length === 2 &&
    groupingDocuments.every(d => d.mode === 'HUMAN_CONFIRMED');
  return { schemaVersion: '2.0.0-session3', caseId: fixture.caseId, caseStatus: 'NEEDS_REVIEW', snapshotToken: 'rs_' + sha(fixture.documents),
    evidenceRevision: 1, prescription, invoice, comparison, groupingDocuments,
    permissions: { canCorrectFields: true, canConfirmGroups: true, canReview: true },
    reviewEligibility: { canVerify, blockerCodes: canVerify ? [] : ['COMPARISON_INSUFFICIENT'], allowedActions: canVerify ? ['VERIFY', 'RETURN_FOR_CORRECTION', 'ESCALATE'] : ['RETURN_FOR_CORRECTION', 'ESCALATE'] },
    notices, legacyFindingsCurrent: false };
}
function targetFromAuthoredInput(fixture, snapshot) {
  const rx = fixture.documents.find(d => d.type === 'PRESCRIPTION');
  const anchor = rx?.groups?.[0]?.anchorFieldId || rx?.extractedFields.find(f => f.fieldType === 'medicine_name')?.id;
  const item = snapshot.prescription?.medicineItems.find(i => i.anchorFieldId === anchor) || null;
  const goldPair = fixture.gold.expectedPairs.find(pair => pair.prescriptionAnchorFieldId === anchor);
  const invoiceItem = goldPair && snapshot.invoice?.medicineItems.find(i => i.anchorFieldId === goldPair.invoiceAnchorFieldId);
  const allowed = new Set(), relevant = new Set();
  for (const source of [item, invoiceItem].filter(Boolean)) {
    for (const field of Object.values(source.fields).filter(Boolean)) allowed.add(field.id);
    if (source.fields.dosage_strength) relevant.add(source.fields.dosage_strength.id);
  }
  // The target name comes from authored input, never a candidate answer.
  const name = rx?.extractedFields.find(f => f.id === anchor)?.normalizedValue || 'the selected medicine';
  return { itemId: item?.itemId || null, anchorFieldId: anchor || null, primaryFieldId: item?.fields.dosage_strength?.id || null,
    allowedFieldIds: [...allowed], relevantFieldIds: [...relevant], query: 'Compare the recorded dosage strength for ' + name + ' in this prescription and invoice.' };
}
function privateCorpus(snapshot) {
  return snapshot.groupingDocuments.flatMap(document => document.fields.map(field => ({
    id: field.id, sourceId: 'field:' + field.id, fieldId: field.id, documentId: document.documentId,
    title: document.documentType + ': ' + field.fieldType.replaceAll('_', ' '),
    excerpt: document.documentType + ' ' + field.fieldType.replaceAll('_', ' ') + ': ' + String(field.normalizedValue || field.rawValue),
    private: true, kind: 'CASE_RECORD'
  })));
}
function renderSources(sources) {
  return sources.map((source, i) => String(source.excerpt) + ' [S' + (i + 1) + ']').join('\n\n');
}
function sourceMetrics(sources, target) {
  const selected = sources.slice(0, 4), relevant = new Set(target.relevantFieldIds), allowed = new Set(target.allowedFieldIds);
  const ids = new Set(selected.map(s => s.fieldId).filter(Boolean));
  return { answered: sources.length > 0, relevantRetrieved: [...relevant].filter(id => ids.has(id)).length,
    relevantTotal: relevant.size, wrongEntityOrSource: sources.some(s => !s.fieldId || !allowed.has(s.fieldId)),
    exactRequestedReferenceFound: relevant.size > 0 && [...relevant].some(id => ids.has(id)) };
}
function counterfactual(snapshot, target, kind) {
  const current = clone(snapshot); current.evidenceRevision++; current.snapshotToken = 'rs_' + sha('SYNTHETIC revision ' + kind);
  if (kind === 'UNRELATED') return current; // Server snapshot after a non-retrieved administrative edit: only revision changes.
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value) && value.id === target.primaryFieldId && value.fieldType === 'dosage_strength') {
      value.normalizedValue = '999 mg'; value.correctedBy = ACTOR; value.correctedAt = '2026-11-16T12:00:30.000Z'; value.needsCorrection = false;
    }
    Object.values(value).forEach(walk);
  };
  walk(current);
  current.comparison = reconcileMedicineDocuments({ caseId: current.caseId, prescription: current.prescription, invoice: current.invoice });
  current.reviewEligibility.canVerify = false;
  current.reviewEligibility.blockerCodes = ['COMPARISON_INSUFFICIENT'];
  current.reviewEligibility.allowedActions = ['RETURN_FOR_CORRECTION', 'ESCALATE'];
  return current;
}
function ratio(numerator, denominator) { return { numerator, denominator, value: denominator ? numerator / denominator : null }; }
function summarize(records, variant) {
  const selected = records.map(r => r.variants[variant]);
  return { scenarios: selected.length, answered: ratio(selected.filter(r => r.metrics.answered).length, selected.length),
    requestedReferenceRecallAt4: ratio(selected.reduce((n, r) => n + r.metrics.relevantRetrieved, 0), selected.reduce((n, r) => n + r.metrics.relevantTotal, 0)),
    wrongEntityOrSourceAnswers: ratio(selected.filter(r => r.metrics.answered && r.metrics.wrongEntityOrSource).length, selected.filter(r => r.metrics.answered).length),
    localDurationMs: selected.reduce((n, r) => n + r.durationMs, 0) };
}
module.exports = { ACTOR, sha, clone, snapshotFromFixture, targetFromAuthoredInput, privateCorpus, renderSources, sourceMetrics, counterfactual, ratio, summarize };
