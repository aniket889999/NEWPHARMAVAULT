export const CASE_ASSISTANT_SCHEMA = '2.0.0-session4' as const;
export type CaseAnswerMode = 'LOCAL_CASE_EVIDENCE' | 'CLARIFY' | 'ABSTAIN' | 'SAFETY';
export type CaseAnswerIntent = 'STRENGTH' | 'QUANTITY' | 'IDENTITY' | 'COMPARISON' | 'CASE_STATUS' | 'UNSUPPORTED';
export interface MedicineChoice { itemId: string; label: string; documentType: 'PRESCRIPTION' | 'PHARMACY_INVOICE' }
export interface CaseAnswerSource {
  citation: string; sourceId: string; documentId: string | null; fieldId: string | null;
  pageNumber: number | null; itemId: string | null; title: string; excerpt: string; fingerprint: string;
}
export interface CaseAssistantAnswer {
  schemaVersion: typeof CASE_ASSISTANT_SCHEMA; caseId: string; answerId: string;
  generatedAt: string; evidenceRevision: number; reply: string; mode: CaseAnswerMode;
  intent: CaseAnswerIntent; medicineItemId: string | null; choices: MedicineChoice[];
  sources: CaseAnswerSource[]; warnings: string[]; dependencyKeys: string[];
  bindingToken: string | null; disclaimer: string;
}
export type FreshnessStatus = 'FRESH' | 'STALE' | 'UNVERIFIABLE';
export const FRESHNESS_REASONS = ['UNCHANGED_DEPENDENCIES', 'EVIDENCE_CHANGED', 'DEPENDENCY_MISSING', 'INVALID_RECEIPT', 'RECEIPT_EXPIRED', 'CASE_PROCESSING'] as const;
export interface AnswerReceipt { answerId: string; bindingToken: string }
export interface FreshnessResult {
  answerId: string; status: FreshnessStatus; changedDependencyKeys: string[];
  reasonCode: typeof FRESHNESS_REASONS[number];
}
export interface FreshnessResponse {
  schemaVersion: typeof CASE_ASSISTANT_SCHEMA; caseId: string; checkedAt: string;
  evidenceRevision: number; results: FreshnessResult[];
}
export interface AnswerFreshness {
  status: FreshnessStatus | 'UNCHECKED' | 'CHECKING';
  checkedAt: string | null; reasonCode: string | null; changedDependencyKeys: string[];
}
