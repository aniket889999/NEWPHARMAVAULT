import React, { useState } from 'react';
import { Check, ChevronDown, Copy, ExternalLink, FileText, Globe, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage as Message } from '../../types';
import { EvidenceFreshness } from '../../features/caseAssistant/EvidenceFreshness';
import { CaseEvidenceSources } from '../../features/caseAssistant/CaseEvidenceSources';
import { AnswerFeedback } from '../../features/chatReadiness/AnswerFeedback';

function officialLink(url?: string) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ['www.nhs.uk', 'medlineplus.gov', 'www.cdc.gov', 'www.fda.gov'].includes(parsed.hostname) && !parsed.port && !parsed.username && !parsed.password ? parsed.href : undefined;
  } catch { return undefined; }
}

const ChatMessage: React.FC<{ message: Message; onCheckEvidence?: () => void; onAskAgain?: () => void; onSelectMedicine?: (id: string) => void; busy?: boolean }> = ({ message, onCheckEvidence, onAskAgain, onSelectMedicine, busy }) => {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === 'user';
  const rag = message.rag;
  // Sources that came from the approved official web search (shown openly, not hidden behind the toggle).
  const webSources = (rag?.sources || []).filter(source => Boolean(officialLink(source.sourceUrl)));
  const streaming = message.deliveryStatus === 'streaming';
  const caseAnswer = rag?.caseAnswer;
  const request = rag?.context?.request;
  const detailLabels: Record<string, string> = { GENERAL: 'General information', USES: 'Uses', SIDE_EFFECTS: 'Possible side effects', STORAGE: 'Storage', PREVENTION: 'Prevention', MECHANISM: 'How it works', SPECIFIC_FACT: 'Specific question' };
  const copy = async () => {
    const warning = caseAnswer && message.freshness?.status !== 'FRESH' ? '[Historical answer: current cited evidence is not confirmed. Check the current source before relying on it.]\n\n' : '';
    try { await navigator.clipboard.writeText(warning + message.content); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };
  if (isUser) return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-slate-100 px-5 py-3 text-sm leading-7 text-slate-900">{message.content}</div>
    </div>
  );
  return (
    <div className="group flex gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-teal-700"><Sparkles size={17} /></div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-900">PharmaVault</span>
          {!streaming && rag && <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
            {rag.mode === 'GEMINI_RAG' ? 'Generated with retrieved evidence' : rag.mode === 'LOCAL_CASE_EVIDENCE' ? 'Local case evidence · no external LLM' : rag.mode === 'PRECISE_LOCAL_EVIDENCE' ? 'Focused local evidence · no LLM synthesis' : rag.mode === 'PRECISE_WEB_EVIDENCE' ? 'Focused official web evidence · no LLM synthesis' : rag.mode === 'OFFICIAL_WEB_EXTRACTIVE' ? 'Official web source notes · no LLM synthesis' : rag.mode === 'LOCAL_EXTRACTIVE' ? 'Local source notes · no LLM' : rag.mode === 'SAFETY' ? 'Safety guidance' : rag.mode === 'CLARIFY' ? 'One quick clarification' : rag.mode === 'ABSTAIN' ? 'Evidence boundary' : 'Assistant'}
          </span>}
          {streaming && <span className="text-[10px] text-teal-700">Preparing a cited answer...</span>}
        </div>
        {!streaming && rag?.context && <div className="mb-3 text-[11px] text-slate-500"><p>Context: {rag.context.topics.map(topic => topic.label).join(', ') || 'Current question'}{rag.context.followupResolved ? ' · carried from your earlier question' : ''}</p>{!!rag.agentTrace?.length && <details className="mt-1"><summary className="cursor-pointer">Evidence route · tool actions, not model reasoning</summary><ul className="mt-1 space-y-1">{rag.agentTrace.map((step, index) => <li key={index}>{step.tool.replace(/_/g, ' ')} → {step.status.replace(/_/g, ' ')}</li>)}</ul></details>}</div>}
        {caseAnswer?.bindingToken && <EvidenceFreshness value={message.freshness} generatedAt={caseAnswer.generatedAt} onCheck={onCheckEvidence} onAskAgain={onAskAgain} busy={busy} />}
        {!streaming && rag?.context?.topicSwitchResolved && <p className="mb-2 text-xs text-teal-800">Switched to your new topic.</p>}
        {!streaming && request && request.evidenceStatus !== 'NOT_ASSESSED' && <p className={'mb-2 rounded-lg px-3 py-2 text-xs ' + (request.evidenceStatus === 'MISSING' ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-600')}>{detailLabels[request.attribute] || 'Requested detail'} · {request.evidenceStatus === 'MISSING' ? 'No supporting passage found for this request.' : 'Supporting text found. Please verify the source.'}</p>}
        {!streaming && rag?.answerQuality && <p className="mb-2 text-[10px] text-slate-400">Focus: {rag.answerQuality.focus.replace(/_/g, ' ').toLowerCase()} · {rag.answerQuality.words} words · {rag.answerQuality.sourceCount} cited source(s){rag.context?.knowledgeRevision ? ' · reviewed retrieval policy v' + rag.context.knowledgeRevision : ''} · Not a clinical accuracy score</p>}
        <div className={'prose prose-sm max-w-none break-words leading-7 text-slate-800 prose-headings:font-semibold prose-a:text-teal-700 ' + (message.freshness?.status === 'STALE' ? 'border-l-2 border-amber-300 pl-3' : '')}>
          {message.content ? <ReactMarkdown skipHtml components={caseAnswer ? { a: ({ children }) => <span>{children}</span> } : undefined}>{message.content}</ReactMarkdown> : <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-teal-600" />}
        </div>
        {caseAnswer?.mode === 'CLARIFY' && !!caseAnswer.choices.length && <><p className="mt-3 text-xs text-teal-900">Choose a medicine to answer this question in that scope. Earlier messages stay unchanged.</p><div className="mt-2 flex flex-wrap gap-2" aria-label="Medicine clarification choices">{caseAnswer.choices.map(choice => <button type="button" key={choice.itemId} disabled={busy} onClick={() => onSelectMedicine?.(choice.itemId)} className="rounded-lg border border-teal-200 px-3 py-2 text-left text-xs text-teal-900 disabled:opacity-40">Use {choice.documentType === 'PRESCRIPTION' ? 'prescription' : 'invoice'}: {choice.label}</button>)}</div></>}
        {message.deliveryStatus === 'stopped' && <p className="mt-2 text-xs text-slate-400">Stopped. Any displayed paragraphs are partial.</p>}
        {message.deliveryStatus === 'error' && <p className="mt-2 text-xs text-rose-600">Please retry or check your session.</p>}
        {!!rag?.warnings.length && <div className="mt-3 space-y-1">{rag.warnings.map((w, i) => <p key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{w}</p>)}</div>}
        {!streaming && !caseAnswer && webSources.length > 0 && (
          <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/60 p-3" aria-label="Web sources searched">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-900"><Globe size={13} /> Searched the web · MedlinePlus (U.S. National Library of Medicine)</p>
            <ul className="mt-2 space-y-1.5">
              {webSources.map(source => <li key={source.sourceId} className="text-xs">
                <a href={officialLink(source.sourceUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-teal-800 underline">[{source.citation}] {source.title.replace(/^MedlinePlus:\s*/, '')} <ExternalLink size={11} /></a>
                <span className="ml-1 text-[10px] text-slate-500">{officialLink(source.sourceUrl)?.replace('https://', '')}{source.version ? ' · ' + source.version : ''}</span>
              </li>)}
            </ul>
            <p className="mt-2 text-[10px] text-slate-500">Only the medicine or topic name was sent to the search, never your question, chat history or case documents.</p>
          </div>
        )}
        {!!rag?.sources.length && (
          <div className="mt-4">
            <button onClick={() => setShowSources(!showSources)} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50" aria-expanded={showSources}>
              <FileText size={13} /> Sources · {rag.sources.length}<ChevronDown size={13} className={showSources ? 'rotate-180' : ''} />
            </button>
            {showSources && caseAnswer && <CaseEvidenceSources answer={caseAnswer} />}
            {showSources && !caseAnswer && <div className="mt-3 grid gap-2">
              {rag.sources.map(source => <div key={source.sourceId} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <p className="text-xs font-semibold text-slate-800">[{source.citation}] {source.title}</p>
                <p className="mt-1 text-xs leading-6 text-slate-600">{source.excerpt}</p>
                <p className="mt-2 text-[10px] text-slate-400">{source.version}{source.pageNumber ? ' · Page ' + source.pageNumber : ''}</p>
                {officialLink(source.sourceUrl) && <a href={officialLink(source.sourceUrl)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-teal-700 underline">Read original reference <ExternalLink size={11} /></a>}
                {source.href && /^\/cases\/[a-f0-9]{24}$/i.test(source.href) && <a href={source.href} className="mt-2 inline-block text-xs text-teal-700 underline">Open protected case</a>}
              </div>)}
            </div>}
            <p className="mt-2 text-[10px] text-slate-400">{rag.retrieval.method === 'CASE_ITEM_EVIDENCE' ? 'Case- and medicine-bound local evidence' : rag.retrieval.method === 'CONTEXT_RERANKED_BM25' ? 'BM25 + locally trained context reranker' : rag.retrieval.method === 'APPROVED_WEB_BM25' ? 'Approved official-source search + keyword ranking' : rag.retrieval.method === 'HYBRID_BM25_VECTOR' ? 'Hybrid keyword + semantic retrieval' : 'Keyword retrieval'} · Citations are traceability, not a guarantee of correctness.</p>
          </div>
        )}
        {message.content && !streaming && <button onClick={() => void copy()} aria-label="Copy answer" className="mt-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">{copied ? <Check size={14} /> : <Copy size={14} />}</button>}
        {!streaming && message.deliveryStatus === 'complete' && rag?.feedbackReceipt && <AnswerFeedback key={rag.feedbackReceipt} receipt={rag.feedbackReceipt} />}
      </div>
    </div>
  );
};
export default ChatMessage;
