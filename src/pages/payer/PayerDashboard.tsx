import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Clock, MessageSquare, CheckCircle2, ChevronRight, ShieldCheck } from 'lucide-react';
import { claimsApi, CLAIM_STATUS_LABEL, ClaimStatus, formatInr } from '../../api/claimsApi';

type Analytics = Awaited<ReturnType<typeof claimsApi.analytics>>;

const ORDER: ClaimStatus[] = ['SUBMITTED', 'UNDER_PAYER_REVIEW', 'QUERY_RAISED', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'SETTLED', 'WITHDRAWN'];

const PayerDashboard: React.FC = () => {
  const [data, setData] = useState<Analytics | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    claimsApi.analytics().then(setData).catch(() => setFailed(true));
  }, []);

  const count = (s: ClaimStatus) => data?.byStatus[s]?.count || 0;
  const pending = count('SUBMITTED') + count('UNDER_PAYER_REVIEW');

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase px-2.5 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-full">Insurer Workspace</span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Pharmacy Claims Review</h1>
            <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
              Review consented, pharmacist-verified pharmacy cases with their source evidence. PharmaVault highlights inconsistencies; your team makes and records every claim decision.
            </p>
          </div>
          <Link to="/payer/claims" className="px-4 py-2.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-medium text-xs flex items-center space-x-1.5 shadow-xs">
            <Inbox className="w-4 h-4" /><span>Open Claims Queue</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-100">
          {[
            { label: 'Awaiting Review', value: pending, icon: Inbox, tone: 'text-indigo-600' },
            { label: 'Waiting on Claimant', value: count('QUERY_RAISED'), icon: MessageSquare, tone: 'text-amber-600' },
            { label: 'Decided', value: data?.decidedCount ?? 0, icon: CheckCircle2, tone: 'text-emerald-600' },
            { label: 'Avg. Decision Time', value: data?.averageDecisionHours == null ? '—' : `${data.averageDecisionHours} h`, icon: Clock, tone: 'text-slate-600' }
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <Icon className={`w-4 h-4 ${tone}`} />
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono">{data ? value : '…'}</div>
            </div>
          ))}
        </div>
      </div>

      {failed && <p role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">Claim analytics could not be loaded.</p>}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Claims by Status</h3>
            <p className="text-xs text-slate-500">{data?.note || 'Recorded claims in your organization.'}{data?.queryRate != null ? ` Query rate on decided claims: ${data.queryRate}%.` : ''}</p>
          </div>
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-5">Status</th><th className="py-3 px-4">Claims</th><th className="py-3 px-4">Claimed Amount</th><th className="py-3 px-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ORDER.map((s) => (
              <tr key={s} className="hover:bg-slate-50/60">
                <td className="py-3 px-5 font-semibold text-slate-800">{CLAIM_STATUS_LABEL[s]}</td>
                <td className="py-3 px-4 font-mono">{count(s)}</td>
                <td className="py-3 px-4 font-mono">{formatInr(data?.byStatus[s]?.claimedAmount || 0)}</td>
                <td className="py-3 px-5 text-right">
                  <Link to={`/payer/claims?status=${s}`} className="text-indigo-700 font-semibold inline-flex items-center">View <ChevronRight className="w-3.5 h-3.5" /></Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" /> Academic prototype with synthetic data. Settlement is simulated and FHIR exports are draft NHCX-aligned, not certified.
      </p>
    </div>
  );
};

export default PayerDashboard;
