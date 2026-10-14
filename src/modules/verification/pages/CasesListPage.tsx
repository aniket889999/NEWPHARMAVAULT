import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { VerificationCase } from '../types';
import { verificationApi } from '../api/verificationApi';
import { useAuth } from '../../../context/AuthContext';
import { VerificationNav } from '../components/VerificationNav';
import {
  ShieldCheck,
  PlusCircle,
  Filter,
  RefreshCw,
  AlertTriangle,
  FileText,
  Clock,
  ArrowRight,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertOctagon
} from 'lucide-react';

export const CasesListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [reviewRequiredOnly, setReviewRequiredOnly] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchCases = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await verificationApi.getCases();
      setCases(data);
    } catch (err: any) {
      console.error('Failed to fetch verification cases:', err);
      const msg = err.response?.data?.message || err.message || 'Error fetching verification cases';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  // Filter cases
  const filteredCases = cases.filter(c => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (reviewRequiredOnly && !c.reviewRequired) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchRef = c.caseReference.toLowerCase().includes(term);
      const matchSubject = c.subjectReference.toLowerCase().includes(term);
      const matchId = (c.id || c._id || '').toLowerCase().includes(term);
      if (!matchRef && !matchSubject && !matchId) return false;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'NEEDS_REVIEW':
      case 'NEEDS_CORRECTION':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'READY_FOR_PROCESSING':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PROCESSING':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200 animate-pulse';
      case 'DOCUMENTS_PENDING':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <VerificationNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header & Action */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Verification Cases
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {user?.role === 'patient'
                ? 'Your personal prescriptions and insurance claim verification records.'
                : `Tenant verification cases scoped for ${user?.role || 'staff'}.`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchCases}
              disabled={isLoading}
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
              title="Refresh case list"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              to="/cases/new"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Case</span>
            </Link>
          </div>
        </div>

        {/* Quick Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-semibold uppercase text-slate-400">Total Cases</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{cases.length}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-semibold uppercase text-blue-500">Ready to Process</span>
            <div className="text-2xl font-bold text-blue-700 mt-1">
              {cases.filter(c => c.status === 'READY_FOR_PROCESSING').length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-semibold uppercase text-amber-500">Requires Review</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">
              {cases.filter(c => c.reviewRequired || ['NEEDS_REVIEW', 'NEEDS_CORRECTION'].includes(c.status)).length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-semibold uppercase text-emerald-500">Verified</span>
            <div className="text-2xl font-bold text-emerald-700 mt-1">
              {cases.filter(c => c.status === 'VERIFIED').length}
            </div>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by case reference or subject ID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="DOCUMENTS_PENDING">Documents Pending</option>
                <option value="READY_FOR_PROCESSING">Ready for Processing</option>
                <option value="PROCESSING">Processing</option>
                <option value="NEEDS_REVIEW">Needs Review</option>
                <option value="NEEDS_CORRECTION">Needs Correction</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={reviewRequiredOnly}
                onChange={e => setReviewRequiredOnly(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Review Required Only</span>
            </label>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Loading verification cases...</p>
            <p className="text-xs text-slate-400 mt-1">Querying authenticated cases from backend</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700 shadow-2xs">
            <AlertOctagon className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <h3 className="font-bold text-sm">Failed to load verification cases</h3>
            <p className="text-xs mt-1 text-red-600">{error}</p>
            <button
              onClick={fetchCases}
              className="mt-4 px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredCases.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No verification cases found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {cases.length === 0
                ? 'No cases have been created yet. Start a new verification by uploading a prescription, invoice, and claim form.'
                : 'No cases match your active search and status filters.'}
            </p>
            {cases.length === 0 ? (
              <Link
                to="/cases/new"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create First Case</span>
              </Link>
            ) : (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setReviewRequiredOnly(false);
                  setSearchTerm('');
                }}
                className="mt-4 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Case List Table */}
        {!isLoading && !error && filteredCases.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-6 py-3.5">Case Reference</th>
                    <th className="px-6 py-3.5">Subject Reference</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Documents</th>
                    <th className="px-6 py-3.5">Review Required</th>
                    <th className="px-6 py-3.5">Created Date</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCases.map(c => {
                    const caseId = c.id || c._id;
                    const docCount = c.documentIds?.length || 0;
                    const isComplete = docCount >= 3;

                    return (
                      <tr
                        key={caseId}
                        onClick={() => navigate(`/cases/${caseId}`)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4 font-mono font-bold text-slate-900">
                          {c.caseReference}
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium">
                          {c.subjectReference}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border ${getStatusBadge(c.status)}`}>
                            {c.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-semibold ${isComplete ? 'text-emerald-700' : 'text-slate-600'}`}>
                              {docCount}/3
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              {isComplete ? '(Tri-Doc Complete)' : '(Pending)'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {c.reviewRequired ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <AlertTriangle className="w-3 h-3" /> Yes
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-[11px]">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center gap-1 text-indigo-600 group-hover:text-indigo-800 font-semibold">
                            View <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
