import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Hand, UserCheck, Undo2, RotateCcw, X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { reviewWorkflowApi, ReviewAssignment } from '../api/reviewWorkflowApi';

interface Props {
  caseId: string;
  caseStatus: string;
  onChanged: () => void | Promise<void>;
}

const QUEUE_STATUSES = ['NEEDS_REVIEW', 'NEEDS_CORRECTION'];
const ADMIN_ROLES = ['org_admin', 'super_admin'];

/**
 * Staff-only strip on the case page: who is reviewing this case (lease),
 * take / release / admin reassign, and the admin "Reopen case" action.
 */
export const ReviewWorkflowPanel: React.FC<Props> = ({ caseId, caseStatus, onChanged }) => {
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<ReviewAssignment['assignment']>(null);
  const [busy, setBusy] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [reason, setReason] = useState('');
  const isAdmin = Boolean(user && ADMIN_ROLES.includes(user.role));
  const inQueue = QUEUE_STATUSES.includes(caseStatus);

  const load = useCallback(async () => {
    if (!inQueue) { setAssignment(null); return; }
    try {
      setAssignment((await reviewWorkflowApi.getAssignment(caseId)).assignment);
    } catch {
      setAssignment(null);
    }
  }, [caseId, inQueue]);

  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await load();
      await onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Action failed.');
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!inQueue && !(isAdmin && ['VERIFIED', 'REJECTED'].includes(caseStatus))) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-2xs mb-6 flex flex-wrap items-center gap-3 text-xs">
      {inQueue && (
        <>
          <UserCheck className={`w-4 h-4 ${assignment ? (assignment.assignedToMe ? 'text-teal-600' : 'text-amber-600') : 'text-slate-400'}`} />
          <span className="text-slate-700">
            {assignment
              ? assignment.assignedToMe
                ? `Assigned to you until ${new Date(assignment.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : `In review by ${assignment.assigneeName || 'another reviewer'} until ${new Date(assignment.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Not assigned. Take the case before you start so nobody else decides it at the same time.'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {(!assignment || assignment.assignedToMe) && (
              <button disabled={busy} onClick={() => run(() => reviewWorkflowApi.take(caseId), assignment ? 'Assignment extended' : 'Case assigned to you')} className="px-3 py-1.5 rounded-lg border border-teal-300 text-teal-800 hover:bg-teal-50 font-semibold flex items-center gap-1 disabled:opacity-50">
                <Hand className="w-3.5 h-3.5" /> {assignment ? 'Extend' : 'Take case'}
              </button>
            )}
            {assignment && (assignment.assignedToMe || isAdmin) && (
              <button disabled={busy} onClick={() => run(() => reviewWorkflowApi.release(caseId), 'Case released')} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-1 disabled:opacity-50">
                <Undo2 className="w-3.5 h-3.5" /> Release
              </button>
            )}
            {assignment && !assignment.assignedToMe && isAdmin && (
              <button disabled={busy} onClick={() => run(() => reviewWorkflowApi.take(caseId, true), 'Case reassigned to you')} className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold disabled:opacity-50">
                Reassign to me
              </button>
            )}
          </div>
        </>
      )}

      {!inQueue && isAdmin && (
        <>
          <RotateCcw className="w-4 h-4 text-slate-500" />
          <span className="text-slate-700">Finished case. An organization admin can reopen it for a new review; earlier snapshots become invalid.</span>
          <button onClick={() => setShowReopen(true)} className="ml-auto px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Reopen case
          </button>
        </>
      )}

      {showReopen && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="reopen-title">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 id="reopen-title" className="text-base font-bold text-slate-900">Reopen case for review</h3>
              <button onClick={() => setShowReopen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <label htmlFor="reopen-reason" className="block font-semibold text-slate-700">Reason (stored in the audit trail)</label>
            <textarea id="reopen-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} minLength={10} maxLength={2000} className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-600" placeholder="What changed and why a new review is needed" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReopen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium">Cancel</button>
              <button
                disabled={busy || reason.trim().length < 10}
                onClick={() => run(async () => { await reviewWorkflowApi.reopen(caseId, reason.trim()); setShowReopen(false); setReason(''); }, 'Case reopened for review')}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold disabled:opacity-50"
              >
                Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewWorkflowPanel;
