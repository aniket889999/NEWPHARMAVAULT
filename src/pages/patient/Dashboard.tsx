import React, { useState } from 'react';
import {
  Activity,
  ShieldCheck,
  Clock,
  Bot,
  Video,
  FileText,
  ChevronRight,
  HeartPulse,
  Sparkles,
  Pill,
  Search,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Calendar,
  ArrowUpRight,
  Upload,
  Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

const PatientDashboard: React.FC = () => {
  // Modal states
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [batchCode, setBatchCode] = useState('');
  const [verifyResult, setVerifyResult] = useState<null | {
    medicine: string;
    batch: string;
    expiry: string;
    status: string;
    isGenuine: boolean;
  }>(null);

  // Quick upload modal state
  const [uploadStep, setUploadStep] = useState<'idle' | 'processing' | 'done'>('idle');

  const handleQuickVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchCode.trim()) {
      toast.error('Please enter a batch code or serial number');
      return;
    }
    setVerifyResult({
      medicine: 'Augmentin 625 Duo (Amoxicillin + Clavulanate)',
      batch: batchCode.toUpperCase(),
      expiry: 'Nov 2027',
      status: 'VERIFIED_GENUINE',
      isGenuine: true,
    });
    toast.success('Batch authenticity confirmed on ledger!');
  };

  const handleSimulateUpload = () => {
    setUploadStep('processing');
    setTimeout(() => {
      setUploadStep('done');
      toast.success('Local OCR processed prescription successfully!');
    }, 1500);
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-7 font-sans bg-slate-50 min-h-full">
      {/* Welcome Banner */}
      <div className="relative rounded-3xl p-8 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 text-white shadow-lg overflow-hidden">
        {/* Glow Spheres */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 right-1/3 w-64 h-64 bg-cyan-300/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-white text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-cyan-200" /> Patient Healthcare Command Center
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              Welcome back to PharmaVault! 👋
            </h1>
            <p className="mt-2 text-blue-100 text-sm sm:text-base leading-relaxed">
              Your personal healthcare workspace. Check drug legitimacy, extract handwritten doctor prescriptions via private OCR, and get medical advice with zero data sharing.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/patient/health-assistant"
                className="px-5 py-2.5 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs shadow-md transition-all flex items-center gap-2"
              >
                <Bot className="w-4 h-4 text-blue-600" /> Ask AI Assistant
              </Link>
              <button
                onClick={() => {
                  setVerifyResult(null);
                  setBatchCode('');
                  setIsVerifyModalOpen(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-800/60 hover:bg-blue-800 text-white border border-blue-400/40 font-bold text-xs transition-all flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-cyan-300" /> Instant Drug Verification
              </button>
              <button
                onClick={() => {
                  setUploadStep('idle');
                  setIsUploadModalOpen(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> Quick Prescription OCR
              </button>
            </div>
          </div>

          {/* Adherence Card */}
          <div className="p-5 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-md flex items-center gap-4 min-w-[230px]">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <HeartPulse className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-100">Medication Adherence</div>
              <div className="text-2xl font-black text-white">96.4%</div>
              <div className="text-[11px] text-cyan-200 font-semibold">All daily doses on track</div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Prescriptions', value: '3 Active', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Verified Batches', value: '18 Batches', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Next Scheduled Dose', value: '08:00 PM', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Resolved Cases', value: '2 Resolved', icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-slate-500">{stat.label}</span>
                <div className={`w-8 h-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-900">{stat.value}</div>
            </div>
          );
        })}
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Active Healthcare Workflows</h2>
          <p className="text-xs text-slate-500 mt-0.5">Explore AI diagnostics, teleconsultation, and document intelligence</p>
        </div>
        <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          6 Modules Operational
        </span>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: AI OCR Analyzer */}
        <Link
          to="/patient/prescriptions"
          className="p-6 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-400 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between group"
        >
          <div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center justify-between">
              <span>AI Prescription OCR</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              Extract handwriting, active ingredients, dosage schedules, and check contraindications locally.
            </p>
          </div>
          <span className="text-xs font-bold text-blue-600 flex items-center">
            Open OCR Engine <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
          </span>
        </Link>

        {/* Card 2: Drug Authenticity Verifier */}
        <div
          onClick={() => {
            setVerifyResult(null);
            setBatchCode('');
            setIsVerifyModalOpen(true);
          }}
          className="p-6 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-400 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center justify-between">
              <span>Drug Authenticity Check</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              Scan medicine QR codes or batch hashes to mathematically verify non-counterfeit origin on the ledger.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-600 flex items-center">
            Verify Batch (Quick Modal) <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>

        {/* Card 3: AI Assistant */}
        <Link
          to="/patient/health-assistant"
          className="p-6 rounded-2xl bg-white border border-slate-200/90 hover:border-cyan-400 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between group"
        >
          <div>
            <div className="w-11 h-11 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center mb-4">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center justify-between">
              <span>Medical AI Assistant</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-600 transition-colors" />
            </h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              Ask symptom questions, check drug-drug interactions, and find generic chemical equivalents safely.
            </p>
          </div>
          <span className="text-xs font-bold text-cyan-600 flex items-center">
            Chat with Assistant <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
          </span>
        </Link>

        {/* Card 4: Verification Cases */}
        <Link
          to="/cases"
          className="p-6 rounded-2xl bg-white border border-slate-200/90 hover:border-indigo-400 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between group"
        >
          <div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center justify-between">
              <span>TrustRAG Case Center</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              View discrepancy audits, catalogue match lineage, and authorized reviewer status in one place.
            </p>
          </div>
          <span className="text-xs font-bold text-indigo-600 flex items-center">
            Open Cases <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
          </span>
        </Link>

        {/* Card 5: Smart Reminders */}
        <Link
          to="/patient/reminders"
          className="p-6 rounded-2xl bg-white border border-slate-200/90 hover:border-amber-400 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between group"
        >
          <div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center justify-between">
              <span>Smart Pill Schedule</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
            </h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              Manage automatic dose alarms with optional SMS & email alerts so you never skip treatments.
            </p>
          </div>
          <span className="text-xs font-bold text-amber-600 flex items-center">
            View Schedule <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
          </span>
        </Link>

        {/* Card 6: Teleconsultation */}
        <Link
          to="/patient/doctor-consult"
          className="p-6 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-400 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between group"
        >
          <div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center justify-between">
              <span>Doctor Teleconsult</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              Book instant encrypted video consults with certified doctors for dosage updates and refills.
            </p>
          </div>
          <span className="text-xs font-bold text-blue-600 flex items-center">
            Launch Call <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
          </span>
        </Link>
      </div>

      {/* Modal 1: Quick Authenticity Verification */}
      <Modal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        title="Drug Authenticity Verifier"
        description="Verify legitimate pharmaceutical origin and batch integrity against the ledger."
        maxWidth="lg"
      >
        <div className="space-y-4">
          <form onSubmit={handleQuickVerify} className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Enter Medicine Batch Number / Serial Hash
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. PV-BATCH-2026-X or AUG-625"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" /> Check
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Quick test demo: <span className="text-blue-600 cursor-pointer font-bold underline" onClick={() => setBatchCode('AUG-625-DEMO')}>AUG-625-DEMO</span> or <span className="text-blue-600 cursor-pointer font-bold underline" onClick={() => setBatchCode('PARACET-2026')}>PARACET-2026</span>
            </p>
          </form>

          {verifyResult && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Genuine Batch Confirmed
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  LEDGER #0x8F91A2
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Medicine:</span>
                  <p className="font-bold text-slate-900 mt-0.5">{verifyResult.medicine}</p>
                </div>
                <div>
                  <span className="text-slate-500">Batch Code:</span>
                  <p className="font-mono font-bold text-slate-900 mt-0.5">{verifyResult.batch}</p>
                </div>
                <div>
                  <span className="text-slate-500">Expiry Status:</span>
                  <p className="font-bold text-emerald-700 mt-0.5">{verifyResult.expiry} (Safe)</p>
                </div>
                <div>
                  <span className="text-slate-500">Chain Status:</span>
                  <p className="font-bold text-slate-900 mt-0.5">Authorized Manufacturer</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal 2: Quick Prescription Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Quick Prescription Upload (Local OCR)"
        description="Extract doctor handwriting with on-device OCR without transmitting patient data."
        maxWidth="md"
      >
        <div className="space-y-4">
          {uploadStep === 'idle' && (
            <div className="text-center py-7 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-blue-50/20">
              <Upload className="w-10 h-10 text-blue-600 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800">Drop prescription image or PDF here</h4>
              <p className="text-xs text-slate-400 mt-0.5 mb-4">Supports PNG, JPG, or PDF up to 10MB</p>
              <button
                type="button"
                onClick={handleSimulateUpload}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all"
              >
                Upload Demo Prescription (Rx_Paracetamol.jpg)
              </button>
            </div>
          )}

          {uploadStep === 'processing' && (
            <div className="text-center py-8">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">Extracting Text via Tesseract OCR...</h4>
              <p className="text-xs text-slate-400 mt-1">Normalizing lines and matching drug catalogue</p>
            </div>
          )}

          {uploadStep === 'done' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Extracted: Paracetamol 500mg Tablet (1 Tab TDS)</span>
              </div>
              <p className="text-xs text-slate-500">
                OCR successfully parsed medicine and added it to your active verification list.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
                >
                  Done
                </button>
                <Link
                  to="/patient/prescriptions"
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs text-center transition-all"
                >
                  View in OCR Page
                </Link>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default PatientDashboard;
