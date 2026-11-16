import type { AnswerFreshness } from './types';

export function EvidenceFreshness({ value, generatedAt, onCheck, onAskAgain, busy }: {
  value?: AnswerFreshness; generatedAt: string; onCheck?: () => void; onAskAgain?: () => void; busy?: boolean;
}) {
  const status = value?.status ?? 'UNCHECKED';
  const stale = status === 'STALE';
  const current = status === 'FRESH';
  const title = stale ? 'Outdated answer — cited evidence changed'
    : current ? 'Cited evidence unchanged at last check'
    : status === 'CHECKING' ? 'Checking cited evidence…' : 'Current evidence has not been confirmed';
  const detail = stale ? 'Keep this answer as history. Read the current source and ask again before relying on it.'
    : current ? 'This checks source versions only—not clinical correctness, insurance eligibility or an expert decision.'
    : 'Do not treat an old answer as a current all-clear. A network error or missing receipt cannot confirm freshness.';
  return <section aria-label="Answer evidence freshness" role={stale ? 'alert' : 'status'}
    className={'mb-3 rounded-xl border p-3 text-xs ' + (stale ? 'border-amber-300 bg-amber-50 text-amber-950' : current ? 'border-teal-200 bg-teal-50 text-teal-950' : 'border-slate-200 bg-slate-50 text-slate-700')}>
    <p className="font-semibold">{title}</p>
    <p className="mt-1 leading-5">{detail}</p>
    <p className="mt-1 text-[10px]">Answered {new Date(generatedAt).toLocaleString()}{value?.checkedAt ? ' · Checked ' + new Date(value.checkedAt).toLocaleString() : ''}</p>
    <div className="mt-2 flex flex-wrap gap-3">
      {onCheck && <button type="button" onClick={onCheck} disabled={busy || status === 'CHECKING'} className="underline underline-offset-2 disabled:opacity-40">Check current evidence</button>}
      {onAskAgain && <button type="button" onClick={onAskAgain} disabled={busy} className="font-semibold underline underline-offset-2 disabled:opacity-40">Ask again using current evidence</button>}
    </div>
  </section>;
}
