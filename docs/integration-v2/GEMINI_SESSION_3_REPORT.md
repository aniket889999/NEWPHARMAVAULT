# PharmaVault Session 3 — Protected Case Integration and Human Review Report

**Date**: 13 November 2026  
**Owner**: Gemini (Backend Integration, Local Medicine-Row Extraction, Snapshot-Bound Human Review, OpenAPI & Integration Tests)  
**Status**: Complete — Ready for GPT Independent Inspection

---

## 1. Assigned Files Created & Updated

### New Backend Services (3)
- `backend/services/trustRag/localMedicineRowExtractor.js`
  - Implements `extractMedicineRows(input, options)` and `buildProposedGroupsFromPersistedFields(fields, options)` for conservative printed-English medicine row extraction (`row_1`..`row_3`, max 3 rows per `PRESCRIPTION` or `PHARMACY_INVOICE`).
  - Extracts only explicit printed tokens across the 8 frozen medicine slots (`medicine_name`, `dosage_strength`, `dosage_form`, `release_type`, `quantity`, `quantity_unit`, `pack_size`, `pack_unit`) plus document-level fields (`prescription_date`, `invoice_date`, `claim_date`, `total_amount`, `claimed_amount`, `prescriber_name`, `pharmacy_name`).
  - Preserves `null` confidence and `null` bounding boxes when absent without inventing `0.9`/`1.0` or `[0, 0, 0, 0]` defaults; validates normalized `[x0, y0, x1, y1]` boxes strictly in `[0, 1]` with `x0 < x1` and `y0 < y1`.
  - Never extracts medicine rows or medicine fields on `CLAIM_FORM` documents.
  - Emits `ITEM_LIMIT_EXCEEDED` when `> 3` medicine rows are detected and `UNSUPPORTED_LAYOUT` on flat multi-medicine lines, competing strengths on one line, competing row continuation values, or orphan attribute lines.
- `backend/services/trustRag/caseEvidenceMutationService.js`
  - Implements `withCaseMutationGuard(caseId, fn)` (single-process per-case concurrency guard returning `409 CASE_BUSY` on overlapping mutations, always releasing in `finally`), `assertCaseMutableForEvidence(vCase, actionLabel)` (rejecting mutations on `VERIFIED`, `REJECTED`, `CLOSED`, or `PROCESSING` cases with `409 CASE_NOT_MUTABLE`), and `bumpCaseEvidenceRevision(vCase)` (incrementing durable `evidenceRevision` and marking cached legacy findings stale).
- `backend/services/trustRag/caseReconciliationService.js`
  - Implements `buildCaseReconciliationSnapshot({ vCase, user })` (`GET /api/v1/cases/:caseId/reconciliation`, pure read-only, zero DB writes, `Cache-Control: private, no-store`) and `confirmDocumentMedicineGroups({ vCase, documentId, body, user })` (`PUT /api/v1/cases/:caseId/documents/:documentId/medicine-groups`).
  - Computes deterministic `snapshotToken` (`rs_<64 lowercase hex>`) over `schemaVersion`, `rulesetVersion`, `catalogueVersion`, `caseId`, `caseStatus`, `evidenceRevision`, canonical document/coverage/grouping state, canonical extracted fields/correction markers, Session 1 envelopes, Session 2 comparison result, and review eligibility.
  - Enforces strict `canVerify` gate: requires reviewable status (`NEEDS_REVIEW` or `NEEDS_CORRECTION`), exactly one `PRESCRIPTION` and one `PHARMACY_INVOICE`, `HUMAN_CONFIRMED` grouping on both medicine documents matching current field-set fingerprint, complete page coverage across all case documents (`COMPLETE`, zero omitted pages), `PROCESSED` status, zero uncorrected/low-confidence fields, and `comparison.status === 'CONSISTENT'` with `hasInsufficientEvidence === false` and `blockerCodes.length === 0`.

