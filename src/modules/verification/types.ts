/**
 * PharmaVault TrustRAG Verification Types
 * Strictly aligned with contracts/schemas/ and backend domain models.
 */

export type VerificationCaseStatus =
  | 'DRAFT'
  | 'DOCUMENTS_PENDING'
  | 'READY_FOR_PROCESSING'
  | 'PROCESSING'
  | 'NEEDS_CORRECTION'
  | 'NEEDS_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'CLOSED';

export type DocumentType = 'PRESCRIPTION' | 'PHARMACY_INVOICE' | 'CLAIM_FORM';

export type BoundingBox = [number, number, number, number]; // [x_min, y_min, x_max, y_max]

export type CheckStatus = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

export type CheckSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type EvidenceSourceType =
  | 'PRIVATE_CASE_DATA'
  | 'CURATED_MEDICINE_KNOWLEDGE'
  | 'OFFICIAL_SOURCE_REGISTRY';

export type PublicReviewAction = 'VERIFY' | 'RETURN_FOR_CORRECTION' | 'ESCALATE';

export interface VerificationCase {
  id: string;
  _id?: string;
  caseReference: string;
  organizationId: string;
  branchId?: string | null;
  createdBy: string | { _id: string; name: string; email: string; role: string };
  subjectReference: string;
  status: VerificationCaseStatus;
  reviewRequired: boolean;
  schemaVersion: string;
  documentIds: string[];
  metadata?: {
    explanation?: CaseExplanation;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DocumentItem {
  id: string;
  _id?: string;
  caseId: string;
  type: DocumentType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  pageCount: number;
  uploadStatus: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  processingStatus: 'PENDING' | 'EXTRACTED' | 'FAILED';
  uploadedBy: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface MedicineResolutionCandidate {
  id?: string;
  _id?: string;
  brandName?: string;
  genericName?: string;
  strength?: string;
  strengthUnit?: string;
  dosageForm?: string;
  manufacturer?: string;
  aliases?: string[];
  matchScore?: number;
  matchBasis?: string;
  catalogueVersion?: string;
  sourceNote?: string;
}

export interface MedicineResolution {
  resolved: boolean;
  ambiguous: boolean;
  matchScore: number;
  matchBasis: string;
  canonical: MedicineResolutionCandidate | null;
  candidates: MedicineResolutionCandidate[];
  rawQuery?: string;
  sourceNote?: string;
  catalogueVersion?: string;
}

export interface ExtractedField {
  id: string;
  _id?: string;
  caseId: string;
  documentId: string;
  documentType: DocumentType;
  fieldType: string;
  rawValue: string;
  normalizedValue: string;
  confidenceScore: number;
  pageNumber?: number;
  extractionMethod?: string;
  boundingBox?: BoundingBox;
  needsCorrection: boolean;
  correctedBy?: string | null;
  correctedAt?: string | null;
  resolution?: MedicineResolution | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EvidenceItem {
  id: string;
  _id?: string;
  caseId: string;
  sourceType: EvidenceSourceType;
  sourceLabel: string;
  citationText: string;
  documentReference?: {
    documentId?: string;
    documentType?: DocumentType;
    pageNumber?: number;
    boundingBox?: BoundingBox;
  };
  trustTier: 1 | 2 | 3 | 4 | 5;
  relevanceReason: string;
  retrievedAt: string;
}

export interface ConsistencyCheck {
  id: string;
  _id?: string;
  caseId: string;
  checkType: string;
  status: CheckStatus;
  severity: CheckSeverity;
  subjectMedicine?: string;
  fieldDifferences?: Record<string, any>;
  explanation: string;
  evidenceItemIds: string[];
  createdAt: string;
}

export interface RiskSignal {
  id: string;
  _id?: string;
  caseId: string;
  signalType: string;
  severity: RiskSeverity;
  score: number;
  description: string;
  triggeringEvidence: string[];
  reviewRequired: boolean;
  isMitigated: boolean;
  createdAt: string;
}

export interface ReviewDecision {
  id: string;
  _id?: string;
  caseId: string;
  reviewerId: string | { _id: string; name: string; email: string; role: string };
  decision: 'APPROVE' | 'REQUEST_CLARIFICATION' | 'ESCALATE' | 'REJECT';
  publicAction?: PublicReviewAction;
  reasonCode: string;
  notes: string;
  evidenceItemIds: string[];
  createdAt: string;
}

export interface AuditEventItem {
  id: string;
  _id?: string;
  caseId?: string | null;
  actorId: string | { _id: string; name: string; email: string; role: string };
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface CaseExplanationFinding {
  claim: string;
  evidenceItemIds: string[];
  confidence?: number;
  status?: string;
}

export interface CaseExplanation {
  summary: string;
  findings?: CaseExplanationFinding[];
  evidenceItemIds?: string[];
  uncertainty?: string;
  source?: string;
  groundingScore?: number;
  verifiedAt?: string;
}

export interface CaseResultsSummary {
  caseId: string;
  caseReference: string;
  status: VerificationCaseStatus;
  reviewRequired: boolean;
  totalDocuments: number;
  explanation: CaseExplanation;
  consistencyChecksSummary: {
    total: number;
    passed: number;
    failed: number;
    inconclusive: number;
  };
  riskSignalsCount: number;
  activeSignals: Array<{
    signalType: string;
    severity: RiskSeverity;
    description: string;
  }>;
  consistencyChecks: ConsistencyCheck[];
  extractedFields: ExtractedField[];
  evidenceItems: EvidenceItem[];
  reviewDecisions: ReviewDecision[];
  auditTrail?: AuditEventItem[];
}
