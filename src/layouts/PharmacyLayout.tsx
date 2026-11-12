import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Store,
  Package,
  Activity,
  LogOut,
  Clock,
  AlertTriangle,
  Building2,
  Globe,
  ShieldCheck,
  Inbox,
  Database,
  UserCheck
} from 'lucide-react';

const PharmacyLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const navLinks = [
    { to: '/pharmacy/dashboard', label: 'Operations Dashboard', icon: Activity },
    { to: '/pharmacy/inventory', label: 'Stock & Inventory', icon: Package },
    { to: '/pharmacy/orders', label: 'Prescription Orders', icon: Store },
    { to: '/pharmacy/expiry-risk', label: 'Expiry Risk Monitor', icon: Clock, badgeColor: 'text-amber-500' },
    { to: '/pharmacy/stock-risk', label: 'Stock-Out Alerts', icon: AlertTriangle, badgeColor: 'text-rose-500' },
    { to: '/cases', label: 'Verification Cases', icon: ShieldCheck, badge: 'TrustRAG' },
    { to: '/review-queue', label: 'Review Queue', icon: Inbox, badge: 'HITL' },
    { to: '/pharmacy/workflow-center', label: 'Workflow Center', icon: Activity },
    { to: '/pharmacy/organization-settings', label: 'Organization Settings', icon: Building2 },
    { to: '/pharmacy/blockchain', label: 'Blockchain Ledger', icon: Database, badge: 'Ledger' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 shadow-xs">
        <div>
          {/* Logo & Portal Header */}
          <div className="p-5 border-b border-slate-100">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white font-black shadow-md shadow-cyan-500/20">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-slate-900 block leading-tight">
                  Pharma<span className="text-cyan-600">Vault</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600">
                  Pharmacy Operations
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Operations & Inventory
            </div>

            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-cyan-50 text-cyan-800 font-bold border border-cyan-200/80 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-600' : item.badgeColor || 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100/70 text-cyan-800 font-bold font-mono">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {user?.role === 'super_admin' && (
              <Link
                to="/admin/saas"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-all mt-2"
              >
                <Globe className="w-4 h-4 text-indigo-600" />
                <span>SaaS Administration</span>
              </Link>
            )}
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-xs">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-900 truncate">{user?.name || 'Pharmacy Admin'}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email || 'pharmacy@test.com'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-bold text-rose-600 hover:text-rose-700 rounded-lg hover:bg-rose-50 border border-slate-200 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-50 text-slate-800">
        <Outlet />
      </main>
    </div>
  );
};

export default PharmacyLayout;
