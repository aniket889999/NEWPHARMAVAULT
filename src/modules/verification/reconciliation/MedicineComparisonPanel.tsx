import { createComparisonView, effectiveFieldText, evidenceKey } from './comparisonViewModel';
import { REASON_LABELS, SLOT_LABELS, type ComparisonStatus, type EvidenceReference, type MedicineItem, type MedicineSlot } from './types';

interface MedicineComparisonPanelProps {
  expectedCaseId: string;
  result: unknown;
  prescription: unknown;
  invoice: unknown;
  loading?: boolean;
  syntheticPreview?: boolean;
  onInspectEvidence?: (reference: EvidenceReference) => void;
}

const statusLabels: Record<ComparisonStatus, string> = {
  CONSISTENT: 'Checked fields agree', MISMATCH: 'Difference found', INSUFFICIENT_EVIDENCE: 'More evidence needed',
};
const statusColors: Record<ComparisonStatus, string> = {
  CONSISTENT: 'border-teal-200 bg-teal-50 text-teal-900',
  MISMATCH: 'border-rose-200 bg-rose-50 text-rose-900',
  INSUFFICIENT_EVIDENCE: 'border-amber-200 bg-amber-50 text-amber-950',
};
const displaySlots: MedicineSlot[] = ['medicine_name', 'dosage_strength', 'dosage_form', 'release_type', 'quantity', 'quantity_unit', 'pack_size', 'pack_unit'];
const checkLabels = { identity: 'Identity', strength: 'Strength', form: 'Form', release: 'Release type', quantity: 'Quantity' };

function MedicineValues({ item }: { item: MedicineItem | null }) {
  if (!item) return <p className="text-sm text-slate-500">No paired item. See the review reason.</p>;
  return <dl className="space-y-2">
    {displaySlots.map(slot => {
      const linked = item.fields[slot];
      if (!linked && ['release_type', 'pack_size', 'pack_unit'].includes(slot)) return null;
      return <div key={slot} className="grid grid-cols-[6rem_1fr] gap-2 text-sm">
        <dt className="text-slate-500">{SLOT_LABELS[slot]}</dt>
        <dd className="min-w-0 break-words font-medium text-slate-900">
          {effectiveFieldText(linked)}
          {linked && linked.normalizedValue.trim() && linked.normalizedValue !== linked.rawValue && <span className="mt-0.5 block text-xs font-normal text-slate-500">OCR: {linked.rawValue}</span>}
          {linked?.needsCorrection && <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-950">Needs correction</span>}
        </dd>
      </div>;
    })}
  </dl>;
}

export function MedicineComparisonPanel({ expectedCaseId, result, prescription, invoice, loading = false, syntheticPreview = false, onInspectEvidence }: MedicineComparisonPanelProps) {
  const view = loading ? null : createComparisonView({ expectedCaseId, result, prescription, invoice });
  return <section aria-label="Medicine document comparison" aria-busy={loading} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="border-b border-slate-200 bg-slate-50 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">PharmaVault · document evidence</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-950">Prescription and invoice comparison</h2>
      <p className="mt-1 text-sm text-slate-600">Compare documented items. An authorised human makes the final review decision.</p>
      {syntheticPreview && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm font-semibold text-amber-950">SYNTHETIC PREVIEW — not connected to the case API</p>}
    </header>
    {loading && <div role="status" className="p-6 text-sm text-slate-600">Loading current comparison…</div>}
    {view && view.state !== 'ready' && <div role={view.state === 'invalid' ? 'alert' : 'status'} className="p-6 text-sm text-slate-700">{view.message}</div>}
    {view?.state === 'ready' && <div className="space-y-5 p-5">
      <div className={`rounded-xl border p-4 ${statusColors[view.result.status]}`}>
        <h3 className="font-semibold">{statusLabels[view.result.status]}</h3>
        <p className="mt-1 text-sm">{view.result.summary.consistent} consistent · {view.result.summary.mismatch} differences · {view.result.summary.insufficientEvidence} need evidence</p>
        {view.result.hasInsufficientEvidence && <p className="mt-2 font-semibold">Evidence is incomplete or uncertain. Any confirmed differences remain visible below.</p>}
        <p className="mt-2 text-xs">Prescription coverage: {view.result.coverage.prescription.toLowerCase()} · Invoice coverage: {view.result.coverage.invoice.toLowerCase()}</p>
      </div>
      {view.result.reasonCodes.length > 0 && <ul aria-label="Review reasons" className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        {view.result.reasonCodes.map(code => <li key={code}>{REASON_LABELS[code]}</li>)}
      </ul>}
      {view.rows.map((row, index) => <article key={row.comparison.rowId} aria-label={`Medicine comparison ${index + 1}`} className="overflow-hidden rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="font-semibold text-slate-900">{row.comparison.genericName || 'Identity needs confirmation'}</h3>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusColors[row.comparison.status]}`}>{statusLabels[row.comparison.status]}</span>
        </div>
        <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="p-4"><h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Prescription</h4><MedicineValues item={row.prescription} /></div>
          <div className="p-4"><h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Pharmacy invoice</h4><MedicineValues item={row.invoice} /></div>
        </div>
        {row.comparison.quantity.baseUnit && <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Server quantity comparison: {row.comparison.quantity.prescriptionBaseQuantity ?? 'Unknown'} {row.comparison.quantity.baseUnit} ↔ {row.comparison.quantity.invoiceBaseQuantity ?? 'Unknown'} {row.comparison.quantity.baseUnit}
          <span className="ml-2 text-xs text-slate-500">Explicit units and pack data only.</span>
        </div>}
        {row.comparison.reasonCodes.length > 0 && <ul className="space-y-1 border-t border-slate-100 px-4 py-3 text-sm text-slate-700">{row.comparison.reasonCodes.map(code => <li key={code}>{REASON_LABELS[code]}</li>)}</ul>}
        <details className="border-t border-slate-100 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-teal-800">Evidence and comparison checks</summary>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">{Object.entries(row.comparison.checks).map(([key, value]) => <div key={key} className="flex gap-2"><dt className="font-semibold text-slate-600">{checkLabels[key as keyof typeof checkLabels]}:</dt><dd className="text-slate-700">{value === 'NOT_APPLICABLE' ? 'Not applicable' : statusLabels[value]}</dd></div>)}</dl>
          <ul aria-label={`Evidence for medicine comparison ${index + 1}`} className="mt-3 flex flex-wrap gap-2">
            {row.evidence.map(({ reference, side, slot }) => <li key={evidenceKey(reference)}>
              {onInspectEvidence ? <button type="button" onClick={() => onInspectEvidence({ ...reference })} className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-900 hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">{side} · {SLOT_LABELS[slot]} · p. {reference.pageNumber}</button>
                : <span className="inline-block rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600">{side} · {SLOT_LABELS[slot]} · p. {reference.pageNumber}</span>}
            </li>)}
          </ul>
        </details>
      </article>)}
      <p className="border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">This is a document comparison, not medical advice, medicine substitution, fraud detection or insurance approval. Missing information is never assumed to match. Human review remains required for the final decision.</p>
    </div>}
  </section>;
}
