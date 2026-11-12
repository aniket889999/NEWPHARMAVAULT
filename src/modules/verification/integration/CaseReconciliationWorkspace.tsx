import { MedicineComparisonPanel } from '../reconciliation/MedicineComparisonPanel';
import { GroupingEditor } from './GroupingEditor';
import { isCorrectionRole, isMutableCase } from './snapshot';
import type { CaseReconciliationSnapshot, ConfirmGroupsRequest, InspectEvidence } from './types';

interface Props {
  caseId: string; role?: string; snapshot: CaseReconciliationSnapshot | null;
  loading: boolean; busy: boolean; error: string | null;
  onRefresh: () => void; onOpenFields: () => void; onInspect: InspectEvidence;
  onConfirm: (documentId: string, payload: ConfirmGroupsRequest) => Promise<void>;
}
export function CaseReconciliationWorkspace({ caseId, role, snapshot, loading, busy, error, onRefresh, onOpenFields, onInspect, onConfirm }: Props) {
  return <div className="space-y-5">
    <section className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-2">
      <div className="flex justify-between gap-3"><h2 className="font-bold text-teal-950">Current medicine-document comparison</h2><button type="button" onClick={onRefresh} disabled={loading || busy} className="text-xs font-semibold underline disabled:opacity-40">Refresh snapshot</button></div>
      <p className="text-xs text-teal-900">One prescription + one invoice · up to three printed medicine rows per document. A consistent comparison is not clinical approval, fraud detection or insurance eligibility.</p>
      {snapshot && <p className="text-xs text-teal-800">Evidence revision {snapshot.evidenceRevision} · {snapshot.caseStatus.replace(/_/g, ' ')} · {snapshot.reviewEligibility.canVerify ? 'Eligible for accountable human verification' : 'Verification is blocked until the evidence requirements are met'}</p>}
    </section>
    {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error} Current comparison and evidence-changing actions are unavailable. Historical findings below must not be used as a fresh all-clear.</div>}
    {snapshot && <>
      {snapshot.reviewEligibility.blockerCodes.length > 0 && <section aria-label="Verification blockers" className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-950"><h3 className="font-semibold mb-2">What still needs attention</h3><ul className="list-disc pl-4 space-y-1">{snapshot.reviewEligibility.blockerCodes.map(code => <li key={code}>{code.replace(/_/g, ' ').toLowerCase()}</li>)}</ul></section>}
      {snapshot.notices.length > 0 && <ul aria-label="Source limitations" className="text-xs text-slate-700 space-y-1">{snapshot.notices.map((notice, index) => <li key={`${notice.code}-${notice.documentId}-${index}`}>{notice.message}</li>)}</ul>}
    </>}
    <MedicineComparisonPanel expectedCaseId={caseId} result={snapshot?.comparison ?? null} prescription={snapshot?.prescription ?? null} invoice={snapshot?.invoice ?? null} loading={loading} onInspectEvidence={onInspect} />
    {snapshot && <>
      <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-sm text-slate-900">Source completeness and grouping</h2><button type="button" onClick={onOpenFields} className="text-xs underline text-indigo-700">Inspect / correct extracted fields</button></div>
      <div className="grid lg:grid-cols-2 gap-4">{snapshot.groupingDocuments.map(doc => <GroupingEditor key={`${snapshot.snapshotToken}-${doc.documentId}`} document={doc} snapshotToken={snapshot.snapshotToken} canEdit={isCorrectionRole(role) && snapshot.permissions.canConfirmGroups && isMutableCase(snapshot.caseStatus)} busy={busy} onConfirm={onConfirm} onInspect={onInspect} />)}</div>
    </>}
  </div>;
}
