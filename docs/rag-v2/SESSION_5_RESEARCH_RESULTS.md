# Session 5 — Synthetic research feasibility results
Date: 16 November 2026. Status: completed for the preregistered bounded track, not clinical validation.

## Research question
Can medicine-bound retrieval and source-content dependencies reduce wrong-medicine/source use and distinguish invalidating corrections from unrelated edits?

The candidate contribution is the combination of explicit medicine-item scope, exact field/page citations, signed content-dependency receipts, and append-only historical answers. It is not a claim to have invented RAG or established market novelty. A literature review and external validation remain necessary before paper submission.

## Reproducibility and separation
- Candidate implementation: commit 566db2349a8f96879f2ec6ac4ba71af1edb2b131.
- Implementation/protocol/data fingerprint freeze: commit f02bda41d7e557267365bacff16a3f5f9639d297.
- Freeze was committed before the first held-out scoring run. No candidate, runner, gold or protocol changes were made after opening held-out results.
- Provenance detail: the development run preceded removal of one extra blank line at the route file's EOF. Its recorded hash differs only for that non-semantic formatting change; all other development hashes and every held-out hash match the freeze. Both runs' actual hashes are retained rather than overwritten.
- Frozen Foundation matrix: 24 development scenarios in six families; 16 held-out scenarios in four different families. Family variants are not independent clinical samples.
- Same corpus/query, first-four-source budget and deterministic quoted-source renderer for retrieval variants. Native answer prose, semantic clinical support and public Gemini generation are not scored.
- Temporal controls reuse the identical actual candidate-supported cited answer: no invalidation, whole-case revision invalidation, or actual signed dependency checking.
- Structured inputs and item associations are synthetic authored fixtures, not measured OCR output or clinician annotations.
- Instrumented fetch/HTTP/HTTPS attempts during both offline runs: 0.
- Machine-readable aggregates and exact code fingerprints: results/SESSION_5_SYNTHETIC_SUMMARY.json. Full generated per-scenario artifacts remain under ignored reports/checkpoints/ and can be reproduced.

## Held-out retrieval results
All three variants produced some source content on 16/16 scenarios; this is source coverage, not a correctness or safe-abstention score.

| Variant | Requested strength-field recall@4 | Answers with a wrong-medicine/source selection |
|---|---:|---:|
| Unscoped lexical BM25 | 16/30 (53.3%) | 9/16 |
| Item-scoped, no freshness | 16/30 (53.3%) | 0/16 |
| Item-scoped, signed dependencies | 16/30 (53.3%) | 0/16 |

Interpretation: item scope improved source attribution on this small test, but did NOT improve held-out reference recall. Freshness adds a temporal control; it does not improve static retrieval simply by being enabled. The candidate's fixed source ordering often puts prescription name/strength/form/quantity before the invoice strength, so the four-source budget can miss the second requested reference. Do not label this as overall answer accuracy or hide the equal recall.

Development final-query results: lexical recall 36/44 versus item-scoped 24/44; wrong-source answers 11/24 versus 0/24. This exposes a recall/attribution trade-off. The development-only plural-token query issue and amendment are recorded in EVALUATION_PROTOCOL.md; the stronger singular-field lexical query was frozen before held-out evaluation.

## Held-out temporal controls
The cohort contains 16 real signed candidate answers, each citing the primary requested strength field. Each received one cited-field correction probe and one unrelated administrative-revision probe.

| Invalidation policy | Cited corrections marked STALE | False FRESH after cited correction | False STALE after unrelated edit |
|---|---:|---:|---:|
| None | 0/16 | 16/16 | 0/16 |
| Whole-case revision | 16/16 | 0/16 | 16/16 |
| Signed content dependencies | 16/16 | 0/16 | 0/16 |

This demonstrates the intended mechanism under the authored counterfactuals. It is not evidence that every future correction, layout, language or medical assertion will be handled correctly. Deletion, regrouping, reprocessing, receipt forgery, authorization and clinical refusals are separate engineering test controls, not additional held-out observations in this table.

## Development discoveries, retained transparently
The first development evaluation stopped rather than accepting an answer with an uncited unit-only source. The backend was corrected and independently regression-tested before the final freeze. The initial plural query also exposed a BM25 tokenization weakness; the final field-aligned query avoids overstating gain against that avoidably weak baseline. Held-out results were not used for tuning.

## What is not measured
No clinical correctness, diagnosis, treatment, claim eligibility, semantic answer-faithfulness rating, clinician time/confidence, real patient outcomes, handwritten/multilingual OCR accuracy, commercial competitor benchmark, or production security certification. Source coverage does not measure appropriate abstention on a separate unsupported-question set. Warm process-local durations are in the JSON record but are not API latency, cold-start or cost claims. With only four held-out families, no statistical significance or broad generalization is claimed.

## Defensible paper direction and next experiment
Working title: “Correction-Aware Medicine Evidence Retrieval with Source-Bound Answer Freshness.”
A submission can describe the architecture, threat model, medicine/item citation contract, correction counterfactuals, controls, reproducibility freeze and these limited results. Claim a prototype feasibility study, not clinical impact or first-in-market novelty.

For a new version: prioritize requested attributes across both documents within the same citation budget; add unsupported-question calibration, actual layout/OCR perturbations, dependency deletion/regrouping probes in a newly frozen evaluation set, and an independently annotated reviewer study with consent. Keep the present held-out set as an exposed regression set, not a fresh unseen test for tuning.

## Reproduce
Install locked root/backend dependencies. The offline evaluator does not connect to MongoDB or use real credentials.

```sh
node --test tests/rag-v2/evaluation-support.test.cjs tests/rag-v2/evaluation-runner.test.cjs
node tests/rag-v2/run-evaluation.cjs --split=development
node tests/rag-v2/run-evaluation.cjs --split=heldout --accept-frozen-heldout
```

The held-out command checks the exact accepted fingerprint map before loading labels. Reproduction of already published data is not a new unseen experiment.
