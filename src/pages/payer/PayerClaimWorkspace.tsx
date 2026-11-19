import React, { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChevronLeft, FileText, AlertTriangle, CheckCircle2, ShieldCheck, MessageSquare, Download, Play, Lock, Eye, X, Gavel
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { claimsApi, PayerClaimDetail, CLAIM_STATUS_LABEL, CLAIM_STATUS_STYLE, formatInr, errorMessage } from '../../api/claimsApi';

const severityStyle = (s: string) =>
  /high|critical/i.test(s) ? 'bg-rose-50 text-rose-700 border-rose-200' : /medium|warn/i.test(s) ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200';
const pretty = (v?: string | null) => (v || '').replace(/_/g, ' ').toLowerCase();

const PayerClaimWorkspace: React.FC = () => {
  const { claimId = '' } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<PayerClaimDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDialog, confirm] = useConfirm();
  const [question, setQuestion] = useState('');
  const [decision, setDecision] = useState<'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED'>('APPROVED');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<{ url: string; type: string; title: string } | null>(null);

  const load = async () => {
    try {
      setData(await claimsApi.payerClaim(claimId));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'This claim could not be opened.'));
    }
  };

  useEffect(() => { void load(); }, [claimId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const claim = data?.claim;
  const docName = useMemo(() => new Map((data?.documents || []).map((d) => [d.id, pretty(d.type)])), [data]);
  const unresolved = (data?.consistencyChecks || []).filter((c) => !/pass|match|ok/i.test(c.status)).length + (data?.riskSignals || []).filter((r) => r.reviewRequired).length;

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Action failed.'));
    } finally {
      setBusy(false);
    }
  };

  const openDocument = async (docId: string, mimeType: string, title: string) => {
    try {
      const blob = await claimsApi.payerDocumentBlob(claimId, docId);
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview({ url: URL.createObjectURL(blob), type: mimeType, title });
    } catch (err) {
      toast.error(errorMessage(err, 'Document could not be opened.'));
    }
  };

  const downloadFhir = async () => {
    try {
      const res = await claimsApi.fhirBundle(claimId);
      const blob = new Blob([JSON.stringify(res.bundle, null, 2)], { type: 'application/fhir+json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fhir-claim-${claim?.claimReference}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      if (res.validation.valid) toast.success('FHIR bundle passed structural validation');
      else toast.error(`FHIR bundle has ${res.validation.issues.filter((i) => i.severity === 'error').length} validation errors`);
    } catch (err) {
      toast.error(errorMessage(err, 'FHIR export failed.'));
    }
  };

  const submitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claim) return;
    const body: { decision: string; approvedAmount?: number; reasonCode?: string; note: string } = { decision, note: note.trim() };
    if (decision === 'PARTIALLY_APPROVED') body.approvedAmount = Number(approvedAmount);
    if (decision !== 'APPROVED') body.reasonCode = reasonCode;
    if (!(await confirm({ title: `Record "${CLAIM_STATUS_LABEL[decision]}"?`, message: `This decision for ${claim.claimReference} is final and the claimant is notified. It cannot be undone (the claimant may appeal once).`, confirmLabel: 'Record Decision', tone: decision === 'REJECTED' ? 'danger' : 'primary' }))) return;
    void run(() => claimsApi.decide(claimId, body), 'Decision recorded');
  };

  if (error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Link to="/payer/claims" className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center mb-4"><ChevronLeft className="w-4 h-4" /> Back to queue</Link>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-sm text-amber-900 flex gap-2"><Lock className="w-5 h-5 flex-shrink-0" />{error}</div>
      </div>
    );
  }
  if (!data || !claim) return <div className="p-8 text-center text-xs text-slate-400">Loading claim…</div>;

  const reasonOptions = decision === 'REJECTED' ? data.reasonCodes.rejected : data.reasonCodes.partial;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {confirmDialog}
      <Link to="/payer/claims" className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center"><ChevronLeft className="w-4 h-4" /> Back to queue</Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-mono text-slate-400">{claim.claimReference} · Case {data.case?.caseReference}</p>
            <h1 className="text-2xl font-bold text-slate-900">{formatInr(claim.claimedAmount)} pharmacy claim</h1>
            <p className="text-xs text-slate-500">From {data.pharmacyName} · Policy {claim.policyNumber} · Pharmacist case status: <span className="font-semibold">{pretty(data.case?.status)}</span></p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${CLAIM_STATUS_STYLE[claim.status]}`}>{CLAIM_STATUS_LABEL[claim.status]}</span>
            <div className="flex gap-2">
              {(claim.status === 'SUBMITTED' || claim.status === 'APPEALED') && (
                <button disabled={busy} onClick={() => run(() => claimsApi.startReview(claimId), 'Review started')} className="px-3 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
                  <Play className="w-3.5 h-3.5" /> Start Review
                </button>
              )}
              {user?.role === 'payer_admin' && ['APPROVED', 'PARTIALLY_APPROVED'].includes(claim.status) && (
                <button disabled={busy} onClick={() => run(() => claimsApi.settle(claimId), 'Marked settled (simulated)')} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold disabled:opacity-50">Mark Settled (demo)</button>
              )}
              <button onClick={downloadFhir} className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50">
                <Download className="w-3.5 h-3.5" /> FHIR Bundle
              </button>
            </div>
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px]">
          <p className="flex items-center gap-1.5 text-slate-500"><Lock className="w-3.5 h-3.5 text-indigo-600" /> Consent valid until {new Date(data.consent.expiresAt).toLocaleDateString('en-IN')}</p>
          {data.amountCheck && (
            <p data-testid="amount-check" className={`flex items-center gap-1.5 ${data.amountCheck.status === 'EXCEEDS_INVOICE' ? 'text-red-700' : data.amountCheck.status === 'WITHIN_INVOICE' ? 'text-emerald-700' : 'text-slate-500'}`}>
              {data.amountCheck.status === 'EXCEEDS_INVOICE' ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {data.amountCheck.invoiceTotal === null
                ? 'No invoice total recorded for this case'
                : data.amountCheck.status === 'EXCEEDS_INVOICE'
                  ? `Claimed amount is more than the verified bill (${formatInr(data.amountCheck.invoiceTotal)})`
                  : `Within the verified bill of ${formatInr(data.amountCheck.invoiceTotal)}`}
            </p>
          )}
          <p className={`flex items-center gap-1.5 ${unresolved ? 'text-amber-700' : 'text-emerald-700'}`}>
            {unresolved ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {unresolved ? `${unresolved} checks or signals need attention` : 'No open consistency issues recorded'}
          </p>
          <p className="flex items-center gap-1.5 text-slate-500"><ShieldCheck className="w-3.5 h-3.5" /> Signals guide review; they are not proof of fraud.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evidence column */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="p-4 border-b border-slate-200 text-sm font-bold text-slate-900">Documents</h2>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {data.documents.length === 0 && <p className="text-xs text-slate-500">No documents shared.</p>}
              {data.documents.map((d) => (
                <button key={d.id} onClick={() => openDocument(d.id, d.mimeType, pretty(d.type))} className="text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
                  <FileText className="w-5 h-5 text-indigo-600 mb-2" />
                  <p className="text-xs font-semibold text-slate-800 capitalize">{pretty(d.type)}</p>
                  <p className="text-[10px] text-slate-500">{d.mimeType}{d.pageCount ? ` · ${d.pageCount} page(s)` : ''}{d.omittedPageCount ? ` · ${d.omittedPageCount} not processed` : ''}</p>
                  <span className="text-[10px] font-semibold text-indigo-700 inline-flex items-center gap-1 mt-1"><Eye className="w-3 h-3" /> View</span>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="p-4 border-b border-slate-200 text-sm font-bold text-slate-900">Consistency Checks & Risk Signals</h2>
            <div className="divide-y divide-slate-100">
              {data.consistencyChecks.length + data.riskSignals.length === 0 && <p className="p-4 text-xs text-slate-500">None recorded.</p>}
              {data.consistencyChecks.map((c) => (
                <div key={c.id} className="p-4 flex items-start gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${severityStyle(c.severity)}`}>{pretty(c.severity) || 'info'}</span>
                  <div><p className="text-xs font-semibold text-slate-800 capitalize">{pretty(c.checkType)} · {pretty(c.status)}</p><p className="text-xs text-slate-500 mt-0.5">{c.message}</p></div>
                </div>
              ))}
              {data.riskSignals.map((r) => (
                <div key={r.id} className="p-4 flex items-start gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${severityStyle(r.severity)}`}>{pretty(r.severity)}</span>
                  <div><p className="text-xs font-semibold text-slate-800 capitalize">{pretty(r.signalType)}</p><p className="text-xs text-slate-500 mt-0.5">{r.description}</p></div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <h2 className="p-4 border-b border-slate-200 text-sm font-bold text-slate-900">Extracted Fields</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Document</th><th className="py-2.5 px-4">Field</th><th className="py-2.5 px-4">Value</th><th className="py-2.5 px-4">Page</th><th className="py-2.5 px-4">OCR Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.extractedFields.map((f) => (
                    <tr key={f.id}>
                      <td className="py-2.5 px-4 capitalize text-slate-600">{docName.get(f.documentId) || '—'}</td>
                      <td className="py-2.5 px-4 capitalize font-semibold text-slate-800">{pretty(f.fieldType)}</td>
                      <td className="py-2.5 px-4 font-mono">{f.normalizedValue || f.rawValue || '—'}</td>
                      <td className="py-2.5 px-4">{f.pageNumber ?? '—'}</td>
                      <td className={`py-2.5 px-4 font-mono ${f.needsCorrection ? 'text-amber-700' : 'text-slate-600'}`}>{typeof f.extractionConfidence === 'number' ? `${Math.round(f.extractionConfidence * 100)}%` : '—'}</td>
                    </tr>
                  ))}
                  {data.extractedFields.length === 0 && <tr><td colSpan={5} className="py-4 px-4 text-slate-500">No extracted fields shared.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="p-4 border-b border-slate-200 text-sm font-bold text-slate-900">Pharmacist Review Decisions</h2>
            <div className="divide-y divide-slate-100">
              {data.reviewDecisions.length === 0 && <p className="p-4 text-xs text-slate-500">No pharmacist decision recorded.</p>}
              {data.reviewDecisions.map((r) => (
                <div key={r.id} className="p-4 text-xs">
                  <p className="font-semibold text-slate-800 capitalize">{pretty(r.decision)} <span className="text-slate-400 font-normal">· {new Date(r.createdAt).toLocaleString('en-IN')}</span></p>
                  {r.notes && <p className="text-slate-500 mt-1">{r.notes}</p>}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Action column */}
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5"><MessageSquare className="w-4 h-4 text-amber-600" /> Queries to Claimant</h2>
            <div className="space-y-3">
              {claim.queries.length === 0 && <p className="text-xs text-slate-500">No queries raised.</p>}
              {claim.queries.map((q) => (
                <div key={q.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                  <p className="font-semibold text-slate-800">{q.question}</p>
                  <p className={`mt-1 ${q.answer ? 'text-slate-600' : 'text-amber-700'}`}>{q.answer ? `Answer: ${q.answer}` : 'Waiting for the claimant.'}</p>
                </div>
              ))}
            </div>
            {claim.status === 'UNDER_PAYER_REVIEW' && (
              <div className="mt-4 space-y-2">
                <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} maxLength={2000} placeholder="Ask for a clarification or a document" className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-600" />
                <button disabled={busy || question.trim().length < 5} onClick={() => run(async () => { await claimsApi.raiseQuery(claimId, question.trim()); setQuestion(''); }, 'Query sent to claimant')} className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50">Raise Query</button>
              </div>
            )}
          </section>

          {claim.appeal && (
            <section className="bg-purple-50 rounded-2xl border border-purple-200 p-5 text-xs space-y-1.5">
              <h2 className="text-sm font-bold text-purple-900">Appeal from the claimant</h2>
              <p className="text-slate-700">{claim.appeal.reason}</p>
              {claim.appeal.previousDecision && (
                <p className="text-slate-500">
                  Appealed decision: {CLAIM_STATUS_LABEL[claim.appeal.previousDecision.decision]} · {formatInr(claim.appeal.previousDecision.approvedAmount)}
                  {claim.appeal.previousDecision.reasonCode ? ` · ${pretty(claim.appeal.previousDecision.reasonCode)}` : ''}
                </p>
              )}
              <p className="text-purple-800 font-semibold">A different reviewer from the one who made the original decision must decide this appeal.</p>
            </section>
          )}

          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5"><Gavel className="w-4 h-4 text-indigo-600" /> Claim Decision</h2>
            {claim.decision ? (
              <div className="text-xs space-y-1">
                <p className="font-semibold text-slate-800">{CLAIM_STATUS_LABEL[claim.decision.decision]} · {formatInr(claim.decision.approvedAmount)}</p>
                {claim.decision.reasonCode && <p className="text-slate-500 capitalize">Reason: {pretty(claim.decision.reasonCode)}</p>}
                <p className="text-slate-600">{claim.decision.note}</p>
                <p className="text-slate-400">{new Date(claim.decision.decidedAt).toLocaleString('en-IN')}</p>
              </div>
            ) : claim.status !== 'UNDER_PAYER_REVIEW' ? (
              <p className="text-xs text-slate-500">{claim.status === 'SUBMITTED' || claim.status === 'APPEALED' ? 'Start the review to record a decision.' : claim.status === 'QUERY_RAISED' ? 'Waiting for the claimant to answer your query.' : 'No decision can be recorded in this state.'}</p>
            ) : (
              <form onSubmit={submitDecision} className="space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-1.5">
                  {(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'] as const).map((d) => (
                    <button type="button" key={d} onClick={() => { setDecision(d); setReasonCode(''); }} className={`py-2 rounded-lg border text-[11px] font-semibold ${decision === d ? 'bg-indigo-700 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-200'}`}>
                      {d === 'APPROVED' ? 'Approve' : d === 'PARTIALLY_APPROVED' ? 'Partial' : 'Reject'}
                    </button>
                  ))}
                </div>
                {decision === 'PARTIALLY_APPROVED' && (
                  <div>
                    <label htmlFor="decision-amount" className="block font-semibold text-slate-700 mb-1">Approved amount (₹, less than {formatInr(claim.claimedAmount)})</label>
                    <input id="decision-amount" required type="number" min="0.01" step="0.01" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono" />
                  </div>
                )}
                {decision !== 'APPROVED' && (
                  <div>
                    <label htmlFor="decision-reason" className="block font-semibold text-slate-700 mb-1">Reason code</label>
                    <select id="decision-reason" required value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white capitalize">
                      <option value="">Select a reason</option>
                      {reasonOptions.map((r) => <option key={r} value={r}>{pretty(r)}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor="decision-note" className="block font-semibold text-slate-700 mb-1">Decision note (shared with claimant)</label>
                  <textarea id="decision-note" required minLength={10} maxLength={2000} rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain the decision with reference to the evidence" className="w-full border border-slate-300 rounded-lg p-2.5" />
                </div>
                <button type="submit" disabled={busy} className="w-full py-2.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-semibold disabled:opacity-50">Record Decision</button>
                <p className="text-[10px] text-slate-400">Your name, time and reason are stored in the audit trail.</p>
              </form>
            )}
          </section>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 capitalize">{preview.title}</h3>
              <button onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center">
              {preview.type.startsWith('image/')
                ? <img src={preview.url} alt={preview.title} className="max-w-full max-h-full object-contain" />
                : <iframe title={preview.title} src={preview.url} className="w-full h-full" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayerClaimWorkspace;
