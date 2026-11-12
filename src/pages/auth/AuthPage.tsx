import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import {
  ShieldCheck,
  User,
  Store,
  FileSearch,
  Lock,
  Mail,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Zap
} from 'lucide-react';

const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const role = searchParams.get('role') || 'patient';

  const { login, signup } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isPharmacy = role === 'pharmacy';
  const isReviewer = role === 'claims_reviewer' || role === 'pharmacist';

  const portalConfig = isReviewer
    ? {
        title: 'TrustRAG Reviewer Portal',
        subtitle: 'Adjudication, discrepancy review & evidence lineage',
        icon: FileSearch,
        textColor: 'text-indigo-600',
        badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        btnBg: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20',
        badge: 'Claims & Compliance Review',
        demoName: 'Demo Claims Reviewer',
        demoEmail: 'reviewer@test.com',
      }
    : isPharmacy
    ? {
        title: 'Pharmacy Operations Portal',
        subtitle: 'Inventory intelligence, batch expiry alerts & dispatch',
        icon: Store,
        textColor: 'text-cyan-600',
        badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        btnBg: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-cyan-600/20',
        badge: 'Licensed Pharmacy Operations',
        demoName: 'Apex Pharmacy Hub',
        demoEmail: 'pharmacy@test.com',
      }
    : {
        title: 'Patient Healthcare Portal',
        subtitle: 'Prescriptions, drug authenticity & smart health reminders',
        icon: User,
        textColor: 'text-blue-600',
        badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
        btnBg: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20',
        badge: 'Patient Workspace',
        demoName: 'Demo Patient',
        demoEmail: 'patient@test.com',
      };

  const Icon = portalConfig.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(email, password, role);
        toast.success(`Welcome to ${portalConfig.title}!`);
      } else {
        await signup(name, email, password, role);
        toast.success('Account created successfully!');
      }

      if (isReviewer) {
        navigate('/review-queue');
      } else if (role === 'patient') {
        navigate('/patient/dashboard');
      } else {
        navigate('/pharmacy/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Authentication failed. Try the Instant 1-Click Bypass below!';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstantBypass = async () => {
    setIsLoading(true);
    try {
      await login(portalConfig.demoEmail, 'password123', role);
      toast.success(`Instant bypass authorized for ${portalConfig.title}!`);
      if (isReviewer) navigate('/review-queue');
      else if (role === 'pharmacy') navigate('/pharmacy/dashboard');
      else navigate('/patient/dashboard');
    } catch (err: any) {
      toast.error('Bypass error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail(portalConfig.demoEmail);
    setPassword('password123');
    setName(portalConfig.demoName);
    toast('Demo credentials auto-filled! Click Sign In or Sign Up.', { icon: '✨' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/70 via-white to-slate-50 text-slate-800 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-4xl rounded-3xl bg-white border border-slate-200/90 shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 my-auto">
        {/* Left Visual Branding Panel */}
        <div className="lg:col-span-5 p-8 bg-gradient-to-b from-blue-50/80 via-white to-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200/80 flex flex-col justify-between">
          <div>
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" /> Change Portal
            </button>

            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center mb-4">
              <Icon className={`w-6 h-6 ${portalConfig.textColor}`} />
            </div>

            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${portalConfig.badgeBg} mb-2`}>
              {portalConfig.badge}
            </span>

            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {portalConfig.title}
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              {portalConfig.subtitle}
            </p>

            <div className="mt-6 space-y-2.5">
              {[
                'Role-Based Cryptographic Access',
                'Local Tesseract OCR Pre-Processing',
                'Zero-Knowledge Ledger Logs',
              ].map((feat, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <CheckCircle2 className={`w-4 h-4 ${portalConfig.textColor} shrink-0`} />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Instant 1-Click Bypass Button */}
          <div className="mt-8 pt-6 border-t border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Bypass Login (Direct Access)
            </span>
            <button
              type="button"
              onClick={handleInstantBypass}
              disabled={isLoading}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-600" />
              <span>⚡ 1-Click Instant Enter</span>
            </button>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto">
            {/* Header toggle */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  {isLogin ? 'Sign In' : 'Create Account'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isLogin ? 'Enter your login details' : 'Register a new account'}
                </p>
              </div>

              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    isLogin ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    !isLogin ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {!isLogin && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Full Name / Organization
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Samar Verma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="name@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 mt-2 ${portalConfig.btnBg}`}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isLogin ? 'Sign In to Portal' : 'Register Account'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Fill */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleFillDemo}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" /> Auto-fill Demo Credentials
              </button>
              <button
                type="button"
                onClick={handleInstantBypass}
                className="text-xs text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" /> Skip & Enter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
