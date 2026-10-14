import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, Package, Activity, LogOut, FileText, Database, Clock, AlertTriangle, Building2, Globe, ShieldCheck, Inbox } from 'lucide-react';

const PharmacyLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-white">PharmaVault</h1>
          <p className="text-xs text-green-400 mt-1">Pharmacy Admin</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/pharmacy/dashboard" className="flex items-center p-3 rounded-lg hover:bg-slate-800 hover:text-white transition-colors">
            <Activity className="w-5 h-5 mr-3" /> Dashboard
          </Link>
          <Link to="/pharmacy/inventory" className="flex items-center p-3 rounded-lg hover:bg-slate-800 hover:text-white transition-colors">
            <Package className="w-5 h-5 mr-3" /> Inventory
          </Link>
          <Link to="/pharmacy/orders" className="flex items-center p-3 rounded-lg hover:bg-slate-800 hover:text-white transition-colors">
            <Store className="w-5 h-5 mr-3" /> Orders
          </Link>
          
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Intelligence</p>
          </div>
          <Link to="/pharmacy/expiry-risk" className="flex items-center p-3 rounded-lg hover:bg-slate-800 hover:text-white transition-colors">
            <Clock className="w-5 h-5 mr-3 text-orange-400" /> Expiry Risk
          </Link>
          <Link to="/pharmacy/stock-risk" className="flex items-center p-3 rounded-lg hover:bg-slate-800 hover:text-white transition-colors">
            <AlertTriangle className="w-5 h-5 mr-3 text-red-400" /> Stock Risk
          </Link>
          <Link to="/cases" className="flex items-center p-3 rounded-lg hover:bg-slate-800 hover:text-white transition-colors text-indigo-400 font-medium">
            <ShieldCheck className="w-5 h-5 mr-3 text-indigo-400" /> Verification Cases
          </Link>
          <Link to="/review-queue" className="flex items-center p-3 rounded-lg hover:bg-slate-800 hover:text-white transition-colors text-amber-400 font-medium">
            <Inbox className="w-5 h-5 mr-3 text-amber-400" /> Review Queue
          </Link>
          <Link to="/pharmacy/workflow-center" className="flex items-center p-3 rounded-lg hover:bg-slate-800 hover:text-white transition-colors text-slate-300 font-medium">
            <Activity className="w-5 h-5 mr-3" /> Workflow Center
          </Link>
          
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Enterprise</p>
          </div>
          <Link to="/pharmacy/organization-settings" className="flex items-center p-3 rounded-lg hover:bg-slate-800 hover:text-white transition-colors">
            <Building2 className="w-5 h-5 mr-3 text-indigo-400" /> My Organization
          </Link>
          {user?.role === 'super_admin' && (
            <Link to="/admin/saas" className="flex items-center p-3 rounded-lg bg-indigo-900/40 text-indigo-300 border border-indigo-800/50 hover:bg-indigo-800 transition-colors mt-2">
              <Globe className="w-5 h-5 mr-3" /> SaaS Control
            </Link>
          )}
          
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">System</p>
          </div>
          <Link to="/pharmacy/blockchain" className="flex items-center p-3 rounded-lg hover:bg-slate-800 hover:text-white transition-colors text-emerald-400">
            <Database className="w-5 h-5 mr-3" /> Blockchain Ledger
          </Link>
        </nav>
        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <div className="mb-4 px-3">
            <p className="text-sm font-medium text-white">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center p-3 text-red-400 rounded-lg hover:bg-slate-800 transition-colors">
            <LogOut className="w-5 h-5 mr-3" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default PharmacyLayout;
