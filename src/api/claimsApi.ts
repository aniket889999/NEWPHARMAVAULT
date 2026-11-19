import apiClient from './apiClient';

export type ClaimStatus =
  | 'SUBMITTED'
  | 'UNDER_PAYER_REVIEW'
  | 'QUERY_RAISED'
  | 'APPROVED'
  | 'PARTIALLY_APPROVED'
  | 'REJECTED'
  | 'SETTLED'
  | 'WITHDRAWN'
  | 'APPEALED';

export interface ClaimQuery { id: string; question: string; askedAt: string; answer: string | null; answeredAt: string | null }
export interface ClaimDecision { decision: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED'; approvedAmount: number; reasonCode: string | null; note: string; decidedAt: string }

export interface Claim {
  id: string;
  claimReference: string;
  caseId: string;
  status: ClaimStatus;
  policyNumber: string;
  claimedAmount: number;
  currency: string;
  payerOrganizationId: string;
  payerName?: string;
  queries: ClaimQuery[];
  decision: ClaimDecision | null;
  settlement: { reference: string; settledAt: string; simulated: true } | null;
  history: { status: ClaimStatus; at: string; byRole: string }[];
  appeal: null | { count: number; reason: string; appealedAt: string; previousDecision: ClaimDecision | null };
  createdAt: string;
  updatedAt: string;
}

export interface PayerQueueItem {
  id: string; claimReference: string; caseReference?: string; status: ClaimStatus;
  claimedAmount: number; currency: string; openQueries: number; createdAt: string; ageHours: number;
}

export interface PayerClaimDetail {
  claim: Claim;
  consent: { grantedAt: string; expiresAt: string; scope: string[] };
  pharmacyName: string;
  case: { id: string; caseReference: string; status: string; subjectReference: string; updatedAt: string } | null;
  documents: { id: string; type: string; mimeType: string; sizeBytes?: number; pageCount?: number; omittedPageCount?: number }[];
  extractedFields: { id: string; documentId: string; fieldType: string; normalizedValue?: string; rawValue?: string; pageNumber?: number; extractionConfidence?: number; needsCorrection?: boolean }[];
  consistencyChecks: { id: string; checkType: string; status: string; severity: string; message: string; reviewRequired?: boolean }[];
  riskSignals: { id: string; signalType: string; severity: string; description: string; reviewRequired?: boolean }[];
  reviewDecisions: { id: string; decision: string; reasonCode?: string; notes?: string; createdAt: string }[];
  amountCheck?: { invoiceTotal: number | null; claimedAmount: number; status: 'WITHIN_INVOICE' | 'EXCEEDS_INVOICE' | 'UNKNOWN' };
  reasonCodes: { rejected: string[]; partial: string[] };
}

export interface EligibleCase { id: string; caseReference: string; subjectReference?: string | null; status: string; updatedAt: string; invoiceTotal?: number | null }

export interface NotificationItem { id: string; type: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string; emailDelivery?: string }

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  SUBMITTED: 'Submitted',
  UNDER_PAYER_REVIEW: 'Under insurer review',
  QUERY_RAISED: 'Query raised',
  APPROVED: 'Approved',
  PARTIALLY_APPROVED: 'Partially approved',
  REJECTED: 'Not approved',
  SETTLED: 'Settled (demo)',
  WITHDRAWN: 'Withdrawn',
  APPEALED: 'Appealed'
};

export const CLAIM_STATUS_STYLE: Record<ClaimStatus, string> = {
  SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200',
  UNDER_PAYER_REVIEW: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  QUERY_RAISED: 'bg-amber-50 text-amber-800 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIALLY_APPROVED: 'bg-teal-50 text-teal-800 border-teal-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  SETTLED: 'bg-slate-100 text-slate-700 border-slate-300',
  WITHDRAWN: 'bg-slate-50 text-slate-500 border-slate-200',
  APPEALED: 'bg-purple-50 text-purple-800 border-purple-200'
};

