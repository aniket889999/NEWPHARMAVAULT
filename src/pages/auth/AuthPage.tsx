import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth, MfaRequiredError } from '../../context/AuthContext';
import { ShieldCheck, User, Store, Mail, Lock, CheckCircle2, ChevronLeft, Building2, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { portalHome, portalTitle, STAFF_PORTALS } from '../../features/navigation/portalPolicy';

const DEMO_CREDENTIALS: Record<string, { name: string; email: string }> = {
  patient: { name: 'Demo Patient', email: 'patient@test.com' },
  pharmacy: { name: 'Demo Pharmacy Hub', email: 'pharmacy@test.com' },
  claims_reviewer: { name: 'Clinical Claims Reviewer', email: 'reviewer@test.com' },
  pharmacist: { name: 'Demo Pharmacist', email: 'pharmacist@test.com' },
  org_admin: { name: 'Demo Organization Admin', email: 'orgadmin@test.com' },
  super_admin: { name: 'Demo System Admin', email: 'admin@test.com' },
  research_evaluator: { name: 'Demo Research Evaluator', email: 'research@test.com' },
  payer_reviewer: { name: 'Demo Insurer Reviewer', email: 'insurer@test.com' },
  payer_admin: { name: 'Demo Insurer Admin', email: 'insureradmin@test.com' },
};

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
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  // Reviewer tab covers every provisioned staff role; backend login requires an exact role match.
  const [staffRole, setStaffRole] = useState<string>(() => {
    const requested = searchParams.get('staffRole');
    return STAFF_PORTALS.some((p) => p.role === requested) ? (requested as string) : 'claims_reviewer';
  });

  const loginRole = activeRole === 'claims_reviewer' ? staffRole : activeRole;
  const canSelfRegister = activeRole === 'patient';

  const [email, setEmail] = useState(() => DEMO_CREDENTIALS[loginRole]?.email || '');
  const [password, setPassword] = useState('password123');
  const [otp, setOtp] = useState('');
  const [needsOtp, setNeedsOtp] = useState(false);

  // Sync state if url param changes
  useEffect(() => {
    const role = searchParams.get('role');
    if (role === 'pharmacy' || role === 'claims_reviewer' || role === 'patient') {
      setActiveRole(role);
    }
    const requestedStaffRole = searchParams.get('staffRole');
    if (requestedStaffRole && STAFF_PORTALS.some((p) => p.role === requestedStaffRole)) {
      setStaffRole(requestedStaffRole);
      setEmail(DEMO_CREDENTIALS[requestedStaffRole]?.email || '');
    } else if (role && role !== 'claims_reviewer') {
      setEmail(DEMO_CREDENTIALS[role]?.email || '');
    }
  }, [searchParams]);

  // Handle switching tabs
  const handleRoleChange = (role: 'patient' | 'pharmacy' | 'claims_reviewer') => {
    setActiveRole(role);
    if (role !== 'patient') setIsLogin(true);
    const targetRole = role === 'claims_reviewer' ? staffRole : role;
    setEmail(DEMO_CREDENTIALS[targetRole]?.email || '');
    setPassword('password123');
    setSearchParams(role === 'claims_reviewer' ? { role, staffRole } : { role });
    setError('');
  };

  const handleStaffRoleChange = (newStaffRole: string) => {
    setStaffRole(newStaffRole);
    setEmail(DEMO_CREDENTIALS[newStaffRole]?.email || '');
    setPassword('password123');
    setSearchParams({ role: 'claims_reviewer', staffRole: newStaffRole });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        await login(email, password, loginRole, needsOtp ? otp : undefined);
        toast.success(`Signed in to ${portalDetails.title}`);
      } else {
        if (!canSelfRegister) throw new Error('Staff and pharmacy accounts are provisioned by an organization administrator.');
        await signup(name, email, password, 'patient');
        toast.success('Account created successfully');
      }

      navigate(portalHome(loginRole));
    } catch (err: any) {
      if (err instanceof MfaRequiredError) {
        setNeedsOtp(true);
        setOtp('');
        setError(err.message);
        return;
      }
      const msg = err.response?.data?.message || err.message || 'Authentication failed. Please verify credentials.';
      setError(msg);
      toast.error(msg);
    }
  };

  // Instant 1-Click Demo Login handler
  const handleQuickDemoLogin = async (demoRole: 'patient' | 'pharmacy' | 'claims_reviewer') => {
    setError('');
    const effectiveRole = demoRole === 'claims_reviewer' ? staffRole : demoRole;
    const targetDemo = DEMO_CREDENTIALS[effectiveRole] || DEMO_CREDENTIALS[demoRole];
    const demoEmail = targetDemo.email;
    const demoPass = 'password123';

    try {
      await login(demoEmail, demoPass, effectiveRole);
      toast.success(`Signed in as ${targetDemo.name} (Demo)`);
      navigate(portalHome(effectiveRole));
    } catch (err: any) {
      setEmail(demoEmail);
      setPassword(demoPass);
      setName(targetDemo.name);
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
      demoName: DEMO_CREDENTIALS.patient.name,
      demoEmail: DEMO_CREDENTIALS.patient.email
    },
    pharmacy: {
      title: 'Pharmacy Hub',
      subtitle: 'Dispensary inventory, prescription review & ledger',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      accentColor: 'text-blue-700',
      btnColor: 'bg-blue-700 hover:bg-blue-800 text-white',
      icon: Store,
      demoName: DEMO_CREDENTIALS.pharmacy.name,
      demoEmail: DEMO_CREDENTIALS.pharmacy.email
    },
    claims_reviewer: {
      title: portalTitle(staffRole),
      subtitle: ['payer_reviewer', 'payer_admin'].includes(staffRole)
        ? 'Insurer claims adjudication, coverage & settlement workstation'
        : 'TrustRAG verification queue & discrepancy adjudication',
      badgeColor: ['payer_reviewer', 'payer_admin'].includes(staffRole)
        ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
        : 'bg-slate-100 text-slate-800 border-slate-300',
      accentColor: ['payer_reviewer', 'payer_admin'].includes(staffRole)
        ? 'text-indigo-800'
        : 'text-slate-800',
      btnColor: ['payer_reviewer', 'payer_admin'].includes(staffRole)
        ? 'bg-indigo-700 hover:bg-indigo-800 text-white'
        : 'bg-slate-800 hover:bg-slate-900 text-white',
      icon: ['payer_reviewer', 'payer_admin'].includes(staffRole) ? Building2 : ShieldCheck,
      demoName: DEMO_CREDENTIALS[staffRole]?.name || 'Clinical Claims Reviewer',
      demoEmail: DEMO_CREDENTIALS[staffRole]?.email || 'reviewer@test.com'
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

        {/* Quick Demo Access Bar (development builds only; seeded synthetic accounts) */}
        {import.meta.env.DEV && <>
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
        </>}

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

            {activeRole === 'claims_reviewer' && (
              <div>
                <label htmlFor="staff-role" className="block text-xs font-semibold text-slate-700 mb-1">
                  Staff Role
                </label>
                <select
                  id="staff-role"
                  value={staffRole}
                  onChange={(e) => handleStaffRoleChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600"
                >
                  {STAFF_PORTALS.map((option) => (
                    <option key={option.role} value={option.role}>{option.label}</option>
                  ))}
                </select>
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
                  minLength={isLogin ? undefined : 15}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>
            </div>

            {isLogin && needsOtp && (
              <div>
                <label htmlFor="otp" className="block text-xs font-semibold text-slate-700 mb-1">
                  Authenticator Code
                </label>
                <input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}|[A-Za-z0-9]{4}-[A-Za-z0-9]{4}"
                  maxLength={9}
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.toUpperCase().replace(/[^0-9A-Z-]/g, ''))}
                  placeholder="6-digit code or recovery code"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>
            )}

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
            {!canSelfRegister ? (
              <span>Staff and pharmacy accounts are provisioned by an organization administrator.</span>
            ) : isLogin ? (
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
