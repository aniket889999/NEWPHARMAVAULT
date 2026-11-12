export const COMPARISON_STATUSES = ['CONSISTENT', 'MISMATCH', 'INSUFFICIENT_EVIDENCE'] as const;
export type ComparisonStatus = typeof COMPARISON_STATUSES[number];
export type CheckStatus = ComparisonStatus | 'NOT_APPLICABLE';
export type CoverageStatus = 'COMPLETE' | 'INCOMPLETE' | 'UNKNOWN' | 'CONTRADICTORY';
export type BaseUnit = 'tablet' | 'capsule' | 'mL';
export const MEDICINE_SLOTS = ['medicine_name', 'dosage_strength', 'dosage_form', 'release_type', 'quantity', 'quantity_unit', 'pack_size', 'pack_unit'] as const;
export type MedicineSlot = typeof MEDICINE_SLOTS[number];
export const REASON_CODES = [
  'MISSING_DOCUMENT', 'UNRESOLVED_GROUPING', 'ITEM_LIMIT_EXCEEDED', 'INCOMPLETE_PAGE_COVERAGE',
  'UNKNOWN_PAGE_COVERAGE', 'CONTRADICTORY_PAGE_COVERAGE', 'FIELD_NEEDS_CORRECTION',
  'UNKNOWN_MEDICINE', 'AMBIGUOUS_MEDICINE', 'IDENTITY_ATTRIBUTE_CONFLICT', 'AMBIGUOUS_MATCH',
  'MISSING_INVOICE_ITEM', 'EXTRA_INVOICE_ITEM', 'STRENGTH_MISMATCH', 'DOSAGE_FORM_MISMATCH',
  'RELEASE_TYPE_MISMATCH', 'QUANTITY_MISMATCH', 'MISSING_STRENGTH', 'MISSING_DOSAGE_FORM',
  'MISSING_RELEASE_TYPE', 'MISSING_QUANTITY', 'UNKNOWN_QUANTITY_UNIT', 'UNKNOWN_PACK_SIZE',
  'INCOMPATIBLE_QUANTITY_UNITS', 'INVALID_QUANTITY', 'UNSUPPORTED_STRENGTH_FORMAT', 'UNSUPPORTED_PRODUCT_TYPE',
] as const;
export type ReconciliationReason = typeof REASON_CODES[number];

export interface LinkedMedicineField {
  id: string; caseId: string; documentId: string; fieldType: MedicineSlot;
  rawValue: string; normalizedValue: string; pageNumber: number;
  extractionConfidence: number; needsCorrection: boolean;
  correctedBy: string | null; correctedAt: string | null;
  boundingBox: [number, number, number, number] | null;
  extractionMethod: string | null;
  resolution: unknown;
}
export interface MedicineItem {
  itemId: string; caseId: string; documentId: string;
  documentType: 'PRESCRIPTION' | 'PHARMACY_INVOICE';
  groupingMode: 'GROUPED' | 'LEGACY_SINGLE_ITEM';
  anchorFieldId: string; fieldIds: string[]; pageNumbers: number[]; needsCorrection: boolean;
  fields: Record<MedicineSlot, LinkedMedicineField | null> & { medicine_name: LinkedMedicineField };
}
export interface MedicineItemsEnvelope {
  schemaVersion: '2.0.0-session1'; caseId: string; documentId: string;
  documentType: 'PRESCRIPTION' | 'PHARMACY_INVOICE';
  groupingStatus: 'GROUPED' | 'LEGACY_SINGLE_ITEM' | 'UNRESOLVED';
  detectedGroupCount: number; maxAllowedItems: 3; reviewRequired: boolean;
  coverage: { status: CoverageStatus; isComplete: boolean; total: number | null; processed: number | null; omitted: number | null; reportedStatus: 'COMPLETE' | 'INCOMPLETE' | null };
  medicineItems: MedicineItem[];
  issues: { code: string; severity: 'INFO' | 'WARNING' | 'ERROR'; message: string; fieldIds: string[] }[];
  issueCodes: string[];
}
export interface EvidenceReference { documentId: string; fieldId: string; pageNumber: number }
export interface ReconciliationRow {
  rowId: string; prescriptionItemId: string | null; invoiceItemId: string | null;
  genericName: string | null; status: ComparisonStatus;
  checks: Record<'identity' | 'strength' | 'form' | 'release' | 'quantity', CheckStatus>;
  quantity: { prescriptionBaseQuantity: number | null; invoiceBaseQuantity: number | null; baseUnit: BaseUnit | null };
  reasonCodes: ReconciliationReason[]; evidenceReferences: EvidenceReference[];
}
export interface ReconciliationResult {
  schemaVersion: '2.0.0-session2'; rulesetVersion: 'academic-reconciliation/1.0.0'; caseId: string;
  documentIds: { prescription: string | null; invoice: string | null };
  status: ComparisonStatus; reviewRequired: boolean; humanDecisionRequired: true;
  coverage: { prescription: CoverageStatus | 'MISSING'; invoice: CoverageStatus | 'MISSING' };
  hasInsufficientEvidence: boolean; reasonCodes: ReconciliationReason[]; rows: ReconciliationRow[];
  summary: { consistent: number; mismatch: number; insufficientEvidence: number };
}
export interface ComparisonViewRow {
  comparison: ReconciliationRow; prescription: MedicineItem | null; invoice: MedicineItem | null;
  evidence: { reference: EvidenceReference; side: 'Prescription' | 'Invoice'; slot: MedicineSlot }[];
}
export type ComparisonView =
  | { state: 'empty'; message: string }
  | { state: 'invalid'; message: string }
  | { state: 'ready'; result: ReconciliationResult; rows: ComparisonViewRow[] };

