# Foundation V2 — Session 1 independent adapter review

**Historical initial review. Superseded on 12 November 2026:** the documented defects were corrected and the final independent suite passes 31/31. Current decision is scoped Foundation PASS; see `SESSION_1_ACCEPTED_CONTRACT.md`. The original findings below are retained for traceability.

Date: 9 November 2026. Owner: GPT. Decision: **CHANGES REQUIRED; combined Session 1 remains PARTIAL. Do not freeze the DTO or start Session 2 integration.**

The reported builder checks were reproduced. This does not close the independent acceptance gate. The new adapter is not wired into the running API/UI, so these findings are contract-readiness defects, not evidence of a deployed patient-data incident.

## Actual verification

| Check | Observed result |
|---|---|
| `node --test backend/tests/foundationMedicineItems.test.js` | 33/33 pass, exit 0 |
| `npm run validate:schemas` | 10 schemas compile, exit 0 |
| `node --test tests/foundation-v2/manifest.test.cjs` | 59/59 fixture-integrity/lock checks pass, exit 0 |
| `node --test tests/foundation-v2/adapter.acceptance.test.cjs` | 19/28 pass, nine fail, exit 1 |
| `node --check backend/services/trustRag/medicineItemContract.js` | Exit 0 |
| `node --check tests/foundation-v2/adapter.acceptance.test.cjs` | Exit 0 |

The independent adapter suite uses only development inputs and newly authored negative controls. No held-out adapter scores, live model calls, database writes or API authorisation claims are made. The 59 data checks are not product accuracy measurements.

The builder's 24 development fixture variants are its own adapter fixture set under `backend/tests/fixtures/`; they are not a scored run of GPT's separate frozen 24-development/16-held-out reconciliation matrix. Do not combine these different counts into one accuracy claim.

## 1. Field retention is insufficient for the approved product direction

Relevant implementation: `backend/services/trustRag/medicineItemContract.js:6`, `:1095`, `:1135`; schema field map at `contracts/schemas/medicine-item.schema.json:406`.

Only medicine name, strength, form and quantity are recognised as medicine slots. An explicitly grouped `release_type`, `quantity_unit`, `pack_size` or `pack_unit` is rejected as invalid membership. An ungrouped release field in explicit mode can be ignored, yielding an apparently clean item while important evidence disappears.

Reproductions: independent tests `F2 provenance: a separate release_type...`, `F4 provenance: explicit quantity_unit...`, and `F2 provenance: an ungrouped release...` all fail.

Required correction: preserve these four additional linked fields and references in the internal schema/adapter; refuse unclaimed medicine attributes instead of silently dropping them. Extend provenance only. Unit conversion and cross-document matching still belong to Session 2. This clarifies the minimum foundation needed by the accepted F2/F4 plan, not permission to build the whole matcher now.

## 2. Review flags can incorrectly clear uncertainty

Relevant implementation: `backend/services/trustRag/medicineItemContract.js:599`, `:1193`, `:1309`.

- An uncorrected strength with confidence 0.3 and `needsCorrection: false` returns `reviewRequired: false`. A Mongoose default false flag therefore overrides low confidence despite the report's stated unreviewed-low-confidence behaviour.
- A `correctedBy` ID without a correction timestamp can suppress the fallback low-confidence guard when the boolean is absent.
- A name-only item with unknown strength, form and quantity returns no review requirement.

Reproductions: independent tests A11b, A11d and A11e fail.

Required correction: define a conservative derived review flag. A true correction flag always requires review. An unreviewed low-confidence essential field needs review even if a stored/default boolean is false. Only a coherent correction marker pair can clear that low-confidence condition. Missing essential slots remain null but require clarification. Preserve useful unambiguous partial items; do not turn every missing optional field into a fatal grouping error.

The missing-essential-field rule is an explicit safety clarification before DTO freeze: an envelope that already exposes `reviewRequired` must not advertise missing required comparison evidence as cleared. It does not require implementing the final case-completeness engine in this session.

## 3. Combination-partner words are not evidence of a single product

Relevant implementation: `backend/services/trustRag/medicineItemContract.js:187`.

The flat text `Paracetamol 500mg and Ibuprofen 200mg` becomes `LEGACY_SINGLE_ITEM`. The detector exempts it because Ibuprofen appears in a combination-partner keyword list, and its fallback family list does not catch both names.

Reproduction: independent test A06b fails.

Required correction: do not establish a single fixed-dose product merely from a partner word. This text could describe a list or a combination and there is no grouping/product evidence to decide. Keep it unresolved or require explicit trustworthy identity/grouping evidence. This review makes no clinical claim about whether a combination product exists.

## 4. Schema accepts contradictory review flags

Relevant schema: envelope `allOf` conditions and `DocumentCoverage` definitions in `contracts/schemas/medicine-item.schema.json`.

The validator accepts both an UNRESOLVED envelope with `reviewRequired: false` and a noncomplete-coverage envelope with `reviewRequired: false`. Shape validation alone does not enforce the promised meaning of those states.

Reproductions: independent tests A16 and A16b fail.

Required correction: encode the representable implications in the schema: unresolved grouping, noncomplete coverage, and item correction requirements imply human review. Continue validating actual instances, including tampered invalid ones. Arithmetic equality between counts can remain a code-level invariant; do not claim vanilla schema validates all cross-field arithmetic.

## Behaviours that passed their independent controls

Minimal legacy representation; stable IDs under ordering/value correction; explicit three-group handling using the four current core slots; duplicate/competing field rejection; cross-case/document field rejection; over-limit refusal; preservation of null fields without inference; rejection of missing extraction confidence; complete correction metadata; unknown/contradictory/out-of-bounds coverage warnings; claim non-invention; storage-key omission; detached returned resolution arrays.

These are bounded test observations, not a comprehensive security certification.

## Ownership and next action

GPT added `tests/foundation-v2/adapter.acceptance.test.cjs`, this review and a correction prompt, and updated its checkpoint documentation. Gemini's five implementation files are unchanged by GPT. The frozen manifests/materialiser/schema and their dataset hashes are unchanged.

Next owner: Gemini for the Session 1 correction pass in the same five-file scope; then GPT repeats independent inspection. Do not edit GPT acceptance tests or gold labels to make the checks pass. A builder fixture expectation may be updated only when the documented review semantics genuinely changed, with that change explained in the report. Commit: none.
