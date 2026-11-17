import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  User, 
  Store, 
  Activity, 
  CheckCircle2, 
  ArrowRight, 
  Lock
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header / Navigation */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">PharmaVault</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full">
                  TrustRAG v2.0
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Clinical Medicine Verification & Supply Intelligence</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-600">
            <a href="#portals" className="hover:text-teal-700 transition-colors">Portals</a>
            <a href="#workflow" className="hover:text-teal-700 transition-colors">Verification Workflow</a>
            <a href="#compliance" className="hover:text-teal-700 transition-colors">Safety & Standards</a>
          </nav>

          <div className="flex items-center space-x-3">
            <div className="hidden lg:flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>System Operational</span>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
            >
              Sign In
            </button>
            <a
              href="#portals"
              className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-all"
            >
              Select Portal
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold mb-6">
              <Activity className="w-3.5 h-3.5 text-teal-600" />
              <span>Evidence-Grounded Medicine Verification Platform</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
              Deterministic verification for prescriptions, supplies, and claims.
            </h1>
            
            <p className="text-lg text-slate-600 leading-relaxed mb-8">
              PharmaVault connects patients, licensed dispensaries, and clinical auditors. 
              Using local OCR, controlled reference catalogues, and human-in-the-loop review, 
              it detects counterfeit batches and reconciles cross-document discrepancies with verifiable evidence.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href="#portals"
                className="px-6 py-3 rounded-lg bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 shadow-sm flex items-center space-x-2 transition-all"
              >
                <span>Access System Portals</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <button
                onClick={() => navigate('/login?role=claims_reviewer')}
                className="px-6 py-3 rounded-lg bg-slate-100 text-slate-800 font-semibold text-sm hover:bg-slate-200 border border-slate-300 flex items-center space-x-2 transition-all"
              >
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Launch Clinical Reviewer</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-slate-100">
            <div>
              <div className="text-2xl font-bold text-slate-900 font-mono">100%</div>
              <p className="text-xs text-slate-500 mt-0.5">Privacy-Preserving Local OCR</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 font-mono">260+</div>
              <p className="text-xs text-slate-500 mt-0.5">Automated Validation Checks</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 font-mono">SHA-256</div>
              <p className="text-xs text-slate-500 mt-0.5">Immutable Batch Traceability</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 font-mono">HITL</div>
              <p className="text-xs text-slate-500 mt-0.5">Human-in-the-Loop Adjudication</p>
            </div>
          </div>
        </div>
      </section>

      {/* Portals Section */}
      <section id="portals" className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs uppercase font-bold tracking-wider text-teal-700 mb-2">Role-Based Access</h2>
            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">Select your operational portal</h3>
            <p className="text-sm text-slate-600 mt-2">
              Each portal provides a dedicated workspace tailored to clinical, retail, and patient needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 1. Patient Portal */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group">
              <div className="p-7">
                <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 mb-5 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                  <User className="w-6 h-6" />
                </div>
                <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 mb-2">
                  Care & Medication
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-2">Patient Portal</h4>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Verify medicine authenticity, upload prescriptions for OCR parsing, set smart medication reminders, and consult healthcare professionals.
                </p>

                <div className="space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <span>Prescription OCR & item extraction</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <span>QR & batch counterfeit check</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <span>Dosage schedule & smart reminders</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <span>Verified medicine ordering</span>
                  </div>
                </div>
              </div>

              <div className="p-7 pt-0">
                <button
                  onClick={() => navigate('/login?role=patient')}
                  className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm flex items-center justify-center space-x-2 transition-colors"
                >
                  <span>Enter Patient Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 2. Pharmacy Portal */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group">
              <div className="p-7">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Store className="w-6 h-6" />
                </div>
                <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 mb-2">
                  Dispensary Operations
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-2">Pharmacy Hub</h4>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Manage dispensary stock, monitor expiration horizons, review incoming customer prescriptions, and trace registered medicine batches.
                </p>

                <div className="space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>Real-time stock & expiry alerts</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>Prescription review queue</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>Immutable blockchain batch ledger</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>NABH compliance & dispensary stats</span>
                  </div>
                </div>
              </div>

              <div className="p-7 pt-0">
                <button
                  onClick={() => navigate('/login?role=pharmacy')}
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-medium text-sm flex items-center justify-center space-x-2 transition-colors"
                >
                  <span>Enter Pharmacy Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3. Reviewer Portal */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group">
              <div className="p-7">
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 mb-5 group-hover:bg-slate-800 group-hover:text-white transition-colors">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 mb-2">
                  Clinical Verification
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-2">Reviewer Portal</h4>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  TrustRAG verification workstation for cross-document reconciliation, evidence lineage validation, and authorized human sign-off.
                </p>

                <div className="space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-slate-700 flex-shrink-0" />
                    <span>Side-by-side document comparison</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-slate-700 flex-shrink-0" />
                    <span>Prescription vs. Invoice matching</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-slate-700 flex-shrink-0" />
                    <span>Quantity conversion & discrepancy flags</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-slate-700 flex-shrink-0" />
                    <span>Structured export & audit trail</span>
                  </div>
                </div>
              </div>

              <div className="p-7 pt-0">
                <button
                  onClick={() => navigate('/login?role=claims_reviewer')}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-medium text-sm flex items-center justify-center space-x-2 transition-colors"
                >
                  <span>Enter Reviewer Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Verification Workflow Section */}
      <section id="workflow" className="py-16 md:py-24 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs uppercase font-bold tracking-wider text-teal-700 mb-2">Architecture</h2>
            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">How TrustRAG verification operates</h3>
            <p className="text-sm text-slate-600 mt-2">
              A 4-stage deterministic pipeline ensuring strict medical evidence lineage before adjudication.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 relative">
              <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded border border-teal-200">
                STAGE 01
              </span>
              <h4 className="text-base font-bold text-slate-900 mt-4 mb-2">Document Ingestion</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Prescription or pharmacy invoice uploaded securely. Local Tesseract OCR renders text blocks without third-party network egress.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 relative">
              <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded border border-teal-200">
                STAGE 02
              </span>
              <h4 className="text-base font-bold text-slate-900 mt-4 mb-2">Identity Extraction</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Deterministic extraction maps medicine names, dosage units, frequency, and duration against a curated academic catalogue.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 relative">
              <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded border border-teal-200">
                STAGE 03
              </span>
              <h4 className="text-base font-bold text-slate-900 mt-4 mb-2">Cross Reconciliation</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Checks matching items between prescription and invoice. Identifies substitute brands, dosage mismatches, or over-dispensing.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 relative">
              <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded border border-teal-200">
                STAGE 04
              </span>
              <h4 className="text-base font-bold text-slate-900 mt-4 mb-2">Human Adjudication</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                The authorized reviewer inspects side-by-side evidence, modifies or validates items, and approves verified documentation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Safety & Compliance Section */}
      <section id="compliance" className="py-14 bg-slate-100 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 md:p-10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-2xl">
              <div className="flex items-center space-x-2 text-teal-700 text-xs font-bold uppercase tracking-wider mb-2">
                <Lock className="w-4 h-4" />
                <span>Privacy-First Healthcare Standards</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">
                Built strictly for verification reliability, not clinical claims.
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                PharmaVault is an academic prototype for evidence-grounded medicine verification. 
                Patient data remains local, OCR processing is sandboxed, and no automated clinical diagnosis is performed without licensed clinician review.
              </p>
            </div>
            <div className="flex-shrink-0">
              <button
                onClick={() => navigate('/login?role=patient')}
                className="px-6 py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-sm transition-colors"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Medical Footer */}
      <footer className="bg-white border-t border-slate-200 py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm">PharmaVault TrustRAG</span>
                <p className="text-xs text-slate-500">Academic Prototype • Not for Clinical Decisions</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 font-medium">
              <button onClick={() => navigate('/login?role=patient')} className="hover:text-teal-700">Patient Portal</button>
              <button onClick={() => navigate('/login?role=pharmacy')} className="hover:text-teal-700">Pharmacy Hub</button>
              <button onClick={() => navigate('/login?role=claims_reviewer')} className="hover:text-teal-700">Reviewer Portal</button>
              <button onClick={() => navigate('/cases')} className="hover:text-teal-700">Cases Directory</button>
            </div>

            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} PharmaVault. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
