import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  User,
  Store,
  FileSearch,
  CheckCircle2,
  Sparkles,
  Layers,
  ChevronRight,
  FileText,
  Clock,
  Activity,
  HeartPulse,
  Award
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isQuickScanModalOpen, setIsQuickScanModalOpen] = useState(false);
  const [demoStep, setDemoStep] = useState<'upload' | 'scanning' | 'verified'>('upload');

  const handleRunDemo = () => {
    setDemoStep('scanning');
    setTimeout(() => {
      setDemoStep('verified');
    }, 1200);
  };

  const handleQuickBypass = async (role: string) => {
    try {
      const email = role === 'pharmacy' ? 'pharmacy@test.com' : role === 'claims_reviewer' ? 'reviewer@test.com' : 'patient@test.com';
      await login(email, 'password123', role);
      toast.success(`Entered ${role.replace('_', ' ')} portal directly!`);
      if (role === 'claims_reviewer') navigate('/review-queue');
      else if (role === 'pharmacy') navigate('/pharmacy/dashboard');
      else navigate('/patient/dashboard');
    } catch (_) {
      navigate(`/login?role=${role}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/60 via-white to-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/85 border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900">
                Pharma<span className="text-blue-600">Vault</span>
              </span>
              <span className="block text-[10px] font-bold text-cyan-600 tracking-wider uppercase">
                TrustRAG Engine
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Capabilities</a>
            <a href="#portals" className="hover:text-blue-600 transition-colors">Portals</a>
            <button
              onClick={() => {
                setDemoStep('upload');
                setIsDemoOpen(true);
              }}
              className="text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors font-bold"
            >
              <Sparkles className="w-4 h-4 text-cyan-500" /> Interactive Demo
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/auth')}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center gap-2"
            >
              Choose Portal <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Highlight Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-200 bg-blue-50/80 text-blue-700 text-xs font-bold uppercase tracking-wider mb-8 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>Evidence-Grounded Medicine Verification & Intelligence</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 max-w-5xl mx-auto leading-[1.15]">
          Verified Pharmaceuticals.{' '}
          <span className="bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 bg-clip-text text-transparent">
            Uncompromised Trust.
          </span>
        </h1>

        <p className="mt-5 text-base sm:text-xl text-slate-600 max-w-3xl mx-auto font-normal leading-relaxed">
          PharmaVault TrustRAG automates on-device prescription OCR, cross-document verification, supply-chain expiry tracking, and human-in-the-loop review.
        </p>

        {/* Action Buttons */}
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <button
            onClick={() => navigate('/auth')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/25 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
          >
            Enter Portal Gateway <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setDemoStep('upload');
              setIsDemoOpen(true);
            }}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5"
          >
            <Zap className="w-4 h-4 text-amber-500" /> Try Live OCR Simulation
          </button>
        </div>

        {/* Feature Badges Bar */}
        <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            { label: 'Local Tesseract OCR', value: '100% Privacy', desc: 'Zero data leakage' },
            { label: 'Verification Speed', value: '< 1.8s', desc: 'Real-time catalogue lookup' },
            { label: 'Audit Trail', value: 'Immutable', desc: 'Cryptographic ledger' },
            { label: 'Multi-Tenant RBAC', value: 'Isolated', desc: 'Patient, Pharmacy, Reviewer' },
          ].map((stat, i) => (
            <div key={i} className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs text-left">
              <div className="text-xl font-black text-slate-900">{stat.value}</div>
              <div className="text-xs font-bold text-blue-600 mt-0.5">{stat.label}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{stat.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Portals Section */}
      <section id="portals" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200/80">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Select Workspace</span>
          <h2 className="mt-1.5 text-3xl font-extrabold text-slate-900 tracking-tight">
            Tailored Portals for Every Workflow
          </h2>
          <p className="mt-2 text-slate-500 max-w-2xl mx-auto text-sm">
            Access your dedicated environment with one click or explore with credential login.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Patient Portal Card */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200/90 hover:border-blue-400 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-5">
                <User className="w-6 h-6" />
              </div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold mb-2">
                Patient & Consumer
              </span>
              <h3 className="text-xl font-bold text-slate-900 mb-1.5">Patient Healthcare Portal</h3>
              <p className="text-slate-500 text-xs leading-relaxed mb-6">
                Upload handwritten prescriptions, run local OCR, consult the medical AI assistant, and check drug authenticity.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleQuickBypass('patient')}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <span>⚡ Instant 1-Click Launch</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => navigate('/login?role=patient')}
                className="w-full py-2 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 transition-all text-center block"
              >
                Login with ID / Password
              </button>
            </div>
          </div>

          {/* Pharmacy Portal Card */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200/90 hover:border-cyan-400 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 mb-5">
                <Store className="w-6 h-6" />
              </div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 text-[11px] font-bold mb-2">
                Licensed Pharmacy
              </span>
              <h3 className="text-xl font-bold text-slate-900 mb-1.5">Pharmacy Operations</h3>
              <p className="text-slate-500 text-xs leading-relaxed mb-6">
                Live catalogue stock, batch expiry countdowns, automated discount triggers, and blockchain ledger tracking.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleQuickBypass('pharmacy')}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <span>⚡ Instant 1-Click Launch</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => navigate('/login?role=pharmacy')}
                className="w-full py-2 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 transition-all text-center block"
              >
                Login with ID / Password
              </button>
            </div>
          </div>

          {/* Reviewer Portal Card */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200/90 hover:border-indigo-400 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-5">
                <FileSearch className="w-6 h-6" />
              </div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold mb-2">
                Verification & Auditing
              </span>
              <h3 className="text-xl font-bold text-slate-900 mb-1.5">TrustRAG Review Queue</h3>
              <p className="text-slate-500 text-xs leading-relaxed mb-6">
                Human-in-the-loop adjudication, document discrepancy resolution, confidence metrics, and structured case exports.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleQuickBypass('claims_reviewer')}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <span>⚡ Instant 1-Click Launch</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => navigate('/login?role=claims_reviewer')}
                className="w-full py-2 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 transition-all text-center block"
              >
                Login with ID / Password
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section id="features" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200/80">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">
              <Layers className="w-4 h-4" /> Technical Architecture
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Deterministic Verification & Supply Integrity
            </h2>
            <p className="mt-3 text-slate-600 text-sm leading-relaxed">
              PharmaVault pairs lightweight OCR with controlled catalogue lookup, ensuring no AI hallucinations interfere with patient medicine safety.
            </p>

            <div className="mt-6 space-y-3.5">
              {[
                {
                  title: 'Private OCR Extraction',
                  desc: 'Processes prescriptions on your machine without external cloud transmission.',
                },
                {
                  title: 'Exact Catalogue Mapping',
                  desc: 'Resolves medicine dosage and active ingredients against official databases.',
                },
                {
                  title: 'Cryptographic Supply Chain Hash',
                  desc: 'Verifies pharmaceutical batch origin to prevent counterfeit drug dispensing.',
                },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-slate-900 font-bold text-sm">{item.title}</h4>
                    <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Visual Graphic */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200/90 shadow-lg">
            <div className="flex items-center justify-between pb-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="text-xs font-mono text-slate-500 ml-2">trustrag-verifier.v1</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono text-xs font-bold border border-emerald-200">
                STATUS: VERIFIED
              </span>
            </div>

            <div className="mt-5 space-y-3 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Document Input</span>
                <div className="text-slate-800 mt-1 font-semibold flex items-center justify-between">
                  <span>Prescription_Augmentin.pdf</span>
                  <span className="text-emerald-600 text-xs">OCR Pass (99.1%)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Catalogue Identity Match</span>
                <div className="text-slate-800 mt-1 font-semibold flex items-center justify-between">
                  <span>Augmentin 625 Duo (Amox + Clav)</span>
                  <span className="text-blue-600 text-xs">#PV-6250</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Batch Ledger Hash</span>
                <div className="text-slate-800 mt-1 font-semibold flex items-center justify-between">
                  <span>0x8F91A2...E9A1</span>
                  <span className="text-emerald-600 text-xs">Genuine Origin</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setDemoStep('upload');
                setIsDemoOpen(true);
              }}
              className="mt-5 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-300" /> Open Interactive Verification Modal
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-10 px-4 text-center text-xs text-slate-500 bg-white">
        <p>© 2026 PharmaVault TrustRAG. Built for Evidence-Grounded Healthcare Intelligence.</p>
        <div className="mt-3 flex items-center justify-center gap-5 text-slate-600 font-medium">
          <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate('/auth')}>Portals</span>
          <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate('/login?role=patient')}>Patient</span>
          <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate('/login?role=pharmacy')}>Pharmacy</span>
          <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate('/login?role=claims_reviewer')}>Reviewer</span>
        </div>
      </footer>

      {/* Interactive OCR Demo Modal */}
      <Modal
        isOpen={isDemoOpen}
        onClose={() => setIsDemoOpen(false)}
        title="Interactive TrustRAG OCR Simulation"
        description="Experience the end-to-end verification pipeline in real-time."
        maxWidth="lg"
      >
        <div className="space-y-5">
          {demoStep === 'upload' && (
            <div className="text-center py-8 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-blue-50/30">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1">Simulate Doctor Prescription</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
                Sample Prescription: <strong>Augmentin 625 Duo Tablet</strong> (Amoxicillin + Clavulanate)
              </p>
              <button
                onClick={handleRunDemo}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md"
              >
                Run Scan & Evidence Check
              </button>
            </div>
          )}

          {demoStep === 'scanning' && (
            <div className="text-center py-10">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-900">Running Local Tesseract OCR...</h4>
              <p className="text-xs text-slate-500 mt-1">Cross-referencing catalogue records & risk models</p>
            </div>
          )}

          {demoStep === 'verified' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-emerald-900">Evidence Verified • Match 99.4%</div>
                  <div className="text-[11px] text-emerald-700">Batch is authentic and registered in active pharmacy stock</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-400 text-[10px] font-bold uppercase">Medicine Name</div>
                  <div className="text-slate-900 font-bold mt-0.5">Augmentin 625 Duo</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-400 text-[10px] font-bold uppercase">Expiry Status</div>
                  <div className="text-emerald-600 font-bold mt-0.5">Dec 2027 (Safe)</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-400 text-[10px] font-bold uppercase">Dosage Regimen</div>
                  <div className="text-slate-900 font-bold mt-0.5">1 Tab Twice Daily (BD)</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-400 text-[10px] font-bold uppercase">Ledger Hash</div>
                  <div className="text-blue-600 font-mono font-bold mt-0.5">0x7F2B...E9A1</div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setDemoStep('upload')}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
                >
                  Scan Another Sample
                </button>
                <button
                  onClick={() => {
                    setIsDemoOpen(false);
                    navigate('/auth');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all"
                >
                  Open Portal Gateway
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
