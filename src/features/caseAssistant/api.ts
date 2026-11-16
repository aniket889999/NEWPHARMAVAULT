import apiClient from '../../api/apiClient';
import { isAnswerId, isCaseId, isMedicineItemId, parseCaseAnswer, parseFreshnessResponse } from './contract';
import type { AnswerReceipt } from './types';

interface Transport { post(path: string, body: unknown, config?: { signal?: AbortSignal }): Promise<{ data: unknown }> }
export function createCaseAssistantApi(transport: Transport = apiClient) {
  const post = async (path: string, body: unknown, signal?: AbortSignal) => {
    try { return await transport.post(path, body, { signal }); }
    catch {
      signal?.throwIfAborted();
      throw new Error('Case evidence is unavailable or access was denied. Check your session and try again.');
    }
  };
  return {
    async answer(caseId: string, message: string, medicineItemId: string | null = null, signal?: AbortSignal) {
      if (!isCaseId(caseId) || !message.trim() || message.length > 2000 || (medicineItemId !== null && !isMedicineItemId(medicineItemId))) throw new Error('Select a valid case and medicine scope.');
      const { data } = await post('/v1/cases/' + caseId + '/assistant/prioritized-answers', { message: message.trim(), medicineItemId }, signal);
      const answer = parseCaseAnswer(data, caseId, medicineItemId);
      if (!answer) throw new Error('The case answer did not satisfy its evidence contract. No answer was accepted.');
      return answer;
    },
    async checkFreshness(caseId: string, receipts: AnswerReceipt[], signal?: AbortSignal) {
      if (!isCaseId(caseId) || !receipts.length || receipts.length > 20 ||
        new Set(receipts.map(r => r.answerId)).size !== receipts.length ||
        receipts.some(r => !isAnswerId(r.answerId) || typeof r.bindingToken !== 'string' || !r.bindingToken.length || r.bindingToken.length > 32768)) throw new Error('Invalid evidence check request.');
      const bounded = receipts.map(({ answerId, bindingToken }) => ({ answerId, bindingToken }));
      const { data } = await post('/v1/cases/' + caseId + '/assistant/freshness', { receipts: bounded }, signal);
      const result = parseFreshnessResponse(data, caseId, bounded);
      if (!result) throw new Error('Evidence freshness could not be verified.');
      return result;
    },
  };
}
export const caseAssistantApi = createCaseAssistantApi();
