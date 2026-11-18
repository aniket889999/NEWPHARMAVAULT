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
  downloadMyData: async () => {
    const res = await apiClient.get('/v1/me/data-export');
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmavault-my-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  myRequests: async () => (await apiClient.get<DataRequestView[]>('/v1/me/data-requests')).data,
  requestErasure: async (reason: string) => (await apiClient.post<DataRequestView>('/v1/me/erasure-request', { reason })).data,
  cancel: async (id: string) => (await apiClient.post<DataRequestView>(`/v1/me/data-requests/${id}/cancel`, {})).data
};
