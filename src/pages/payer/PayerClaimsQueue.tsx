import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw, ChevronRight, MessageSquare, Search } from 'lucide-react';
import { claimsApi, PayerQueueItem, CLAIM_STATUS_LABEL, CLAIM_STATUS_STYLE, ClaimStatus, formatInr } from '../../api/claimsApi';

const FILTERS: (ClaimStatus | 'ALL')[] = ['ALL', 'SUBMITTED', 'UNDER_PAYER_REVIEW', 'QUERY_RAISED', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'SETTLED', 'WITHDRAWN'];
const SLA_HOURS = 72;

const PayerClaimsQueue: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as ClaimStatus | null) || 'ALL';
  const [items, setItems] = useState<PayerQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setItems(await claimsApi.payerQueue(status === 'ALL' ? undefined : status));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = items.filter((i) => !search || `${i.claimReference} ${i.caseReference || ''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Claims Queue</h1>
          <p className="text-xs text-slate-500 mt-1">Oldest open claims first need attention. Claims older than {SLA_HOURS} hours are marked.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Claim or case reference" className="pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg w-56 focus:outline-none focus:ring-1 focus:ring-indigo-600" />
          </div>
          <button onClick={load} className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setParams(f === 'ALL' ? {} : { status: f })} className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${status === f ? 'bg-indigo-700 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
            {f === 'ALL' ? 'All' : CLAIM_STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {failed && <p role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">The claims queue could not be loaded.</p>}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-5">Claim</th><th className="py-3 px-4">Case</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Amount</th><th className="py-3 px-4">Age</th><th className="py-3 px-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading…</td></tr>}
            {!loading && visible.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No claims match this filter.</td></tr>}
            {!loading && [...visible].sort((a, b) => b.ageHours - a.ageHours).map((item) => {
              const open = ['SUBMITTED', 'UNDER_PAYER_REVIEW', 'QUERY_RAISED'].includes(item.status);
              return (
                <tr key={item.id} className="hover:bg-slate-50/60">
                  <td className="py-3.5 px-5 font-mono font-semibold text-slate-900">{item.claimReference}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">{item.caseReference || '—'}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CLAIM_STATUS_STYLE[item.status]}`}>{CLAIM_STATUS_LABEL[item.status]}</span>
                    {item.openQueries > 0 && <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-amber-700"><MessageSquare className="w-3 h-3" />{item.openQueries}</span>}
                  </td>
                  <td className="py-3.5 px-4 font-mono">{formatInr(item.claimedAmount)}</td>
                  <td className={`py-3.5 px-4 font-mono ${open && item.ageHours > SLA_HOURS ? 'text-rose-700 font-semibold' : 'text-slate-500'}`}>{item.ageHours} h</td>
                  <td className="py-3.5 px-5 text-right">
                    <Link to={`/payer/claims/${item.id}`} className="text-indigo-700 hover:text-indigo-800 font-semibold inline-flex items-center">Open <ChevronRight className="w-3.5 h-3.5" /></Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PayerClaimsQueue;
