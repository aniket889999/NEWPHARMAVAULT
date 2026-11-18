import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import DemoNotice from '../components/common/DemoNotice';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/notifications/NotificationBell';
import LanguageSwitch from '../components/common/LanguageSwitch';
import { 
  Home, 
  Pill, 
  FileText, 
  ShoppingCart, 
  LogOut, 
  Package, 
  ShieldCheck, 
  Stethoscope, 
  Video, 
  Bell, 
  Scale, 
  ClipboardList,
  ChevronRight,
  ExternalLink,
  Receipt,
  KeyRound
} from 'lucide-react';

const PatientLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getBreadcrumbTitle = () => {
    const segment = location.pathname.split('/').pop() || '';
    if (segment === 'cases') return 'Verification Cases & Audits';
    if (segment === 'prescriptions') return 'Prescription Upload';
    if (segment === 'authenticity') return 'Authenticity Verifier';
    if (segment === 'doctor-consult') return 'Doctor Teleconsult';
    if (segment === 'reminders') return 'Medication Reminders';
    if (segment === 'health-records') return 'Health Records';
    if (segment === 'medicines') return 'Medicine Directory';
    if (segment === 'comparisons') return 'Compare Formulations';
    if (segment === 'cart') return 'Dispensary Cart';
    if (segment === 'orders') return 'My Orders';
    if (segment === 'dashboard') return 'Dashboard Overview';
    if (segment === 'claims') return 'Insurance Claims';
    if (segment === 'security') return 'Account Security';
    return segment.replace('-', ' ');
  };

  const navItemClass = (path: string) => {
    const isActive = location.pathname === path;
    return `flex items-center px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
      isActive
        ? 'bg-teal-50 text-teal-800 font-semibold border-l-2 border-teal-600 shadow-2xs'
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
            <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base tracking-tight group-hover:text-teal-700 transition-colors">
                PharmaVault
              </span>
              <p className="text-[11px] text-teal-700 font-medium">Patient Care Portal</p>
            </div>
          </Link>
        </div>

        {/* Navigation Categories */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
          {/* Section: Clinical & Prescriptions */}
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Clinical & Prescriptions
            </p>
            <div className="space-y-1">
              <Link to="/patient/dashboard" className={navItemClass('/patient/dashboard')}>
                <Home className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>Dashboard Overview</span>
              </Link>

              <Link to="/patient/prescriptions" className={navItemClass('/patient/prescriptions')}>
                <FileText className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>Prescription Upload</span>
              </Link>

              <Link to="/patient/authenticity" className={navItemClass('/patient/authenticity')}>
                <ShieldCheck className="w-4 h-4 mr-2.5 text-teal-600" />
                <span>Authenticity Verifier</span>
              </Link>

              <Link to="/patient/cases" className={navItemClass('/patient/cases')}>
                <ClipboardList className="w-4 h-4 mr-2.5 text-teal-600" />
                <span>Verification Audits</span>
              </Link>

              <Link to="/patient/claims" className={navItemClass('/patient/claims')}>
                <Receipt className="w-4 h-4 mr-2.5 text-teal-600" />
                <span>Insurance Claims</span>
              </Link>
            </div>
          </div>

          {/* Section: Care Tools */}
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Care & Consult
            </p>
            <div className="space-y-1">
              <Link to="/patient/health-assistant" className={navItemClass('/patient/health-assistant')}>
                <Stethoscope className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>Health Assistant</span>
              </Link>

              <Link to="/patient/doctor-consult" className={navItemClass('/patient/doctor-consult')}>
                <Video className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>Doctor Teleconsult</span>
              </Link>

              <Link to="/patient/reminders" className={navItemClass('/patient/reminders')}>
                <Bell className="w-4 h-4 mr-2.5 text-slate-500" />
                <span className="flex-1">Medication Reminders</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
                  Coming Soon
                </span>
              </Link>

              <Link to="/patient/health-records" className={navItemClass('/patient/health-records')}>
                <FileText className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>Health Records</span>
              </Link>

              <Link to="/patient/security" className={navItemClass('/patient/security')}>
                <KeyRound className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>Security & MFA</span>
              </Link>
            </div>
          </div>

          {/* Section: Dispensary & Pharmacy */}
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Dispensary & Orders
            </p>
            <div className="space-y-1">
              <Link to="/patient/medicines" className={navItemClass('/patient/medicines')}>
                <Pill className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>Medicine Directory</span>
              </Link>

              <Link to="/patient/comparisons" className={navItemClass('/patient/comparisons')}>
                <Scale className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>Compare Formulations</span>
              </Link>

              <Link to="/patient/cart" className={navItemClass('/patient/cart')}>
                <ShoppingCart className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>Dispensary Cart</span>
              </Link>

              <Link to="/patient/orders" className={navItemClass('/patient/orders')}>
                <Package className="w-4 h-4 mr-2.5 text-slate-500" />
                <span>My Orders</span>
              </Link>
            </div>
          </div>
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/70">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-teal-100 border border-teal-200 text-teal-800 flex items-center justify-center text-xs font-bold">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'PT'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate">{user?.name || 'Demo Patient'}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email || 'patient@test.com'}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              to="/auth"
              className="flex-1 py-1.5 px-2 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 flex items-center justify-center space-x-1"
            >
              <span>Switch Portal</span>
            </Link>
            <button
              onClick={handleLogout}
              className="py-1.5 px-2.5 text-[11px] font-medium text-rose-600 bg-white border border-rose-200 rounded-md hover:bg-rose-50 flex items-center justify-center"
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
            <span>Patient Portal</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800 capitalize">
              {getBreadcrumbTitle()}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <LanguageSwitch />
            <NotificationBell />
            <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Account Active</span>
            </div>

            <Link
              to="/patient/cases"
              className="text-xs font-medium text-slate-600 hover:text-teal-700 flex items-center space-x-1"
            >
              <ClipboardList className="w-3.5 h-3.5 text-teal-600" />
              <span className="hidden sm:inline">Verification Audits</span>
            </Link>

            <Link
              to="/"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center space-x-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">Home</span>
            </Link>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <DemoNotice />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PatientLayout;
