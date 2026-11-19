# PharmaVault Academic Gold / Reference Standard v1

Prepared 18 November 2026 for the final-year major project. **The populated academic evaluation pack is complete; human review is pending.** It is not a clinically certified gold standard or an unseen, independent research test set. It does not train the LLM or add persistent chat memory.

## What is delivered

- **100 scenarios in 50 authored families**, two variants each. Related topics, phrasing variants and reused document facts are not 100 independent clinical observations.
- Expected action, contextual topic, supporting source/fact keys, exact synthetic field requirements, prohibited patterns, tool boundaries and correction/freshness outcomes.
- **12 frozen source-linked summaries and 12 reference facts**. Public medical facts were checked against the primary publisher pages on 2026-11-18. This is engineering source checking, not pharmacist approval. No full articles, commercial monographs, patient records or bulk datasets were downloaded.
- Human-readable answer key, editable reviewer sheet, manual grading rubric, offline scorer, scorer negative-control tests and an integrity freeze.
- The actual baseline results, including failures, with a finite remaining-work list.

| Category | Scenarios | Passing mechanical checks |
|---|---:|---:|
| Supported medicine/project answers | 24 | 18 |
| Conversation context | 16 | 14 |
| Safety/access/domain boundaries | 24 | 24 |
| Simulated web/gap/source-policy behaviour | 12 | 12 |
| Synthetic case answers | 16 | 16 |
| Source-bound answer freshness | 8 | 8 |
| **Total** | **100** | **92** |

**92/100 is an all-checks-per-item engineering replay result, not 92% medical accuracy.** All 50 families are exposed reference/development material; 44 families passed every variant. The 24 boundary and 12 tool cases do not establish universal safety or web reliability. Full semantic support, completeness and clinical judgements need the manual rubric.

## Files

| File | Purpose |
|---|---|
| `benchmark.json` | All 100 inputs and machine-checkable expectations; no expectations are copied from candidate outputs. |
| `ANSWER_KEY.md` | Item-by-item reference answers/behaviour, source-fact definitions and synthetic correction expectations. |
| `source-catalog.json` | Original short project summaries, source URLs, original versions, stable IDs, fact assertions and reuse notices. |
| `case-fixtures.json` | Two synthetic snapshots: Rx 500 mg / invoice 500 mg and Rx 500 mg / invoice 650 mg. Reused authored development fixtures, not measured OCR or unseen cases. |
| `freeze.json` | Hashes of reference inputs and 24 selected candidate files captured before scoring. This is not a hermetic freeze of every transitive dependency. |
| `RESULTS.json` | Current scorer 1.0.2 result, per-item checks/failures and exact evaluator hash. |
| `RESULTS.initial-harness.json` | Preserved first scorer result: 90/100. Two failures were Markdown-escape scoring errors, not missing review actions. |
| `RESULTS.scorer-1.0.1.json` | Preserved corrected 92/100 result before adding the non-empty-response guard. |
| `review-sheet.csv` | 100 rows for actual human review. Reviewer identities and grades are deliberately blank/PENDING. |
| `REVIEW_RUBRIC.md` | Mentor/peer source/document checking, grading criteria and medical-review limits. |
| `REMAINING_WORK.md` | Eight observed misses grouped into six fixes, plus the finite chatbot completion backlog. |

## Reproduce

From the repository root, after installing the existing locked dependencies:

```sh
npm run validate:chatbot:reference
npm run test:chatbot:reference
npm run evaluate:chatbot:reference
```

Validation checks the populated contract and selected-file/input freeze. The 15 scorer/contract tests include negative controls: unknown evidence, fabricated approvals, forged citations, empty responses, numeric regimens and input/hash tampering.

Update after the next application checkpoint: reference inputs remain frozen,
but the candidate has improved. The default validator now checks the reference
freeze and separately reports whether the baseline candidate is unchanged.
`node scripts/validate-chatbot-reference.cjs --strict-baseline` requires the
original candidate too. Use `npm run evaluate:chatbot:current` to compare a new
candidate against the unchanged exposed labels; actual candidate hashes and
changed files are recorded. Never overwrite the baseline `RESULTS.json` with
this newer run. No independent/clinical generalization claim follows from
fixing failures on an exposed reference set.

**The evaluator currently exits 1 because eight reference scenarios fail.** That is an honest quality gate, not a broken command. It does not write files. `node scripts/evaluate-chatbot-reference.cjs --json` prints the detailed report. No `.env` is loaded, no database is opened and HTTP/HTTPS/fetch are blocked. Web responses are simulated; public model generation and embeddings are forced off. The fixture receipt secret is synthetic and never used by a server.

Reported timings are warm offline function timings, not application/API/network/model latency. No paid model/provider acceptance, browser interaction, OCR accuracy, load test or real authentication/tenant test is measured by this pack.

## Freeze and fair iteration

Candidate inputs and expected labels were captured before the first score. The application was **not changed to tune this result**. The one scoring correction only normalized Markdown escapes; the non-empty-response guard strengthened a missing-response check. Expectations and frozen source/case data remained unchanged. Earlier outputs are preserved.

Do not alter v1 inputs, expected actions or stored results to make a candidate green. When fixing the application, retain this baseline and create a new candidate/versioned evaluation run with its actual source hashes. These 100 exposed scenarios may then be used as regression checks, never relabelled unseen heldout. A new independent evaluator must author additional hidden families for a paper-level generalization claim; group related medicine/SPL versions and scenario roots within one split.

The expected multi-detail behaviour is the **v1 project scope** (clarify which detail). If later product requirements add multi-section answers, version that policy; do not secretly change old expected outcomes. Family F17 is a conservative clarification-quality target: its current abstention is not evidence of harmful medical advice.

## Source use and academic scope

Publisher facts checked: [Paracetamol](https://www.nhs.uk/medicines/paracetamol-for-adults/), [Metformin](https://www.nhs.uk/medicines/metformin/), [Cetirizine](https://www.nhs.uk/medicines/cetirizine/about-cetirizine/), [Amoxicillin](https://www.nhs.uk/medicines/amoxicillin/about-amoxicillin/), [Antibiotics](https://www.nhs.uk/medicines/antibiotics/), [Antibiotic resistance](https://medlineplus.gov/antibioticresistance.html).

NHS-derived material is represented as short original summaries, not a full page mirror. Contains public sector information licensed under the Open Government Licence v3.0; see the [NHS terms and adaptation/refresh conditions](https://www.nhs.uk/our-policies/terms-and-conditions/). This adaptation is not NHS clinical approval or endorsement. Source: MedlinePlus, National Library of Medicine; only public health-topic-summary information is represented, not licensed drug monographs. See [MedlinePlus reuse boundaries](https://medlineplus.gov/about/using/usingcontent/).

The medical sources are UK/US references, not verification of Indian regulatory approval, brands or substitution. Historical project summary versions remain labelled as such even where current pages were checked. Supporting a narrow fact is not proof that a source is complete/current for every use. Academic document facts and system policies can be checked by a mentor/peer against the controlled originals. Medical interpretation should not be described as clinically validated without qualified review.
