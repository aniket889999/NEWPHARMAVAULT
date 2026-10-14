import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, Clock, Activity, IndianRupee, FileText, BrainCircuit, ShieldAlert, Award, FileSignature } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const PharmacyDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [nabhStatus, setNabhStatus] = useState<any>(null);

  useEffect(() => {
    const fetchIntelligence = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
        const userStr = localStorage.getItem('pharmavault_user');
        const token = userStr ? JSON.parse(userStr).token : '';

        const headers = { Authorization: `Bearer ${token}` };

        // Fetch Intelligence Dashboard
        const { data } = await axios.get(`${API_URL}/pharmacy/intelligence`, { headers });
        setMetrics(data.metrics);
        setInsights(data.insights);
        
        // Fetch NABH Status
        try {
          const nabhRes = await axios.get(`${API_URL}/regulatory/pharmacy-status`);
          setNabhStatus(nabhRes.data);
        } catch(e) {}
        
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch intelligence', error);
        setLoading(false);
      }
    };
    fetchIntelligence();
  }, []);

  return (
    <div className="p-8 bg-slate-50 min-h-full">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            Pharmacy Smart Dashboard
            {nabhStatus?.nabhCertified && (
              <span className="ml-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                <Award size={14} className="mr-1" /> NABH Certified ({nabhStatus.licenseNumber})
              </span>
            )}
            {!loading && metrics && (
              <span className={`ml-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${metrics.healthScore > 80 ? 'bg-green-100 text-green-800 border border-green-200' : metrics.healthScore > 50 ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                Health Score: {metrics.healthScore}/100
              </span>
            )}
          </h1>
          <p className="text-slate-500 mt-1">Real-time AI-powered inventory and workflow overview.</p>
        </div>
      </div>
      
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Link to="/pharmacy/inventory" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-transform hover:-translate-y-1 block cursor-pointer group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-sm font-medium mb-1">Total Inventory Value</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {loading ? '...' : `₹${metrics?.totalValue.toLocaleString('en-IN')}`}
              </h3>
            </div>
            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <IndianRupee className="text-green-600" size={20} />
            </div>
          </div>
          <p className="text-xs text-green-600 mt-4 font-medium flex justify-between items-center">
            <span>Total Catalog: {metrics?.totalMedicines}</span>
            <span className="text-gray-400 group-hover:text-green-600 transition-colors">View →</span>
          </p>
        </Link>

        <Link to="/pharmacy/stock-risk" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-transform hover:-translate-y-1 block cursor-pointer group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-sm font-medium mb-1">Low Stock Alerts</p>
              <h3 className="text-2xl font-bold text-red-600">{loading ? '...' : metrics?.lowStockCount}</h3>
            </div>
            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center group-hover:bg-red-100 transition-colors">
              <AlertTriangle className="text-red-500" size={20} />
            </div>
          </div>
          <p className="text-xs text-red-500 mt-4 font-medium flex justify-between items-center">
            <span>Critical Restock Priority</span>
            <span className="text-gray-400 group-hover:text-red-500 transition-colors">View →</span>
          </p>
        </Link>

        <Link to="/pharmacy/expiry-risk" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-transform hover:-translate-y-1 block cursor-pointer group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-sm font-medium mb-1">Expiring Soon</p>
              <h3 className="text-2xl font-bold text-orange-500">{loading ? '...' : metrics?.expiringSoonCount}</h3>
            </div>
            <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center group-hover:bg-orange-100 transition-colors">
              <Clock className="text-orange-500" size={20} />
            </div>
          </div>
          <p className="text-xs text-orange-500 mt-4 font-medium flex justify-between items-center">
            <span>High Risk (&lt;30 Days)</span>
            <span className="text-gray-400 group-hover:text-orange-500 transition-colors">View →</span>
          </p>
        </Link>

        <Link to="/pharmacy/prescription-queue" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-transform hover:-translate-y-1 block cursor-pointer group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-sm font-medium mb-1">Pending Prescriptions</p>
              <h3 className="text-2xl font-bold text-blue-600">{loading ? '...' : metrics?.pendingPrescriptions}</h3>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <FileSignature className="text-blue-600" size={20} />
            </div>
          </div>
          <p className="text-xs text-blue-500 mt-4 font-medium flex justify-between items-center">
            <span>Requires Manual Review</span>
            <span className="text-gray-400 group-hover:text-blue-500 transition-colors">View →</span>
          </p>
        </Link>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <BrainCircuit className="text-indigo-600 mr-2" size={20} />
              <h3 className="text-lg font-semibold text-slate-800">AI Pharmacy Insights</h3>
            </div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full uppercase border border-indigo-100">Smart Engine</span>
          </div>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-gray-500">Loading insights...</p>
            ) : insights.length === 0 ? (
              <p className="text-sm text-gray-500">All systems optimal. No critical insights generated.</p>
            ) : (
              insights.map((insight, idx) => (
                <div key={idx} className="flex justify-between items-start border-l-4 border-indigo-500 pl-4 py-3 bg-indigo-50/50 rounded-r-lg">
                  <p className="text-sm font-medium text-indigo-900">{insight}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <ShieldAlert className="text-emerald-600 mr-2" size={20} />
              <h3 className="text-lg font-semibold text-slate-800">Blockchain Integrity</h3>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <p className="text-sm font-bold text-gray-800">Total Registered Batches</p>
                <p className="text-xs text-gray-500 mt-1">Secured immutably via SHA-256</p>
              </div>
              <span className="text-xl font-bold text-emerald-600">{loading ? '...' : metrics?.blockchainBatches}</span>
            </div>
            <p className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-center font-medium">
              <Activity size={14} className="mr-2" /> PharmaVault Ledger is actively protecting your supply chain from counterfeit drugs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PharmacyDashboard;
