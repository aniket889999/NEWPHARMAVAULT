import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/notifications/NotificationBell';
import { 
  ShieldCheck, 
  Inbox, 
  ListFilter, 
  PlusCircle, 
  MessageSquare, 
  Store, 
  Database, 
  FileSignature, 
  KeyRound, 
  LogOut, 
  ChevronRight, 
  CheckCircle2,
  Receipt,
  Users
} from 'lucide-react';

const ReviewerLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItemClass = (path: string) => {
    const isActive = location.pathname === path || (path !== '/review-queue' && location.pathname.startsWith(path));
    return `flex items-center px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
      isActive
        ? 'bg-teal-50 text-teal-800 font-semibold border-l-2 border-teal-600 shadow-2xs'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;
  };

  const getBreadcrumbTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/cases/') && path !== '/cases/new') return 'Case Adjudication Workspace';
    if (path === '/cases/new') return 'New Verification Wizard';
    if (path === '/cases') return 'Verification Cases';
    if (path === '/review-queue') return 'Reviewer Queue';
    if (path === '/assistant') return 'TrustRAG Evidence Assistant';
    if (path === '/account/security') return 'Account Security & MFA';
    if (path === '/staff/claims') return 'Insurance Claims Status';
    if (path === '/team') return 'Team & Access';
    return 'Reviewer Workstation';
  };

  const roleLabel = () => {
    if (user?.role === 'claims_reviewer') return 'Clinical Claims Reviewer';
    if (user?.role === 'pharmacist') return 'Licensed Pharmacist';
    if (user?.role === 'org_admin') return 'Organization Administrator';
    if (user?.role === 'super_admin') return 'System Administrator';
    return 'Clinical Reviewer';
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Left Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-20">
        {/* Brand Header */}
        <div className="h-14 flex items-center px-5 border-b border-slate-200">
          <Link to="/" className="flex items-center space-x-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-2xs group-hover:bg-teal-700 transition-colors">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 tracking-tight block leading-tight">PharmaVault</span>
              <span className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider block leading-tight">Reviewer Workstation</span>
            </div>
          </Link>
        </div>

        {/* Navigation Categories */}
        <nav className="flex-1 overflow-y-auto p-3.5 space-y-6">
          {/* Section: Clinical Verification */}
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Clinical Adjudication
            </p>
            <div className="space-y-1">
              <Link to="/review-queue" className={navItemClass('/review-queue')}>
                <Inbox className="w-4 h-4 mr-2.5 text-teal-600" />
                <span>Reviewer Queue</span>
              </Link>

              <Link to="/cases" className={navItemClass('/cases')}>
                <ListFilter className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>All Cases</span>
              </Link>

              <Link to="/cases/new" className={navItemClass('/cases/new')}>
                <PlusCircle className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>New Verification</span>
              </Link>

              <Link to="/assistant" className={navItemClass('/assistant')}>
                <MessageSquare className="w-4 h-4 mr-2.5 text-indigo-600" />
                <span>Evidence Assistant</span>
              </Link>

              {user?.role !== 'patient' && (
                <Link to="/staff/claims" className={navItemClass('/staff/claims')}>
                  <Receipt className="w-4 h-4 mr-2.5 text-blue-600" />
                  <span>Claims Status</span>
                </Link>
              )}
            </div>
          </div>

          {/* Section: Dispensary & Audit Hub */}
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Dispensary & Audits
            </p>
            <div className="space-y-1">
              <Link to="/pharmacy/dashboard" className={navItemClass('/pharmacy/dashboard')}>
                <Store className="w-4 h-4 mr-2.5 text-blue-600" />
                <span>Dispensary Hub</span>
              </Link>

              <Link to="/pharmacy/prescription-queue" className={navItemClass('/pharmacy/prescription-queue')}>
                <FileSignature className="w-4 h-4 mr-2.5 text-amber-600" />
                <span>Prescription Queue</span>
              </Link>

              <Link to="/pharmacy/blockchain" className={navItemClass('/pharmacy/blockchain')}>
                <Database className="w-4 h-4 mr-2.5 text-emerald-600" />
                <span>Blockchain Ledger</span>
              </Link>
            </div>
          </div>

          {/* Section: Account & Security */}
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Account & Credentials
            </p>
            <div className="space-y-1">
              {user && ['org_admin', 'super_admin'].includes(user.role) && (
                <Link to="/team" className={navItemClass('/team')}>
                  <Users className="w-4 h-4 mr-2.5 text-teal-600" />
                  <span>Team & Access</span>
                </Link>
              )}
              <Link to="/account/security" className={navItemClass('/account/security')}>
                <KeyRound className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>Security & 2FA</span>
              </Link>
            </div>
          </div>

          {/* HITL Adjudication info callout */}
          <div className="mx-1 rounded-lg border border-teal-200 bg-teal-50/50 p-3 text-[11px] text-teal-800 leading-relaxed flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
            <span>HITL verification active. All discrepancy overrides and decisions are permanently logged.</span>
          </div>
        </nav>

        {/* Sidebar Footer: User Details & Logout */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/70">
          <div className="flex items-center space-x-2.5 min-w-0 mb-3 px-1">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-teal-300 flex items-center justify-center text-xs font-bold shadow-2xs">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'RV'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 truncate">{user?.name || 'Reviewer'}</p>
              <p className="text-[10px] text-slate-500 truncate">{roleLabel()}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Link 
              to="/auth" 
              className="flex-1 py-1.5 px-2 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center shadow-2xs"
            >
              Switch Portal
            </Link>
            <button 
              onClick={handleLogout} 
              className="py-1.5 px-2.5 text-[11px] font-medium text-rose-600 bg-white border border-rose-200 rounded-md hover:bg-rose-50 transition-colors shadow-2xs" 
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span>Reviewer Workstation</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800">{getBreadcrumbTitle()}</span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
              <span>HITL Queue Active</span>
            </div>

            <NotificationBell />

            <Link 
              to="/" 
              className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ReviewerLayout;
