import apiClient from '../../../api/apiClient';
import {
  VerificationCase,
  DocumentItem,
  ExtractedField,
  EvidenceItem,
  ReviewDecision,
  AuditEventItem,
  CaseResultsSummary,
  DocumentType,
  PublicReviewAction
} from '../types';

/**
 * PharmaVault TrustRAG Verification API Client
 * Wraps all /api/v1 endpoints with strong typing and error handling.
 */
export const verificationApi = {
  /**
   * List verification cases (scoped by patient or organization)
   */
  async getCases(params?: { status?: string; reviewRequired?: boolean }): Promise<VerificationCase[]> {
    const { data } = await apiClient.get<VerificationCase[]>('/v1/cases', { params });
    return data;
  },

  /**
   * Get single verification case by ID
   */
  async getCase(caseId: string): Promise<VerificationCase> {
    const { data } = await apiClient.get<VerificationCase>(`/v1/cases/${caseId}`);
    return data;
  },

  /**
   * Create a new verification case (DRAFT state)
   */
  async createCase(subjectReference?: string, metadata?: Record<string, any>): Promise<VerificationCase> {
    const { data } = await apiClient.post<VerificationCase>('/v1/cases', {
      subjectReference,
      metadata
    });
    return data;
  },

  /**
   * Update case metadata or status (e.g., close case)
   */
  async updateCase(caseId: string, payload: { status?: string; metadata?: Record<string, any> }): Promise<VerificationCase> {
    const { data } = await apiClient.patch<VerificationCase>(`/v1/cases/${caseId}`, payload);
    return data;
  },

  /**
   * List documents uploaded to a case
   */
  async getDocuments(caseId: string): Promise<DocumentItem[]> {
    const { data } = await apiClient.get<DocumentItem[]>(`/v1/cases/${caseId}/documents`);
    return data;
  },

  /**
   * Fetch protected raw document content as an authenticated binary Blob
   */
  async getDocumentContent(caseId: string, documentId: string): Promise<Blob> {
    const response = await apiClient.get<Blob>(
      `/v1/cases/${caseId}/documents/${documentId}/content`,
      {
        responseType: 'blob'
      }
    );
    return response.data;
  },

  /**
   * Fetch rendered PDF page preview as an authenticated binary Blob
   */
  async getDocumentPagePreview(caseId: string, documentId: string, pageNumber: number): Promise<Blob> {
    const response = await apiClient.get<Blob>(
      `/v1/cases/${caseId}/documents/${documentId}/pages/${pageNumber}/preview`,
      {
        responseType: 'blob'
      }
    );
    return response.data;
  },

  /**
   * Upload a document to a case
   */
  async uploadDocument(
    caseId: string,
    payload: {
      type: DocumentType;
      file?: string;
      filename?: string;
      mimeType?: string;
    }
  ): Promise<DocumentItem> {
    const { data } = await apiClient.post<DocumentItem>(`/v1/cases/${caseId}/documents`, payload);
    return data;
  },

  /**
   * Human-in-the-Loop field correction
   */
  async correctExtractedField(
    caseId: string,
    fieldId: string,
    normalizedValue: string
  ): Promise<ExtractedField> {
    const { data } = await apiClient.patch<ExtractedField>(
      `/v1/cases/${caseId}/extracted-fields/${fieldId}`,
      { normalizedValue }
    );
    return data;
  },

  /**
   * Trigger TrustRAG processing pipeline
   */
  async processCase(caseId: string, options?: Record<string, any>): Promise<any> {
    const idempotencyKey = `proc-${caseId}-${Date.now()}`;
    const { data } = await apiClient.post(
      `/v1/cases/${caseId}/process`,
      options || {},
      {
        headers: {
          'Idempotency-Key': idempotencyKey
        }
      }
    );
    return data;
  },

  /**
   * Get structured explainable verification results
   */
  async getResults(caseId: string): Promise<CaseResultsSummary> {
    const { data } = await apiClient.get<CaseResultsSummary>(`/v1/cases/${caseId}/results`);
    return data;
  },

  /**
   * Get cited evidence lineage items
   */
  async getEvidence(caseId: string): Promise<EvidenceItem[]> {
    const { data } = await apiClient.get<EvidenceItem[]>(`/v1/cases/${caseId}/evidence`);
    return data;
  },

  /**
   * Get review queue (cases in NEEDS_REVIEW or NEEDS_CORRECTION)
   */
  async getReviewQueue(): Promise<VerificationCase[]> {
    const { data } = await apiClient.get<VerificationCase[]>('/v1/review-queue');
    return data;
  },

  /**
   * Submit human review decision using public action labels
   */
  async submitReview(
    caseId: string,
    payload: {
      action: PublicReviewAction;
      reasonCode: string;
      notes?: string;
      evidenceItemIds?: string[];
    }
  ): Promise<ReviewDecision> {
    const { data } = await apiClient.post<ReviewDecision>(`/v1/cases/${caseId}/reviews`, payload);
    return data;
  },

  /**
   * Get historical review decisions for a case
   */
  async getReviews(caseId: string): Promise<ReviewDecision[]> {
    const { data } = await apiClient.get<ReviewDecision[]>(`/v1/cases/${caseId}/reviews`);
    return data;
  },

  /**
   * Get append-only audit trail for a case
   */
  async getAuditTrail(caseId: string): Promise<AuditEventItem[]> {
    const { data } = await apiClient.get<AuditEventItem[]>(`/v1/cases/${caseId}/audit-trail`);
    return data;
  },

  /**
   * Export synthetic FHIR R4 bundle
   */
  async getFhirBundle(caseId: string): Promise<any> {
    const { data } = await apiClient.get(`/v1/cases/${caseId}/fhir-bundle`);
    return data;
  }
};
