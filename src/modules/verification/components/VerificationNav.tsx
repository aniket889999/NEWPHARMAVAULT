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
  ExternalLink
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
      label: 'All Cases',
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
            label: 'Review Queue',
            icon: Inbox,
            active: location.pathname === '/review-queue'
          }
        ]
      : [])
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand & Return */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(getDashboardLink())}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Return to primary portal"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Exit to Portal</span>
            </button>

            <div className="h-5 w-px bg-slate-800 hidden sm:block" />

            <Link to="/cases" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm group-hover:bg-indigo-500 transition-colors">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white tracking-tight">PharmaVault</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/80">
                    TrustRAG
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 hidden md:block">
                  Tri-Document Evidence Verification
                </p>
              </div>
            </Link>
          </div>

          {/* Center: Module Navigation Links */}
          <nav className="flex items-center gap-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    item.active
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: User Role Chip */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white">{user?.name || 'Authorized User'}</div>
              <div className="text-[10px] font-mono uppercase text-indigo-400">{user?.role}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <User className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
