import { create } from 'zustand';
import { ChatMessage, Conversation, Medicine, QuestionType, RagChatResponse } from '../types';
import { questionTemplates } from '../data/questions';
import { streamChat } from '../api/chatStream';
import { caseAssistantApi } from '../features/caseAssistant/api';
import { isMedicineItemId } from '../features/caseAssistant/contract';

interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  selectedMedicine: Medicine | null;
  isLoading: boolean;
  stage: string;
  isCheckingFreshness: boolean;
  freshnessError: string | null;
  createConversation: (caseId?: string) => void;
  setActiveConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  selectMedicine: (medicine: Medicine | null) => void;
  selectCaseMedicine: (itemId: string | null) => void;
  sendMessage: (content: string, scope?: { medicineItemId: string | null }) => Promise<void>;
  refreshCaseFreshness: () => Promise<void>;
  askAgainWithCurrentEvidence: (assistantMessageId: string) => Promise<void>;
  stopResponse: () => void;
  regenerateLastResponse: () => Promise<void>;
  sendPredefinedQuestion: (questionType: QuestionType) => void;
  sendGeneralHealthQuery: (content: string) => Promise<void>;
  clearActiveConversation: () => void;
  resetChat: () => void;
}

const id = () => crypto.randomUUID();

export function createChatStore(transport = streamChat, freshnessTransport = caseAssistantApi.checkFreshness) {
  let request: { id: string; controller: AbortController } | null = null;
  let freshnessRequest: { id: string; controller: AbortController } | null = null;
  const cancelFreshness = () => { freshnessRequest?.controller.abort(); freshnessRequest = null; };
  return create<ChatState>((set, get) => ({
    conversations: [], activeConversation: null, selectedMedicine: null, isLoading: false, stage: '',
    isCheckingFreshness: false, freshnessError: null,
    createConversation: caseId => {
      get().stopResponse();
      cancelFreshness();
      const conversation: Conversation = {
        id: id(), title: 'New chat', messages: [], createdAt: new Date(),
        updatedAt: new Date(), type: 'general', caseId,
      };
      set(state => ({ conversations: [conversation, ...state.conversations].slice(0, 20), activeConversation: conversation, isCheckingFreshness: false, freshnessError: null }));
    },
    setActiveConversation: conversationId => {
      get().stopResponse();
      cancelFreshness();
      const conversation = get().conversations.find(c => c.id === conversationId);
      if (conversation) set({ activeConversation: conversation, isCheckingFreshness: false, freshnessError: null });
    },
    deleteConversation: conversationId => {
      if (get().activeConversation?.id === conversationId) { get().stopResponse(); cancelFreshness(); }
      set(state => ({
        conversations: state.conversations.filter(c => c.id !== conversationId),
        activeConversation: state.activeConversation?.id === conversationId ? null : state.activeConversation,
      }));
    },
    selectMedicine: medicine => set({ selectedMedicine: medicine }),
    selectCaseMedicine: itemId => {
      if (get().isLoading || (itemId !== null && !isMedicineItemId(itemId))) return;
      const current = get().activeConversation;
      if (!current?.caseId) return;
      const updated = { ...current, medicineItemId: itemId };
      set(state => ({ activeConversation: updated, conversations: state.conversations.map(c => c.id === current.id ? updated : c) }));
    },
    stopResponse: () => { request?.controller.abort(); },
    sendMessage: async (content, scope) => {
      if (get().isLoading || !content.trim() || content.length > 2000) return;
      if (!get().activeConversation) get().createConversation();
      const conversation = get().activeConversation!;
      const medicineItemId = scope ? scope.medicineItemId : conversation.medicineItemId ?? null;
      if (medicineItemId !== null && !isMedicineItemId(medicineItemId)) return;
      const conversationId = conversation.id, assistantId = id();
      const localRequest = { id: id(), controller: new AbortController() };
      request = localRequest;
      const update = (operation: (c: Conversation) => Conversation) => set(state => {
        const conversations = state.conversations.map(c => c.id === conversationId ? operation(c) : c);
        return { conversations, activeConversation: state.activeConversation?.id === conversationId
          ? conversations.find(c => c.id === conversationId) || null : state.activeConversation };
      });
      const updateAssistant = (operation: (m: ChatMessage) => ChatMessage) => update(c => ({
        ...c, updatedAt: new Date(), messages: c.messages.map(m => m.id === assistantId ? operation(m) : m),
      }));
      const history = conversation.messages.filter(m => m.deliveryStatus !== 'streaming' && m.deliveryStatus !== 'error')
        .slice(-10).map(m => ({ role: m.role, text: m.content.slice(0, 2000) }));
      update(c => ({ ...c, title: c.messages.length ? c.title : content.trim().slice(0, 48), updatedAt: new Date(),
        messages: [...c.messages, { id: id(), role: 'user', content: content.trim(), timestamp: new Date(), caseMedicineItemId: medicineItemId },
          { id: assistantId, role: 'assistant', content: '', timestamp: new Date(), deliveryStatus: 'streaming', showTrustLayer: false }].slice(-60) as ChatMessage[] }));
      set({ isLoading: true, stage: 'Finding relevant sources...' });
      try {
        await transport({ message: content.trim(), history, ...(conversation.caseId ? { caseId: conversation.caseId, medicineItemId } : {}) },
          localRequest.controller.signal, event => {
            if (localRequest.controller.signal.aborted) return;
            if (event.event === 'status') set({ stage: event.data.message });
            else if (event.event === 'meta') updateAssistant(m => ({ ...m, rag: { ...event.data, reply: '' } as RagChatResponse }));
            else if (event.event === 'delta') updateAssistant(m => ({ ...m, content: m.content + event.data.text }));
            else if (event.event === 'reset' || event.event === 'done') updateAssistant(m => ({
              ...m, content: event.data.reply, rag: event.data,
              deliveryStatus: event.event === 'done' ? 'complete' : 'streaming',
              ...(event.data.caseAnswer?.bindingToken ? { freshness: { status: 'UNCHECKED', checkedAt: null, reasonCode: null, changedDependencyKeys: [] } } : {}),
            }));
            else if (event.event === 'error') throw new Error(event.data.message);
          });
      } catch (error) {
        const stopped = localRequest.controller.signal.aborted;
        updateAssistant(m => ({ ...m, deliveryStatus: stopped ? 'stopped' : 'error',
          content: m.content || (stopped ? 'Response stopped.' : error instanceof Error ? error.message : 'The response could not complete. Please try again.') }));
      } finally {
        if (request?.id === localRequest.id) {
          request = null;
          set({ isLoading: false, stage: '' });
          if (get().activeConversation?.id === conversationId && conversation.caseId) void get().refreshCaseFreshness();
        }
      }
    },
    refreshCaseFreshness: async () => {
      const conversation = get().activeConversation;
      if (!conversation?.caseId) return;
      const receipts = conversation.messages.flatMap(m => {
        const a = m.rag?.caseAnswer;
        return m.deliveryStatus === 'complete' && a && a.caseId === conversation.caseId && a.bindingToken
          ? [{ answerId: a.answerId, bindingToken: a.bindingToken }] : [];
      }).slice(-20);
      if (!receipts.length) return;
      cancelFreshness();
      const local = { id: id(), controller: new AbortController() };
      freshnessRequest = local;
      const ids = new Set(receipts.map(r => r.answerId));
      const update = (operation: (m: ChatMessage) => ChatMessage) => set(state => {
        const conversations = state.conversations.map(c => c.id !== conversation.id ? c : {
          ...c, messages: c.messages.map(m => {
            if (!m.rag?.caseAnswer?.bindingToken) return m;
            if (ids.has(m.rag.caseAnswer.answerId)) return operation(m);
            return { ...m, freshness: m.freshness?.status === 'STALE' ? m.freshness : { status: 'UNVERIFIABLE' as const, checkedAt: m.freshness?.checkedAt ?? null, reasonCode: 'OUTSIDE_RECENT_CHECK_WINDOW', changedDependencyKeys: [] } };
          }),
        });
        return { conversations, activeConversation: state.activeConversation?.id === conversation.id ? conversations.find(c => c.id === conversation.id) || null : state.activeConversation };
      });
      set({ isCheckingFreshness: true, freshnessError: null });
      update(m => ({ ...m, freshness: m.freshness?.status === 'STALE' ? m.freshness : { status: 'CHECKING', checkedAt: m.freshness?.checkedAt ?? null, reasonCode: null, changedDependencyKeys: [] } }));
      try {
        const result = await freshnessTransport(conversation.caseId, receipts, local.controller.signal);
        if (freshnessRequest?.id !== local.id || local.controller.signal.aborted) return;
        const results = new Map(result.results.map(r => [r.answerId, r]));
        update(m => {
          const r = results.get(m.rag!.caseAnswer!.answerId);
          if (!r || (m.freshness?.status === 'STALE' && r.status === 'FRESH')) return m;
          return { ...m, freshness: { status: r.status, checkedAt: result.checkedAt, reasonCode: r.reasonCode, changedDependencyKeys: r.changedDependencyKeys } };
        });
      } catch {
        if (freshnessRequest?.id !== local.id || local.controller.signal.aborted) return;
        set({ freshnessError: 'Current evidence could not be checked. Previous answers are not a current all-clear.' });
        update(m => ({ ...m, freshness: m.freshness?.status === 'STALE' ? m.freshness : { status: 'UNVERIFIABLE', checkedAt: null, reasonCode: 'CHECK_UNAVAILABLE', changedDependencyKeys: [] } }));
      } finally {
        if (freshnessRequest?.id === local.id) { freshnessRequest = null; set({ isCheckingFreshness: false }); }
      }
    },
    askAgainWithCurrentEvidence: async assistantMessageId => {
      const conversation = get().activeConversation;
      if (!conversation?.caseId || get().isLoading) return;
      const index = conversation.messages.findIndex(m => m.id === assistantMessageId && m.role === 'assistant');
      if (index < 0) return;
      const preceding = conversation.messages.slice(0, index).reverse().find(m => m.role === 'user');
      if (preceding) await get().sendMessage(preceding.content, { medicineItemId: preceding.caseMedicineItemId ?? null });
    },
    regenerateLastResponse: async () => {
      const conversation = get().activeConversation;
      if (!conversation || get().isLoading) return;
      if (conversation.caseId) {
        const lastAnswer = [...conversation.messages].reverse().find(m => m.role === 'assistant');
        if (lastAnswer) await get().askAgainWithCurrentEvidence(lastAnswer.id);
        return;
      }
      let index = conversation.messages.length - 1;
      while (index >= 0 && conversation.messages[index].role !== 'user') index--;
      if (index < 0) return;
      const question = conversation.messages[index].content;
      const shortened = { ...conversation, messages: conversation.messages.slice(0, index) };
      set(state => ({ activeConversation: shortened, conversations: state.conversations.map(c => c.id === shortened.id ? shortened : c) }));
      await get().sendMessage(question);
    },
    sendGeneralHealthQuery: content => get().sendMessage(content),
    sendPredefinedQuestion: questionType => {
      const template = questionTemplates.find(t => t.id === questionType);
      if (template) void get().sendMessage(template.text);
    },
    clearActiveConversation: () => { get().stopResponse(); cancelFreshness(); set({ activeConversation: null, isCheckingFreshness: false, freshnessError: null }); },
    resetChat: () => {
      request?.controller.abort(); request = null;
      cancelFreshness();
      set({ conversations: [], activeConversation: null, selectedMedicine: null, isLoading: false, stage: '', isCheckingFreshness: false, freshnessError: null });
    },
  }));
}

export const useChatStore = createChatStore();
