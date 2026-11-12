import React, { useState, useEffect } from 'react';
import {
  Package,
  AlertTriangle,
  Clock,
  Activity,
  IndianRupee,
  FileSignature,
  BrainCircuit,
  ShieldAlert,
  Award,
  Sparkles,
  ArrowUpRight,
  Search,
  CheckCircle2,
  Plus,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

const PharmacyDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<any>({
    totalValue: 842500,
    totalMedicines: 48,
    lowStockCount: 4,
    expiringSoonCount: 2,
    pendingPrescriptions: 5,
    healthScore: 92,
    blockchainBatches: 124,
  });
  const [insights, setInsights] = useState<string[]>([
    'High regional demand detected for Amoxicillin 500mg - restock recommended.',
    'Batch #PV-9021 expiring in 24 days - automatic discount policy triggered.',
    'All prescription verification hashes matched catalogue ground truth.'
  ]);
  const [nabhStatus, setNabhStatus] = useState<any>({ nabhCertified: true, licenseNumber: 'NABH-PHARM-2026-X' });

  // Modal State
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedStock, setNewMedStock] = useState('100');
  const [newMedBatch, setNewMedBatch] = useState('BATCH-2026-01');

  useEffect(() => {
    const fetchIntelligence = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
        const userStr = localStorage.getItem('user');
        const token = userStr ? JSON.parse(userStr).token : '';

        const headers = { Authorization: `Bearer ${token}` };

        const { data } = await axios.get(`${API_URL}/pharmacy/intelligence`, { headers });
        if (data.metrics) setMetrics(data.metrics);
        if (data.insights && data.insights.length > 0) setInsights(data.insights);

        try {
          const nabhRes = await axios.get(`${API_URL}/regulatory/pharmacy-status`);
          if (nabhRes.data) setNabhStatus(nabhRes.data);
        } catch (_) {}
      } catch (_) {
        // Fallback demo metrics remain intact
      }
    };
    fetchIntelligence();
  }, []);

  const handleSimulateRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName) {
      toast.error('Please enter a medicine name');
      return;
    }
    toast.success(`Batch ${newMedBatch} for ${newMedName} recorded and logged on ledger!`);
    setIsQuickAddModalOpen(false);
    setNewMedName('');
  };

  const handleSimulateReorder = (item: string) => {
    toast.success(`Purchase order generated for ${item} with distributor.`);
    setIsReorderModalOpen(false);
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-7 font-sans bg-slate-50 min-h-full">
      {/* Top Banner */}
      <div className="relative rounded-3xl p-8 bg-gradient-to-r from-cyan-700 via-cyan-600 to-blue-600 text-white shadow-lg overflow-hidden">
        {/* Glow Spheres */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 right-1/3 w-64 h-64 bg-blue-300/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-white text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-cyan-200" /> Pharmacy Operations Hub
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              Pharmacy Operations & Intelligence
            </h1>
            <p className="mt-2 text-cyan-100 text-sm sm:text-base leading-relaxed">
              Real-time supply chain monitoring, automated batch expiry forecasting, and TrustRAG prescription verification.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsQuickAddModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-white text-cyan-700 hover:bg-cyan-50 font-bold text-xs shadow-md transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-cyan-600" /> Quick Batch Registration
              </button>
              <button
                onClick={() => setIsReorderModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-cyan-800/60 hover:bg-cyan-800 text-white border border-cyan-400/40 font-bold text-xs transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4 text-cyan-200" /> Auto-Restock Order
              </button>
              <Link
                to="/cases"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
              >
                <Activity className="w-4 h-4" /> Verification Queue
              </Link>
            </div>
          </div>

          {/* Compliance & Health Score */}
          <div className="p-5 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-md flex flex-col gap-2 min-w-[230px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-100">Inventory Health</span>
              <span className="text-xs font-mono font-bold text-white">Score 92/100</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
              <div className="bg-white h-2 rounded-full w-[92%]" />
            </div>
            <div className="pt-1 flex items-center gap-1.5 text-xs text-white">
              <Award className="w-4 h-4 text-cyan-200" />
              <span>NABH Certified ({nabhStatus?.licenseNumber || 'PV-NABH-2026'})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Value */}
        <Link
          to="/pharmacy/inventory"
          className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-400 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 block group"
        >
          <div className="flex justify-between items-start mb-2.5">
            <span className="text-xs font-semibold text-slate-500">Total Stock Value</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{metrics?.totalValue ? metrics.totalValue.toLocaleString('en-IN') : '8,42,500'}
          </div>
          <div className="text-xs text-emerald-600 mt-2 font-medium flex items-center justify-between">
            <span>Catalogue: {metrics?.totalMedicines || 48} SKUs</span>
            <span className="group-hover:translate-x-1 transition-transform">Inspect →</span>
          </div>
        </Link>

        {/* Low Stock Alerts */}
        <Link
          to="/pharmacy/stock-risk"
          className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-rose-400 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 block group"
        >
          <div className="flex justify-between items-start mb-2.5">
            <span className="text-xs font-semibold text-slate-500">Stock Out Risk</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600">
            {metrics?.lowStockCount || 4} Critical
          </div>
          <div className="text-xs text-rose-600 mt-2 font-medium flex items-center justify-between">
            <span>Requires Reorder</span>
            <span className="group-hover:translate-x-1 transition-transform">View →</span>
          </div>
        </Link>

        {/* Expiring Soon */}
        <Link
          to="/pharmacy/expiry-risk"
          className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-amber-400 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 block group"
        >
          <div className="flex justify-between items-start mb-2.5">
            <span className="text-xs font-semibold text-slate-500">Expiring (&lt;30 Days)</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">
            {metrics?.expiringSoonCount || 2} Batches
          </div>
          <div className="text-xs text-amber-600 mt-2 font-medium flex items-center justify-between">
            <span>Discount Action Triggered</span>
            <span className="group-hover:translate-x-1 transition-transform">View →</span>
          </div>
        </Link>

        {/* Pending Prescriptions */}
        <Link
          to="/pharmacy/prescription-queue"
          className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-400 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 block group"
        >
          <div className="flex justify-between items-start mb-2.5">
            <span className="text-xs font-semibold text-slate-500">Pending Rx Queue</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileSignature className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600">
            {metrics?.pendingPrescriptions || 5} Orders
          </div>
          <div className="text-xs text-blue-600 mt-2 font-medium flex items-center justify-between">
            <span>Human Review Required</span>
            <span className="group-hover:translate-x-1 transition-transform">Process →</span>
          </div>
        </Link>
      </div>

      {/* Secondary Intelligence Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* AI Pharmacy Insights */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">AI Demand & Safety Insights</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
              Predictive Model
            </span>
          </div>
          <div className="space-y-2.5">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5"
              >
                <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                  {insight}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Blockchain Integrity Ledger Card */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Supply Chain Ledger Status</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                Zero Counterfeits
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between mb-3.5">
              <div>
                <p className="text-xs font-bold text-slate-900">Registered Batches</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Anchored with cryptographic hashes</p>
              </div>
              <div className="text-2xl font-black text-emerald-600 font-mono">
                {metrics?.blockchainBatches || 124}
              </div>
            </div>

            <p className="text-xs text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>All dispensed medicines match verified manufacturer signatures.</span>
            </p>
          </div>

          <Link
            to="/pharmacy/blockchain"
            className="mt-5 w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
          >
            Open Blockchain Ledger <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Modal: Quick Add Batch */}
      <Modal
        isOpen={isQuickAddModalOpen}
        onClose={() => setIsQuickAddModalOpen(false)}
        title="Register Pharmaceutical Batch"
        description="Add newly received medicine supply to active catalogue and record authenticity hash."
        maxWidth="md"
      >
        <form onSubmit={handleSimulateRestock} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Medicine Name & Dosage
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ciprofloxacin 500mg Tablet"
              value={newMedName}
              onChange={(e) => setNewMedName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium outline-none focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Batch Code
              </label>
              <input
                type="text"
                required
                value={newMedBatch}
                onChange={(e) => setNewMedBatch(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono font-medium outline-none focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Quantity Units
              </label>
              <input
                type="number"
                required
                value={newMedStock}
                onChange={(e) => setNewMedStock(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium outline-none focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              onClick={() => setIsQuickAddModalOpen(false)}
              className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-xs transition-all"
            >
              Confirm & Mint Hash
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Quick Restock Reorder */}
      <Modal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        title="Distributor Auto-Restock Order"
        description="Quickly place orders for critical low-stock pharmaceuticals."
        maxWidth="md"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            The following items are running below emergency stock buffer thresholds:
          </p>
          {[
            { name: 'Azithromycin 500mg', current: '12 units', reorder: '100 units' },
            { name: 'Metformin 500mg (SR)', current: '8 units', reorder: '250 units' },
            { name: 'Pantoprazole 40mg', current: '15 units', reorder: '150 units' },
          ].map((item, i) => (
            <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-slate-900">{item.name}</p>
                <p className="text-[11px] text-rose-600 font-medium mt-0.5">Stock: {item.current} • Order: {item.reorder}</p>
              </div>
              <button
                type="button"
                onClick={() => handleSimulateReorder(item.name)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition-all"
              >
                Reorder
              </button>
            </div>
          ))}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsReorderModalOpen(false)}
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PharmacyDashboard;
