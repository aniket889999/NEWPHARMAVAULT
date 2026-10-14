import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { 
  Building2, 
  MapPin, 
  ShieldCheck, 
  CreditCard, 
  Plus, 
  Settings, 
  Activity, 
  AlertCircle,
  Users,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const OrganizationSettings: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [orgRes, branchRes] = await Promise.all([
        apiClient.get('/organizations/me'),
        apiClient.get('/branches')
      ]);

      setData(orgRes.data);
      setBranches(branchRes.data);
    } catch (err) {
      console.log("No organization found or fetch error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!data?.organization) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-6">
        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-600">
          <Building2 size={40} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Set Up Your Organization</h1>
        <p className="text-slate-500">PharmaVault X is now multi-tenant. To access enterprise features, please initialize your pharmacy organization.</p>
        <button className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors">
          Initialize Organization
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Settings className="text-indigo-600" />
            Organization & Subscription
          </h1>
          <p className="text-slate-500 mt-1">Manage your pharmacy group, branches, and enterprise plan.</p>
        </div>
        <div className="flex items-center gap-3">
           <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
             {data.organization.status.toUpperCase()}
           </span>
           <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold border border-indigo-200">
             {data.subscription.planName.toUpperCase()} PLAN
           </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile and Plan */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Building2 size={20} className="text-indigo-600" />
              Organization Profile
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Organization Name</label>
                <p className="font-bold text-slate-700">{data.organization.name}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Contact Email</label>
                <p className="font-bold text-slate-700">{data.organization.contactEmail || 'N/A'}</p>
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Primary Address</label>
                <p className="font-bold text-slate-700">
                  {data.organization.address?.street || 'N/A'}, {data.organization.address?.city || ''}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MapPin size={20} className="text-indigo-600" />
                Branch Management
              </h2>
              <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-indigo-100">
                <Plus size={16} />
                Add Branch
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {branches.length === 0 ? (
                <div className="p-12 text-center text-slate-400">No branches added yet.</div>
              ) : (
                branches.map((branch) => (
                  <div key={branch._id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{branch.name}</h4>
                        <p className="text-xs text-slate-500">{branch.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                       <div className="text-right">
                         <span className="text-[10px] font-bold text-slate-400 block uppercase">License</span>
                         <span className="text-xs font-bold text-slate-700">{branch.licenseNumber}</span>
                       </div>
                       <ChevronRight size={20} className="text-slate-300" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Subscription & Usage */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
            <CreditCard size={100} className="absolute -right-4 -bottom-4 text-white/5 rotate-12" />
            <h3 className="text-xl font-bold mb-6">Subscription</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400 font-bold uppercase">AI Usage ({data.subscription.aiUsageCount} / {data.subscription.aiUsageLimit})</span>
                  <span className="text-indigo-400 font-bold">{Math.round((data.subscription.aiUsageCount / data.subscription.aiUsageLimit) * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(data.subscription.aiUsageCount / data.subscription.aiUsageLimit) * 100}%` }}></div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Max Branches</span>
                  <span className="font-bold">{data.subscription.maxBranches}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Max Users</span>
                  <span className="font-bold">{data.subscription.maxUsers}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Renewal Date</span>
                  <span className="font-bold text-indigo-400">{new Date(data.subscription.renewalDate).toLocaleDateString()}</span>
                </div>
              </div>

              <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/40">
                Upgrade Plan
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
             <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
               <ShieldCheck size={18} className="text-emerald-500" />
               Enterprise Security
             </h3>
             <div className="space-y-4">
                <div className="flex items-start gap-3">
                   <div className="mt-1 p-1 bg-emerald-50 text-emerald-600 rounded">
                     <ShieldCheck size={12} />
                   </div>
                   <p className="text-[11px] text-slate-600">Tenant-level data isolation is active for <b>{data.organization.name}</b>.</p>
                </div>
                <div className="flex items-start gap-3">
                   <div className="mt-1 p-1 bg-blue-50 text-blue-600 rounded">
                     <Users size={12} />
                   </div>
                   <p className="text-[11px] text-slate-600">RBAC hierarchy is enforced across all <b>{branches.length}</b> branches.</p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationSettings;
