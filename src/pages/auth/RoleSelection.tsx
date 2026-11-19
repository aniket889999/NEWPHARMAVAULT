import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Store, ShieldCheck, ArrowRight, ChevronLeft, FileText } from 'lucide-react';

const RoleSelection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-6">
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <Link 
          to="/" 
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Home
        </Link>
        <span className="text-xs text-slate-400 font-medium">PharmaVault Gateway</span>
      </div>

      <div className="max-w-6xl w-full mx-auto py-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Select System Role</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Choose your operational portal
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Access your dedicated workstation based on your credentials
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Patient Card */}
          <div
            onClick={() => navigate('/login?role=patient')}
            className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-400 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 mb-5 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <User className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Patient Portal</h2>
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                Prescription upload, OCR verification, batch authenticity checking, dosage reminders, and verified medicine ordering.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-teal-700 group-hover:text-teal-800 pt-4 border-t border-slate-100">
              <span>Sign In as Patient</span>
              <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Pharmacy Card */}
          <div
            onClick={() => navigate('/login?role=pharmacy')}
            className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Store className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Pharmacy Hub</h2>
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                Dispensary inventory, prescription review queue, expiration horizon tracking, and immutable batch ledger operations.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-blue-700 group-hover:text-blue-800 pt-4 border-t border-slate-100">
              <span>Sign In to Pharmacy Hub</span>
              <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Reviewer Card */}
          <div
            onClick={() => navigate('/login?role=claims_reviewer')}
            className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-500 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 mb-5 group-hover:bg-slate-800 group-hover:text-white transition-colors">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Reviewer &amp; Insurer</h2>
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                Case evidence and consent-based insurance review. Choose your provisioned staff role; each account sees only its authorised sections.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-slate-800 group-hover:text-slate-900 pt-4 border-t border-slate-100">
              <span>Sign In as Staff</span>
              <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Claimants are patients; this entry opens the v4 claimant sign-in tab. */}
          <div
            onClick={() => navigate('/login?role=claimant')}
            className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-400 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 mb-5 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                <FileText className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Claimant Portal</h2>
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                Submit a verified case with consent, respond to insurer queries, and track claim decisions and appeals.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-indigo-700 group-hover:text-indigo-800 pt-4 border-t border-slate-100">
              <span>Sign In as Claimant</span>
              <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto text-center py-4">
        <p className="text-xs text-slate-400">
          PharmaVault Healthcare Technology • Clinical Verification Architecture
        </p>
      </div>
    </div>
  );
};

export default RoleSelection;
