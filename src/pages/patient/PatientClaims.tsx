import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '../../i18n';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ShieldCheck, FileText, Plus, RefreshCw, X, MessageSquare, Lock, CheckCircle2, Clock, AlertTriangle, ChevronRight, Building2
} from 'lucide-react';
import { claimsApi, Claim, CLAIM_STATUS_LABEL, CLAIM_STATUS_STYLE, formatInr, errorMessage } from '../../api/claimsApi';

const CONSENT_POINTS = [
  'Prescription, invoice and claim-form documents of this case',
  'Extracted medicine fields, consistency checks and risk signals',
  'Pharmacist review decisions on this case'
];

const PatientClaims: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);

  const [payers, setPayers] = useState<{ id: string; name: string }[]>([]);
  const [cases, setCases] = useState<{ id: string; caseReference: string }[]>([]);
  const [form, setForm] = useState({ caseId: '', payerOrganizationId: '', claimedAmount: '', policyNumber: '' });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDialog, confirm] = useConfirm();
  const t = useT();
  const [appealFor, setAppealFor] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState('');

  const selected = useMemo(() => claims.find((c) => c.id === selectedId) || null, [claims, selectedId]);

  const load = async () => {
    setLoading(true);
    try {
      setClaims(await claimsApi.myClaims());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openSubmit = async () => {
    setShowSubmit(true);
    try {
      const [p, c] = await Promise.all([claimsApi.payers(), claimsApi.eligibleCases()]);
      setPayers(p);
      setCases(c);
      setForm((f) => ({ ...f, caseId: c[0]?.id || '', payerOrganizationId: p[0]?.id || '' }));
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load insurers or verified cases.'));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) return toast.error(t('Please accept the data-sharing consent.'));
    setSubmitting(true);
    try {
      const created = await claimsApi.submit({
        caseId: form.caseId, payerOrganizationId: form.payerOrganizationId,
        claimedAmount: Number(form.claimedAmount), policyNumber: form.policyNumber.trim(), consent: { accepted: true }
      });
      toast.success(`Claim ${created.claimReference} submitted`);
      setShowSubmit(false);
      setConsent(false);
      setForm({ caseId: '', payerOrganizationId: '', claimedAmount: '', policyNumber: '' });
      setClaims((prev) => [created, ...prev]);
      setSelectedId(created.id);
    } catch (err) {
      toast.error(errorMessage(err, 'Claim could not be submitted.'));
    } finally {
      setSubmitting(false);
    }
  };

  const replace = (updated: Claim) => setClaims((prev) => prev.map((c) => (c.id === updated.id ? { ...updated, payerName: updated.payerName || c.payerName } : c)));

  const answer = async (claim: Claim, queryId: string) => {
    const text = (answers[queryId] || '').trim();
    if (text.length < 2) return toast.error('Write an answer first.');
    setBusy(true);
    try {
      replace(await claimsApi.answerQuery(claim.id, queryId, text));
      toast.success(t('Answer sent to the insurer'));
    } catch (err) {
      toast.error(errorMessage(err, 'Answer could not be sent.'));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (claim: Claim) => {
    if (!(await confirm({ title: t('Withdraw this claim?'), message: `Claim ${claim.claimReference} will be withdrawn and the insurer will lose access to your case. You can submit a new claim later.`, confirmLabel: t('Withdraw Claim') }))) return;
    setBusy(true);
    try {
      replace(await claimsApi.withdraw(claim.id));
      toast.success(t('Claim withdrawn and consent revoked'));
    } catch (err) {
      toast.error(errorMessage(err, 'Claim could not be withdrawn.'));
    } finally {
      setBusy(false);
    }
  };

  const appeal = async () => {
    if (!appealFor) return;
    setBusy(true);
    try {
      replace(await claimsApi.appeal(appealFor, appealReason.trim()));
      toast.success(t('Appeal sent. A different insurer reviewer will decide it.'));
      setAppealFor(null);
      setAppealReason('');
    } catch (err) {
      toast.error(errorMessage(err, 'Appeal could not be sent.'));
    } finally {
      setBusy(false);
    }
  };

  const openCount = claims.filter((c) => ['SUBMITTED', 'APPEALED', 'UNDER_PAYER_REVIEW', 'QUERY_RAISED'].includes(c.status)).length;
  const queryCount = claims.filter((c) => c.status === 'QUERY_RAISED').length;
  const decidedCount = claims.filter((c) => c.decision).length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {confirmDialog}
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase px-2.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-full">
              Consent-Based Claims
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{t('Insurance Claims')}</h1>
            <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
              Submit a pharmacist-verified case to an insurer. The insurer can see the case only after you give consent, and a person at the insurer makes every decision.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="px-3 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={openSubmit} className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs">
              <Plus className="w-4 h-4" /> New Claim
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-100">
          {[
            { label: t('Total Claims'), value: claims.length, icon: FileText, tone: 'text-teal-600' },
            { label: 'Open', value: openCount, icon: Clock, tone: 'text-blue-600' },
            { label: t('Needs Your Answer'), value: queryCount, icon: MessageSquare, tone: 'text-amber-600' },
            { label: 'Decided', value: decidedCount, icon: CheckCircle2, tone: 'text-emerald-600' }
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <Icon className={`w-4 h-4 ${tone}`} />
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono">{loading ? '…' : value}</div>
            </div>
          ))}
        </div>
      </div>

      {loadError && (
        <p role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          Claims could not be loaded. Check that the server is running and you are signed in as a patient.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">{t('My Claims')}</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
            {!loading && claims.length === 0 && (
              <div className="p-6 text-xs text-slate-500 space-y-2">
                <p>{t('No claims yet.')}</p>
                <p>First get a case verified by a pharmacist in <Link to="/patient/cases" className="text-teal-700 font-semibold">Verification Audits</Link>, then submit it here.</p>
              </div>
            )}
            {claims.map((claim) => (
              <button key={claim.id} onClick={() => setSelectedId(claim.id)} className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${selectedId === claim.id ? 'bg-teal-50/50 border-l-2 border-teal-600' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-semibold text-slate-800">{claim.claimReference}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CLAIM_STATUS_STYLE[claim.status]}`}>{t(CLAIM_STATUS_LABEL[claim.status])}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {claim.payerName || 'Insurer'}</span>
                  <span className="font-mono">{formatInr(claim.claimedAmount)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
          {!selected ? (
            <div className="p-10 text-center text-xs text-slate-500">
              <ShieldCheck className="w-8 h-8 mx-auto text-slate-300 mb-3" />
              Select a claim to see its status, insurer questions and decision.
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400 font-mono">{selected.claimReference}</p>
                  <h2 className="text-lg font-bold text-slate-900">{selected.payerName || 'Insurer'}</h2>
                  <p className="text-xs text-slate-500">Policy {selected.policyNumber} · Claimed {formatInr(selected.claimedAmount)}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${CLAIM_STATUS_STYLE[selected.status]}`}>{t(CLAIM_STATUS_LABEL[selected.status])}</span>
              </div>

              {selected.decision && (
                <div className={`rounded-xl border p-4 ${selected.decision.decision === 'REJECTED' ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <p className="text-xs font-bold text-slate-800 mb-1">Insurer decision · {t(CLAIM_STATUS_LABEL[selected.decision.decision])}</p>
                  <p className="text-xs text-slate-700">Approved amount: <span className="font-mono font-semibold">{formatInr(selected.decision.approvedAmount)}</span>{selected.decision.reasonCode ? ` · Reason: ${selected.decision.reasonCode.replace(/_/g, ' ').toLowerCase()}` : ''}</p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{selected.decision.note}</p>
                </div>
              )}
              {selected.appeal && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-xs space-y-1">
                  <p className="font-bold text-purple-900">You appealed on {new Date(selected.appeal.appealedAt).toLocaleDateString('en-IN')}</p>
                  <p className="text-slate-700">{selected.appeal.reason}</p>
                  {selected.appeal.previousDecision && (
                    <p className="text-slate-500">Original decision: {t(CLAIM_STATUS_LABEL[selected.appeal.previousDecision.decision])} · {formatInr(selected.appeal.previousDecision.approvedAmount)}</p>
                  )}
                </div>
              )}
              {selected.settlement && (
                <p className="text-xs rounded-lg bg-slate-50 border border-slate-200 p-3 text-slate-600">
                  Settlement reference {selected.settlement.reference}. This is a simulated settlement; no payment was made.
                </p>
              )}

              {/* Queries */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3">{t('Insurer Questions')}</h3>
                {selected.queries.length === 0 && <p className="text-xs text-slate-500">{t('No questions from the insurer.')}</p>}
                <div className="space-y-3">
                  {selected.queries.map((q) => (
                    <div key={q.id} className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold text-slate-800 flex items-start gap-2"><MessageSquare className="w-4 h-4 text-amber-600 flex-shrink-0" />{q.question}</p>
                      {q.answer ? (
                        <p className="text-xs text-slate-600 mt-2 pl-6">Your answer: {q.answer}</p>
                      ) : (
                        <div className="mt-3 pl-6 space-y-2">
                          <textarea
                            value={answers[q.id] || ''}
                            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                            rows={3}
                            maxLength={2000}
                            placeholder={t('Type your answer')}
                            className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-600"
                          />
                          <button disabled={busy} onClick={() => answer(selected, q.id)} className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold disabled:opacity-50">{t('Send Answer')}</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3">{t('Timeline')}</h3>
                <ol className="space-y-2">
                  {selected.history.map((h, i) => (
                    <li key={i} className="flex items-center gap-3 text-xs">
                      <span className="w-2 h-2 rounded-full bg-teal-600" />
                      <span className="font-semibold text-slate-700 w-44">{t(CLAIM_STATUS_LABEL[h.status])}</span>
                      <span className="text-slate-400">{new Date(h.at).toLocaleString('en-IN')}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
                <Link to={`/cases/${selected.caseId}`} className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1">
                  View verification case <ChevronRight className="w-3.5 h-3.5" />
                </Link>
                {['REJECTED', 'PARTIALLY_APPROVED'].includes(selected.status) && !selected.appeal && (
                  <button disabled={busy} onClick={() => setAppealFor(selected.id)} className="px-3 py-1.5 rounded-lg border border-purple-200 text-purple-800 hover:bg-purple-50 text-xs font-semibold disabled:opacity-50">
                    {t('Appeal Decision')}
                  </button>
                )}
                {['SUBMITTED', 'APPEALED', 'UNDER_PAYER_REVIEW', 'QUERY_RAISED'].includes(selected.status) && (
                  <button disabled={busy} onClick={() => withdraw(selected)} className="ml-auto px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold disabled:opacity-50">
                    Withdraw Claim & Revoke Consent
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Appeal modal */}
      {appealFor && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="appeal-title">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 id="appeal-title" className="text-base font-bold text-slate-900">{t('Appeal the insurer\'s decision')}</h3>
              <button onClick={() => setAppealFor(null)} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-slate-600">{t('You can appeal once. A different reviewer at the insurer will look at the claim again.')}</p>
            <label htmlFor="appeal-reason" className="block font-semibold text-slate-700">Why should the decision change? (20–2000 characters)</label>
            <textarea id="appeal-reason" rows={5} minLength={20} maxLength={2000} value={appealReason} onChange={(e) => setAppealReason(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-600" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setAppealFor(null)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium">{t('Cancel')}</button>
              <button disabled={busy || appealReason.trim().length < 20} onClick={appeal} className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold disabled:opacity-50">{t('Send Appeal')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Submit modal */}
      {showSubmit && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">{t('Submit Insurance Claim')}</h3>
              <button onClick={() => setShowSubmit(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-4 text-xs">
              {cases.length === 0 && (
                <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-900 flex gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> You have no pharmacist-verified case yet. Only verified cases can be claimed.
                </p>
              )}
              <div>
                <label htmlFor="claim-case" className="block font-semibold text-slate-700 mb-1">{t('Verified Case *')}</label>
                <select id="claim-case" required value={form.caseId} onChange={(e) => setForm({ ...form, caseId: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white">
                  {cases.map((c) => <option key={c.id} value={c.id}>{c.caseReference}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="claim-payer" className="block font-semibold text-slate-700 mb-1">{t('Insurer *')}</label>
                <select id="claim-payer" required value={form.payerOrganizationId} onChange={(e) => setForm({ ...form, payerOrganizationId: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white">
                  {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="claim-amount" className="block font-semibold text-slate-700 mb-1">{t('Claimed Amount (₹) *')}</label>
                  <input id="claim-amount" required type="number" min="0.01" step="0.01" value={form.claimedAmount} onChange={(e) => setForm({ ...form, claimedAmount: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono" />
                </div>
                <div>
                  <label htmlFor="claim-policy" className="block font-semibold text-slate-700 mb-1">{t('Policy Number *')}</label>
                  <input id="claim-policy" required pattern="[A-Za-z0-9-]{4,64}" value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} placeholder="SYN-POL-0001" className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono" />
                </div>
              </div>
              <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 space-y-2">
                <p className="font-bold text-slate-800 flex items-center gap-1.5"><Lock className="w-4 h-4 text-teal-700" /> Data-sharing consent</p>
                <p className="text-slate-600">{t('The selected insurer will be able to view, for 90 days and only for this claim:')}</p>
                <ul className="list-disc pl-5 text-slate-600 space-y-0.5">{CONSENT_POINTS.map((p) => <li key={p}>{t(p)}</li>)}</ul>
                <p className="text-slate-600">{t('You can withdraw the claim and revoke access before a decision is made.')}</p>
                <label className="flex items-start gap-2 pt-1 cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                  <span className="font-semibold text-slate-800">{t('I agree to share this case with the selected insurer.')}</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowSubmit(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium">{t('Cancel')}</button>
                <button type="submit" disabled={submitting || !consent || cases.length === 0} className="bg-teal-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {submitting ? 'Submitting…' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientClaims;
