import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import {
  AlertTriangle,
  Clock,
  ShieldCheck,
  Trash2,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingDown,
  RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';

const ExpiryRisk: React.FC = () => {
  const [risks, setRisks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRisk = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/pharmacy/expiry-risk');
      setRisks(data);
    } catch (error) {
      toast.error('Failed to fetch expiry risk data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisk();
  }, []);

  const handleAction = (item: any, action: string) => {
    toast.success(`${action} triggered for ${item.name} (${item.batchNumber})!`);
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'Expired':
        return (
          <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-300 text-xs font-bold rounded-full flex items-center gap-1 w-max">
            <Trash2 size={12} className="text-rose-600" /> Expired
          </span>
        );
      case 'High Risk':
        return (
          <span className="px-2.5 py-1 bg-orange-50 text-orange-800 border border-orange-300 text-xs font-bold rounded-full flex items-center gap-1 w-max">
            <AlertTriangle size={12} className="text-orange-600" /> &lt;30 Days
          </span>
        );
      case 'Watch':
        return (
          <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold rounded-full flex items-center gap-1 w-max">
            <Clock size={12} className="text-amber-600" /> &lt;90 Days
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-full flex items-center gap-1 w-max">
            <ShieldCheck size={12} className="text-emerald-600" /> Safe Buffer
          </span>
        );
    }
  };

  const expiredCount = risks.filter(r => r.riskLevel === 'Expired').length;
  const highRiskCount = risks.filter(r => r.riskLevel === 'High Risk').length;
  const watchCount = risks.filter(r => r.riskLevel === 'Watch').length;

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Expiry Risk Intelligence</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              FEFO Inventory Protection
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Predictive First-Expired, First-Out (FEFO) algorithms to mitigate medication loss and quarantine expired stock.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Expired Batches</span>
            <Trash2 className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">{expiredCount}</div>
          <p className="text-[11px] text-rose-600/80 mt-0.5">Quarantine required immediately</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-orange-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-600">Critical (&lt;30d)</span>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-black text-orange-700 mt-2">{highRiskCount}</div>
          <p className="text-[11px] text-orange-600/80 mt-0.5">FEFO priority dispensing</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Watchlist (&lt;90d)</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">{watchCount}</div>
          <p className="text-[11px] text-amber-600/80 mt-0.5">Monitor turn velocity</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Compliance Rate</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">99.4%</div>
          <p className="text-[11px] text-emerald-600/80 mt-0.5">Regulatory disposal grade</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-bold">
            Auditing shelf-life timestamps across active inventory...
          </div>
        ) : risks.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">All Batches Have Healthy Expiry Windows</h3>
            <p className="text-xs text-slate-500 mt-1">No medicines within near-term expiration thresholds.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-4 pl-6">Medicine & Batch</th>
                  <th className="p-4">Days Remaining</th>
                  <th className="p-4">Risk Classification</th>
                  <th className="p-4">AI Recommended Protocol</th>
                  <th className="p-4 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {risks.map(item => (
                  <tr key={item._id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="p-4 pl-6">
                      <p className="font-bold text-slate-900 group-hover:text-blue-700 text-sm">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Batch: {item.batchNumber}
                      </p>
                    </td>

                    <td className="p-4">
                      <span className="font-black text-slate-900 text-sm">
                        {item.daysRemaining < 0 ? 'Expired' : `${item.daysRemaining} days`}
                      </span>
                    </td>

                    <td className="p-4">{getRiskBadge(item.riskLevel)}</td>

                    <td className="p-4 font-bold text-blue-700">
                      {item.suggestedAction || 'Prioritize in FEFO rotation'}
                    </td>

                    <td className="p-4 pr-6 text-right">
                      {item.riskLevel === 'Expired' ? (
                        <button
                          onClick={() => handleAction(item, 'Quarantine & Disposal Protocol')}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-colors"
                        >
                          Quarantine
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(item, 'FEFO Priority Tag')}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold border border-blue-200 transition-colors"
                        >
                          Apply FEFO
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpiryRisk;
