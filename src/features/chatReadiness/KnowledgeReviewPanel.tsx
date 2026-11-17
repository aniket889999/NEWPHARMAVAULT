import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
interface Source { id: string; title: string; excerpt: string; topics: string[]; focuses: string[]; version: string }
interface Catalogue { corpusHash: string; topics: { id: string; label: string }[]; focuses: string[]; sources: Source[] }
interface Candidate { _id: string; topicId: string; focus: string; sourceIds: string[]; createdBy: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED'; revision: number; approvalVersion: number }
export function KnowledgeReviewPanel() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false), [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]), [feedbackCount, setFeedbackCount] = useState(0);
  const [topic, setTopic] = useState('workflow-human-review'), [focus, setFocus] = useState('DEFINITION'), [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const dialog = useRef<HTMLElement>(null);
  // Membership is checked by the API from the authenticated database user.
  // Legacy login DTOs do not include organizationId; client cache is not authority.
  const allowed = ['pharmacist', 'claims_reviewer', 'org_admin', 'super_admin', 'admin'].includes(user?.role || '');
  const load = useCallback(async () => {
    setError('');
    try { const [refs, pending, votes] = await Promise.all([apiClient.get<Catalogue>('/v1/chat/knowledge/references'), apiClient.get<Candidate[]>('/v1/chat/knowledge/candidates'), apiClient.get<unknown[]>('/v1/chat/knowledge/feedback')]); setCatalogue(refs.data); setCandidates(pending.data); setFeedbackCount(votes.data.length); }
    catch { setError('Review data is unavailable. An authorized organization reviewer is required.'); }
  }, []);
  useEffect(() => { if (open && allowed) void load(); }, [open, allowed, load]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controls = () => [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), [href]') || [])];
    controls()[0]?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'Tab') {
        const items = controls(), first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('keydown', close); previous?.focus(); };
  }, [open]);
  if (!allowed) return null;
  const sources = catalogue?.sources.filter(value => value.topics.includes(topic) && value.focuses.includes(focus)) || [];
  async function propose() {
    if (!catalogue) return; setBusy(true); setError(''); setNotice('');
    try { await apiClient.post('/v1/chat/knowledge/candidates', { topicId: topic, focus, sourceIds: selected, corpusHash: catalogue.corpusHash }); setSelected([]); await load(); setNotice('Proposal saved. A different reviewer must approve it. No model weights changed.'); }
    catch { setError('Proposal failed. Check current topic/focus references and refresh.'); }
    finally { setBusy(false); }
  }
  async function review(candidate: Candidate, decision: 'APPROVE' | 'REJECT' | 'REVOKE') {
    setBusy(true); setError(''); setNotice('');
    try { await apiClient.post('/v1/chat/knowledge/candidates/' + candidate._id + '/review', { decision, revision: candidate.revision, reasonCode: decision === 'APPROVE' ? 'SOURCE_FOCUS_SUPPORTED' : decision === 'REVOKE' ? 'REVERT_TO_DEFAULT' : 'NEEDS_SOURCE_REVIEW' }); await load(); setNotice(decision === 'APPROVE' ? 'Retrieval preference approved for this organization. New answers can use it; model weights and historical answers are unchanged.' : decision === 'REVOKE' ? 'Preference revoked. Default retrieval restored.' : 'Proposal rejected; retrieval is unchanged.'); }
    catch { setError('Decision rejected. Self-review, stale revisions and cross-organization access are blocked. Refresh before retrying.'); }
    finally { setBusy(false); }
  }
  return <><button onClick={() => setOpen(true)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-teal-800">Knowledge review</button>{open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4"><section ref={dialog} role="dialog" aria-modal="true" aria-label="Controlled knowledge review" className="max-h-[90dvh] w-full max-w-4xl space-y-5 overflow-y-auto rounded-2xl bg-white p-6 text-slate-900">
    <header className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Controlled retrieval improvement</h2><p className="mt-2 text-sm text-slate-600">Review source relevance—not clinical correctness. Two reviewers are required. Feedback never automatically becomes medical knowledge or retrains Gemini.</p></div><button aria-label="Close knowledge review" onClick={() => setOpen(false)} className="rounded border px-3 py-2">Close</button></header>
    <p className="text-sm">Organization improvement feedback: {feedbackCount}. Only rating/source metadata is stored, not raw chats or patient text.</p>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}<button onClick={() => void load()} className="ml-2 underline">Refresh</button></p>}{notice && <p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-900">{notice}</p>}
    {catalogue && <section className="rounded-xl border p-4"><h3 className="font-semibold">Propose a source preference</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Topic<select aria-label="Curation topic" value={topic} onChange={event => { setTopic(event.target.value); setSelected([]); }} className="mt-1 w-full rounded border p-2">{catalogue.topics.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label><label className="text-sm">Answer focus<select aria-label="Curation focus" value={focus} onChange={event => { setFocus(event.target.value); setSelected([]); }} className="mt-1 w-full rounded border p-2">{catalogue.focuses.map(value => <option key={value}>{value}</option>)}</select></label></div><p className="mt-3 text-xs text-slate-500">Inspect and select at most two compatible references. No new medical claims can be submitted.</p><div className="mt-3 space-y-3">{sources.map(source => <label key={source.id} className="flex gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" aria-label={'Prefer ' + source.title} checked={selected.includes(source.id)} onChange={event => setSelected(values => event.target.checked ? [...values, source.id].slice(0, 2) : values.filter(id => id !== source.id))} /><span><strong>{source.title}</strong><span className="mt-1 block text-slate-600">{source.excerpt}</span><span className="mt-1 block text-xs text-slate-400">{source.version}</span></span></label>)}</div>{!sources.length && <p className="mt-3 text-sm">No registry source supports this topic/focus combination.</p>}<button disabled={busy || !selected.length} onClick={() => void propose()} className="mt-4 rounded-lg bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-40">Submit retrieval proposal</button></section>}
    <section><h3 className="font-semibold">Proposal history</h3><div className="mt-3 space-y-3">{candidates.map(value => <article key={value._id} className="rounded-xl border p-4 text-sm"><strong>{value.topicId} · {value.focus}</strong><p className="mt-1 text-slate-500">{value.status} · revision {value.revision} · policy version {value.approvalVersion}</p><p className="mt-1 text-xs">{value.sourceIds.map(id => catalogue?.sources.find(source => source.id === id)?.title || 'Source registry changed').join(' / ')}</p>{value.createdBy === user?._id ? <p className="mt-2 text-xs text-amber-800">You created this proposal; another reviewer must decide.</p> : <div className="mt-3 flex gap-3">{value.status === 'PENDING' && <><button disabled={busy} onClick={() => void review(value, 'APPROVE')} className="rounded border px-3 py-2 text-teal-800">Approve source preference</button><button disabled={busy} onClick={() => void review(value, 'REJECT')} className="rounded border px-3 py-2">Reject proposal</button></>}{value.status === 'APPROVED' && <button disabled={busy} onClick={() => void review(value, 'REVOKE')} className="rounded border px-3 py-2 text-rose-800">Revoke preference</button>}</div>}</article>)}</div></section>
  </section></div>}</>;
}
