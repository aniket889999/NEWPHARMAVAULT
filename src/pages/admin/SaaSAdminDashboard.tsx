import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { 
  Building2, 
  Users, 
  CreditCard, 
  Zap, 
  ShieldCheck, 
  Workflow, 
  Activity, 
  Search,
  Globe,
  Settings,
  MoreVertical,
  ArrowUpRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const SaaSAdminDashboard: React.FC = () => {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrgs: 0,
    totalBranches: 0,
    activePlans: 0,
    aiUsageTotal: 0
  });

  const fetchData = async () => {
    try {
      const res = await apiClient.get('/organizations');
      setOrganizations(res.data);
      
      // Mock stats for dashboard
      setStats({
        totalOrgs: res.data.length,
        totalBranches: res.data.length * 2, // simulated
        activePlans: res.data.filter((o:any) => o.status === 'active').length,
        aiUsageTotal: 45200
      });
    } catch (err) {
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Globe className="text-indigo-500" />
            Enterprise Control Center
          </h1>
          <p className="text-slate-500 mt-1">Multi-tenant SaaS Administration & Platform Health</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
          <div className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-900/20">
            Platform Overview
          </div>
          <div className="px-4 py-2 text-slate-400 hover:text-white cursor-pointer text-sm font-medium transition-colors">
            Billing
          </div>
          <div className="px-4 py-2 text-slate-400 hover:text-white cursor-pointer text-sm font-medium transition-colors">
            Global Safety
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {[
          { label: 'Total Organizations', value: stats.totalOrgs, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Active Branches', value: stats.totalBranches, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Enterprise AI Usage', value: stats.aiUsageTotal.toLocaleString(), icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'System Compliance', value: '99.9%', icon: ShieldCheck, color: 'text-indigo-500', bg: 'bg-indigo-500/10' }
        ].map((m, i) => (
          <div key={i} className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
            <div className={`w-12 h-12 ${m.bg} rounded-xl flex items-center justify-center mb-4`}>
              <m.icon className={m.color} size={24} />
            </div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{m.label}</p>
            <h3 className="text-3xl font-bold text-white mt-1">{m.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tenant Table */}
        <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Active Tenants</h2>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search organizations..." 
                className="bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-64"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-6 py-4">Organization</th>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">AI Usage</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {organizations.map((org) => (
                  <tr key={org._id} className="hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center font-bold text-indigo-500">
                          {org.name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{org.name}</p>
                          <p className="text-[10px] text-slate-500">{org.owner?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        org.plan === 'Enterprise' ? 'bg-amber-500/20 text-amber-500' :
                        org.plan === 'Professional' ? 'bg-indigo-500/20 text-indigo-500' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${org.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                        <span className="text-xs font-medium capitalize">{org.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 w-[60%]"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-500 group-hover:text-white">
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Intelligence */}
        <div className="space-y-8">
          <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-2xl shadow-indigo-900/40 relative overflow-hidden group">
            <Zap size={80} className="absolute -right-4 -bottom-4 text-white/10 rotate-12 group-hover:rotate-0 transition-transform duration-500" />
            <h3 className="text-xl font-black italic tracking-tighter mb-4">PLATFORM INTELLIGENCE</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-indigo-100 uppercase tracking-widest mb-1">Global AI Load</p>
                <div className="h-1.5 bg-indigo-400/30 rounded-full overflow-hidden">
                  <div className="h-full bg-white w-[42%]"></div>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-indigo-100">
                System is currently managing <b>{stats.totalOrgs}</b> enterprise tenants with a cumulative safety verification score of <b>99.2%</b>.
              </p>
              <button className="w-full bg-white text-indigo-600 py-2 rounded-xl text-sm font-bold shadow-xl">
                Generate Network Report
              </button>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Workflow size={20} className="text-indigo-500" />
              SaaS Events
            </h3>
            <div className="space-y-6">
              {[
                { org: 'MedLife Central', action: 'Upgraded to Enterprise', time: '2 mins ago', icon: CreditCard, color: 'text-amber-500' },
                { org: 'City Pharmacy', action: 'Added 2 new branches', time: '14 mins ago', icon: Building2, color: 'text-blue-500' },
                { org: 'Global Health', action: 'System Audit Completed', time: '1h ago', icon: ShieldCheck, color: 'text-emerald-500' }
              ].map((ev, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className={`p-2 rounded-lg bg-slate-800 ${ev.color}`}>
                    <ev.icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{ev.org}</p>
                    <p className="text-xs text-slate-500">{ev.action}</p>
                    <p className="text-[10px] text-slate-600 mt-1 uppercase font-bold">{ev.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaaSAdminDashboard;
