import apiClient from '../../../api/apiClient';
import { isEntityId, isSnapshotToken, parseCaseSnapshot } from './snapshot';
import type { CaseReconciliationSnapshot, ConfirmGroupsRequest } from './types';

export interface IntegrationTransport {
  get(path: string, config?: { signal?: AbortSignal }): Promise<{ data: unknown }>;
  put(path: string, payload: unknown): Promise<{ data: unknown }>;
}
function casePath(caseId: string): string {
  if (!isEntityId(caseId)) throw new Error('Invalid case identifier.');
  return `/v1/cases/${encodeURIComponent(caseId)}`;
}
export function createIntegrationApi(transport: IntegrationTransport) {
  const decode = (data: unknown, caseId: string): CaseReconciliationSnapshot => {
    const parsed = parseCaseSnapshot(data, caseId);
    if (!parsed) throw new Error('The current case snapshot could not be verified.');
    return parsed;
  };
  return {
    async getSnapshot(caseId: string, signal?: AbortSignal): Promise<CaseReconciliationSnapshot> {
      const response = await transport.get(`${casePath(caseId)}/reconciliation`, { signal });
      return decode(response.data, caseId);
    },
    async confirmGroups(caseId: string, documentId: string, payload: ConfirmGroupsRequest): Promise<CaseReconciliationSnapshot> {
      if (!isEntityId(documentId) || !isSnapshotToken(payload.snapshotToken)) throw new Error('Refresh the current document snapshot first.');
      const response = await transport.put(`${casePath(caseId)}/documents/${encodeURIComponent(documentId)}/medicine-groups`, payload);
      return decode(response.data, caseId);
    },
  };
}
export const integrationApi = createIntegrationApi({
  get: (path, config) => apiClient.get<unknown>(path, config),
  put: (path, payload) => apiClient.put<unknown>(path, payload),
});
