import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Menu, MessageSquare, PanelLeftClose, Plus, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import ChatInterface from '../../components/chat/ChatInterface';
import { useChatStore } from '../../stores/chatStore';
import { verificationApi } from '../../modules/verification/api/verificationApi';
import { VerificationCase } from '../../modules/verification/types';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/apiClient';
import { portalHome } from '../../features/navigation/portalPolicy';
import { ChatReadinessNotice } from '../../features/chatReadiness/ChatReadinessNotice';
import { parseChatCapabilities } from '../../features/chatReadiness/presentation';
import type { ChatCapabilities } from '../../features/chatReadiness/presentation';
import { KnowledgeReviewPanel } from '../../features/chatReadiness/KnowledgeReviewPanel';
import { SavedHistoryControls } from '../../components/chat/SavedHistoryControls';

const HealthAssistant: React.FC = () => {
  const { user } = useAuth();
  const userId = user?._id;
  const [params, setParams] = useSearchParams();
  const caseId = params.get('caseId') || undefined;
  const { activeConversation, conversations, createConversation, setActiveConversation, deleteConversation, isLoading,initializeHistory } = useChatStore();
  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [capabilities, setCapabilities] = useState<ChatCapabilities | null>(null);
  const [officialWebEnabled, setOfficialWebEnabled] = useState<boolean | null>(null);
  const [officialWebPolicy, setOfficialWebPolicy] = useState('FALLBACK');
  const [caseLoadError, setCaseLoadError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(()=>{if(userId)void initializeHistory();},[userId,initializeHistory]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setCases([]);
    setCaseLoadError(false);
    verificationApi.getCases().then(data => { if (!cancelled) setCases(data); })
      .catch(() => { if (!cancelled) setCaseLoadError(true); });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false, sequence = 0;
    const controller = new AbortController();
    const check = () => {
      const request = ++sequence;
      void apiClient.get<unknown>('/v1/chat/status', { signal: controller.signal })
        .then(({ data }) => { if (!cancelled && request === sequence) {
          setCapabilities(parseChatCapabilities(data));
          const extra = data as { contextualChat?: { version?: string; webEnabled?: boolean; webLookupPolicy?: string } };
          setOfficialWebEnabled(extra?.contextualChat?.version === 'contextual-chat-v1' && typeof extra.contextualChat.webEnabled === 'boolean' ? extra.contextualChat.webEnabled : null);
          setOfficialWebPolicy(extra?.contextualChat?.webLookupPolicy === 'ALWAYS_PUBLIC' ? 'ALWAYS_PUBLIC' : 'FALLBACK');
        } })
        .catch(() => { if (!cancelled && request === sequence) { setCapabilities(null); setOfficialWebEnabled(null); } });
    };
    const checkVisible = () => { if (document.visibilityState === 'visible') check(); };
    check();
    const interval = window.setInterval(checkVisible, 30000);
    window.addEventListener('focus', checkVisible);
    document.addEventListener('visibilitychange', checkVisible);
    return () => { cancelled = true; controller.abort(); window.clearInterval(interval); window.removeEventListener('focus', checkVisible); document.removeEventListener('visibilitychange', checkVisible); };
  }, [userId, isLoading]);

  useEffect(() => {
    // StrictMode may replay effects before a captured render updates.
    const current = useChatStore.getState().activeConversation;
    if (user && (!current || current.caseId !== caseId)) createConversation(caseId);
  }, [user, activeConversation, caseId, createConversation]);

  const newChat = () => { createConversation(caseId); setSidebarOpen(false); };
  const selectChat = (id: string) => {
    const conversation = conversations.find(c => c.id === id);
    if (!conversation) return;
    setActiveConversation(id);
    setParams(conversation.caseId ? { caseId: conversation.caseId } : {});
    setSidebarOpen(false);
  };
  const changeScope = (value: string) => {
    createConversation(value || undefined);
    setParams(value ? { caseId: value } : {});
  };

  return (
    <div className="flex h-[calc(100dvh-var(--pharmavault-demo-toolbar-height,0px))] min-h-0 overflow-hidden bg-white text-slate-900">
      {sidebarOpen && <button aria-label="Close chat sidebar" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" />}
      <aside className={(sidebarOpen ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden') + ' w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-50 lg:static lg:flex'}>
        <div className="flex items-center justify-between px-4 pb-4 pt-6">
          <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={19} className="text-teal-700" /> PharmaVault</div>
          <button onClick={() => setSidebarOpen(false)} aria-label="Hide chat sidebar" className="rounded p-1 text-slate-400 lg:hidden"><PanelLeftClose size={17} /></button>
        </div>
        <div className="px-3">
          <button onClick={newChat} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium shadow-sm hover:border-teal-300"><Plus size={16} /> New chat</button>
        </div>
        <p className="px-5 pb-2 pt-7 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Recent chats</p>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
          {conversations.map(c => <div key={c.id} className={'group flex items-center rounded-xl ' + (c.id === activeConversation?.id ? 'bg-slate-200/70' : 'hover:bg-slate-200/50')}>
            <button onClick={() => selectChat(c.id)} className="flex min-w-0 flex-1 items-center gap-2 p-3 text-left text-xs text-slate-700">
              <MessageSquare size={13} className="shrink-0 text-slate-400" /><span className="truncate">{c.title}{c.savedId?' · saved':''}</span>
            </button>
            <button aria-label={'Delete chat: ' + c.title} onClick={() => deleteConversation(c.id)} className="mr-1 rounded p-2 text-slate-400 opacity-0 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"><Trash2 size={12} /></button>
          </div>)}
        </div>
        <div className="space-y-3 border-t border-slate-200 p-4">
          <p className="flex items-center gap-2 text-[11px] text-teal-800"><ShieldCheck size={14} /> Private cases stay local</p>
          <SavedHistoryControls />
          <Link to="/cases" className="flex items-center gap-2 text-xs text-slate-600 hover:text-teal-700"><ArrowLeft size={13} /> Verification cases</Link>
          <Link to={portalHome(user?.role)} className="block text-xs text-slate-400">Return to portal</Link>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-slate-100 px-4 py-4 md:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} aria-label="Open chat sidebar" className="rounded p-1 text-slate-500 lg:hidden"><Menu size={19} /></button>
              <div><h1 className="text-sm font-semibold text-slate-900 md:text-base">Health Assistant <span className="ml-1 font-normal text-slate-400">/ TrustRAG</span></h1>
                <ChatReadinessNotice capabilities={capabilities} privateScope={Boolean(caseId)} />
              </div>
            </div>
            <button onClick={newChat} aria-label="Start a new chat" className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><Plus size={16} /></button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!caseId && <KnowledgeReviewPanel />}
            <label htmlFor="chat-scope" className="text-[10px] uppercase tracking-wide text-slate-400">Evidence scope</label>
            <select id="chat-scope" value={caseId || ''} disabled={isLoading} onChange={e => changeScope(e.target.value)} className="max-w-full rounded-lg border-slate-200 py-1.5 pl-2 pr-7 text-xs text-slate-600">
              <option value="">Public medicine references + project knowledge</option>
              {caseId && !cases.some(c => c.id === caseId) && <option value={caseId}>Selected case - server checks access</option>}
              {cases.map(c => <option key={c.id} value={c.id}>{c.caseReference} · {c.status}</option>)}
            </select>
            {!caseId && officialWebEnabled !== null && <span className="text-[10px] text-slate-500">Official-source lookup: {officialWebEnabled ? officialWebPolicy === 'ALWAYS_PUBLIC' ? 'checked for eligible public questions · fresh cache reused' : 'fallback for approved public topics' : 'disabled'} · Private cases never searched online</span>}
            {capabilities?.embeddingEnabled && !caseId && <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] text-teal-700">Semantic retrieval configured · checked per answer</span>}
          </div>
          {caseLoadError && <p className="mt-2 text-xs text-amber-800">Could not load case choices. Public reference chat remains available.</p>}
          {activeConversation?.savedId && <p className="mt-2 text-[11px] text-slate-500">Saved public conversation · earlier answers retain their original sources and dates, not a new evidence check. Ask again to retrieve current references.</p>}
        </header>
        <div className="min-h-0 flex-1"><ChatInterface /></div>
      </div>
    </div>
  );
};
export default HealthAssistant;
