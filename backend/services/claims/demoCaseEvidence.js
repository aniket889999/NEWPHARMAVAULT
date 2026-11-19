'use strict';
/**
 * Demo-only: gives the seeded, pharmacist-VERIFIED showcase cases real evidence
 * (synthetic prescription + invoice images, extracted fields, consistency checks,
 * risk signals and the pharmacist's decision) so an insurer reviewing a demo claim
 * sees what a real verified case contains. Runs only from seed scripts.
 * Idempotent: a case that already has documents is left as it is.
 */
const fs = require('node:fs');
const path = require('node:path');
const Document = require('../../models/documentModel');
const ExtractedField = require('../../models/extractedFieldModel');
const ConsistencyCheck = require('../../models/consistencyCheckModel');
const RiskSignal = require('../../models/riskSignalModel');
const ReviewDecision = require('../../models/reviewDecisionModel');
const storageService = require('../trustRag/storageService');
const { computeDocumentFieldSetFingerprint } = require('../trustRag/caseReconciliationService');
const { buildDocumentMedicineItems } = require('../trustRag/medicineItemContract');

const DOC_DIR = path.join(__dirname, '..', '..', 'data', 'demo-documents');

const CASES = {
  'PV-DEMO-ANANYA-001': {
    prescription: { file: 'ananya-001-prescription.png', fields: [
      ['patient_name', 'Ananya Verma', 0.94], ['prescriber_name', 'Dr. Ramesh Kulkarni, MD', 0.92], ['prescription_date', '2026-11-12', 0.9],
      ['medicine_name', 'Dolo 650', 0.95, 'rx-1'], ['dosage_strength', '650 mg', 0.93, 'rx-1'], ['dosage_form', 'Tablet', 0.96, 'rx-1'],
      ['medicine_name', 'Azithromycin', 0.94, 'rx-2'], ['dosage_strength', '500 mg', 0.92, 'rx-2'], ['dosage_form', 'Tablet', 0.95, 'rx-2']
    ] },
    invoice: { file: 'ananya-001-invoice.png', fields: [
      ['pharmacy_name', 'Demo Dispensary - Camp, Pune', 0.93], ['invoice_date', '2026-11-12', 0.91],
      ['medicine_name', 'Dolo 650 mg Tablet', 0.95, 'inv-1'], ['dosage_strength', '650 mg', 0.94, 'inv-1'], ['dosage_form', 'Tablet', 0.95, 'inv-1'],
      ['medicine_name', 'Azithromycin 500 mg Tablet', 0.93, 'inv-2'], ['dosage_strength', '500 mg', 0.93, 'inv-2'], ['dosage_form', 'Tablet', 0.94, 'inv-2'],
      ['total_amount', '139.50', 0.97]
    ] },
    checks: [
      ['MEDICINE_NAME_CONSISTENCY', 'PASS', 'INFO', 'Both prescribed medicines appear on the invoice.'],
      ['DOSAGE_STRENGTH_CONSISTENCY', 'PASS', 'INFO', 'Strengths match: Dolo 650 mg and Azithromycin 500 mg.'],
      ['DOSAGE_FORM_CONSISTENCY', 'PASS', 'INFO', 'Tablet on both documents.'],
      ['QUANTITY_CONSISTENCY', 'PASS', 'INFO', '10 + 3 tablets prescribed; 10 + 3 billed.'],
      ['DATE_SEQUENCE_CONSISTENCY', 'PASS', 'INFO', 'Invoice dated the same day as the prescription.']
    ],
    signals: [],
    review: ['APPROVE', 'EVIDENCE_CONSISTENT', 'Checked prescription against invoice: medicines, strengths, form and quantities match. Verified.']
  },
  'PV-DEMO-ANANYA-002': {
    prescription: { file: 'ananya-002-prescription.png', fields: [
      ['patient_name', 'Ananya Verma', 0.93], ['prescriber_name', 'Dr. Meera Shah, MD', 0.91], ['prescription_date', '2026-11-03', 0.9],
      ['medicine_name', 'Pantoprazole', 0.94, 'rx-1'], ['dosage_strength', '40 mg', 0.93, 'rx-1'], ['dosage_form', 'Tablet', 0.95, 'rx-1']
    ] },
    invoice: { file: 'ananya-002-invoice.png', fields: [
      ['pharmacy_name', 'Demo Dispensary - Camp, Pune', 0.92], ['invoice_date', '2026-11-04', 0.62, null, true],
      ['medicine_name', 'Pantoprazole 40 mg Tablet', 0.94, 'inv-1'], ['dosage_strength', '40 mg', 0.93, 'inv-1'], ['dosage_form', 'Tablet', 0.95, 'inv-1'],
      ['total_amount', '230.00', 0.96]
    ] },
    checks: [
      ['MEDICINE_NAME_CONSISTENCY', 'PASS', 'INFO', 'Pantoprazole appears on both documents.'],
      ['DOSAGE_STRENGTH_CONSISTENCY', 'PASS', 'INFO', 'Strength matches: 40 mg.'],
      ['QUANTITY_CONSISTENCY', 'PASS', 'INFO', '30 tablets prescribed; 2 strips of 15 billed.'],
      ['DATE_SEQUENCE_CONSISTENCY', 'PASS', 'LOW', 'Invoice dated one day after the prescription.']
    ],
    signals: [['LOW_OCR_CONFIDENCE', 'LOW', 'Invoice date was read with low confidence (62%) and confirmed by the claimant.', 'FIELD_CONFIDENCE_MONITOR']],
    review: ['APPROVE', 'EVIDENCE_CONSISTENT', 'Invoice date confirmed by the claimant; medicine, strength and quantity match the prescription. Verified.']
  }
};

