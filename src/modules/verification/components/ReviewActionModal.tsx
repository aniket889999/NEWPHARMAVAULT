import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { verificationApi } from '../api/verificationApi';
import { integrationApi } from '../integration/api';
import { buildReviewRequest, canSubmitAction, safeApiMessage } from '../integration/snapshot';
import type { CaseReconciliationSnapshot, ReviewAction } from '../integration/types';

interface ReviewActionModalProps {
  caseId: string; caseReference: string; isOpen: boolean;
  onClose: () => void; onSuccess: () => void;
  /** undefined: queue loads a snapshot; null: parent snapshot unavailable, fail closed. */
  snapshot?: CaseReconciliationSnapshot | null;
  onRefresh?: () => void;
}
const options: { action: ReviewAction; label: string; reason: string; description: string }[] = [
  { action: 'VERIFY', label: 'Verify document consistency', reason: 'SOURCE_CONSISTENCY_CONFIRMED', description: 'Only when complete, confirmed and consistent. This does not approve a claim or treatment.' },
  { action: 'RETURN_FOR_CORRECTION', label: 'Return for correction', reason: 'SOURCE_CORRECTION_REQUIRED', description: 'Record what needs a staff correction or a clearer source document.' },
  { action: 'ESCALATE', label: 'Escalate for further review', reason: 'EXPERT_REVIEW_REQUIRED', description: 'Refer unresolved evidence to an authorised senior reviewer.' },
];
export function ReviewActionModal({ caseId, caseReference, isOpen, onClose, onSuccess, snapshot: suppliedSnapshot, onRefresh }: ReviewActionModalProps) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<CaseReconciliationSnapshot | null>(null);
  const [action, setAction] = useState<ReviewAction>('RETURN_FOR_CORRECTION');
  const [notes, setNotes] = useState('');
  const [inspected, setInspected] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invalidated, setInvalidated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const submitLock = useRef(false);

  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setSnapshot(null); setInspected(false); setConfirming(false); setError(null); setInvalidated(false);
    setAction('RETURN_FOR_CORRECTION'); setNotes(''); setLoading(false);
    if (!isOpen) return () => controller.abort();
    if (suppliedSnapshot !== undefined) {
      if (suppliedSnapshot?.caseId === caseId) setSnapshot(suppliedSnapshot);
      else setError('A current case snapshot is required. Refresh the case first.');
    } else {
      setLoading(true);
      integrationApi.getSnapshot(caseId, controller.signal).then(value => { if (current) setSnapshot(value); }).catch(() => { if (current) setError('The current review snapshot is unavailable. No decision can be submitted.'); }).finally(() => { if (current) setLoading(false); });
    }
    return () => { current = false; controller.abort(); };
  }, [isOpen, caseId, suppliedSnapshot, reload, user?._id, user?.role]);

  if (!isOpen) return null;
  const currentOption = options.find(option => option.action === action)!;
  const displayed = snapshot?.caseId === caseId && (suppliedSnapshot === undefined || suppliedSnapshot?.snapshotToken === snapshot.snapshotToken) ? snapshot : null;
  const eligible = !invalidated && canSubmitAction(displayed, user?.role, action);
  const payload = buildReviewRequest(displayed, user?.role, action, currentOption.reason, notes);
  const submit = async () => {
    if (!payload || !eligible || !inspected || !confirming || submitLock.current) return;
    submitLock.current = true; setSubmitting(true); setError(null);
    try {
      // Use the displayed snapshot, never a silently refreshed token before writing.
      await verificationApi.submitReview(caseId, payload);
      toast.success('Human review recorded.'); onSuccess(); onClose();
    } catch (cause: unknown) {
      setError(safeApiMessage(cause, 'The decision was not confirmed. Refresh and inspect the current case before retrying.'));
      setInvalidated(true); setInspected(false); setConfirming(false);
    } finally { submitLock.current = false; setSubmitting(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
    <section role="dialog" aria-modal="true" aria-labelledby="review-title" className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto p-6 space-y-4">
      <div className="flex justify-between gap-3"><div><h2 id="review-title" className="font-bold text-slate-900">Human-in-the-Loop Validation</h2><p className="text-xs text-slate-500">{caseReference} · {snapshot ? `evidence revision ${snapshot.evidenceRevision}` : 'Snapshot unavailable'}</p></div><button type="button" aria-label="Close review" onClick={onClose} disabled={submitting}><X className="w-5 h-5" /></button></div>
      <p className="rounded-lg bg-indigo-50 p-3 text-xs text-indigo-950">Inspect the original documents, extracted values and comparison evidence. AI supports review; the authorised human records the decision. Verification is not insurance or clinical approval.</p>
      {loading && <p role="status" className="text-sm">Loading current evidence requirements…</p>}
      {snapshot && !snapshot.reviewEligibility.canVerify && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900"><strong>Verify is blocked.</strong><ul className="list-disc pl-4 mt-1">{snapshot.reviewEligibility.blockerCodes.map(code => <li key={code}>{code.replace(/_/g, ' ').toLowerCase()}</li>)}</ul></div>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <button type="button" disabled={submitting || loading} className="text-xs text-indigo-700 underline" onClick={() => { if (onRefresh) onRefresh(); else setReload(value => value + 1); }}>Refresh evidence (resets confirmation)</button>
      <fieldset disabled={submitting || loading || invalidated} className="space-y-2">
        <legend className="text-xs font-semibold mb-2">Reviewer action</legend>
        {options.map(option => <button key={option.action} type="button" aria-pressed={action === option.action} disabled={!canSubmitAction(displayed, user?.role, option.action)} onClick={() => { setAction(option.action); setConfirming(false); }} className={`block text-left w-full border rounded-lg p-3 disabled:opacity-40 ${action === option.action ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}><span className="block text-sm font-semibold">{option.label}</span><span className="block text-xs text-slate-600 mt-1">{option.description}</span></button>)}
        <label className="block text-xs font-semibold pt-2">Accountable reviewer notes (10–2,000 characters)<textarea value={notes} minLength={10} maxLength={2000} onChange={event => { setNotes(event.target.value); setConfirming(false); }} className="block border rounded-lg p-2 w-full mt-1 font-normal" rows={3} /></label>
        <label className="flex gap-2 text-xs text-slate-700"><input type="checkbox" checked={inspected} onChange={event => { setInspected(event.target.checked); setConfirming(false); }} />I inspected the source documents and the evidence for this displayed snapshot.</label>
      </fieldset>
      {confirming && <p className="text-sm font-semibold text-slate-800">Record “{currentOption.label}” against this evidence revision?</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} disabled={submitting} className="border rounded-lg px-3 py-2 text-xs">Cancel</button><button type="button" disabled={!eligible || !payload || !inspected || submitting || loading} onClick={() => { if (confirming) void submit(); else setConfirming(true); }} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40">{submitting ? 'Recording…' : confirming ? 'Record human decision' : 'Review and confirm'}</button></div>
    </section>
  </div>;
}
