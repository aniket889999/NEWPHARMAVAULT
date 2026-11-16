# Session 5 preregistration — six-hour synthetic feasibility track
Prepared 16 November 2026, before held-out scoring. No result is asserted here.

## Boundaries
Evaluate private structured evidence locally. Do not mix public Gemini language generation, OCR layout accuracy, clinical judgments, authorization tests or screenshots into a matching/RAG percentage. The pre-existing 40-scenario Foundation matrix and hashes remain frozen: six development families (24 variants), four held-out families (16 variants). All variants of a family stay together. Builders must not inspect held-out labels.

The six-hour scope changes the earlier hybrid/vector comparison to a controlled private retrieval/freshness ablation:
A. lexical BM25 source selection without item or freshness safeguards;
B. item-scoped source selection without freshness safeguards;
C. item-scoped selection plus the actual signed dependency-receipt checks.
Use the same source corpus, query, source-count limit, deterministic quoted-source renderer and access policy. These are experimental offline baselines, not relaxed production routes or competitor implementations. Public hybrid/vector RAG remains a separate unscored feature.

## Freeze before scoring
Record code hashes for the candidate, baseline runner/renderer and frozen dataset. Derive requested source-field IDs and expected outcomes from authored fixture metadata, not the candidate's own output. Freeze any additional temporal counterfactual specification and gold before running it. Do not tune the candidate on the held-out results; record failures and defer a new version/evaluation.

### Runner specification, added before any scoring on 16 November 2026
The primary retrieval comparison uses exactly the first four selected sources per variant and the same quoted-source renderer. Native answer prose is not scored. Item scope is the authored first prescription anchor; its expected invoice counterpart comes from frozen fixture gold, not matcher output. All 24 development / 16 held-out scenarios are retained, including zero-source outcomes. Coverage here is the fraction producing any source, not clinically answerable-case calibration.

Development-only amendment before implementation freeze: use the fixed query template “Compare the recorded dosage strength for {authored medicine name} in this prescription and invoice.” The initial plural “strengths” query produced zero lexical reference recall because the existing BM25 tokenizer does not stem that word. The singular field phrase avoids reporting an artificially weak lexical baseline caused by that avoidable query mismatch. Record both the development discovery and the final fixed template; held-out data is still unopened.

The temporal experiment is a separate same-answer control: reuse the identical candidate-supported, signed answer under (1) no invalidation, (2) whole-case revision invalidation, and (3) actual signed-dependency validation. Only answers with a receipt and the primary requested strength field actually cited enter this cohort; report its denominator. The dependent counterfactual changes that field's normalized strength to 999 mg, updates synthetic correction metadata and recomputes the frozen comparison. The unrelated administrative counterfactual changes revision/token while leaving the medicine projection identical. The latter represents a filtered non-medicine edit, not an OCR or real reviewer study. A real HTTP edit is tested separately.

This bounded runner scores those two temporal probes only. Deletion, regrouping, reprocessing, authorization and forged receipts are independently tested engineering controls, not additional held-out metric observations. Cold/warm API latency, semantic answer support, clinician confidence, unsupported-question calibration and clinical correctness remain unmeasured. Process-local durations are descriptive only.

## Measurements
Report numerators/denominators separately for:
- exact requested source/medicine attribution (not citation existence alone);
- retrieval reference recall@4;
- sourced-answer coverage on answerable inputs and safe abstention/clarification on unsupported inputs;
- stale detection after a cited-field correction, deletion, grouping change or reprocessing;
- false invalidation after unrelated corrections;
- measured local runtime, with environment/cache and fixture-only limitations stated.
If a metric is not implementable in time, mark it unmeasured rather than substituting a test-pass percentage.

Gold-supported, contradicted, wrong-entity and insufficient-evidence outcomes are distinct. Real medicine-strength discrepancies must remain discrepancies. An evidence-unchanged result is not a medically correct answer or an approved claim.

## Interpretation
Sixteen held-out synthetic scenarios are a small engineering feasibility sample, not clinical generalization or evidence of commercial superiority. The proposed contribution is correction-aware medicine/source dependency handling and a reproducible longitudinal test—not the first chatbot, first RAG system or a defensible “50% novelty” claim. Do not promise paper acceptance or clinician time savings without a separate study.
