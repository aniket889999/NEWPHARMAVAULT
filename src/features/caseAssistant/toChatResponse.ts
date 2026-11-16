import type { RagChatResponse } from '../../types';
import type { CaseAssistantAnswer } from './types';
export function toChatResponse(answer: CaseAssistantAnswer): RagChatResponse {
  return {
    reply: answer.reply, mode: answer.mode, caseAnswer: answer,
    sources: answer.sources.map(s => ({
      citation: s.citation, sourceId: s.sourceId, title: s.title, excerpt: s.excerpt,
      kind: 'CASE_RECORD', version: 'Evidence fingerprint ' + s.fingerprint.slice(0, 12), score: 0,
      ...(s.documentId ? { documentId: s.documentId } : {}), ...(s.pageNumber ? { pageNumber: s.pageNumber } : {}),
    })),
    warnings: answer.warnings, disclaimer: answer.disclaimer,
    retrieval: { method: 'CASE_ITEM_EVIDENCE', matchedPassages: answer.sources.length },
  };
}
