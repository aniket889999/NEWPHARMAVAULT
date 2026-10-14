import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { verificationApi } from '../api/verificationApi';
import {
  VerificationCase,
  CaseResultsSummary,
  EvidenceItem,
  RiskSignal,
  ConsistencyCheck,
  ExtractedField,
  DocumentItem,
  AuditEventItem
} from '../types';
import { useAuth } from '../../../context/AuthContext';
import { VerificationNav } from '../components/VerificationNav';
import { LifecycleStepper } from '../components/LifecycleStepper';
import { EvidenceCard } from '../components/EvidenceCard';
import { RiskSignalCard } from '../components/RiskSignalCard';
import { ExtractedFieldsEditor } from '../components/ExtractedFieldsEditor';
import { AuditTrailView } from '../components/AuditTrailView';
import { ReviewActionModal } from '../components/ReviewActionModal';
import { DocumentEvidenceViewer } from '../components/DocumentEvidenceViewer';
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  Cpu,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Download,
  Eye,
  Archive,
  Sparkles,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

export const CaseDetailPage: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [vCase, setVCase] = useState<VerificationCase | null>(null);
  const [results, setResults] = useState<CaseResultsSummary | null>(null);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'viewer' | 'fields' | 'evidence' | 'checks' | 'audit'>('overview');
  const [viewerDocType, setViewerDocType] = useState<DocumentType>('PRESCRIPTION');
  const [viewerSelectedFieldId, setViewerSelectedFieldId] = useState<string | null>(null);

  // Adjudication Modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [fhirModalOpen, setFhirModalOpen] = useState<boolean>(false);
  const [fhirData, setFhirData] = useState<any>(null);

  const isStaff = user && ['pharmacist', 'pharmacy', 'claims_reviewer', 'org_admin', 'super_admin'].includes(user.role);

  const loadCaseData = async () => {
    if (!caseId) return;
    try {
      setIsLoading(true);
      setError(null);

      const caseData = await verificationApi.getCase(caseId);
      setVCase(caseData);

      // Fetch documents
      const docs = await verificationApi.getDocuments(caseId);
      setDocuments(docs);

      // Fetch results if past DRAFT / DOCUMENTS_PENDING or if processed
      try {
        const resData = await verificationApi.getResults(caseId);
        setResults(resData);
      } catch (e) {
        // Results may not be generated yet if in early stages
      }

      // Fetch evidence items
      try {
        const evData = await verificationApi.getEvidence(caseId);
        setEvidenceItems(evData);
      } catch (e) {}

      // Fetch audit events
      try {
        const auditData = await verificationApi.getAuditTrail(caseId);
        setAuditEvents(auditData);
      } catch (e) {}
    } catch (err: any) {
      console.error('Failed to load case data:', err);
      const msg = err.response?.data?.message || err.message || 'Error loading verification case';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCaseData();
  }, [caseId]);

  const handleProcessCase = async () => {
    if (!caseId) return;
    try {
      setIsProcessing(true);
      await verificationApi.processCase(caseId);
      toast.success('TrustRAG pipeline completed!');
      await loadCaseData();
    } catch (err: any) {
      console.error('Processing failed:', err);
      const msg = err.response?.data?.message || err.message || 'Processing failed';
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseCase = async () => {
    if (!caseId || !vCase) return;
    if (!['VERIFIED', 'REJECTED'].includes(vCase.status)) {
      toast.error('Case must be VERIFIED or REJECTED prior to closure.');
      return;
    }
    try {
      await verificationApi.updateCase(caseId, { status: 'CLOSED' });
      toast.success('Case closed and archived.');
      await loadCaseData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to close case');
    }
  };

  const handleExportFhir = async () => {
    if (!caseId) return;
    try {
      const data = await verificationApi.getFhirBundle(caseId);
      setFhirData(data);
      setFhirModalOpen(true);
    } catch (err: any) {
      toast.error('Failed to generate FHIR Bundle');
    }
  };

  const handleFieldCorrected = async () => {
    await loadCaseData();
  };

  const handleSelectEvidence = (evId: string) => {
    setSelectedEvidenceId(evId);
    setActiveTab('evidence');
    setTimeout(() => {
      const el = document.getElementById(`evidence-${evId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleInspectEvidenceDocument = (docType?: string, docId?: string) => {
    if (docType && ['PRESCRIPTION', 'PHARMACY_INVOICE', 'CLAIM_FORM'].includes(docType)) {
      setViewerDocType(docType as DocumentType);
    } else if (docId) {
      const matched = documents.find(d => (d.id || d._id) === docId);
      if (matched) setViewerDocType(matched.type);
    }
    setActiveTab('viewer');
  };

  const handleInspectSignalDocument = (evidenceId?: string) => {
    if (evidenceId) {
      const ev = evidenceItems.find(e => (e.id || e._id) === evidenceId);
      if (ev?.documentReference?.documentType) {
        setViewerDocType(ev.documentReference.documentType);
      } else if (ev?.documentReference?.documentId) {
        const matched = documents.find(d => (d.id || d._id) === ev.documentReference?.documentId);
        if (matched) setViewerDocType(matched.type);
      }
    }
    setActiveTab('viewer');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <VerificationNav />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Loading Case Verification...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !vCase) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <VerificationNav />
        <div className="flex-1 max-w-2xl mx-auto p-8 flex items-center">
          <div className="bg-white border border-red-200 rounded-xl p-8 text-center shadow-xs w-full">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-900">Unable to Access Case</h2>
            <p className="text-xs text-slate-500 mt-2">{error || 'Case not found or access denied.'}</p>
            <button
              onClick={() => navigate('/cases')}
              className="mt-6 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition-colors"
            >
              Back to Cases List
            </button>
          </div>
        </div>
      </div>
    );
  }

  const canReview = isStaff && ['NEEDS_REVIEW', 'NEEDS_CORRECTION'].includes(vCase.status);
  const canClose = ['VERIFIED', 'REJECTED'].includes(vCase.status);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <VerificationNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Link
            to="/cases"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Cases
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportFhir}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export FHIR R4</span>
            </button>

            {vCase.status === 'READY_FOR_PROCESSING' && (
              <button
                onClick={handleProcessCase}
                disabled={isProcessing}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Processing...' : 'Run Verification'}</span>
              </button>
            )}

            {canReview && (
              <button
                onClick={() => setIsReviewModalOpen(true)}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Adjudicate Case</span>
              </button>
            )}

            {canClose && (
              <button
                onClick={handleCloseCase}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Close Case</span>
              </button>
            )}
          </div>
        </div>

        {/* Header Block */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900 font-mono">
                  {vCase.caseReference}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                  vCase.status === 'VERIFIED'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : vCase.status === 'REJECTED'
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : vCase.status === 'NEEDS_REVIEW' || vCase.status === 'NEEDS_CORRECTION'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-blue-100 text-blue-800 border-blue-200'
                }`}>
                  {vCase.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-4">
                <span>Subject: <strong className="text-slate-700">{vCase.subjectReference}</strong></span>
                <span>Created: {new Date(vCase.createdAt).toLocaleString()}</span>
                <span>Ingested Documents: <strong className="text-slate-700">{documents.length}/3</strong></span>
              </div>
            </div>

            {vCase.reviewRequired && (
              <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Human review required before claim approval.</span>
              </div>
            )}
          </div>
        </div>

        {/* Visual Lifecycle Stepper */}
        <LifecycleStepper currentStatus={vCase.status} />

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 mb-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Explanation & Risks</span>
          </button>

          <button
            onClick={() => setActiveTab('viewer')}
            className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'viewer'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Document Evidence ({documents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('fields')}
            className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'fields'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Extracted Fields & HITL ({results?.extractedFields?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('checks')}
            className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'checks'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Consistency Checks ({results?.consistencyChecks?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('evidence')}
            className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'evidence'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Evidence Lineage ({evidenceItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Audit Trail ({auditEvents.length})</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW & EXPLANATION */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Structured Explanation Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Grounded TrustRAG Verification Explanation
                  </h3>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Source: {results?.explanation?.source || 'Deterministic TrustRAG Engine'}
                </div>
              </div>

              {results?.explanation ? (
                <div>
                  <p className="text-sm text-slate-800 leading-relaxed font-medium mb-4">
                    {results.explanation.summary}
                  </p>

                  {/* Grounded Findings */}
                  {results.explanation.findings && results.explanation.findings.length > 0 && (
                    <div className="mt-4 space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Evidence-Grounded Findings
                      </h4>
                      <div className="grid grid-cols-1 gap-2.5">
                        {results.explanation.findings.map((finding, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-xs text-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <span className="font-medium">{finding.claim}</span>
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-slate-400">Evidence:</span>
                              {finding.evidenceItemIds.map(evId => (
                                <button
                                  key={evId}
                                  onClick={() => handleSelectEvidence(evId)}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-200 transition-colors"
                                >
                                  #{String(evId).slice(-6)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.explanation.uncertainty && (
                    <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{results.explanation.uncertainty}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  Verification explanation not yet computed. Ingest all 3 documents and run verification.
                </div>
              )}
            </div>

            {/* Risk Signals Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Detected Risk Signals ({results?.activeSignals?.length || 0})</span>
                </h3>
              </div>

              {results?.activeSignals && results.activeSignals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {results.activeSignals.map((sig, idx) => (
                    <RiskSignalCard
                      key={sig.id || sig._id || idx}
                      signal={sig}
                      onSelectEvidence={handleSelectEvidence}
                      onViewSourceDocument={handleInspectSignalDocument}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-400">
                  No active risk signals detected.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: SECURE DOCUMENT EVIDENCE VIEWER */}
        {activeTab === 'viewer' && (
          <DocumentEvidenceViewer
            caseId={caseId!}
            documents={documents}
            extractedFields={results?.extractedFields || []}
            riskSignals={results?.activeSignals || []}
            consistencyChecks={results?.consistencyChecks || []}
            evidenceItems={evidenceItems}
            initialDocumentType={viewerDocType}
            selectedFieldId={viewerSelectedFieldId}
            onSelectField={setViewerSelectedFieldId}
          />
        )}

        {/* TAB 3: EXTRACTED FIELDS & HITL */}
        {activeTab === 'fields' && (
          <ExtractedFieldsEditor
            caseId={caseId!}
            fields={results?.extractedFields || []}
            documents={documents}
            onFieldCorrected={handleFieldCorrected}
            canEdit={isStaff || user?.role === 'patient'}
          />
        )}

        {/* TAB 3: CONSISTENCY CHECKS */}
        {activeTab === 'checks' && (
          <div className="space-y-3">
            {results?.consistencyChecks && results.consistencyChecks.length > 0 ? (
              results.consistencyChecks.map(check => (
                <div
                  key={check.id || check._id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-xs text-slate-900">
                          {check.checkType.replace(/_/g, ' ')}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          check.status === 'PASS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : check.status === 'FAIL'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {check.status}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Severity: {check.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium mt-1">
                        {check.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
                No consistency checks recorded yet.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: EVIDENCE LINEAGE */}
        {activeTab === 'evidence' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">
                Cited Multi-Tier Evidence Lineage
              </h3>
              <span className="text-xs text-slate-400">
                {evidenceItems.length} evidence items retrieved
              </span>
            </div>

            {evidenceItems.length > 0 ? (
              evidenceItems.map(ev => (
                <EvidenceCard
                  key={ev.id || ev._id}
                  evidence={ev}
                  isHighlighted={selectedEvidenceId === (ev.id || ev._id)}
                  onViewDocument={handleInspectEvidenceDocument}
                />
              ))
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
                No evidence items attached to this case.
              </div>
            )}
          </div>
        )}

        {/* TAB 5: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <AuditTrailView events={auditEvents} />
        )}

        {/* Adjudication Modal */}
        <ReviewActionModal
          caseId={caseId!}
          caseReference={vCase.caseReference}
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          onSuccess={loadCaseData}
        />

        {/* FHIR Bundle Modal Preview */}
        {fhirModalOpen && fhirData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">FHIR R4 Bundle Export</h3>
                  <p className="text-xs text-slate-400">Standardized interoperable health bundle</p>
                </div>
                <button
                  onClick={() => setFhirModalOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <pre className="mt-4 p-4 bg-slate-900 text-slate-200 rounded-lg text-[11px] font-mono overflow-auto flex-1">
                {JSON.stringify(fhirData, null, 2)}
              </pre>

              <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(fhirData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `fhir-bundle-${vCase.caseReference}.json`;
                    a.click();
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
                >
                  Download JSON Bundle
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
