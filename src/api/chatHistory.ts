import apiClient from './apiClient';
import type { ChatMessage, Conversation, RagChatResponse } from '../types';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export interface SavedSummary { id: string; title: string; createdAt: string; updatedAt: string; messageCount: number }
export interface SavedHistoryState { enabled: boolean; consentVersion: string; retentionInactiveDays: number; conversations: SavedSummary[] }
export interface ChatHistoryTransport {
  state: () => Promise<SavedHistoryState>;
  enable: () => Promise<SavedHistoryState>;
  clear: () => Promise<void>;
  create: (signal?: AbortSignal) => Promise<SavedSummary>;
  get: (id: string) => Promise<Conversation>;
  remove: (id: string) => Promise<void>;
}
function assertId(id: string) { if (!uuid.test(id)) throw new Error('Invalid saved conversation.'); }
export function parseSavedConversation(value: unknown): Conversation {
  const c = value as { id?: string; title?: string; createdAt?: string; updatedAt?: string; messages?: unknown[] };
  if (!c || !uuid.test(c.id || '') || typeof c.title !== 'string' || c.title.length > 80 || !Array.isArray(c.messages) || c.messages.length > 200 || !Number.isFinite(Date.parse(c.createdAt || '')) || !Number.isFinite(Date.parse(c.updatedAt || ''))) throw new Error('Invalid saved history response.');
  const ids = new Set<string>();
  const messages = c.messages.map((raw): ChatMessage => {
    const m = raw as { id: string; role: 'user' | 'assistant'; content: string; timestamp: string; rag?: RagChatResponse };
    if (!m || !uuid.test(m.id) || ids.has(m.id) || !['user','assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 12000 || !Number.isFinite(Date.parse(m.timestamp))) throw new Error('Invalid saved message.');
    ids.add(m.id);
    if (m.rag && (m.role !== 'assistant' || m.rag.caseAnswer || m.rag.reply !== m.content || !Array.isArray(m.rag.sources) || !Array.isArray(m.rag.warnings) || m.rag.sources.some(s => s.kind === 'CASE_RECORD' || s.documentId))) throw new Error('Private or malformed evidence is not accepted in saved public history.');
    return { id:m.id, role:m.role, content:m.content, timestamp:new Date(m.timestamp), ...(m.rag ? { rag:m.rag } : {}), deliveryStatus:'complete' };
  });
  return { id:c.id!, savedId:c.id!, historyLoaded:true, title:c.title, messages, createdAt:new Date(c.createdAt!), updatedAt:new Date(c.updatedAt!), type:'general' };
}
function state(value: SavedHistoryState): SavedHistoryState {
  if (!value || typeof value.enabled !== 'boolean' || value.consentVersion !== 'public-history-v1' || !Array.isArray(value.conversations) || value.conversations.length > 20 || value.conversations.some(c=>!uuid.test(c.id) || typeof c.title !== 'string' || !Number.isFinite(Date.parse(c.updatedAt)) || !Number.isFinite(Date.parse(c.createdAt)))) throw new Error('Saved history is unavailable.');
  return value;
}
export const chatHistoryApi: ChatHistoryTransport = {
  state: async () => state((await apiClient.get<SavedHistoryState>('/v1/chat/history')).data),
  enable: async () => state((await apiClient.post<SavedHistoryState>('/v1/chat/history/consent',{consentVersion:'public-history-v1'})).data),
  clear: async () => { await apiClient.delete('/v1/chat/history'); },
  create: async signal => (await apiClient.post<SavedSummary>('/v1/chat/history/conversations',{}, {signal})).data,
  get: async id => { assertId(id); return parseSavedConversation((await apiClient.get('/v1/chat/history/conversations/'+id)).data); },
  remove: async id => { assertId(id); await apiClient.delete('/v1/chat/history/conversations/'+id); },
};
