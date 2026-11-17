import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, LayoutDashboard, Inbox, LogOut, ShieldCheck, ChevronRight, ExternalLink, KeyRound } from 'lucide-react';
import NotificationBell from '../components/notifications/NotificationBell';

const PayerLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItemClass = (path: string) => {
    const isActive = location.pathname === path || (path !== '/payer/dashboard' && location.pathname.startsWith(path));
    return `flex items-center px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
      isActive ? 'bg-indigo-50 text-indigo-800 font-semibold border-l-2 border-indigo-600 shadow-2xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;
  };

  const crumb = location.pathname.startsWith('/payer/claims/') ? 'Claim Workspace'
    : location.pathname === '/payer/claims' ? 'Claims Queue'
    : location.pathname === '/payer/security' ? 'Account Security' : 'Dashboard Overview';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-20">
        <div className="h-14 flex items-center px-5 border-b border-slate-200">
          <Link to="/" className="flex items-center space-x-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-700 flex items-center justify-center text-white shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 tracking-tight block leading-tight">PharmaVault</span>
              <span className="text-[10px] font-medium text-indigo-700 uppercase tracking-wider block leading-tight">Insurer Portal</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-3.5 space-y-6">
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Claims Review</p>
            <div className="space-y-1">
              <Link to="/payer/dashboard" className={navItemClass('/payer/dashboard')}>
                <LayoutDashboard className="w-4 h-4 mr-2.5 text-indigo-600" />
                <span>Dashboard</span>
              </Link>
              <Link to="/payer/claims" className={navItemClass('/payer/claims')}>
                <Inbox className="w-4 h-4 mr-2.5 text-amber-600" />
                <span>Claims Queue</span>
              </Link>
            </div>
          </div>
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Account</p>
            <div className="space-y-1">
              <Link to="/payer/security" className={navItemClass('/payer/security')}>
                <KeyRound className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>Security & MFA</span>
              </Link>
            </div>
          </div>
          <div className="mx-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500 leading-relaxed flex gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            You can open a case only when the claimant has granted consent. Every decision is recorded with your name.
          </div>
        </nav>

        <div className="p-3.5 border-t border-slate-200 bg-slate-50/70">
          <div className="flex items-center space-x-2.5 min-w-0 mb-3 px-1">
            <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-800 flex items-center justify-center text-xs font-bold">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'IN'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 truncate">{user?.name || 'Insurer Reviewer'}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.role === 'payer_admin' ? 'Insurer administrator' : 'Insurer claims reviewer'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Link to="/auth" className="flex-1 py-1.5 px-2 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 flex items-center justify-center">Switch Portal</Link>
            <button onClick={handleLogout} className="py-1.5 px-2.5 text-[11px] font-medium text-rose-600 bg-white border border-rose-200 rounded-md hover:bg-rose-50" title="Sign Out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span>Insurer Portal</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800">{crumb}</span>
          </div>
          <div className="flex items-center space-x-4">
            <NotificationBell />
            <Link to="/" className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center space-x-1">
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">Home</span>
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PayerLayout;
