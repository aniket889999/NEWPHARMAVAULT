import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import {
  ShieldCheck,
  ListFilter,
  PlusCircle,
  Inbox,
  ArrowLeft,
  User,
  Sparkles
} from 'lucide-react';

export const VerificationNav: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isStaff = user && ['pharmacist', 'pharmacy', 'claims_reviewer', 'org_admin', 'super_admin'].includes(user.role);

  const getDashboardLink = () => {
    if (!user) return '/auth';
    if (user.role === 'patient') return '/patient/dashboard';
    return '/pharmacy/dashboard';
  };

  const navItems = [
    {
      to: '/cases',
      label: 'All Verification Cases',
      icon: ListFilter,
      active: location.pathname === '/cases'
    },
    {
      to: '/cases/new',
      label: 'New Verification',
      icon: PlusCircle,
      active: location.pathname === '/cases/new'
    },
    ...(isStaff
      ? [
          {
            to: '/review-queue',
            label: 'Reviewer Queue',
            icon: Inbox,
            active: location.pathname === '/review-queue'
          }
        ]
      : [])
  ];

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-800 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand & Return */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(getDashboardLink())}
              className="text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Return to primary portal"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Exit to Portal</span>
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <Link to="/cases" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base text-slate-900 tracking-tight">PharmaVault</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    TrustRAG
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden md:block font-medium">
                  Tri-Document Evidence Verification
                </p>
              </div>
            </Link>
          </div>

          {/* Center: Module Navigation Links */}
          <nav className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    item.active
                      ? 'bg-white text-blue-700 shadow-xs border border-blue-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${item.active ? 'text-blue-600' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: User Role Chip */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-900">{user?.name || 'Reviewer'}</div>
              <div className="text-[10px] font-mono uppercase font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-block">
                {user?.role || 'authorized'}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs shadow-xs">
              <User className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
