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
  Lock
} from 'lucide-react';

export const ReviewQueuePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [queueCases, setQueueCases] = useState<VerificationCase[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <VerificationNav />
        <div className="flex-1 max-w-xl mx-auto p-8 flex items-center justify-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Restricted Access</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              The Reviewer Queue is reserved for licensed pharmacists and claims reviewers. Patients can view their cases under My Cases.
            </p>
            <button
              onClick={() => navigate('/cases')}
              className="mt-6 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition-colors"
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
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Reviewer Adjudication Queue
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                {queueCases.length} Pending
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Cases in <strong className="text-slate-700">NEEDS_REVIEW</strong> or <strong className="text-slate-700">NEEDS_CORRECTION</strong> requiring human validation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchQueue}
              disabled={isLoading}
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
              title="Refresh queue"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mandatory Accountability Banner */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 flex items-start sm:items-center gap-3 text-xs text-indigo-950 font-medium">
          <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <span className="font-bold">Human-in-the-Loop Mandate: </span>
            <span>AI supports the review; the human reviewer makes the final accountable decision.</span>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Loading adjudication queue...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700 shadow-2xs mb-6">
            <p className="text-xs font-semibold">{error}</p>
            <button
              onClick={fetchQueue}
              className="mt-3 px-3 py-1 bg-red-600 text-white rounded-md text-xs font-semibold hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty Queue State */}
        {!isLoading && !error && queueCases.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Review Queue is Clear</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              There are no pending cases requiring review or correction at this time.
            </p>
            <Link
              to="/cases"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition-colors"
            >
              <span>View All Cases</span>
            </Link>
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
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:border-indigo-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-1">
                      <span className="font-mono font-bold text-base text-slate-900">
                        {c.caseReference}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                        c.status === 'NEEDS_CORRECTION'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                      }`}>
                        {c.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Subject: {c.subjectReference}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-4 mt-2">
                      <span>Submitted by: <strong className="text-slate-700">{createdByName}</strong></span>
                      <span>Tri-Documents: <strong className="text-slate-700">{docCount}/3</strong></span>
                      <span>Updated: {new Date(c.updatedAt || c.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      to={`/cases/${caseId}`}
                      className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <span>Inspect Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <button
                      onClick={() => setSelectedCase(c)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
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
