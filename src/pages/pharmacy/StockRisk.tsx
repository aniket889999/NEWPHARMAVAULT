import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import {
  AlertTriangle,
  TrendingDown,
  CheckCircle2,
  PackageSearch,
  Shuffle,
  BrainCircuit,
  Package,
  Sparkles,
  ArrowRight,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

const StockRisk: React.FC = () => {
  const [risks, setRisks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [substitutes, setSubstitutes] = useState<any>(null);
  const [subModalOpen, setSubModalOpen] = useState(false);

  const fetchRisk = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/pharmacy/stock-risk');
      setRisks(data);
    } catch (error) {
      toast.error('Failed to fetch stock risk data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisk();
  }, []);

  const fetchSubstitutes = async (medicineName: string) => {
    try {
      toast.loading('Consulting AI Pharmacopeia for bioequivalent alternatives...', { id: 'subs' });
      const { data } = await apiClient.get(`/pharmacy/substitutes/${encodeURIComponent(medicineName)}`);
      setSubstitutes(data);
      setSubModalOpen(true);
      toast.dismiss('subs');
    } catch (err) {
      toast.error('Failed to fetch substitutes', { id: 'subs' });
    }
  };

  const handleSimulateRestock = (item: any) => {
    toast.success(`Purchase order dispatched to distributor for ${item.suggestedReorder || 50} units of ${item.name}!`);
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'Out of Stock':
        return (
          <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-300 text-xs font-bold rounded-full flex items-center w-max gap-1">
            <AlertTriangle size={12} className="text-rose-600" /> Out of Stock
          </span>
        );
      case 'Low':
        return (
          <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold rounded-full flex items-center w-max gap-1">
            <TrendingDown size={12} className="text-amber-600" /> Low Stock
          </span>
        );
      case 'Watch':
        return (
          <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold rounded-full flex items-center w-max gap-1">
            <PackageSearch size={12} className="text-blue-600" /> Watch
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-full flex items-center w-max gap-1">
            <CheckCircle2 size={12} className="text-emerald-600" /> Adequate
          </span>
        );
    }
  };

  const outOfStockCount = risks.filter(r => r.riskLevel === 'Out of Stock').length;
  const lowCount = risks.filter(r => r.riskLevel === 'Low').length;

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Supply Shortage Predictor</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              AI Predictive Inventory
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Predictive stock-out modeling, intelligent reorder thresholds, and therapeutic substitute matching.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Stockouts</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">{outOfStockCount}</div>
          <p className="text-[11px] text-rose-600/80 mt-0.5">Critical zero stock items</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Low Stock</span>
            <TrendingDown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">{lowCount}</div>
          <p className="text-[11px] text-amber-600/80 mt-0.5">Below buffer safety minimum</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Tracked Formulations</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2">{risks.length}</div>
          <p className="text-[11px] text-blue-500/80 mt-0.5">Active catalog monitoring</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">AI Substitute Ready</span>
            <BrainCircuit className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">100%</div>
          <p className="text-[11px] text-emerald-600/80 mt-0.5">Bioequivalents indexed</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-bold">
            Running predictive shortage scans...
          </div>
        ) : risks.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Inventory Levels are Fully Buffered</h3>
            <p className="text-xs text-slate-500 mt-1">No short-term shortage hazards detected.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-4 pl-6">Medicine Formulation</th>
                  <th className="p-4">Current Stock Units</th>
                  <th className="p-4">Risk Level</th>
                  <th className="p-4">Suggested Reorder</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
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
                        Batch: {item.batchNumber || 'Live Tracking'}
                      </p>
                    </td>

                    <td className="p-4 font-black text-slate-900 text-sm">{item.stock} units</td>

                    <td className="p-4">{getRiskBadge(item.riskLevel)}</td>

                    <td className="p-4 font-bold text-blue-700">
                      {item.suggestedReorder > 0 ? `+${item.suggestedReorder} units recommended` : 'Healthy stock'}
                    </td>

                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.suggestedReorder > 0 && (
                          <button
                            onClick={() => handleSimulateRestock(item)}
                            className="text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors"
                          >
                            ⚡ Reorder
                          </button>
                        )}
                        <button
                          onClick={() => fetchSubstitutes(item.name)}
                          className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                        >
                          <Shuffle size={13} />
                          <span>Substitutes</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Substitute Modal */}
      {subModalOpen && substitutes && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <BrainCircuit className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">AI Bioequivalent Substitutes</h3>
              </div>
              <button
                onClick={() => setSubModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-blue-50/70 border border-blue-100 p-4 rounded-2xl text-xs space-y-1">
              <p className="text-blue-900 font-bold">
                Requested Drug: <span className="font-normal">{substitutes.original}</span>
              </p>
              {substitutes.genericClass && (
                <p className="text-blue-800">
                  <strong className="font-bold">Pharmacological Class:</strong> {substitutes.genericClass}
                </p>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Available In-Stock Equivalents
              </h4>
              {substitutes.inventoryAlternatives?.length > 0 ? (
                <div className="space-y-2">
                  {substitutes.inventoryAlternatives.map((alt: any) => (
                    <div
                      key={alt._id}
                      className="p-3 rounded-2xl border border-slate-200 bg-white flex justify-between items-center text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{alt.name}</p>
                        <p className="text-[11px] text-slate-500">
                          Stock: {alt.stock} units • Price: ₹{alt.price}
                        </p>
                      </div>
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[11px] rounded-full border border-emerald-200">
                        In Stock
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800">
                  No direct in-stock alternatives found in local inventory. Distributor transfer recommended.
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSubModalOpen(false)}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
              >
                Close Substitute Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockRisk;
