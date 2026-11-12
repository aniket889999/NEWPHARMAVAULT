import { useState } from 'react';
import { SLOT_LABELS } from '../reconciliation/types';
import { buildGroupingRequest, candidateNeedsCorrection, createGroupingDraft } from './snapshot';
import type { ConfirmGroupsRequest, GroupingDocument, InspectEvidence } from './types';

interface Props {
  document: GroupingDocument; snapshotToken: string; canEdit: boolean; busy: boolean;
  onConfirm: (documentId: string, payload: ConfirmGroupsRequest) => Promise<void>;
  onInspect: InspectEvidence;
}

/** The parent keys this editor by snapshot token: no attestation survives a source change. */
export function GroupingEditor({ document: doc, snapshotToken, canEdit, busy, onConfirm, onInspect }: Props) {
  const [draft, setDraft] = useState(() => createGroupingDraft(doc));
  const [error, setError] = useState<string | null>(null);
  const anchors = doc.fields.filter(field => field.fieldType === 'medicine_name');
  const submit = async () => {
    const built = buildGroupingRequest(doc, draft, snapshotToken);
    if (!canEdit || busy || !built.payload) { setError(built.error || 'This document is read-only.'); return; }
    setError(null);
    try { await onConfirm(doc.documentId, built.payload); }
    catch { setError('Grouping was not saved. Refresh the case and inspect the current evidence.'); }
  };
  const label = doc.documentType === 'PRESCRIPTION' ? 'Prescription' : 'Invoice';
  return <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3" aria-label={`${label} medicine grouping`}>
    <div className="flex flex-wrap justify-between gap-2">
      <h3 className="font-semibold text-slate-900">{label} · medicine rows</h3>
      <span className={`text-xs rounded-full px-2 py-1 ${doc.mode === 'HUMAN_CONFIRMED' ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-900'}`}>{doc.mode.replace(/_/g, ' ')}</span>
    </div>
    <p className="text-xs text-slate-600">Inspect every source row. Grouping confirms which extracted fields belong together; it does not correct values or approve a claim.</p>
    {!doc.fields.length && <p className="text-sm text-amber-900">No usable medicine fields. Reprocess a supported, clearer source; missing rows cannot be created here.</p>}
    <div className="overflow-x-auto"><table className="w-full text-xs text-left">
      <caption className="sr-only">Extracted source fields and medicine-row assignments</caption>
      <thead><tr className="text-slate-500 border-b"><th className="p-2">Source field</th><th className="p-2">Value / uncertainty</th><th className="p-2">Medicine row</th></tr></thead>
      <tbody>{doc.fields.map(field => <tr key={field.id} className="border-b border-slate-100">
        <td className="p-2"><button type="button" onClick={() => onInspect({ documentId: doc.documentId, fieldId: field.id, pageNumber: field.pageNumber })} className="text-indigo-700 underline text-left">{SLOT_LABELS[field.fieldType]} · p{field.pageNumber}</button></td>
        <td className="p-2 break-words max-w-xs"><span>{field.normalizedValue || field.rawValue || 'Not extracted'}</span><span className="block text-slate-500">OCR confidence: {field.extractionConfidence === null ? 'unknown' : `${Math.round(field.extractionConfidence * 100)}%`}</span>{candidateNeedsCorrection(field) && <span className="block text-amber-800">Correction required</span>}</td>
        <td className="p-2"><select aria-label={`${label} ${SLOT_LABELS[field.fieldType]} row ${field.id}`} value={draft.assignments[field.id] || ''} disabled={!canEdit || busy || field.fieldType === 'medicine_name'} onChange={event => setDraft(previous => ({ ...previous, completenessAttested: false, assignments: { ...previous.assignments, [field.id]: event.target.value } }))} className="max-w-48 border rounded p-1 disabled:bg-slate-50">
          <option value="">Assign a source row</option>{anchors.map((anchor, index) => <option value={anchor.id} key={anchor.id}>{index + 1}. {anchor.normalizedValue || anchor.rawValue}</option>)}
        </select></td>
      </tr>)}</tbody>
    </table></div>
    {canEdit ? <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
      <label className="text-xs block">Number of medicine rows visible in the original document <input aria-label={`${label} visible medicine count`} type="number" min={1} max={3} value={draft.observedItemCount} onChange={event => setDraft(previous => ({ ...previous, observedItemCount: Number(event.target.value), completenessAttested: false }))} className="border rounded p-1 ml-2 w-16" /></label>
      <label className="flex gap-2 items-start text-xs text-slate-700"><input type="checkbox" checked={draft.completenessAttested} onChange={event => setDraft(previous => ({ ...previous, completenessAttested: event.target.checked }))} />I inspected the original document, counted every visible medicine row and checked that all are represented above. I am not inferring missing fields.</label>
      <button type="button" onClick={submit} disabled={busy || !anchors.length || anchors.length > 3} className="rounded-lg bg-slate-900 text-white px-3 py-2 text-xs font-semibold disabled:opacity-40">Confirm source grouping</button>
    </fieldset> : <p className="text-xs text-slate-500">Read-only. An authorised staff member must confirm source completeness.</p>}
    {error && <p role="alert" className="text-xs text-red-800">{error}</p>}
  </section>;
}
