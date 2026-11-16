import { Link } from 'react-router-dom';
import { researchSnapshot as snapshot } from '../../data/researchSnapshot';

const labels: Record<string, string> = { LEXICAL_UNSCOPED: 'Unscoped lexical BM25', ITEM_SCOPED_NO_FRESHNESS: 'Item-scoped sources', ITEM_SCOPED_DEPENDENCY_FRESHNESS: 'Item-scoped + signed dependencies',
  NO_INVALIDATION: 'No invalidation', WHOLE_CASE_REVISION: 'Whole-case revision', SIGNED_DEPENDENCIES: 'Signed content dependencies' };
const count = (value: { numerator: number; denominator: number }) => value.numerator + '/' + value.denominator;

export default function ResearchDashboard() {
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'PharmaVault-synthetic-study-snapshot.json'; anchor.click(); URL.revokeObjectURL(url);
  };
  return <div className="mx-auto max-w-6xl space-y-6 p-8 text-slate-900">
    <Link to="/auth" className="text-sm text-teal-800 underline">Return to portal selection</Link>
    <header><p className="text-xs font-semibold uppercase text-teal-800">Recorded synthetic study · not live clinical analytics</p><h1 className="mt-2 text-3xl font-bold">TrustRAG Research Evidence</h1></header>
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">This snapshot reports {snapshot.dataset.scenarios} held-out structured scenarios across {snapshot.dataset.families} families. It does not measure clinical accuracy, clinician time savings or production readiness. Later citation-priority changes have not been evaluated as a new unseen study.</p>
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-lg font-semibold">Source retrieval: identical four-source budget</h2>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Variant</th><th className="p-3">Requested reference recall@4</th><th className="p-3">Wrong-source answers</th></tr></thead>
        <tbody>{Object.entries(snapshot.retrieval).map(([key, value]) => <tr key={key} className="border-b"><td className="p-3">{labels[key]}</td><td className="p-3">{count(value.requestedReferenceRecallAt4)}</td><td className="p-3">{count(value.wrongEntityOrSourceAnswers)}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-sm text-slate-600">Item scope reduced wrong-source attribution in this sample. Reference recall did not improve. These are not overall answer-accuracy percentages.</p>
    </section>
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-lg font-semibold">Answer freshness: same signed-answer cohort</h2>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Policy</th><th className="p-3">Cited corrections marked stale</th><th className="p-3">False fresh</th><th className="p-3">False stale after unrelated edit</th></tr></thead>
        <tbody>{Object.entries(snapshot.temporal).map(([key, value]) => <tr key={key} className="border-b"><td className="p-3">{labels[key]}</td><td className="p-3">{count(value.exactStaleDetection)}</td><td className="p-3">{count(value.falseFreshAfterDependentEdit)}</td><td className="p-3">{count(value.falseStaleAfterUnrelatedEdit)}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-sm text-slate-600">Content/version checking is not clinical correctness. Counterfactuals are authored, not patient observations.</p>
    </section>
    <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-600">
      <h2 className="text-base font-semibold text-slate-900">Recorded provenance</h2><p>Implementation: {snapshot.implementationCommit}</p><p>Pre-scoring freeze: {snapshot.freezeCommit}</p><p>Recorded run: {snapshot.generatedAt}</p><p className="break-all">Source: {snapshot.source}</p><p className="break-all">Snapshot SHA-256: {snapshot.sourceSha256}</p>
      <button type="button" onClick={download} className="mt-3 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white">Export recorded snapshot</button>
    </section>
    <Link to="/research/knowledge-graph" className="inline-block text-sm text-teal-800 underline">Open separate legacy graph demonstration</Link>
  </div>;
}
