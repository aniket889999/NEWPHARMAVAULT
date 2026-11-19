import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  Trash2, 
  Tag, 
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
      setRisks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch expiry risk data", error);
      setRisks([]);
      toast.error('Could not load data. Check that the server is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisk();
  }, []);

  const handleApplyMarkdown = async (id: string, medicineName: string, batchNumber: string) => {
    try {
      const { data } = await apiClient.post(`/pharmacy/medicines/${id}/markdown`, { percent: 30 });
      toast.success(`${medicineName} (Batch ${batchNumber}) marked down 30%: now ₹${Number(data.price).toFixed(2)}.`);
      fetchRisk();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Markdown could not be applied.');
    }
  };

  const handleReturnToVendor = async (id: string, medicineName: string, batchNumber: string) => {
    if (!window.confirm(`Recall ${medicineName} batch ${batchNumber}? It is removed from sale (stock set to 0).`)) return;
    try {
      const { data } = await apiClient.post(`/pharmacy/medicines/${id}/recall`, {});
      toast.success(`${medicineName} (Batch ${batchNumber}) recalled: ${data.unitsRemoved} unit(s) removed from sale.`);
      fetchRisk();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Recall could not be recorded.');
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'Expired':
        return (
          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full border border-rose-200 flex items-center w-max">
            <Trash2 size={11} className="mr-1 text-rose-600"/> Expired
          </span>
        );
      case 'High Risk':
        return (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full border border-amber-200 flex items-center w-max">
            <AlertTriangle size={11} className="mr-1 text-amber-600"/> Critical (&lt; 30d)
          </span>
        );
      case 'Watch':
        return (
          <span className="px-2 py-0.5 bg-yellow-50 text-yellow-800 text-[10px] font-bold rounded-full border border-yellow-200 flex items-center w-max">
            <Clock size={11} className="mr-1 text-yellow-600"/> Watch (&lt; 90d)
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200 flex items-center w-max">
            <ShieldCheck size={11} className="mr-1 text-emerald-600"/> Stable (&gt; 90d)
          </span>
        );
    }
  };

  const criticalCount = risks.filter(r => r.riskLevel === 'High Risk' || r.daysRemaining <= 30).length;
  const watchCount = risks.filter(r => r.riskLevel === 'Watch' || (r.daysRemaining > 30 && r.daysRemaining <= 90)).length;
  const stableCount = risks.filter(r => r.riskLevel === 'Safe' || r.daysRemaining > 90).length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
              FEFO Inventory Rotation
            </span>
            <span className="text-xs text-slate-400 font-mono">Automated Horizon Monitor</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">Expiry Risk Intelligence</h1>
          <p className="text-xs text-slate-500 mt-1">
            Predictive tracking of shelf lives, FEFO (First-Expired-First-Out) prioritization, and automated vendor returns.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500">Scheduled Scan:</span>
          <span className="text-xs font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
            Every 24 Hours
          </span>
        </div>
      </div>

      {/* 3 Horizon Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-2xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-medium text-slate-500">Critical Expiry (&lt; 30 Days)</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600 font-mono">
            {loading ? '...' : criticalCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Requires immediate clearance or manufacturer recall.</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-2xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-medium text-slate-500">Watch List (30 - 90 Days)</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 font-mono">
            {loading ? '...' : watchCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Prioritize dispensing over newer incoming stock.</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-medium text-slate-500">Safe Horizon (&gt; 90 Days)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-mono">
            {loading ? '...' : stableCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Optimal stability for routine dispensing.</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-2xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Scanning inventory expiration horizons...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-3.5 pl-5">Medicine & Formulation</th>
                  <th className="p-3.5">Batch Number</th>
                  <th className="p-3.5">Days Remaining</th>
                  <th className="p-3.5">Risk Tier</th>
                  <th className="p-3.5">Recommended Protocol</th>
                  <th className="p-3.5 text-right pr-5">Dispensary Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {risks.map((item, idx) => {
                  const days = item.daysRemaining !== undefined ? item.daysRemaining : 45;
                  const isCritical = days <= 30;

                  return (
                    <tr key={item._id || item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 pl-5">
                        <span className="font-bold text-slate-900">{item.name}</span>
                        {item.manufacturer && (
                          <p className="text-[11px] text-slate-400">{item.manufacturer}</p>
                        )}
                      </td>

                      <td className="p-3.5 font-mono text-slate-700 font-medium">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {item.batchNumber || 'B-UNKNOWN'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center space-x-2">
                          <span className={`font-mono font-bold text-xs ${isCritical ? 'text-rose-600' : 'text-slate-800'}`}>
                            {days < 0 ? 'Passed' : `${days} Days`}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        {getRiskBadge(item.riskLevel || (isCritical ? 'High Risk' : days <= 90 ? 'Watch' : 'Safe'))}
                      </td>

                      <td className="p-3.5 text-slate-600 font-medium">
                        {item.suggestedAction || (isCritical ? 'Apply FEFO priority discount' : 'Routine stock rotation')}
                      </td>

                      <td className="p-3.5 text-right pr-5 space-x-2">
                        {item.recalled ? (
                          <span className="text-[11px] text-rose-600 font-semibold">Recalled</span>
                        ) : isCritical ? (
                          <>
                            {item.markdownPercent > 0 && <span className="text-[11px] text-amber-700 font-semibold mr-1">-{item.markdownPercent}%</span>}
                            <button
                              onClick={() => handleApplyMarkdown(item._id, item.name, item.batchNumber)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold transition-colors inline-flex items-center"
                              title="Mark down for quick dispensing"
                            >
                              <Tag className="w-3 h-3 mr-1" />
                              Markdown
                            </button>
                            <button
                              onClick={() => handleReturnToVendor(item._id, item.name, item.batchNumber)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[11px] font-semibold transition-colors inline-flex items-center"
                              title="Initiate Return to Manufacturer"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Recall
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            Monitoring Active
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};


export default ExpiryRisk;
