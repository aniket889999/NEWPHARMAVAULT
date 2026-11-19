import apiClient from './apiClient';
import { RagChatResponse } from '../types';
import { caseAssistantApi } from '../features/caseAssistant/api';
import { toChatResponse } from '../features/caseAssistant/toChatResponse';
import { notifySessionExpired } from '../features/navigation/sessionProfile';

export type ChatStreamEvent =
  | { event: 'status'; data: { stage: string; message: string } }
  | { event: 'meta'; data: Omit<RagChatResponse, 'reply'> }
  | { event: 'delta'; data: { text: string } }
  | { event: 'reset' | 'done'; data: RagChatResponse }
  | { event: 'error'; data: { message: string } };

export function parseChatEvent(block: string): ChatStreamEvent | null {
  const event = block.split('\n').find(l => l.startsWith('event:'))?.slice(6).trim();
  const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n');
  if (!event || !data || !['status', 'meta', 'delta', 'reset', 'done', 'error'].includes(event)) return null;
  return { event, data: JSON.parse(data) } as ChatStreamEvent;
}

export async function streamChat(
  payload: { message: string; caseId?: string; conversationId?: string; contextId?: string; contextToken?: string; medicineItemId?: string | null; history: { role: 'user' | 'assistant'; text: string }[] },
  signal: AbortSignal,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  if (payload.caseId) {
    // Private answers use a local, signed-evidence contract, never public generation.
    onEvent({ event: 'status', data: { stage: 'retrieving', message: 'Reading current case and medicine evidence…' } });
    const answer = await caseAssistantApi.answer(payload.caseId, payload.message, payload.medicineItemId ?? null, signal);
    signal.throwIfAborted();
    onEvent({ event: 'done', data: toChatResponse(answer) });
    return;
  }
  const base = String(apiClient.defaults.baseURL || '/api').replace(/\/$/, '');
  if (payload.conversationId && !/^[a-f0-9-]{36}$/i.test(payload.conversationId)) throw new Error('Invalid saved conversation.');
  const endpoint = payload.conversationId ? `/v1/chat/history/conversations/${payload.conversationId}/stream` : '/v1/chat/stream';
  const response = await fetch(base + endpoint, {
    method: 'POST', signal, credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-PharmaVault-Client': 'web' },
    body: JSON.stringify(payload.conversationId ? {message:payload.message} : payload),
  });
  if (response.status === 401) notifySessionExpired();
  if (response.status === 400) {
    const value = await response.clone().json().catch(() => null);
    if (typeof value?.message === 'string' && /conversation context|chat context/i.test(value.message)) throw Object.assign(new Error('Conversation context expired or changed. Restate the medicine, or start a new chat.'), { code: 'CONTEXT_EXPIRED' });
  }
  if (!response.ok || !response.body) throw new Error(response.status === 401 ? 'Please sign in again.' : response.status === 409 && payload.conversationId ? 'Saved chat is busy or full. Wait for the previous answer or start a new chat.' : 'Evidence chat is unavailable or this case is not accessible.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', bytes = 0, completed = false;
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      bytes += value?.length || 0;
      if (bytes > 250000) throw new Error('Response limit exceeded.');
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || '';
      if (done && buffer.trim()) blocks.push(buffer);
      for (const block of blocks) {
        const event = parseChatEvent(block.replace(/\r/g, ''));
        if (event?.event === 'done') completed = true;
        if (event) onEvent(event);
      }
      if (done) break;
    }
    if (!completed && !signal.aborted) throw new Error('The response was interrupted.');
  } finally { await reader.cancel().catch(() => {}); }
}
