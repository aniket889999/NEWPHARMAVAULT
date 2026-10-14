import React, { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { 
  Pill, 
  BarChart3, 
  Shield, 
  GitCompare, 
  FileText, 
  Store, 
  Users, 
  Settings,
  Menu,
  X,
  Bell,
  Search,
  Activity,
  CalendarDays
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: 'Overview', href: '/dashboard', icon: BarChart3, current: location.pathname === '/dashboard' },
    { name: 'Medicines', href: '/dashboard/medicines', icon: Pill, current: location.pathname === '/dashboard/medicines' },
    { name: 'Availability', href: '/dashboard/availability', icon: Search, current: location.pathname === '/dashboard/availability' },
    { name: 'Authenticity', href: '/dashboard/authenticity', icon: Shield, current: location.pathname === '/dashboard/authenticity' },
    { name: 'Health Tracker', href: '/dashboard/health-tracker', icon: Activity, current: location.pathname === '/dashboard/health-tracker' },
    { name: 'Reminders', href: '/dashboard/reminders', icon: CalendarDays, current: location.pathname === '/dashboard/reminders' },
    { name: 'Comparisons', href: '/dashboard/comparisons', icon: GitCompare, current: location.pathname === '/dashboard/comparisons' },
    { name: 'Prescriptions', href: '/dashboard/prescriptions', icon: FileText, current: location.pathname === '/dashboard/prescriptions' },
    { name: 'Pharmacies', href: '/dashboard/pharmacies', icon: Store, current: location.pathname === '/dashboard/pharmacies' },
    { name: 'Users', href: '/dashboard/users', icon: Users, current: location.pathname === '/dashboard/users' },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings, current: location.pathname === '/dashboard/settings' },
  ];

  const filteredNavigation = navigation.filter(item => {
    if (user?.role === 'patient') {
      return !['Users'].includes(item.name);
    }
    if (user?.role === 'pharmacist') {
      return !['Users'].includes(item.name);
    }
    return true; // Admin and doctor see all
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
          <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200">
            <div className="flex items-center">
              <Pill className="h-8 w-8 text-primary-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">PharmaVault</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">
            {filteredNavigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  item.current
                    ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-600'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 shadow-sm">
          <div className="flex h-16 items-center px-6 border-b border-gray-200">
            <Pill className="h-8 w-8 text-primary-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">PharmaVault</span>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">
            {filteredNavigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  item.current
                    ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-600'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-400 hover:text-gray-600"
              >
                <Menu className="h-6 w-6" />
              </button>
              
              {/* Search bar */}
              <div className="hidden sm:block ml-4 lg:ml-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search medicines, prescriptions..."
                    className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button className="p-2 text-gray-400 hover:text-gray-600 relative">
                <Bell className="h-6 w-6" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>

              {/* User menu */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                </div>
                <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-700">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;