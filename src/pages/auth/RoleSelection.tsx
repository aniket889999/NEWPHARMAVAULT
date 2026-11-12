import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Store, ShieldCheck, ArrowRight, ArrowLeft, Sparkles, Lock, Zap, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const RoleSelection: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleInstantBypass = async (role: string, email: string) => {
    try {
      await login(email, 'password123', role);
      toast.success(`Welcome to ${role.replace('_', ' ').toUpperCase()} Portal!`);
      if (role === 'claims_reviewer' || role === 'pharmacist') {
        navigate('/review-queue');
      } else if (role === 'pharmacy') {
        navigate('/pharmacy/dashboard');
      } else {
        navigate('/patient/dashboard');
      }
    } catch (err: any) {
      toast.error('Could not auto-login: ' + (err.message || 'Error'));
      navigate(`/login?role=${role}`);
    }
  };

  const portals = [
    {
      id: 'patient',
      role: 'patient',
      email: 'patient@test.com',
      title: 'Patient Healthcare Portal',
      badge: 'Individual Healthcare',
      desc: 'Upload handwritten prescriptions for local OCR, chat with medical AI assistant, set pill alarms, and verify authentic drug batches.',
      icon: User,
      iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      btnColor: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20',
      tags: ['Local OCR Scanner', 'AI Medical Assistant', 'Authenticity Check'],
    },
    {
      id: 'pharmacy',
      role: 'pharmacy',
      email: 'pharmacy@test.com',
      title: 'Pharmacy Operations Portal',
      badge: 'Licensed Pharmacy',
      desc: 'Monitor real-time inventory, track batch expiry risk, manage prescription orders, and anchor shipments to the blockchain ledger.',
      icon: Store,
      iconBg: 'bg-cyan-50 text-cyan-600 border-cyan-200',
      badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      btnColor: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-cyan-500/20',
      tags: ['Stock Risk Alerts', 'Expiry Countdown', 'Blockchain Supply Chain'],
    },
    {
      id: 'reviewer',
      role: 'claims_reviewer',
      email: 'reviewer@test.com',
      title: 'TrustRAG Review Queue',
      badge: 'Adjudication & Auditing',
      desc: 'Investigate cross-document discrepancies, review OCR extractions against evidence grounds, and perform authorized HITL approvals.',
      icon: ShieldCheck,
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      btnColor: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20',
      tags: ['Case Investigation', 'Evidence Grounds', 'Audit Export'],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/70 via-white to-slate-50 text-slate-800 flex flex-col justify-between p-4 sm:p-8 font-sans">
      {/* Top Header */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Landing Page
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Lock className="w-3.5 h-3.5 text-blue-600" />
          <span>Role-Based Access Protected</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl w-full mx-auto my-auto py-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Choose Workspace
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            Select Your Portal
          </h1>
          <p className="mt-2 text-slate-600 text-sm">
            Enter with 1-click instant bypass or choose to authenticate with credentials.
          </p>
        </div>

        {/* Portals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {portals.map((portal) => {
            const Icon = portal.icon;
            return (
              <div
                key={portal.id}
                className="p-7 rounded-3xl bg-white border border-slate-200/90 hover:border-blue-400 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${portal.iconBg}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${portal.badgeColor}`}>
                      {portal.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {portal.title}
                  </h3>
                  <p className="text-slate-500 text-xs leading-relaxed mb-5">
                    {portal.desc}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {portal.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200/80 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {/* Instant 1-Click Bypass Button */}
                  <button
                    onClick={() => handleInstantBypass(portal.role, portal.email)}
                    className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 ${portal.btnColor}`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>⚡ 1-Click Instant Enter</span>
                  </button>

                  {/* Manual Login */}
                  <button
                    onClick={() => navigate(`/login?role=${portal.role}`)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-all text-center block"
                  >
                    Login with ID / Password
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl w-full mx-auto text-center py-4 text-xs text-slate-400 border-t border-slate-200/80">
        PharmaVault Medical SaaS • Instant 1-click bypass enabled for development & review.
      </div>
    </div>
  );
};

export default RoleSelection;
