import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Pill, FileText, ShoppingCart, LogOut, Package, ShieldCheck, Stethoscope, Video, Bell } from 'lucide-react';

const PatientLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-primary-600">PharmaVault</h1>
          <p className="text-xs text-gray-500 mt-1">Patient Portal</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/patient/dashboard" className="flex items-center p-3 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600">
            <Home className="w-5 h-5 mr-3" /> Overview
          </Link>
          <Link to="/patient/medicines" className="flex items-center p-3 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600">
            <Pill className="w-5 h-5 mr-3" /> Medicines
          </Link>
          <Link to="/patient/prescriptions" className="flex items-center p-3 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600">
            <FileText className="w-5 h-5 mr-3" /> Prescriptions
          </Link>
          <Link to="/cases" className="flex items-center p-3 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600 font-medium">
            <ShieldCheck className="w-5 h-5 mr-3 text-indigo-600" /> Verification Cases
          </Link>
          <Link to="/patient/authenticity" className="flex items-center p-3 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600">
            <ShieldCheck className="w-5 h-5 mr-3" /> Authenticity Check
          </Link>
          <Link to="/patient/health-assistant" className="flex items-center p-3 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600">
            <Stethoscope className="w-5 h-5 mr-3" /> Health Assistant
          </Link>
          <Link to="/patient/cart" className="flex items-center p-3 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600">
            <ShoppingCart className="w-5 h-5 mr-3" /> Cart
          </Link>
          <Link to="/patient/orders" className="flex items-center p-3 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600">
            <Package className="w-5 h-5 mr-3" /> My Orders
          </Link>
          <Link to="/patient/doctor-consult" className="flex items-center p-3 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600">
            <Video className="w-5 h-5 mr-3" /> Consult Doctor
          </Link>
          <Link to="/patient/reminders" className="flex items-center p-3 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600">
            <Bell className="w-5 h-5 mr-3" /> Smart Reminders
          </Link>
          <Link to="/patient/health-records" className="flex items-center p-3 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600">
            <FileText className="w-5 h-5 mr-3" /> Health Records
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <div className="mb-4 px-3">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center p-3 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
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

export default PatientLayout;
