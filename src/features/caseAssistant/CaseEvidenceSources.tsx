import { ExternalLink } from 'lucide-react';
import { caseSourceHref } from './contract';
import type { CaseAssistantAnswer } from './types';

type Sources = CaseAssistantAnswer['sources'];

export function CaseSourceCards({ caseId, sources }: { caseId: string; sources: Sources }) {
  return <div className="grid gap-2">{sources.map(source => {
    const href = caseSourceHref(caseId, source);
    return <div key={source.sourceId} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-semibold text-slate-800">[{source.citation}] {source.title}</p>
      <p className="mt-1 text-xs leading-6 text-slate-600">{source.excerpt}</p>
      <p className="mt-2 text-[10px] text-slate-400">Evidence fingerprint {source.fingerprint.slice(0, 12)}{source.pageNumber ? ' · Page ' + source.pageNumber : ''}</p>
      {href && <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-teal-700 underline">Open current protected source{source.pageNumber ? ' · page ' + source.pageNumber : ''} <ExternalLink size={11} /></a>}
    </div>;
  })}</div>;
}

export function CaseEvidenceSources({ answer }: { answer: CaseAssistantAnswer }) {
  const priority = answer.sources.slice(0, 4), additional = answer.sources.slice(4);
  return <section aria-label="Case evidence sources" className="mt-3 space-y-3">
    <p className="text-xs leading-5 text-slate-500">Showing {priority.length} of {answer.sources.length} sources in server-provided priority order. Priority is a reading aid, not a verification decision.</p>
    <CaseSourceCards caseId={answer.caseId} sources={priority} />
    {!!additional.length && <details className="rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-xs font-semibold text-teal-800">Show {additional.length} additional cited sources</summary>
      <p className="my-3 text-xs leading-5 text-slate-500">The complete answer can rely on these fields too. No cited evidence has been removed.</p>
      <CaseSourceCards caseId={answer.caseId} sources={additional} />
    </details>}
  </section>;
}