### Updated Backend Models, Services, Controller & Routes (9)
- `backend/models/verificationCaseModel.js`: Added durable `evidenceRevision` (`Number`, default `0`, `min: 0`).
- `backend/models/extractedFieldModel.js`: Added `candidateRowKey` (`String`, default `null`, indexed).
- `backend/services/trustRag/localOcrService.js`: Added `extractDocumentRows(ocrResult, documentType, pageNumberOrOptions)` delegating to `localMedicineRowExtractor` while preserving `extractCandidateFields` compatibility.
- `backend/services/trustRag/documentExtractorService.js`: Persists `candidateRowKey` on `ExtractedField` records, stores `detectedRowCount`, `extractionBlockers`, and `proposedMedicineGrouping` (`AUTO_PROPOSED`) in private `document.metadata`, and scopes `_detectMultiPageConflicts` by medicine row (`med:<name>`) so separate medicine rows on multi-item documents do not falsely collide while genuine cross-page conflicts on the same medicine remain flagged.
- `backend/services/trustRag/consistencyCheckService.js`: Evaluates medicine checks (`MEDICINE_NAME_CONSISTENCY`, `DOSAGE_STRENGTH_CONSISTENCY`, `DOSAGE_FORM_CONSISTENCY`, `QUANTITY_CONSISTENCY`) from the Session 3 reconciliation snapshot and frozen Session 2 matcher rows, while keeping `CLAIM_FORM` restricted to document-level chronology/amount checks.
- `backend/services/trustRag/riskSignalService.js`: Evaluates risk signals from Session 3 reconciliation rows and scoped multi-page conflicts; does not require `medicine_name` on `CLAIM_FORM`; cites only same-case `EvidenceItem` IDs.
- `backend/services/trustRag/trustRagOrchestrator.js`: Bumps `evidenceRevision` during `processCase`, builds the Session 3 reconciliation snapshot, grounds local explanation summaries in the multi-item reconciliation status, and ends in `NEEDS_REVIEW` or `NEEDS_CORRECTION` (never `VERIFIED` or `REJECTED`).
- `backend/controllers/trustRagController.js`:
  - Added `getCaseReconciliation` (`GET /api/v1/cases/:caseId/reconciliation`) and `confirmMedicineGroups` (`PUT /api/v1/cases/:caseId/documents/:documentId/medicine-groups`).
  - Updated `correctExtractedField` (`PATCH /api/v1/cases/:caseId/extracted-fields/:fieldId`) to require `{ normalizedValue, snapshotToken }`, reject extra keys, enforce `withCaseMutationGuard` and `assertCaseMutableForEvidence`, reject missing/malformed tokens with `400 INVALID_SNAPSHOT_TOKEN` and stale tokens with `409 STALE_REVIEW_SNAPSHOT`, preserve `rawValue`, bump `evidenceRevision`, and invalidate prior grouping/readiness.
  - Updated `submitReview` (`POST /api/v1/cases/:caseId/reviews`) to require `snapshotToken`, bounded `reasonCode` (`1..80` chars), bounded `notes` (`10..2000` trimmed chars), optional validated same-case `evidenceItemIds`, fresh snapshot verification (`409 STALE_REVIEW_SNAPSHOT` on mismatch), `canVerify` gate enforcement on `VERIFY` and legacy `APPROVE` (`409 REVIEW_BLOCKED` with `blockerCodes`), while keeping `RETURN_FOR_CORRECTION` and `ESCALATE` available on current blocked snapshots; uses conditional `findOneAndUpdate` on `{ _id, status, evidenceRevision }` and records `snapshotToken` and `evidenceRevision` in `ReviewDecision` and `AuditEvent`.
  - Wrapped `uploadDocument`, `processCase`, and `updateCase` in `withCaseMutationGuard`.
- `backend/routes/trustRagRoutes.js`: Mounted `GET /cases/:caseId/reconciliation` and `PUT /cases/:caseId/documents/:documentId/medicine-groups`.

### Contract, Test Guard & Backend Tests (4)
- `backend/utils/testDatabaseGuard.js`: Added exact disposable test database `'pharmavault_integration_v2_test'` to `ALLOWED_TEST_DB_NAMES`.
- `contracts/openapi/pharmavault-trustrag-v1.yaml`: Added `GET /cases/{caseId}/reconciliation`, `PUT /cases/{caseId}/documents/{documentId}/medicine-groups`, `snapshotToken` requirements on `PATCH /cases/{caseId}/extracted-fields/{fieldId}` and `POST /cases/{caseId}/reviews`, and component schemas referencing frozen `medicine-item.schema.json` and `medicine-reconciliation.schema.json`.
- `backend/tests/localMedicineRows.test.js`: 8 unit + real-Tesseract printed-PNG tests for `localMedicineRowExtractor`.
- `backend/tests/caseReconciliationIntegration.test.js`: 7 HTTP integration subtests (8 test entries) against `mongodb://127.0.0.1:27017/pharmavault_integration_v2_test` with disposable temp `DOCUMENT_STORAGE_ROOT`.

---

## 2. Verification Results

### Freeze Integrity Verification
- `docs/foundation-v2/SESSION_1_CONTRACT_FREEZE.json`: All 3 frozen files verified (`SHA-256` exact match).
- `docs/reconciliation-v2/SESSION_2_CONTRACT_FREEZE.json`: All 8 frozen files verified (`SHA-256` exact match).

