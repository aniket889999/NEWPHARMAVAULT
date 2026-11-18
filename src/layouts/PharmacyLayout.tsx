import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/notifications/NotificationBell';
import { 
  Store, 
  Package, 
  Activity, 
  LogOut, 
  Database, 
  Clock, 
  AlertTriangle,  
  Receipt,
  FileSignature, 
  ChevronRight,
  ExternalLink
} from 'lucide-react';

const PharmacyLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItemClass = (path: string) => {
    const isActive = location.pathname === path;
    return `flex items-center px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
      isActive
        ? 'bg-blue-50 text-blue-800 font-semibold border-l-2 border-blue-600 shadow-2xs'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-20">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-2xs">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base tracking-tight group-hover:text-blue-700 transition-colors">
                PharmaVault
              </span>
              <p className="text-[11px] text-blue-700 font-medium">Pharmacy Operations</p>
            </div>
          </Link>
        </div>

        {/* Navigation Categories */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
          {/* Section: Dispensary & Stock */}
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Dispensary & Stock
            </p>
            <div className="space-y-1">
              <Link to="/pharmacy/dashboard" className={navItemClass('/pharmacy/dashboard')}>
                <Activity className="w-4 h-4 mr-2.5 text-blue-600" />
                <span>Dashboard Overview</span>
              </Link>

              <Link to="/pharmacy/inventory" className={navItemClass('/pharmacy/inventory')}>
                <Package className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>Inventory Catalog</span>
              </Link>

              <Link to="/pharmacy/orders" className={navItemClass('/pharmacy/orders')}>
                <Store className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>Patient Orders</span>
              </Link>

              <Link to="/pharmacy/prescription-queue" className={navItemClass('/pharmacy/prescription-queue')}>
                <FileSignature className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>Prescription Queue</span>
              </Link>
            </div>
          </div>

          {/* Section: Clinical Risks & Intelligence */}
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Inventory Intelligence
            </p>
            <div className="space-y-1">
              <Link to="/pharmacy/expiry-risk" className={navItemClass('/pharmacy/expiry-risk')}>
                <Clock className="w-4 h-4 mr-2.5 text-amber-500" />
                <span>Expiry Risk Tracking</span>
              </Link>

              <Link to="/pharmacy/stock-risk" className={navItemClass('/pharmacy/stock-risk')}>
                <AlertTriangle className="w-4 h-4 mr-2.5 text-rose-500" />
                <span>Stock Deficiency Risk</span>
              </Link>

              <Link to="/pharmacy/workflow-center" className={navItemClass('/pharmacy/workflow-center')}>
                <Activity className="w-4 h-4 mr-2.5 text-indigo-500" />
                <span>Workflow Center</span>
              </Link>
            </div>
          </div>

          {/* Section: TrustRAG Verification */}
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Claims & Ledger
            </p>
            <div className="space-y-1">
              <Link to="/pharmacy/claims" className={navItemClass('/pharmacy/claims')}>
                <Receipt className="w-4 h-4 mr-2.5 text-blue-600" />
                <span>Insurance Claims</span>
              </Link>

              <Link to="/pharmacy/blockchain" className={navItemClass('/pharmacy/blockchain')}>
                <Database className="w-4 h-4 mr-2.5 text-emerald-600" />
                <span>Blockchain Ledger</span>
              </Link>
            </div>
          </div>

        </nav>

        {/* Sidebar Footer User Info */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/70">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'PH'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate">{user?.name || 'Pharmacy Hub'}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email || 'pharmacy@test.com'}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              to="/auth"
              className="flex-1 py-1.5 px-2 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center justify-center space-x-1 transition-colors shadow-2xs"
            >
              <span>Switch Portal</span>
            </Link>
            <button
              onClick={handleLogout}
              className="py-1.5 px-2.5 text-[11px] font-medium text-rose-700 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 hover:border-rose-200 flex items-center justify-center transition-colors shadow-2xs"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span>Pharmacy Hub</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800 capitalize">
              {location.pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <NotificationBell />
            <Link
              to="/"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center space-x-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">Landing</span>
            </Link>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PharmacyLayout;
