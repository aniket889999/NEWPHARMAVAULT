# Copy into Gemini — Session 2 uncertain-identity correction only

Historical correction prompt: completed and independently accepted on 12 November 2026. Do not rerun it as a new work order. Current checkpoint: `SESSION_2_ACCEPTED_CONTRACT.md`.

Project: `/Users/aniket/Downloads/PBL 5 TH SEM`.

Your original results reproduce: builder 8+32 tests, original GPT backend 52/52, consumer 39/39, Foundation 35+31+59 and schemas 11/11 all pass. GPT added three independent checks: the real engine/UI bridge passes for 24 development cases, but two uncertain-name cases fail. Expanded backend acceptance is **53/55**, not yet PASS.

Read `docs/reconciliation-v2/SESSION_2_INDEPENDENT_REVIEW.md` fully. Fix the single root cause: a medicine name still requiring human correction must not count as resolved evidence for declaring another specific item definitely missing or extra.

Inspect `resolveItemIdentity`, `rxHasUnresolvedIdentity` / `invHasUnresolvedIdentity`, and `buildSingleSidedRow`. An exact catalogue text lookup is not a confirmed identity when that name field has unreviewed low confidence / needsCorrection. Incorporate that uncertainty into inference eligibility before issuing MISSING_INVOICE_ITEM / EXTRA_INVOICE_ITEM. Preserve unresolved observations and evidence references; do not merely remove warning labels or override all result statuses after calculation.

Make both new negative controls in `tests/reconciliation-v2/backend.acceptance.test.cjs` pass without editing them. Keep the original confirmed-mismatch-plus-independent-uncertainty behaviour: do not blanket-suppress reliable differences just because another row needs correction. Add builder regressions for both sides and a non-suppression control.

No DTO/schema delta is needed. Work only in your original six assigned files (two services, two builder suites, your development fixture and your report). Do not edit GPT tests, shared result schema, consumer UI, frozen Foundation files, locked gold or held-out labels. No routes/models/API wiring, dependency/environment changes, database writes, commit, push or deployment.

Run:
```sh
node --test backend/tests/medicineQuantity.test.js backend/tests/medicineReconciliation.test.js
node --test tests/reconciliation-v2/backend.acceptance.test.cjs
node --test tests/reconciliation-v2/consumer.test.cjs
node --test backend/tests/foundationMedicineItems.test.js tests/foundation-v2/adapter.acceptance.test.cjs tests/foundation-v2/manifest.test.cjs
npm run validate:schemas
node --check backend/services/trustRag/medicineReconciliationService.js
```

Return a <=150-word checkpoint with exact changed files, actual test counts, inference-policy change, limitations and next owner GPT. Update your existing detailed report. This is Session 2 correction only; Session 3 remains closed until independent acceptance.