export const REASON_LABELS: Record<ReconciliationReason, string> = {
  MISSING_DOCUMENT: 'A required document is missing.',
  UNRESOLVED_GROUPING: 'Medicine rows need confirmation.',
  ITEM_LIMIT_EXCEEDED: 'This document exceeds the supported item limit.',
  INCOMPLETE_PAGE_COVERAGE: 'Some document pages were not inspected.',
  UNKNOWN_PAGE_COVERAGE: 'Inspected page coverage is unknown.',
  CONTRADICTORY_PAGE_COVERAGE: 'Page coverage information conflicts.',
  FIELD_NEEDS_CORRECTION: 'An extracted field needs human correction.',
  UNKNOWN_MEDICINE: 'Medicine identity is outside the supported reference.',
  AMBIGUOUS_MEDICINE: 'Medicine identity has more than one possible meaning.',
  IDENTITY_ATTRIBUTE_CONFLICT: 'The medicine label conflicts with its extracted attributes.',
  AMBIGUOUS_MATCH: 'Several items could match; no pair was forced.',
  MISSING_INVOICE_ITEM: 'No corresponding item was found in the inspected invoice.',
  EXTRA_INVOICE_ITEM: 'An invoice item has no corresponding prescribed item.',
  STRENGTH_MISMATCH: 'The documented strengths differ.',
  DOSAGE_FORM_MISMATCH: 'The documented dosage forms differ.',
  RELEASE_TYPE_MISMATCH: 'The documented release types differ.',
  QUANTITY_MISMATCH: 'The supported quantity comparison differs.',
  MISSING_STRENGTH: 'Medicine strength is missing.',
  MISSING_DOSAGE_FORM: 'Dosage form is missing.',
  MISSING_RELEASE_TYPE: 'A required release-type label is missing.',
  MISSING_QUANTITY: 'An explicit quantity is missing.',
  UNKNOWN_QUANTITY_UNIT: 'The quantity unit needs clarification.',
  UNKNOWN_PACK_SIZE: 'Pack contents are not explicitly stated.',
  INCOMPATIBLE_QUANTITY_UNITS: 'These quantity units cannot be compared.',
  INVALID_QUANTITY: 'A quantity is invalid or outside the supported range.',
  UNSUPPORTED_STRENGTH_FORMAT: 'Strength formatting needs human clarification.',
  UNSUPPORTED_PRODUCT_TYPE: 'This product type is outside the pilot scope.',
};
export const SLOT_LABELS: Record<MedicineSlot, string> = {
  medicine_name: 'Medicine', dosage_strength: 'Strength', dosage_form: 'Dosage form', release_type: 'Release type',
  quantity: 'Quantity', quantity_unit: 'Quantity unit', pack_size: 'Pack size', pack_unit: 'Units in pack',
};
