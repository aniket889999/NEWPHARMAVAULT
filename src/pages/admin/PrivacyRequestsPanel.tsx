import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ShieldCheck, Trash2, RefreshCw, X } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { errorMessage } from '../../api/claimsApi';

interface ErasureRequest {
  id: string;
  userId: string;
  status: 'OPEN' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';
  reason: string | null;
  dueBy: string | null;
  createdAt: string;
  processedAt: string | null;
  outcome?: { note: string | null; casesPurged: number; grantsRevoked: number; notificationsDeleted: number; openClaims: number };
}
interface ChainResult { ok: boolean; checked: number; headSeq: number; legacyUnchained: number; problem?: string; seq?: number; detail?: string }

const STATUSES: ErasureRequest['status'][] = ['OPEN', 'COMPLETED', 'CANCELLED'];

/**
 * Platform administrator tools: patient deletion requests (DPDP) and the audit-chain check.
 * Every action is audited server-side.
 */
const PrivacyRequestsPanel: React.FC = () => {
  const [status, setStatus] = useState<ErasureRequest['status']>('OPEN');
  const [items, setItems] = useState<ErasureRequest[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ErasureRequest | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [chain, setChain] = useState<ChainResult | null>(null);

  const load = async (s = status) => {
    try {
      setItems((await apiClient.get<ErasureRequest[]>('/v1/privacy/data-requests', { params: { status: s } })).data);
      setFailed(null);
    } catch (err) {
      setFailed(errorMessage(err, 'Deletion requests could not be loaded.'));
    }
  };
  useEffect(() => { void load(status); }, [status]);

  const complete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processing) return;
    setBusy(true);
    try {
      const res = await apiClient.post<{ outcome: NonNullable<ErasureRequest['outcome']> }>(`/v1/privacy/data-requests/${processing.id}/complete`, { note: note.trim() });
      toast.success(`Erasure completed: ${res.data.outcome.casesPurged} case(s) purged, ${res.data.outcome.grantsRevoked} consent(s) revoked`);
      setProcessing(null);
      setNote('');
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'The erasure could not be completed.'));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const verifyChain = async () => {
    setBusy(true);
    try {
      const res = await apiClient.get<ChainResult>('/v1/audit/chain/verify');
      setChain(res.data);
      if (res.data.ok) toast.success(`Audit chain intact (${res.data.checked} events)`);
      else toast.error(`Audit chain problem at event #${res.data.seq}`);
    } catch (err) {
      toast.error(errorMessage(err, 'The audit check could not run.'));
    } finally {
      setBusy(false);
    }
  };

  const daysLeft = (due: string | null) => (due ? Math.ceil((new Date(due).getTime() - Date.now()) / 86_400_000) : null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Trash2 size={18} className="text-rose-400" /> Data Deletion Requests</h2>
          <div className="flex items-center gap-2">
            <select aria-label="Request status" value={status} onChange={(e) => setStatus(e.target.value as ErasureRequest['status'])} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200">
              {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
            </select>
            <button type="button" onClick={() => void load()} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300" aria-label="Refresh"><RefreshCw size={16} /></button>
          </div>
        </div>
        {failed && <p role="alert" className="px-6 py-4 text-sm text-amber-300">{failed}</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-800">
              <th className="px-6 py-3">Requested</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Notes</th><th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {items === null && !failed && <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading…</td></tr>}
            {items?.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No {status.toLowerCase()} requests.</td></tr>}
            {items?.map((r) => {
              const left = daysLeft(r.dueBy);
              return (
                <tr key={r.id} className="text-slate-300">
                  <td className="px-6 py-3">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">…{r.userId.slice(-8)}</td>
                  <td className="px-4 py-3">
                    {r.status === 'OPEN' && left !== null
                      ? <span className={left <= 5 ? 'text-rose-400 font-bold' : 'text-slate-300'}>{left < 0 ? `${-left} day(s) overdue` : `${left} day(s) left`}</span>
                      : <span className="text-slate-500">{r.processedAt ? new Date(r.processedAt).toLocaleDateString('en-IN') : '—'}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 max-w-xs">
                    {r.outcome?.openClaims ? <span className="text-amber-300">{r.outcome.openClaims} open claim(s) — waiting</span> : r.outcome?.note || r.reason || '—'}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {r.status === 'OPEN'
                      ? <button type="button" onClick={() => { setProcessing(r); setNote(''); }} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold">Process</button>
                      : <span className="text-xs text-slate-500">{r.status.toLowerCase()}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-400" /> Audit Log Integrity</h2>
        <p className="text-sm text-slate-400">Recomputes the hash chain over every audit event and reports the first edited, missing or reordered event.</p>
        <button type="button" disabled={busy} onClick={verifyChain} className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50">Verify Audit Chain</button>
        {chain && (
          <div className={`rounded-xl border p-4 text-sm ${chain.ok ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300' : 'border-rose-800 bg-rose-950/40 text-rose-300'}`}>
            <p className="font-bold">{chain.ok ? 'Intact' : `Broken: ${chain.problem}`}</p>
            <p className="text-xs mt-1">{chain.checked} event(s) checked · head #{chain.headSeq}{chain.legacyUnchained ? ` · ${chain.legacyUnchained} older event(s) not covered` : ''}</p>
            {!chain.ok && <p className="text-xs mt-1">At event #{chain.seq}: {chain.detail}. Do not edit events; preserve the database and compare with the daily export.</p>}
          </div>
        )}
      </div>

      {processing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={complete} className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Process Deletion Request</h3>
              <button type="button" onClick={() => setProcessing(null)} className="text-slate-400 hover:text-slate-200" aria-label="Close"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-3 text-sm text-slate-300">
              <p>This permanently removes the person's documents and extracted details, revokes all their consents, deletes their notifications, and anonymises and deactivates the account. Claims, review decisions and audit records are kept. It is refused while a claim is open.</p>
              {processing.reason && <p className="text-xs text-slate-400">Their reason: “{processing.reason}”</p>}
              <label htmlFor="erasure-note" className="block font-semibold text-slate-200">Processing note (how you confirmed the request)</label>
              <textarea id="erasure-note" required minLength={10} maxLength={2000} rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100" />
            </div>
            <div className="p-5 border-t border-slate-800 flex justify-end gap-2">
              <button type="button" onClick={() => setProcessing(null)} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300">Cancel</button>
              <button type="submit" disabled={busy || note.trim().length < 10} className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-50">{busy ? 'Processing…' : 'Erase Data'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PrivacyRequestsPanel;
