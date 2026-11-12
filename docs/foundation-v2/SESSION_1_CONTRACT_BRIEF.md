# Foundation V2 — Session 1 contract and ownership brief

Status updated 12 November 2026: standalone DTO independently accepted and frozen; `SESSION_1_ACCEPTED_CONTRACT.md` and `SESSION_1_CONTRACT_FREEZE.json` are authoritative for the exact interface. The original implementation brief below is retained for scope/ownership history. No new public endpoint is authorised by this checkpoint.

Active project: `/Users/aniket/Downloads/PBL 5 TH SEM`. Do not work in the older `NEWPHARMAVAULT` copy. Preserve the dirty worktree, local documents, databases and secrets.

## Ownership

Gemini may create only:

- `backend/services/trustRag/medicineItemContract.js`
- `backend/tests/foundationMedicineItems.test.js`
- `contracts/schemas/medicine-item.schema.json`
- `backend/tests/fixtures/foundation-v2-development.json`
- `docs/foundation-v2/GEMINI_SESSION_1_REPORT.md`

GPT owns:

- `docs/foundation-v2/SESSION_1_CONTRACT_BRIEF.md`
- `docs/foundation-v2/ACCEPTANCE_AND_UI_STATES.md`
- `docs/foundation-v2/BASELINE_AND_CHECKPOINT.md`
- `docs/foundation-v2/GEMINI_SESSION_1_PROMPT.md`
- all files under `tests/foundation-v2/`

No shared file edits without an explicit handoff. No model/controller/route, OpenAPI, frontend type, package or lockfile change in this foundation checkpoint. The standalone schema is a proposed internal contract, not a published API response. Public API/model integration belongs to later sessions after review.

## Gemini deliverable

Create a pure, database/network-free contract adapter over existing server-loaded extracted fields. Read current `backend/models/extractedFieldModel.js`, `backend/models/documentModel.js`, `backend/services/trustRag/documentExtractorService.js`, `contracts/schemas/extracted-field.schema.json` and related tests to preserve actual names and semantics.

Proposed export: `buildDocumentMedicineItems({ document, extractedFields, groups })`. If a different signature is materially safer, document the delta before integration; do not invent an HTTP endpoint.

`groups` represents trusted server-produced grouping of field references, not a permitted client payload. It should identify an existing medicine-name anchor field plus its member field IDs. A group cannot claim fields outside the supplied case/document or reuse fields across medicines. Do not group multi-medicine text by guessing its order or duplicating a flat field into several items.

### Required semantics

1. Output at most three medicine items for a prescription or pharmacy invoice. Every item identifies its case/document and links its actual fields with their existing IDs, page numbers, raw values, normalised values, extraction confidence and correction markers. Use the server model's `extractionConfidence`; the current frontend's `confidenceScore` is a known mismatch, not a reason to fabricate a value.
2. Generate opaque, deterministic server-side item IDs from document identity plus a stable group/anchor identity, not medicine content, a request-supplied item ID, array position or internal storage path. Reordering groups and correcting the value of the same field must not change that item's ID. This ID does not itself establish authorisation.
3. Explicit, unambiguous groups allow multiple items. Duplicate anchors, duplicated membership, cross-document/cross-case fields, missing referenced fields and multiple competing values for one slot must fail safely or return unresolved status with a reason. Never choose a first value silently.
4. The legacy adapter creates at most one item only when a single flat medicine-name field exists and recognised medicine slots are unambiguous. A flat multi-medicine name, repeated medicine-name fields or contradictory duplicate slots remain unresolved. Do not parse a comma-separated list into an invented grouping.
5. A claim form returns no invented medicine items and a not-applicable grouping status. Preserve access to existing metadata via existing mechanisms; do not invent claim lines.
6. Missing strength/form/quantity stays unknown. Preserve formulation and release text verbatim. No match decisions, unit conversion, clinical equivalence, quantity inference from dosage instructions or suitability advice in Session 1.
7. More than three detected groups must produce an explicit limit/coverage issue, not a silently truncated successful result. Prefer unresolved output with the detected count rather than publishing a partial all-clear.
8. Preserve document coverage exactly when available. Unknown or contradictory coverage is not complete. A `COMPLETE` label with processed count less than total must not become an unqualified complete envelope. No assumed high confidence, invented bounding boxes or fabricated evidence references.
9. No output contains `objectStorageKey`, `localPath`, storage roots or raw document metadata. Do not spread arbitrary input objects into the DTO.
10. Do not mutate inputs; corrections and audit/lifecycle state remain untouched.

Suggested envelope concepts: schema version, case/document identity/type, grouping status (`GROUPED`, `LEGACY_SINGLE_ITEM`, `UNRESOLVED`, `NOT_APPLICABLE`), medicine items, coverage and machine-readable issue codes. Per-item fields may be a fixed map or typed list; freeze the exact JSON Schema after the report is reviewed.

## Minimum builder tests

Legacy one-item compatibility; three explicit groups with stable IDs after reordering/value correction; omitted/unknown fields; repeated legacy names; repeated slots; four-group limit; invalid group membership; cross-case/document references; claim form without invented items; incomplete/contradictory coverage; storage-identifier omission; input immutability.

Run database-free tests and schema/syntax checks. Do not report reconciliation accuracy: the matcher is Session 2 work. GPT will independently review the adapter after your handoff.

Existing dependency note: root `require('ajv')` may resolve the older ESLint copy. The existing `ajv-cli` dependency carries Draft 2020-12 support. In a CommonJS test, `createRequire(require.resolve('ajv-cli/package.json'))('ajv/dist/2020')` resolves that existing validator without a package/lockfile change.

## Evaluation separation

GPT owns a versioned 40-scenario manifest and gold specification: ten case families, four variants each, six development families and four held out. Gemini may use only development scenarios to create its small adapter fixtures. Do not inspect held-out labels to tune the implementation. Dataset consistency checks are not a passing product benchmark or independent clinical validation.
