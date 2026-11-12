import type { EvidenceReference, MedicineItemsEnvelope, MedicineSlot, ReconciliationResult } from '../reconciliation/types';

export const CASE_STATES = ['DRAFT', 'DOCUMENTS_PENDING', 'READY_FOR_PROCESSING', 'PROCESSING', 'NEEDS_CORRECTION', 'NEEDS_REVIEW', 'VERIFIED', 'REJECTED', 'CLOSED', 'FAILED'] as const;
export type CaseState = typeof CASE_STATES[number];
export type ReviewAction = 'VERIFY' | 'RETURN_FOR_CORRECTION' | 'ESCALATE';
export const INTEGRATION_CODES = ['DOCUMENTS_MISSING', 'MULTIPLE_DOCUMENTS_UNSUPPORTED', 'GROUPING_CONFIRMATION_REQUIRED', 'GROUPING_STALE', 'GROUPING_INVALID', 'ITEM_LIMIT_EXCEEDED', 'EXTRACTION_INCOMPLETE', 'PAGE_COVERAGE_INCOMPLETE', 'FIELD_CORRECTION_REQUIRED', 'COMPARISON_MISMATCH', 'COMPARISON_INSUFFICIENT', 'CASE_NOT_REVIEWABLE', 'LEGACY_FINDINGS_STALE', 'UNSUPPORTED_LAYOUT'] as const;
export type IntegrationCode = typeof INTEGRATION_CODES[number];
export interface GroupingField {
  id: string; caseId: string; documentId: string; fieldType: MedicineSlot;
  rawValue: string; normalizedValue: string; pageNumber: number;
  extractionConfidence: number | null; needsCorrection: boolean;
  correctedBy: string | null; correctedAt: string | null;
}
export interface MedicineGroup { anchorFieldId: string; fieldIds: string[] }
export interface GroupingDocument {
  documentId: string; documentType: 'PRESCRIPTION' | 'PHARMACY_INVOICE'; processingStatus: string;
  mode: 'UNCONFIRMED' | 'AUTO_PROPOSED' | 'HUMAN_CONFIRMED' | 'STALE';
  observedItemCount: number | null; confirmedBy: string | null; confirmedAt: string | null;
  groups: MedicineGroup[]; fields: GroupingField[];
}
export interface CaseReconciliationSnapshot {
  schemaVersion: '2.0.0-session3'; caseId: string; caseStatus: CaseState;
  snapshotToken: string; evidenceRevision: number;
  prescription: MedicineItemsEnvelope | null; invoice: MedicineItemsEnvelope | null; comparison: ReconciliationResult | null;
  groupingDocuments: GroupingDocument[];
  permissions: { canCorrectFields: boolean; canConfirmGroups: boolean; canReview: boolean };
  reviewEligibility: { canVerify: boolean; blockerCodes: IntegrationCode[]; allowedActions: ReviewAction[] };
  notices: { code: IntegrationCode; documentId: string | null; message: string }[];
  legacyFindingsCurrent: false;
}
export interface ConfirmGroupsRequest {
  snapshotToken: string; observedItemCount: number; completenessAttested: true; groups: MedicineGroup[];
}
export interface SnapshotReviewRequest {
  snapshotToken: string; action: ReviewAction; reasonCode: string; notes: string; evidenceItemIds?: string[];
}
export interface GroupingDraft { assignments: Record<string, string>; observedItemCount: number; completenessAttested: boolean }
export type InspectEvidence = (reference: EvidenceReference) => void;
