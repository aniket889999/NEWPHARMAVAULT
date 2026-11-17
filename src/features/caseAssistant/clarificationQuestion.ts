import type { ChatMessage } from '../../types';

// Use the question preceding this clarification, not a later/historical question.
export function clarificationQuestion(messages: Pick<ChatMessage, 'id' | 'role' | 'content'>[], answerId: string) {
  const answerIndex = messages.findIndex(message => message.id === answerId && message.role === 'assistant');
  if (answerIndex < 0) return null;
  return [...messages.slice(0, answerIndex)].reverse().find(message => message.role === 'user')?.content || null;
}
