import { create } from 'zustand';
import { ChatMessage, Conversation, Medicine, QuestionType, RagChatResponse } from '../types';
import { questionTemplates } from '../data/questions';
import { streamChat } from '../api/chatStream';
import { caseAssistantApi } from '../features/caseAssistant/api';
import { isMedicineItemId } from '../features/caseAssistant/contract';
import { chatHistoryApi } from '../api/chatHistory';
import type { ChatHistoryTransport } from '../api/chatHistory';

interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  selectedMedicine: Medicine | null;
  isLoading: boolean;
  stage: string;
  isCheckingFreshness: boolean;
  freshnessError: string | null;
  historyEnabled: boolean;
  historyLoading: boolean;
  historyError: string | null;
  initializeHistory: () => Promise<void>;
  enableSavedHistory: () => Promise<void>;
  clearSavedHistory: () => Promise<void>;
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

export function createChatStore(transport = streamChat, freshnessTransport = caseAssistantApi.checkFreshness, memory: ChatHistoryTransport = chatHistoryApi) {
  let request: { id: string; controller: AbortController } | null = null;
  let freshnessRequest: { id: string; controller: AbortController } | null = null;
  let memoryEpoch = 0;
  let openEpoch = 0;
  const cancelFreshness = () => { freshnessRequest?.controller.abort(); freshnessRequest = null; };
  return create<ChatState>((set, get) => ({
    conversations: [], activeConversation: null, selectedMedicine: null, isLoading: false, stage: '',
    isCheckingFreshness: false, freshnessError: null,
    historyEnabled:false, historyLoading:false, historyError:null,
    initializeHistory: async () => {
      const epoch=memoryEpoch;
      set({historyLoading:true,historyError:null});
      try {
        const data=await memory.state(); if(epoch!==memoryEpoch)return;
        set(state=>{
          const saved=data.conversations.map(summary=>{
            const current=state.conversations.find(c=>c.savedId===summary.id);
            return current || {id:summary.id,savedId:summary.id,historyLoaded:false,title:summary.title,messages:[],createdAt:new Date(summary.createdAt),updatedAt:new Date(summary.updatedAt),type:'general' as const};
          });
          const local=state.conversations.filter(c=>!c.savedId);
          return {historyEnabled:data.enabled,historyLoading:false,conversations:[...local,...saved].slice(0,40),
            activeConversation:state.activeConversation?.savedId && !data.conversations.some(c=>c.id===state.activeConversation?.savedId)?null:state.activeConversation};
        });
      } catch {if(epoch===memoryEpoch)set({historyLoading:false,historyError:'Saved history could not be loaded. Session-only chat remains available.'});}
    },
    enableSavedHistory: async () => {
      const epoch=++memoryEpoch;set({historyLoading:true,historyError:null});
      try {await memory.enable();if(epoch!==memoryEpoch)return;set({historyEnabled:true,historyLoading:false});await get().initializeHistory();if(epoch===memoryEpoch)get().createConversation();}
      catch {if(epoch===memoryEpoch)set({historyLoading:false,historyError:'Could not enable saved history. Nothing will be saved until consent succeeds.'});}
    },
    clearSavedHistory: async () => {
      const epoch=++memoryEpoch;openEpoch++;get().stopResponse();set({historyLoading:true,historyError:null});
      try {await memory.clear();if(epoch!==memoryEpoch)return;set(state=>({historyEnabled:false,historyLoading:false,conversations:state.conversations.filter(c=>!c.savedId),activeConversation:state.activeConversation?.savedId?null:state.activeConversation}));}
      catch {if(epoch===memoryEpoch)set({historyLoading:false,historyError:'Saved history was not deleted. Please retry; saving has not been disabled.'});}
    },
    createConversation: caseId => {
      openEpoch++;
      get().stopResponse();
      cancelFreshness();
      const conversation: Conversation = {
        id: id(), title: 'New chat', messages: [], createdAt: new Date(),
        updatedAt: new Date(), type: 'general', caseId,
      };
      set(state => ({ conversations: [conversation, ...state.conversations].slice(0, 40), activeConversation: conversation, isCheckingFreshness: false, freshnessError: null,historyLoading:false }));
    },
    setActiveConversation: conversationId => {
      const epoch=++openEpoch, accountEpoch=memoryEpoch;
      get().stopResponse();
      cancelFreshness();
      const conversation = get().conversations.find(c => c.id === conversationId);
      if (conversation) set({ activeConversation: conversation, isCheckingFreshness: false, freshnessError: null,historyLoading:false });
      if(conversation?.savedId && !conversation.historyLoaded){
        set({historyLoading:true,historyError:null});
        void memory.get(conversation.savedId).then(loaded=>{
          if(epoch!==openEpoch || accountEpoch!==memoryEpoch || get().activeConversation?.id!==conversationId)return;
          const restored={...loaded,id:conversationId};
          set(state=>({activeConversation:restored,conversations:state.conversations.map(c=>c.id===conversationId?restored:c),historyLoading:false}));
        }).catch(()=>{if(epoch===openEpoch && accountEpoch===memoryEpoch)set({historyLoading:false,historyError:'This saved chat could not be reopened. Check your session and retry.'});});
      }
    },
    deleteConversation: conversationId => {
      const savedId=get().conversations.find(c=>c.id===conversationId)?.savedId, epoch=memoryEpoch;
      if (get().activeConversation?.id === conversationId) { get().stopResponse(); cancelFreshness(); }
      set(state => ({
        conversations: state.conversations.filter(c => c.id !== conversationId),
        activeConversation: state.activeConversation?.id === conversationId ? null : state.activeConversation,
      }));
      if(savedId)void memory.remove(savedId).catch(()=>{if(epoch===memoryEpoch){set({historyError:'The saved chat was not deleted on the server. Refreshing history.'});void get().initializeHistory();}});
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
      if (get().isLoading || get().historyLoading || !content.trim() || content.length > 2000) return;
      if (!get().activeConversation) get().createConversation();
      const conversation = get().activeConversation!;
      if(conversation.savedId && !conversation.historyLoaded){set({historyError:'Reopen this saved conversation before sending another message.'});return;}
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
        let savedId=conversation.savedId;
        if(get().historyEnabled && !conversation.caseId && !savedId && !conversation.messages.length){
          const created=await memory.create(localRequest.controller.signal);
          localRequest.controller.signal.throwIfAborted();savedId=created.id;
          update(c=>({...c,savedId:created.id,historyLoaded:true}));
        }
        await transport({ message: content.trim(), history, ...(savedId && !conversation.caseId ? {conversationId:savedId} : !conversation.caseId ? {contextId:conversationId,...(conversation.contextToken ? {contextToken:conversation.contextToken} : {})} : {}), ...(conversation.caseId ? { caseId: conversation.caseId, medicineItemId } : {}) },
          localRequest.controller.signal, event => {
            if (localRequest.controller.signal.aborted) return;
            if (event.event === 'status') set({ stage: event.data.message });
            else if (event.event === 'meta') updateAssistant(m => ({ ...m, rag: { ...event.data, reply: '' } as RagChatResponse }));
            else if (event.event === 'delta') updateAssistant(m => ({ ...m, content: m.content + event.data.text }));
            else if (event.event === 'reset' || event.event === 'done') { if(event.event==='done' && event.data.contextToken && !conversation.caseId && !savedId)update(c=>({...c,contextToken:event.data.contextToken}));if(event.event==='done' && event.data.savedConversation?.saved===false)set({historyError:'This answer was not saved; it remains in this session only.'});updateAssistant(m => ({
              ...m, content: event.data.reply, rag: event.data,
              deliveryStatus: event.event === 'done' ? 'complete' : 'streaming',
              ...(event.data.caseAnswer?.bindingToken ? { freshness: { status: 'UNCHECKED', checkedAt: null, reasonCode: null, changedDependencyKeys: [] } } : {}),
            })); }
            else if (event.event === 'error') throw new Error(event.data.message);
          });
      } catch (error) {
        const stopped = localRequest.controller.signal.aborted;
        if (error && typeof error === 'object' && 'code' in error && error.code === 'CONTEXT_EXPIRED') update(c=>({...c,contextToken:undefined}));
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
      if(conversation.savedId){const previous=[...conversation.messages].reverse().find(m=>m.role==='user');if(previous)await get().sendMessage(previous.content);return;}
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
      memoryEpoch++;
      openEpoch++;
      request?.controller.abort(); request = null;
      cancelFreshness();
      set({ conversations: [], activeConversation: null, selectedMedicine: null, isLoading: false, stage: '', isCheckingFreshness: false, freshnessError: null,historyEnabled:false,historyLoading:false,historyError:null });
    },
  }));
}

export const useChatStore = createChatStore();
