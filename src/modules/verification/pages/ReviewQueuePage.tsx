import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { VerificationCase } from '../types';
import { verificationApi } from '../api/verificationApi';
import { useAuth } from '../../../context/AuthContext';
import { VerificationNav } from '../components/VerificationNav';
import { ReviewActionModal } from '../components/ReviewActionModal';
import {
  Inbox,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  FileText,
  Clock,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Sparkles,
  FileSearch,
  Scale
} from 'lucide-react';
import toast from 'react-hot-toast';

export const ReviewQueuePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [queueCases, setQueueCases] = useState<VerificationCase[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState<boolean>(false);

  // Adjudication Modal state
  const [selectedCase, setSelectedCase] = useState<VerificationCase | null>(null);

  const allowedRoles = ['claims_reviewer', 'pharmacist', 'pharmacy', 'org_admin', 'super_admin'];
  const hasAccess = user && allowedRoles.includes(user.role);

  const fetchQueue = async () => {
    if (!hasAccess) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await verificationApi.getReviewQueue();
      setQueueCases(data);
    } catch (err: any) {
      console.error('Failed to load review queue:', err);
      const msg = err.response?.data?.message || err.message || 'Error fetching review queue';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      fetchQueue();
    }
  }, [hasAccess]);

  const handleCreatePendingCase = async () => {
    try {
      setIsGeneratingDemo(true);
      const created = await verificationApi.createCase(
        'CLAIM-REVIEW-REQ-402',
        'Patient claim flagged for human adjudication: Discrepancy between prescribed dosage (625mg) and invoice units (500mg).'
      );
      toast.success('Sample pending adjudication case created!');
      fetchQueue();
      navigate(`/cases/${created.id || created._id}`);
    } catch (err: any) {
      toast.error('Failed: ' + (err.message || 'Network error'));
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <VerificationNav />
        <div className="flex-1 max-w-xl mx-auto p-8 flex items-center justify-center">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-xs">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Restricted Adjudication Area</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              The Reviewer Queue is reserved for licensed pharmacists and claims reviewers. Patients can track their cases under My Cases.
            </p>
            <button
              onClick={() => navigate('/cases')}
              className="mt-6 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
            >
              Go to My Cases
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <VerificationNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Reviewer Adjudication Queue
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {queueCases.length} Pending Actions
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              High-priority verification cases requiring Human-In-The-Loop clinical judgment and signature.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCreatePendingCase}
              disabled={isGeneratingDemo}
              className="px-3.5 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>{isGeneratingDemo ? 'Staging...' : '⚡ Stage Sample Case'}</span>
            </button>

            <button
              onClick={fetchQueue}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-xs"
              title="Refresh queue"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mandatory Accountability Banner */}
        <div className="bg-gradient-to-r from-blue-50/80 via-white to-blue-50/50 border border-blue-200/80 rounded-2xl p-4 mb-6 flex items-start sm:items-center gap-3.5 text-xs text-blue-950 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-blue-900">Human-In-The-Loop (HITL) Adjudication Mandate: </span>
            <span className="text-blue-800">
              The TrustRAG agent extracts consistency checks and candidate entities; licensed reviewers verify patient safety and authorize claim approval or escalation.
            </span>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800">Loading adjudication queue...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-700 shadow-xs mb-6">
            <p className="text-xs font-semibold">{error}</p>
            <button
              onClick={fetchQueue}
              className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty Queue State */}
        {!isLoading && !error && queueCases.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-100">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Review Queue is Clear</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              No pending cases requiring review or dosage correction at this moment.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                onClick={handleCreatePendingCase}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
              >
                <Sparkles className="w-4 h-4" />
                <span>Stage Sample Discrepancy Case</span>
              </button>
              <Link
                to="/cases"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs"
              >
                <span>View All Cases</span>
              </Link>
            </div>
          </div>
        )}

        {/* Queue Cards */}
        {!isLoading && !error && queueCases.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {queueCases.map(c => {
              const caseId = c.id || c._id;
              const docCount = c.documentIds?.length || 0;
              const createdByName =
                typeof c.createdBy === 'object' && c.createdBy !== null
                  ? c.createdBy.name
                  : 'Patient';

              return (
                <div
                  key={caseId}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-blue-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                      <span className="font-mono font-bold text-base text-slate-900">
                        {c.caseReference}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                        c.status === 'NEEDS_CORRECTION'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {c.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Subject: {c.subjectReference}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-4 mt-2">
                      <span>Submitted by: <strong className="text-slate-800">{createdByName}</strong></span>
                      <span>Tri-Documents: <strong className="text-blue-700 font-bold">{docCount}/3</strong></span>
                      <span>Updated: {new Date(c.updatedAt || c.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      to={`/cases/${caseId}`}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <FileSearch className="w-3.5 h-3.5 text-slate-500" />
                      <span>Inspect Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <button
                      onClick={() => setSelectedCase(c)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Adjudicate</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Adjudication Modal */}
        {selectedCase && (
          <ReviewActionModal
            caseId={selectedCase.id || selectedCase._id}
            caseReference={selectedCase.caseReference}
            isOpen={Boolean(selectedCase)}
            onClose={() => setSelectedCase(null)}
            onSuccess={fetchQueue}
          />
        )}
      </main>
    </div>
  );
};