async function storeImage(caseId, file, uploadedBy, type) {
  const buf = fs.readFileSync(path.join(DOC_DIR, file));
  const stored = await storageService.storeDocument({ caseId: String(caseId), filename: file, content: `data:image/png;base64,${buf.toString('base64')}`, mimeType: 'image/png' });
  return Document.create({
    caseId, type, objectStorageKey: stored.objectStorageKey, originalFilename: file, mimeType: 'image/png',
    sizeBytes: stored.sizeBytes, sha256: stored.sha256, pageCount: 1, processedPageCount: 1, omittedPageCount: 0,
    pageCoverage: { total: 1, processed: 1, omitted: 0, status: 'COMPLETE' },
    uploadStatus: 'COMPLETED', processingStatus: 'PROCESSED', uploadedBy
  });
}

/**
 * The case is pharmacist-VERIFIED, so its medicine grouping was confirmed by that pharmacist.
 * Store it exactly as the medicine-groups endpoint does, but only when the shared validator
 * accepts it (otherwise the reconciliation keeps its auto-proposed grouping).
 */
async function confirmGrouping(doc, caseIdStr, pharmacistId) {
  const docFields = await ExtractedField.find({ caseId: doc.caseId, documentId: doc._id }).sort({ pageNumber: 1, _id: 1 });
  const rowKeys = [...new Set(docFields.map((f) => f.candidateRowKey).filter(Boolean))];
  const groups = rowKeys.map((key) => {
    const fields = docFields.filter((f) => f.candidateRowKey === key);
    const anchor = fields.find((f) => f.fieldType === 'medicine_name');
    return anchor ? { anchorFieldId: String(anchor._id), fieldIds: fields.map((f) => String(f._id)) } : null;
  }).filter(Boolean);
  if (!groups.length) return false;
  const envelope = buildDocumentMedicineItems({ document: doc, extractedFields: docFields, groups });
  if (envelope.groupingStatus !== 'GROUPED' || envelope.medicineItems.length !== groups.length) return false;
  doc.metadata = {
    ...(doc.metadata || {}),
    medicineGrouping: {
      mode: 'HUMAN_CONFIRMED', observedItemCount: groups.length, completenessAttested: true, groups,
      confirmedBy: String(pharmacistId), confirmedAt: new Date().toISOString(),
      fieldSetFingerprint: computeDocumentFieldSetFingerprint(doc, docFields, caseIdStr)
    }
  };
  doc.markModified('metadata');
  await doc.save();
  return true;
}

async function seedDemoCaseEvidence(vCase, { claimantId, pharmacistId }) {
  const spec = CASES[vCase.caseReference];
  if (!spec) return false;
  if (await Document.exists({ caseId: vCase._id })) return false;
  const caseId = vCase._id;
  const rx = await storeImage(caseId, spec.prescription.file, claimantId, 'PRESCRIPTION');
  const inv = await storeImage(caseId, spec.invoice.file, claimantId, 'PHARMACY_INVOICE');
  const rows = [];
  for (const [doc, def] of [[rx, spec.prescription], [inv, spec.invoice]]) {
    for (const [fieldType, value, conf, rowKey, corrected] of def.fields) {
      rows.push({
        caseId, documentId: doc._id, fieldType, rawValue: value, normalizedValue: value, pageNumber: 1,
        extractionMethod: 'DETERMINISTIC_PROTOTYPE', extractionConfidence: conf, candidateRowKey: rowKey || null,
        needsCorrection: false, ...(corrected ? { correctedBy: claimantId, correctedAt: new Date() } : {})
      });
    }
  }
  await ExtractedField.insertMany(rows);
  if (pharmacistId) {
    for (const doc of [rx, inv]) await confirmGrouping(doc, String(caseId), pharmacistId);
  }
  await ConsistencyCheck.insertMany(spec.checks.map(([checkType, status, severity, message]) => ({ caseId, checkType, status, severity, message, rulesetVersion: '2.0', reviewRequired: false })));
  if (spec.signals.length) {
    await RiskSignal.insertMany(spec.signals.map(([signalType, severity, description, detectedBy]) => ({ caseId, signalType, severity, description, detectedBy, rulesetVersion: '2.0', reviewRequired: false })));
  }
  if (pharmacistId) {
    const [decision, reasonCode, notes] = spec.review;
    await ReviewDecision.create({ caseId, reviewerId: pharmacistId, decision, reasonCode, notes });
  }
  return true;
}

module.exports = { seedDemoCaseEvidence };