export const formatInr = (value: number | null | undefined) =>
  typeof value === 'number' ? `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—';

export const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export const claimsApi = {
  // Claimant
  payers: async () => (await apiClient.get<{ id: string; name: string }[]>('/v1/claims/payers')).data,
  eligibleCases: async () => (await apiClient.get<EligibleCase[]>('/v1/claims/eligible-cases')).data,
  myClaims: async () => (await apiClient.get<Claim[]>('/v1/claims')).data,
  submit: async (body: { caseId: string; payerOrganizationId: string; claimedAmount: number; policyNumber: string; consent: { accepted: boolean } }) =>
    (await apiClient.post<Claim>('/v1/claims', body)).data,
  answerQuery: async (claimId: string, queryId: string, answer: string) =>
    (await apiClient.post<Claim>(`/v1/claims/${claimId}/queries/${queryId}/answer`, { answer })).data,
  withdraw: async (claimId: string) => (await apiClient.post<Claim>(`/v1/claims/${claimId}/withdraw`, {})).data,
  appeal: async (claimId: string, reason: string) => (await apiClient.post<Claim>(`/v1/claims/${claimId}/appeal`, { reason })).data,

  // Insurer
  /** Server-side paged insurer queue; totals come from X-Total-Count. */
  payerQueue: async (params: { status?: string; q?: string; page?: number; limit?: number; sort?: 'oldest' | 'newest' } = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    const res = await apiClient.get<PayerQueueItem[]>('/v1/payer/claims', { params: clean });
    const total = Number(res.headers['x-total-count'] ?? res.data.length);
    return { items: res.data, total: Number.isFinite(total) ? total : res.data.length };
  },
  payerClaim: async (claimId: string) => (await apiClient.get<PayerClaimDetail>(`/v1/payer/claims/${claimId}`)).data,
  payerDocumentBlob: async (claimId: string, documentId: string) =>
    (await apiClient.get<Blob>(`/v1/payer/claims/${claimId}/documents/${documentId}/content`, { responseType: 'blob' })).data,
  startReview: async (claimId: string) => (await apiClient.post<Claim>(`/v1/payer/claims/${claimId}/start-review`, {})).data,
  raiseQuery: async (claimId: string, question: string) => (await apiClient.post<Claim>(`/v1/payer/claims/${claimId}/queries`, { question })).data,
  decide: async (claimId: string, body: { decision: string; approvedAmount?: number; reasonCode?: string; note: string }) =>
    (await apiClient.post<Claim>(`/v1/payer/claims/${claimId}/decision`, body)).data,
  settle: async (claimId: string) => (await apiClient.post<Claim>(`/v1/payer/claims/${claimId}/settle`, {})).data,
  fhirBundle: async (claimId: string) =>
    (await apiClient.get<{ bundle: unknown; validation: { valid: boolean; issues: { severity: string; path: string; message: string }[] }; disclaimer: string }>(`/v1/payer/claims/${claimId}/fhir-bundle`)).data,
  analytics: async () =>
    (await apiClient.get<{ byStatus: Record<string, { count: number; claimedAmount: number }>; decidedCount: number; averageDecisionHours: number | null; queryRate: number | null; note: string }>('/v1/payer/analytics')).data,

  // Pharmacy staff
  pharmacyClaims: async () =>
    (await apiClient.get<{ id: string; claimReference: string; caseId: string; caseReference?: string; payerName?: string; status: ClaimStatus; openQueries: number; updatedAt: string }[]>('/v1/pharmacy/claims')).data,

  // Notifications
  notifications: async () => (await apiClient.get<{ unread: number; items: NotificationItem[] }>('/v1/notifications')).data,
  markRead: async (id: string) => (await apiClient.post(`/v1/notifications/${id}/read`, {})).data,
  markAllRead: async () => (await apiClient.post('/v1/notifications/read-all', {})).data,

  // MFA
  mfaSetup: async () => (await apiClient.post<{ secret: string; otpauthUri: string }>('/users/mfa/setup', {})).data,
  mfaEnable: async (code: string) => (await apiClient.post<{ recoveryCodes?: string[] }>('/users/mfa/enable', { code })).data,
  mfaRecoveryCodes: async (code: string) => (await apiClient.post<{ recoveryCodes: string[] }>('/users/mfa/recovery-codes', { code })).data,
  mfaDisable: async (code: string) => (await apiClient.post('/users/mfa/disable', { code })).data
};
