# Foundation V2 synthetic specification

This directory is GPT-owned. It contains offline structured fixtures, not patient records, real prescriptions, rendered PDF/image documents, OCR results or a functioning reconciliation engine.

## Contents

- `development.manifest.json`: six development families, four variants each (24 scenarios).
- `heldout.manifest.json`: four evaluation families, four variants each (16 scenarios). Builders must not inspect these labels for tuning.
- `manifest.schema.json`: Draft 2020-12 manifest structure.
- `fixtures.cjs`: deterministic, database/network-free materialiser; defaults to development only.
- `manifest.test.cjs`: independent schema/data-integrity/counterfactual checks. These do not measure application accuracy.
- `adapter.acceptance.test.cjs`: independent development-only tests against Gemini's actual adapter and schema. Initially 19/28 passed with nine documented blockers. After corrections, all original 28 and three additional regression checks pass: 31/31 as of 12 November 2026. See `docs/foundation-v2/SESSION_1_ACCEPTED_CONTRACT.md`.
- `dataset-lock.json`: versioned hashes of the frozen manifest/schema/materialiser after initial validation.

Run from `/Users/aniket/Downloads/PBL 5 TH SEM`:

```sh
node --test tests/foundation-v2/manifest.test.cjs
node --test tests/foundation-v2/adapter.acceptance.test.cjs
node tests/foundation-v2/fixtures.cjs --split=development
```

The final command prints JSON to standard output without writing files or uploading data. A held-out export requires explicit `--split=heldout`; use it for evaluation, not development. Access is a workflow convention, not a technical secrecy barrier.

## Oracle interpretation

Expected status/reason labels are authored in the manifests from controlled perturbations. The materialiser copies these labels; it does not run the product matcher to generate its own answer key. Expected field-reference links are deterministic fixture identifiers, not runtime medicine-item IDs. A pair with insufficient evidence describes a candidate comparison, not a resolved clinical identity.

`missingInvoiceKeys` denotes an observed difference in a fully inspected invoice. `unobservedInvoiceKeys` denotes information unavailable because a page/document is missing; do not treat those as a proven omitted bill item.

Every fixture/document says `SYNTHETIC — DEMO ONLY`. Source text is a generic comparison template, not a usable prescription. It has no patient details, prescriber, signature or official logo. Fixed confidence values are test inputs tagged `SYNTHETIC_GOLD`, not measured OCR confidence or clinical certainty. No bounding boxes are fabricated. The materialiser's `sourceText`, `fixtureLineKey` and `gold` are fixture/oracle data, not fields to expose through the public API.

Baseline supported generic/strength/form tuples are checked against the project's existing academic catalogue, not a national regulatory database. Release labels are supplied document-comparison attributes; no claim of clinically validated release-type coverage is made. Deliberate conflict variants may contain inconsistent medicine descriptions: that is the test, not prescribing guidance.

## Coverage and limitations

The pilot includes ordering, real strength/form/release differences, unknown identity, known/unknown pack counts, missing fields/documents, incomplete/contradictory coverage, legacy ambiguity, wrong-medicine evidence and dependent/unrelated corrections. Session-specific security and source deletion/reprocessing tests remain separate acceptance requirements; forty scenarios do not cover every production edge case.

All variants of a family remain on one split. Base item profiles differ across families, but the same small catalogue and template family is intentionally reused. This is not an external validation set or evidence of generalisation to real hospital layouts, different pharmacies or new medicine populations.

Freeze gold/split/materialisation hashes before scoring. If a fixture defect is discovered, bump the dataset version, document the correction and rerun all compared variants. Never adjust an expected result merely to make a failed implementation pass.

Do not combine logic-only scores with OCR or generated-language scores. Label every reported metric with its track, scope, denominator and unimplemented features. Passing this directory's tests means the fixtures are coherent, not that PharmaVault solves them yet.
