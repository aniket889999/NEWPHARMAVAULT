import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, User, Store, Mail, Lock, CheckCircle2, ChevronLeft, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';

const AuthPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Current active role in view
  const currentRoleParam = searchParams.get('role') || 'patient';
  const [activeRole, setActiveRole] = useState<'patient' | 'pharmacy' | 'claims_reviewer'>(
    currentRoleParam === 'pharmacy' ? 'pharmacy' : currentRoleParam === 'claims_reviewer' ? 'claims_reviewer' : 'patient'
  );

  const { login, signup, isLoading } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  // Sync state if url param changes
  useEffect(() => {
    const role = searchParams.get('role');
    if (role === 'pharmacy' || role === 'claims_reviewer' || role === 'patient') {
      setActiveRole(role);
    }
  }, [searchParams]);

  // Handle switching tabs
  const handleRoleChange = (role: 'patient' | 'pharmacy' | 'claims_reviewer') => {
    setActiveRole(role);
    setSearchParams({ role });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        await login(email, password, activeRole);
        toast.success(`Signed in to ${portalDetails.title}`);
      } else {
        await signup(name, email, password, activeRole);
        toast.success('Account created successfully');
      }

      // Route based on role
      if (activeRole === 'claims_reviewer') {
        navigate('/review-queue');
      } else if (activeRole === 'pharmacy') {
        navigate('/pharmacy/dashboard');
      } else {
        navigate('/patient/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Authentication failed. Please verify credentials.';
      setError(msg);
      toast.error(msg);
    }
  };

  // Instant 1-Click Demo Login handler
  const handleQuickDemoLogin = async (demoRole: 'patient' | 'pharmacy' | 'claims_reviewer') => {
    setError('');
    const demoEmail = demoRole === 'patient' 
      ? 'patient@test.com' 
      : demoRole === 'pharmacy' 
      ? 'pharmacy@test.com' 
      : 'reviewer@test.com';
    const demoPass = 'password123';

    try {
      await login(demoEmail, demoPass, demoRole);
      toast.success(`Signed in as ${demoRole.replace('_', ' ')} (Demo)`);
      if (demoRole === 'claims_reviewer') {
        navigate('/review-queue');
      } else if (demoRole === 'pharmacy') {
        navigate('/pharmacy/dashboard');
      } else {
        navigate('/patient/dashboard');
      }
    } catch (err: any) {
      // In case user doesn't exist, fill fields and let them submit
      setEmail(demoEmail);
      setPassword(demoPass);
      setName(demoRole === 'patient' ? 'Demo Patient' : demoRole === 'pharmacy' ? 'Demo Pharmacy Hub' : 'Demo Reviewer');
      setError('Auto-filled credentials. Please click Sign In.');
    }
  };

  // Visual metadata per portal
  const portalDetails = {
    patient: {
      title: 'Patient Portal',
      subtitle: 'Access prescriptions, medicine verification & care services',
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
      accentColor: 'text-teal-700',
      btnColor: 'bg-teal-600 hover:bg-teal-700 text-white',
      icon: User,
      demoName: 'Demo Patient',
      demoEmail: 'patient@test.com'
    },
    pharmacy: {
      title: 'Pharmacy Hub',
      subtitle: 'Dispensary inventory, prescription review & ledger',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      accentColor: 'text-blue-700',
      btnColor: 'bg-blue-700 hover:bg-blue-800 text-white',
      icon: Store,
      demoName: 'Demo Pharmacy Hub',
      demoEmail: 'pharmacy@test.com'
    },
    claims_reviewer: {
      title: 'Reviewer Portal',
      subtitle: 'TrustRAG verification queue & discrepancy adjudication',
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
      accentColor: 'text-slate-800',
      btnColor: 'bg-slate-800 hover:bg-slate-900 text-white',
      icon: ShieldCheck,
      demoName: 'Clinical Claims Reviewer',
      demoEmail: 'reviewer@test.com'
    }
  }[activeRole];

  const IconComponent = portalDetails.icon;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Header / Back */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between mb-4">
        <Link 
          to="/" 
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Home
        </Link>
        <div className="flex items-center space-x-1.5 text-xs text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
          <span>Encrypted Session</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="max-w-md w-full mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Portal Role Tabs */}
        <div className="grid grid-cols-3 bg-slate-100/80 p-1.5 border-b border-slate-200 text-xs font-medium">
          <button
            type="button"
            onClick={() => handleRoleChange('patient')}
            className={`py-2 px-1 text-center rounded-lg transition-all flex items-center justify-center space-x-1 ${
              activeRole === 'patient'
                ? 'bg-white text-teal-800 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span className="truncate">Patient</span>
          </button>

          <button
            type="button"
            onClick={() => handleRoleChange('pharmacy')}
            className={`py-2 px-1 text-center rounded-lg transition-all flex items-center justify-center space-x-1 ${
              activeRole === 'pharmacy'
                ? 'bg-white text-blue-800 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span className="truncate">Pharmacy</span>
          </button>

          <button
            type="button"
            onClick={() => handleRoleChange('claims_reviewer')}
            className={`py-2 px-1 text-center rounded-lg transition-all flex items-center justify-center space-x-1 ${
              activeRole === 'claims_reviewer'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="truncate">Reviewer</span>
          </button>
        </div>

        {/* Card Header */}
        <div className="p-6 pb-2 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 mb-3 shadow-2xs">
            <IconComponent className="w-6 h-6 text-slate-700" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">{portalDetails.title}</h2>
          <p className="text-xs text-slate-500 mt-1">{portalDetails.subtitle}</p>
        </div>

        {/* Quick Demo Access Bar */}
        <div className="px-6 py-2">
          <button
            type="button"
            onClick={() => handleQuickDemoLogin(activeRole)}
            className="w-full py-2 px-3 text-xs font-medium rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 flex items-center justify-center space-x-2 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            <span>1-Click Sign In as <strong>{portalDetails.demoName}</strong></span>
          </button>
        </div>

        <div className="relative px-6 my-2 flex items-center justify-center">
          <div className="border-t border-slate-200 w-full"></div>
          <span className="bg-white px-2 text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            or use credentials
          </span>
        </div>

        {/* Form Body */}
        <div className="p-6 pt-2">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name / Organization
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center space-x-2 transition-colors ${portalDetails.btnColor}`}
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoading ? 'Authenticating...' : isLogin ? `Sign In to ${portalDetails.title}` : 'Create Account'}</span>
            </button>
          </form>

          {/* Switch Login / Sign Up */}
          <div className="mt-5 text-center text-xs text-slate-500">
            {isLogin ? (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="font-semibold text-teal-700 hover:text-teal-800"
                >
                  Create one here
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="font-semibold text-teal-700 hover:text-teal-800"
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="max-w-md w-full mx-auto text-center mt-6">
        <p className="text-xs text-slate-400">
          PharmaVault Academic Verification Framework • All activity is logged for auditing
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
