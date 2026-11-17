import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, BookOpen, FileCheck2, Loader2, ShieldCheck, Square, Sparkles } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import ChatMessage from './ChatMessage';
import { integrationApi } from '../../modules/verification/integration/api';
import type { MedicineChoice } from '../../features/caseAssistant/types';
import { clarificationQuestion } from '../../features/caseAssistant/clarificationQuestion';

const ChatInterface: React.FC = () => {
  const [input, setInput] = useState('');
  const { activeConversation, sendMessage, isLoading, stopResponse, stage, regenerateLastResponse, selectCaseMedicine, refreshCaseFreshness, askAgainWithCurrentEvidence, isCheckingFreshness, freshnessError } = useChatStore();
  const [medicineChoices, setMedicineChoices] = useState<MedicineChoice[]>([]);
  const [contextError, setContextError] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messages = React.useMemo(() => activeConversation?.messages || [], [activeConversation?.messages]);
  const hasMessages = messages.length > 0;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, [activeConversation?.id]);
  useEffect(() => {
    const caseId = activeConversation?.caseId;
    const controller = new AbortController();
    setMedicineChoices([]); setContextError(false);
    if (caseId) integrationApi.getSnapshot(caseId, controller.signal).then(snapshot => {
      if (controller.signal.aborted) return;
      setMedicineChoices([...(snapshot.prescription?.medicineItems || []), ...(snapshot.invoice?.medicineItems || [])].map(item => ({
        itemId: item.itemId, label: String(item.fields.medicine_name.normalizedValue || item.fields.medicine_name.rawValue).slice(0, 240), documentType: item.documentType,
      })));
    }).catch(() => { if (!controller.signal.aborted) setContextError(true); });
    return () => controller.abort();
  }, [activeConversation?.caseId]);
  useEffect(() => {
    if (!activeConversation?.caseId) return;
    const check = () => { if (document.visibilityState === 'visible') void refreshCaseFreshness(); };
    check();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, 30000);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [activeConversation?.id, activeConversation?.caseId, refreshCaseFreshness]);
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    void sendMessage(input);
    setInput('');
  };
  const suggestions = activeConversation?.caseId ? [
    { title: 'Compare document strengths', query: 'Compare prescription and invoice dosage strength for the selected medicine', Icon: FileCheck2 },
    { title: 'Understand the risk flags', query: 'Why is my case flagged?', Icon: ShieldCheck },
    { title: 'Check the case status', query: 'What is the current case status?', Icon: BookOpen },
  ] : [
    { title: 'Understand a medicine', query: 'What is Paracetamol used for?', Icon: BookOpen },
    { title: 'Explore possible side effects', query: 'What are the common side effects of Metformin?', Icon: Sparkles },
    { title: 'Learn about document checks', query: 'What happens when prescription and invoice strengths differ?', Icon: FileCheck2 },
    { title: 'See human review in action', query: 'Explain human-in-the-loop validation simply', Icon: ShieldCheck },
  ];
  const lastCaseAnswer = [...messages].reverse().find(m => m.rag?.caseAnswer)?.rag?.caseAnswer;
  const choices = lastCaseAnswer?.choices.length ? lastCaseAnswer.choices : medicineChoices;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {activeConversation?.caseId && <div className="border-b border-slate-100 bg-teal-50/40 px-4 py-3 md:px-8">
        <div className="mx-auto max-w-3xl space-y-2">
          <label className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-950">Medicine scope
            <select aria-label="Medicine evidence scope" value={activeConversation.medicineItemId ?? ''} disabled={isLoading} onChange={event => selectCaseMedicine(event.target.value || null)} className="max-w-full rounded-lg border border-teal-200 bg-white p-2 text-xs">
              <option value="">Whole case / ask me to clarify</option>
              {activeConversation.medicineItemId && !choices.some(c => c.itemId === activeConversation.medicineItemId) && <option value={activeConversation.medicineItemId}>Previous medicine scope — server must re-check</option>}
              {choices.map(c => <option key={c.itemId} value={c.itemId}>{c.documentType === 'PRESCRIPTION' ? 'Rx' : 'Invoice'} · {c.label}</option>)}
            </select>
          </label>
          <p className="text-[10px] leading-4 text-teal-900">Private case answers stay local. Freshness is rechecked on return to this tab and every 30 seconds while visible—not continuously. Previous answers remain in this in-memory conversation.</p>
          {contextError && <p className="text-xs text-amber-900">Medicine choices could not be loaded. The answer endpoint must re-check scope; no older chat fallback is used.</p>}
          {freshnessError && <p role="alert" className="text-xs text-amber-900">{freshnessError}</p>}
          {isCheckingFreshness && <p role="status" className="text-[10px] text-teal-800">Checking cited source versions…</p>}
        </div>
      </div>}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8" aria-label="Conversation">
        {!hasMessages ? (
          <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center py-12">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Sparkles size={25} /></div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Pharmacy + document evidence</p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">What would you like to understand?</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-500">Understand supported medicine references, clarify medicine identity, or check prescription, invoice and claim evidence. I ask when context is missing. I don’t diagnose, prescribe or approve claims.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {suggestions.map(({ title, query, Icon }) => (
                <button key={query} onClick={() => void sendMessage(query)} className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/40">
                  <Icon size={18} className="mb-3 text-teal-700" />
                  <p className="text-sm font-medium text-slate-800">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{query}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-8 py-8">
            {messages.map(message => <ChatMessage key={message.id} message={message} busy={isLoading} onCheckEvidence={() => void refreshCaseFreshness()} onAskAgain={() => void askAgainWithCurrentEvidence(message.id)} onSelectMedicine={itemId => {
              const question = clarificationQuestion(messages, message.id);
              if (!question || isLoading) return;
              selectCaseMedicine(itemId);
              void sendMessage(question, { medicineItemId: itemId });
            }} />)}
            {isLoading && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />{stage || 'Working on your answer...'}</div>}
            {!isLoading && messages.some(m => m.role === 'assistant') && (
              <button onClick={() => void regenerateLastResponse()} className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-teal-800">{activeConversation?.caseId ? 'Ask last question again · keep previous answer' : 'Regenerate last response'}</button>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="shrink-0 bg-white px-4 pb-4 pt-3 md:px-8">
        <form onSubmit={submit} className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-slate-50 px-5 pb-3 pt-4 shadow-sm focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-50">
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} maxLength={2000} rows={1}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(e); } }}
            placeholder="Ask about a medicine, prescription, invoice or claim evidence..."
            aria-label="Message Health Assistant"
            className="max-h-40 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-slate-900 outline-none focus:ring-0" />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">{activeConversation?.caseId ? 'Private case · stays local' : 'Source-backed educational answers'} · {input.length}/2000</span>
            {isLoading ? (
              <button type="button" onClick={stopResponse} aria-label="Stop response" className="rounded-full bg-slate-900 p-2.5 text-white"><Square size={15} fill="currentColor" /></button>
            ) : (
              <button type="submit" disabled={!input.trim()} aria-label="Send message" className="rounded-full bg-teal-700 p-2.5 text-white transition hover:bg-teal-800 disabled:bg-slate-200"><ArrowUp size={18} /></button>
            )}
          </div>
        </form>
        <p className="mx-auto mt-3 max-w-3xl text-center text-[10px] leading-4 text-slate-400">PharmaVault can make mistakes. Check sources. Not a doctor, prescription service or claim approval system. For emergencies, seek urgent medical help.</p>
      </div>
    </div>
  );
};
export default ChatInterface;
