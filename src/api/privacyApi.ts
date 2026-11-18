import apiClient from './apiClient';

export interface DataRequestView {
  id: string;
  type: 'EXPORT' | 'ERASURE';
  status: 'OPEN' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';
  reason: string | null;
  dueBy: string | null;
  createdAt: string;
  processedAt: string | null;
}

/** Data-principal rights: export own data, request and cancel deletion. */
export const privacyApi = {
  /** format 'html' = readable summary (print → Save as PDF); 'json' = full machine-readable copy. */
  downloadMyData: async (format: 'html' | 'json' = 'html') => {
    const res = await apiClient.get('/v1/me/data-export', { params: { format }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmavault-my-data-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  myRequests: async () => (await apiClient.get<DataRequestView[]>('/v1/me/data-requests')).data,
  requestErasure: async (reason: string) => (await apiClient.post<DataRequestView>('/v1/me/erasure-request', { reason })).data,
  cancel: async (id: string) => (await apiClient.post<DataRequestView>(`/v1/me/data-requests/${id}/cancel`, {})).data
};
