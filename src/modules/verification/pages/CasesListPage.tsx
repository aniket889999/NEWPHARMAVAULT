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
  Sparkles,
  FileCheck2,
  AlertOctagon,
  FileSpreadsheet
} from 'lucide-react';
import toast from 'react-hot-toast';

export const CasesListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingDemo, setIsCreatingDemo] = useState<boolean>(false);

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

  const handleCreateDemoCase = async () => {
    try {
      setIsCreatingDemo(true);
      const created = await verificationApi.createCase(
        'PATIENT-DEMO-889',
        'Clinical trial tri-document claim: Augmentin 625 Duo oral antibiotic therapy verification.'
      );
      toast.success('Sample verification case initialized!');
      navigate(`/cases/${created.id || created._id}`);
    } catch (err: any) {
      toast.error('Failed to initialize sample case: ' + (err.message || 'Network error'));
    } finally {
      setIsCreatingDemo(false);
    }
  };

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
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'NEEDS_REVIEW':
      case 'NEEDS_CORRECTION':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'READY_FOR_PROCESSING':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'PROCESSING':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse';
      case 'DOCUMENTS_PENDING':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <VerificationNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Tri-Document Verification Cases
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                TrustRAG Engine
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Cross-document grounded validation between Doctor Prescriptions, Pharmacy Tax Invoices, and Insurance Claim Forms.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchCases}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-xs"
              title="Refresh case list"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleCreateDemoCase}
              disabled={isCreatingDemo}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>{isCreatingDemo ? 'Generating...' : '⚡ 1-Click Demo Case'}</span>
            </button>

            <Link
              to="/cases/new"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Case Wizard</span>
            </Link>
          </div>
        </div>

        {/* Quick Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Cases</span>
              <FileSpreadsheet className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{cases.length}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Tri-doc archives</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Ready to Process</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-700 mt-2">
              {cases.filter(c => c.status === 'READY_FOR_PROCESSING').length}
            </div>
            <p className="text-[11px] text-blue-500/80 mt-0.5">Docs staged</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Requires Review</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-700 mt-2">
              {cases.filter(c => c.reviewRequired || ['NEEDS_REVIEW', 'NEEDS_CORRECTION'].includes(c.status)).length}
            </div>
            <p className="text-[11px] text-amber-600/80 mt-0.5">HITL adjudication</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Verified</span>
              <FileCheck2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-2">
              {cases.filter(c => c.status === 'VERIFIED').length}
            </div>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Passed consistency checks</p>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by case reference or subject ID..."
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
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

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <input
                type="checkbox"
                checked={reviewRequiredOnly}
                onChange={e => setReviewRequiredOnly(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Review Required Only</span>
            </label>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800">Loading verification cases...</p>
            <p className="text-xs text-slate-400 mt-1">Connecting to TrustRAG verification ledger</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-700 shadow-xs">
            <AlertOctagon className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <h3 className="font-bold text-sm">Failed to load verification cases</h3>
            <p className="text-xs mt-1 text-rose-600">{error}</p>
            <button
              onClick={fetchCases}
              className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredCases.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No verification cases found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              {cases.length === 0
                ? 'Create a new verification case or generate a pre-loaded sample clinical trial case to explore the OCR inspection workbench.'
                : 'No cases match your active filters. Try adjusting the filter criteria.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleCreateDemoCase}
                disabled={isCreatingDemo}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isCreatingDemo ? 'Creating...' : '⚡ Generate Pre-Loaded Demo Case'}</span>
              </button>
              <Link
                to="/cases/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Custom Upload Wizard</span>
              </Link>
            </div>
          </div>
        )}

        {/* Case List Table */}
        {!isLoading && !error && filteredCases.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-6 py-4">Case Reference</th>
                    <th className="px-6 py-4">Subject Reference</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Documents</th>
                    <th className="px-6 py-4">Review Required</th>
                    <th className="px-6 py-4">Created Date</th>
                    <th className="px-6 py-4 text-right">Action</th>
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
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4 font-mono font-bold text-slate-900 group-hover:text-blue-700">
                          {c.caseReference}
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium">
                          {c.subjectReference}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase border ${getStatusBadge(c.status)}`}>
                            {c.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold ${isComplete ? 'text-emerald-700' : 'text-slate-600'}`}>
                              {docCount}/3
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              {isComplete ? '(Tri-Doc Complete)' : '(Pending)'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {c.reviewRequired ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
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
                          <span className="inline-flex items-center gap-1 text-blue-600 group-hover:text-blue-800 font-bold">
                            Inspect <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
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
