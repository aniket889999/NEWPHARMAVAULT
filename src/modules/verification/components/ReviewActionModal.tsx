import React, { useState } from 'react';
import { PublicReviewAction } from '../types';
import { verificationApi } from '../api/verificationApi';
import {
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ReviewActionModalProps {
  caseId: string;
  caseReference: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewActionModal: React.FC<ReviewActionModalProps> = ({
  caseId,
  caseReference,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [action, setAction] = useState<PublicReviewAction>('VERIFY');
  const [reasonCode, setReasonCode] = useState<string>('CROSS_DOCUMENT_CONSISTENT');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);

  if (!isOpen) return null;

  const actionOptions: Array<{
    value: PublicReviewAction;
    title: string;
    description: string;
    badge: string;
    icon: React.ElementType;
    reasons: Array<{ code: string; label: string }>;
  }> = [
    {
      value: 'VERIFY',
      title: 'Verify Case',
      description: 'Confirm cross-document consistency across prescription, invoice, and claim form.',
      badge: 'border-emerald-500 bg-emerald-50 text-emerald-900',
      icon: ShieldCheck,
      reasons: [
        { code: 'CROSS_DOCUMENT_CONSISTENT', label: 'Cross-document consistency confirmed' },
        { code: 'IDENTITY_VERIFIED', label: 'Medicine identity and strength resolved accurately' },
        { code: 'RISKS_MITIGATED', label: 'All flagged risk signals satisfactorily reviewed' }
      ]
    },
    {
      value: 'RETURN_FOR_CORRECTION',
      title: 'Return for Correction',
      description: 'Return case for patient/billing field correction due to extraction or billing mismatches.',
      badge: 'border-amber-500 bg-amber-50 text-amber-900',
      icon: AlertTriangle,
      reasons: [
        { code: 'QUANTITY_MISMATCH', label: 'Invoice quantity exceeds prescription' },
        { code: 'DATE_OUT_OF_SEQUENCE', label: 'Invoice date precedes prescription issuance' },
        { code: 'LOW_CONFIDENCE_FIELD', label: 'Extracted fields require user clarification' }
      ]
    },
    {
      value: 'ESCALATE',
      title: 'Escalate to Senior Adjudicator',
      description: 'Escalate complex discrepancies, suspect documentation, or unresolvable clinical conflicts.',
      badge: 'border-purple-500 bg-purple-50 text-purple-900',
      icon: ArrowUpRight,
      reasons: [
        { code: 'SUSPECTED_ALTERATION', label: 'Potential document discrepancy or high risk signal' },
        { code: 'CLINICAL_CONFLICT', label: 'Drug substitution ambiguity requires senior review' },
        { code: 'EXCEEDS_THRESHOLD', label: 'Claim value or risk score exceeds standard threshold' }
      ]
    }
  ];

  const currentOption = actionOptions.find(opt => opt.value === action) || actionOptions[0];

  const handleActionChange = (newAction: PublicReviewAction) => {
    setAction(newAction);
    const target = actionOptions.find(opt => opt.value === newAction);
    if (target && target.reasons[0]) {
      setReasonCode(target.reasons[0].code);
    }
  };

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error('Reviewer notes/comment are required to record an accountable decision.');
      return;
    }

    try {
      setIsSubmitting(true);
      await verificationApi.submitReview(caseId, {
        action,
        reasonCode,
        notes: notes.trim()
      });
      toast.success(`Case adjudication recorded: ${action}`);
      setShowConfirmation(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Submit review error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to submit review decision';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Human-in-the-Loop Adjudication
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Case Ref: {caseReference}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Accountability Banner */}
        <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2.5 text-xs text-indigo-900 font-semibold">
          <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>AI supports the review; the human reviewer makes the final accountable decision.</span>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Action Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Select Public Review Action
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {actionOptions.map(opt => {
                const Icon = opt.icon;
                const isSelected = action === opt.value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleActionChange(opt.value)}
                    className={`cursor-pointer rounded-xl p-3 border-2 transition-all flex flex-col justify-between ${
                      isSelected
                        ? opt.badge
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Icon className="w-4 h-4" />
                        {isSelected && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                      <div className="font-bold text-xs">{opt.title}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2 italic font-medium">
              {currentOption.description}
            </p>
          </div>

          {/* Reason Code */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Reason Code <span className="text-red-500">*</span>
            </label>
            <select
              value={reasonCode}
              onChange={e => setReasonCode(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              {currentOption.reasons.map(r => (
                <option key={r.code} value={r.code}>
                  {r.label} ({r.code})
                </option>
              ))}
            </select>
          </div>

          {/* Reviewer Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Reviewer Adjudication Notes & Rationale <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Provide a clear, accountable explanation for this review decision..."
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!notes.trim()) {
                toast.error('Please enter notes/comment before proceeding.');
                return;
              }
              setShowConfirmation(true);
            }}
            className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
          >
            Review & Confirm Action
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h4 className="text-base font-bold text-slate-900 mb-2">
              Confirm Adjudication Decision
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Are you sure you want to record the action <strong className="text-indigo-600 uppercase font-mono">{action}</strong> for case <span className="font-mono">{caseReference}</span>?
              This will update the case lifecycle and append an immutable audit record.
            </p>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs mb-4 space-y-1">
              <div><strong className="text-slate-700">Action:</strong> {action}</div>
              <div><strong className="text-slate-700">Reason:</strong> {reasonCode}</div>
              <div><strong className="text-slate-700">Notes:</strong> {notes}</div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Go Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Recording...' : 'Confirm and Submit Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
