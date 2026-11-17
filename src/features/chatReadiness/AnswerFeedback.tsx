import { useState } from 'react';
import apiClient from '../../api/apiClient';
export function AnswerFeedback({ receipt }: { receipt: string }) {
  const [state, setState] = useState<'READY' | 'SAVING' | 'SAVED' | 'ERROR'>('READY');
  async function submit(rating: 'HELPFUL' | 'NOT_HELPFUL') {
    setState('SAVING');
    try { await apiClient.post('/v1/chat/feedback', { receipt, rating }); setState('SAVED'); }
    catch { setState('ERROR'); }
  }
  if (state === 'SAVED') return <p role="status" className="mt-2 text-[11px] text-teal-800">Feedback saved for expert review. It has not trained the model or changed the knowledge base.</p>;
  return <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span>Was this evidence useful?</span><button disabled={state === 'SAVING'} onClick={() => void submit('HELPFUL')} className="rounded border px-2 py-1">Helpful</button><button disabled={state === 'SAVING'} onClick={() => void submit('NOT_HELPFUL')} className="rounded border px-2 py-1">Needs improvement</button>{state === 'ERROR' && <span role="alert">Could not save. The answer receipt may have expired.</span>}</div>;
}
