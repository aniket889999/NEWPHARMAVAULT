import apiClient from '../../../api/apiClient';
import { VerificationCase } from '../types';

export interface QueueParams {
  page?: number;
  limit?: number;
  status?: 'NEEDS_REVIEW' | 'NEEDS_CORRECTION';
  assigned?: 'me' | 'unassigned' | 'others';
  sort?: 'oldest' | 'newest';
  q?: string;
}

export interface QueueCase extends VerificationCase {
  assignedTo?: { _id: string; name?: string; role?: string } | string | null;
  assignmentExpiresAt?: string | null;
}

export interface ReviewAssignment {
  caseId: string;
  status: string;
  assignment: null | { assignedTo: string; assignedToMe: boolean; assigneeName?: string | null; assignedAt: string; expiresAt: string };
}

const clean = (params: QueueParams) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null));

export const reviewWorkflowApi = {
  /** Server-side paged review queue. Totals come from the X-Total-Count header. */
  async queue(params: QueueParams): Promise<{ items: QueueCase[]; total: number; page: number; limit: number }> {
    const res = await apiClient.get<QueueCase[]>('/v1/review-queue', { params: clean(params) });
    const total = Number(res.headers['x-total-count'] ?? res.data.length);
    return { items: res.data, total: Number.isFinite(total) ? total : res.data.length, page: Number(res.headers['x-page'] ?? params.page ?? 1), limit: Number(res.headers['x-limit'] ?? params.limit ?? 50) };
  },
  async getAssignment(caseId: string) {
    return (await apiClient.get<ReviewAssignment>(`/v1/review/cases/${caseId}/assignment`)).data;
  },
  async take(caseId: string, force = false) {
    return (await apiClient.post<ReviewAssignment>(`/v1/review/cases/${caseId}/assignment`, force ? { force: true } : {})).data;
  },
  async release(caseId: string) {
    return (await apiClient.delete<ReviewAssignment>(`/v1/review/cases/${caseId}/assignment`)).data;
  },
  async reopen(caseId: string, reason: string) {
    return (await apiClient.post<{ caseId: string; status: string; reopenCount: number }>(`/v1/review/cases/${caseId}/reopen`, { reason })).data;
  }
};

export const isActiveLease = (c: QueueCase) => Boolean(c.assignedTo && c.assignmentExpiresAt && new Date(c.assignmentExpiresAt) > new Date());
export const assigneeId = (c: QueueCase) => (typeof c.assignedTo === 'object' && c.assignedTo ? c.assignedTo._id : (c.assignedTo as string | null | undefined)) || null;
export const assigneeName = (c: QueueCase) => (typeof c.assignedTo === 'object' && c.assignedTo ? c.assignedTo.name : null) || 'another reviewer';
