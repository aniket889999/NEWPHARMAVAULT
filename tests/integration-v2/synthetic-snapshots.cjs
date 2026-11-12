'use strict';
// Authored client responses only. Not backend, OCR, clinical or held-out evaluation scores.
const { makeExample } = require('../reconciliation-v2/synthetic-response-examples.cjs');
const ACTOR = 'a'.repeat(24);
const TOKEN = 'rs_' + 'a'.repeat(64);
const clone = value => JSON.parse(JSON.stringify(value));
function makeSnapshot(kind = 'consistent') {
  const example = makeExample(kind);
  const groupingDocuments = [example.prescription, example.invoice].filter(Boolean).map(envelope => ({
    documentId: envelope.documentId, documentType: envelope.documentType, processingStatus: 'PROCESSED',
    mode: 'HUMAN_CONFIRMED', observedItemCount: envelope.medicineItems.length, confirmedBy: ACTOR, confirmedAt: '2026-11-12T08:00:00.000Z',
    groups: envelope.medicineItems.map(item => ({ anchorFieldId: item.anchorFieldId, fieldIds: clone(item.fieldIds) })),
    fields: envelope.medicineItems.flatMap(item => Object.values(item.fields).filter(Boolean).map(field => ({
      id: field.id, caseId: field.caseId, documentId: field.documentId, fieldType: field.fieldType,
      rawValue: field.rawValue, normalizedValue: field.normalizedValue, pageNumber: field.pageNumber,
      extractionConfidence: field.extractionConfidence, needsCorrection: field.needsCorrection, correctedBy: field.correctedBy, correctedAt: field.correctedAt,
    }))),
  }));
  const canVerify = kind === 'consistent' || kind === 'pack';
  return { schemaVersion: '2.0.0-session3', caseId: example.expectedCaseId, caseStatus: 'NEEDS_REVIEW',
    snapshotToken: TOKEN, evidenceRevision: 2, prescription: example.prescription, invoice: example.invoice, comparison: example.result,
    groupingDocuments, permissions: { canCorrectFields: true, canConfirmGroups: true, canReview: true },
    reviewEligibility: { canVerify, blockerCodes: canVerify ? [] : [kind === 'mismatch' ? 'COMPARISON_MISMATCH' : 'COMPARISON_INSUFFICIENT'], allowedActions: canVerify ? ['VERIFY', 'RETURN_FOR_CORRECTION', 'ESCALATE'] : ['RETURN_FOR_CORRECTION', 'ESCALATE'] },
    notices: [], legacyFindingsCurrent: false };
}
function documentMetadata(snapshot) {
  return snapshot.groupingDocuments.map(doc => ({ id: doc.documentId, caseId: snapshot.caseId, type: doc.documentType,
    originalFilename: 'SYNTHETIC-DEMO-ONLY.pdf', mimeType: 'application/pdf', pageCount: 3,
    processingStatus: 'PROCESSED', pageCoverage: { total: 3, processed: 3, omitted: 0, status: 'COMPLETE' } }));
}
module.exports = { makeSnapshot, documentMetadata, clone, TOKEN, ACTOR };
