# Copy into Gemini — Session 1 correction pass, not Session 2

Historical correction prompt: executed and independently accepted on 12 November 2026. Do not rerun this as a new work order. See `SESSION_1_ACCEPTED_CONTRACT.md` for the current checkpoint.

Project: `/Users/aniket/Downloads/PBL 5 TH SEM`.

GPT reran your 33 tests successfully, but its independently authored development-only acceptance suite passed 19/28 and failed nine checks. Combined Foundation is not yet PASS.

Read `docs/foundation-v2/SESSION_1_INDEPENDENT_REVIEW.md` and the existing contract brief completely. Inspect `tests/foundation-v2/adapter.acceptance.test.cjs` as the correction acceptance gate. Do not edit that suite, GPT-owned files, locked manifests/materialiser or held-out labels.

Fix these four root causes within your original five assigned files only:

1. Preserve `release_type`, `quantity_unit`, `pack_size`, `pack_unit` as nullable linked medicine fields alongside the current four slots. Update enums, fixed maps, member checks, field-ID limits and instance schema accordingly. An ungrouped medicine attribute must not silently disappear. Do not compute conversions or implement matching yet.
2. Derive conservative review requirements. An unreviewed low-confidence field must still require review when `needsCorrection` is a default false. `correctedBy` alone is insufficient to establish completed correction; require coherent correction metadata. Missing essential strength/form/quantity must remain null and require clarification. Keep unambiguous partial items usable; do not route nonfatal incompleteness warnings into a blanket fatal grouping branch. A true correction flag must not be cleared automatically.
3. Remove the unsafe inference that any recognised combination-partner word proves one product. The unverified flat text `Paracetamol 500mg and Ibuprofen 200mg` must remain unresolved without sufficient single-product/grouping evidence. This is ambiguity handling, not a clinical equivalence judgment.
4. Strengthen JSON Schema implications: UNRESOLVED grouping and noncomplete coverage must require `reviewRequired: true`; item correction requirements must not coexist with a cleared envelope. Validate valid and deliberately invalid actual instances.

Keep stable IDs, scope checks, raw/corrected provenance, coverage honesty, claim non-invention and storage sanitisation intact. Your fixture/test expectations may change only where the documented review semantics truly changed; explain those changes. Do not weaken tests, validation or privacy to make a pass. Prefer small targeted changes over another broad rewrite.

Your writable scope remains:
- `backend/services/trustRag/medicineItemContract.js`
- `backend/tests/foundationMedicineItems.test.js`
- `contracts/schemas/medicine-item.schema.json`
- `backend/tests/fixtures/foundation-v2-development.json`
- `docs/foundation-v2/GEMINI_SESSION_1_REPORT.md`

Run:
```sh
node --test backend/tests/foundationMedicineItems.test.js
node --test tests/foundation-v2/adapter.acceptance.test.cjs
node --test tests/foundation-v2/manifest.test.cjs
npm run validate:schemas
node --check backend/services/trustRag/medicineItemContract.js
```

No routes, models, frontend, OpenAPI, packages/lockfiles, .env, databases, commits, pushes or deployments. No Session 2 implementation. Return a <=150-word checkpoint with actual counts, exact changed files, DTO/review-semantics delta and remaining limitations. Save details in your existing report. GPT reviews again before contract freeze.