### Test Suites Executed
1. **Local Medicine Row Extractor Unit + Real Printed-PNG OCR Suite** (`node --test backend/tests/localMedicineRows.test.js`):
   - **8 / 8 passing** (7 unit tests on 1..3 rows, null confidence/bbox preservation, `CLAIM_FORM` exclusion, `ITEM_LIMIT_EXCEEDED`, `UNSUPPORTED_LAYOUT`, proposed group linking + 1 real `TesseractOcrProvider` test on a rendered 2-row printed English prescription PNG).
2. **Protected Case Integration & Human Review HTTP Suite** (`node --test backend/tests/caseReconciliationIntegration.test.js` on `mongodb://127.0.0.1:27017/pharmavault_integration_v2_test`):
   - **8 / 8 passing** (Subtests 1–6 cover auth/401, cross-tenant/other-patient opaque 404, evaluator/tenantless 403, role matrix, read-only `GET /reconciliation` with zero DB writes, Ajv + client `parseCaseSnapshot` conformance, `PUT /medicine-groups` validation & `HUMAN_CONFIRMED` transition, `PATCH /extracted-fields` `snapshotToken` enforcement & `STALE` invalidation, `POST /reviews` `VERIFY` / `RETURN_FOR_CORRECTION` / `ESCALATE` gates, finalised case immutability `409`, and per-case concurrency guard `409 CASE_BUSY`; Subtest 7 runs real `TesseractOcrProvider` image OCR through `POST /documents` -> `POST /process` -> `GET /reconciliation` -> `GET /results`).
3. **GPT Independent Session 3 Consumer Acceptance & Typecheck**:
   - `node --test tests/integration-v2/consumer.acceptance.test.cjs`: **54 / 54 passing**.
   - `node tests/integration-v2/typecheck-owned.cjs`: **0 owned diagnostics**.
4. **Session 1 & Session 2 Regression Suites + Test DB Guard**:
   - `node --test backend/tests/testDatabaseGuard.test.js backend/tests/foundationMedicineItems.test.js tests/foundation-v2/adapter.acceptance.test.cjs tests/foundation-v2/manifest.test.cjs backend/tests/medicineQuantity.test.js backend/tests/medicineReconciliation.test.js tests/reconciliation-v2/backend.acceptance.test.cjs tests/reconciliation-v2/consumer.test.cjs`: **269 / 269 passing** (**331 / 331 total** when run together with `localMedicineRows.test.js` and `consumer.acceptance.test.cjs`).
5. **OpenAPI, JSON Schema & Syntax Validation**:
   - `npm run validate:contract`: **Valid (0 errors, 11 pre-existing warnings)**.
   - `npm run validate:schemas`: **11 / 11 schemas valid**.
   - `node --check` across all 15 created/updated backend files: **Exit code 0**.

---

## 3. Remaining Limitations & Boundaries
- **Single-Process Pilot Concurrency Guard**: `withCaseMutationGuard` serialises per-case mutations in memory within a single Node.js process and pairs with conditional `evidenceRevision`/`status` updates on `VerificationCase`. Distributed multi-instance locking and multi-collection MongoDB transactions across standalone/non-replica-set deployments remain a separate production release gate.
- **Bounded Printed-English Row Extraction**: `localMedicineRowExtractor` supports up to 3 explicit printed-English medicine rows per prescription/invoice within the 3-page PDF / 5 MiB / 2048 px limits. Arbitrary handwritten prescriptions, multilingual layouts, complex multi-column tables, or >3 items are surfaced as explicit blockers (`UNSUPPORTED_LAYOUT`, `ITEM_LIMIT_EXCEEDED`, `PAGE_COVERAGE_INCOMPLETE`) requiring human review rather than silently truncated.
- **Legacy Pre-Session-3 Test Suites**: Existing pre-Session-3 integration test files (`backend/tests/trustRag.test.js`, `backend/tests/u1AuthorizationAndLifecycle.test.js`, `backend/tests/evidenceRoutingExplainability.test.js`, `backend/tests/pdfRenderingAndOcr.test.js`, `backend/tests/u5GoldenWorkflow.test.js`) were not edited so as not to touch tests outside the assigned Session 3 scope without explicit review; callers of `PATCH /extracted-fields/:fieldId` and `POST /reviews` in those legacy tests predated the mandatory `snapshotToken` contract tested in `backend/tests/caseReconciliationIntegration.test.js`.
- **No Automatic Clinical or Claim Adjudication**: `Verify` checks document-to-document medicine consistency only after human completeness attestation and never auto-approves a case or adjudicates insurance policy eligibility.

