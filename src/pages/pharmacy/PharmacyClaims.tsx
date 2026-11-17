import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ChevronRight, MessageSquare, Building2 } from 'lucide-react';
import { claimsApi, CLAIM_STATUS_LABEL, CLAIM_STATUS_STYLE } from '../../api/claimsApi';

type Row = Awaited<ReturnType<typeof claimsApi.pharmacyClaims>>[number];

const PharmacyClaims: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await claimsApi.pharmacyClaims());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full">Read-only</span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Insurance Claims on Our Cases</h1>
          <p className="text-xs text-slate-500 max-w-2xl">Track what happened after your verified cases were submitted to insurers. Insurers ask claimants directly; your verification record stays unchanged.</p>
        </div>
        <button onClick={load} className="px-3 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5 self-start">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {failed && <p role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">Claim status could not be loaded.</p>}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-5">Claim</th><th className="py-3 px-4">Case</th><th className="py-3 px-4">Insurer</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Updated</th><th className="py-3 px-5 text-right">Case</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No claims have been submitted on your cases yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="py-3.5 px-5 font-mono font-semibold text-slate-900">{r.claimReference}</td>
                <td className="py-3.5 px-4 font-mono text-slate-600">{r.caseReference || '—'}</td>
                <td className="py-3.5 px-4 text-slate-600"><span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{r.payerName || 'Insurer'}</span></td>
                <td className="py-3.5 px-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CLAIM_STATUS_STYLE[r.status]}`}>{CLAIM_STATUS_LABEL[r.status]}</span>
                  {r.openQueries > 0 && <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-amber-700"><MessageSquare className="w-3 h-3" />{r.openQueries} open</span>}
                </td>
                <td className="py-3.5 px-4 text-slate-500">{new Date(r.updatedAt).toLocaleString('en-IN')}</td>
                <td className="py-3.5 px-5 text-right">
                  <Link to={`/cases/${r.caseId}`} className="text-blue-700 hover:text-blue-800 font-semibold inline-flex items-center">Open <ChevronRight className="w-3.5 h-3.5" /></Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PharmacyClaims;
