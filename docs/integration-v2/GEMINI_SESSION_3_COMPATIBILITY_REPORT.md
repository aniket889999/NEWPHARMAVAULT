# PharmaVault Session 3 — Legacy Backend Test Compatibility Report

**Date**: 16 November 2026  
**Owner**: Gemini (Legacy Backend Test Compatibility Only)  
**Status**: Partial — `snapshotToken` & Grouping Callers Migrated; 2 Genuine Production Defects Reported Before Expanding Ownership

---

## 1. Guarded Disposable Database Verification
All five legacy suites were verified prior to execution:
- `backend/tests/trustRag.test.js`: `mongodb://127.0.0.1:27017/pharmavault_trustrag_test` (`assertTestDatabase`)
- `backend/tests/u1AuthorizationAndLifecycle.test.js`: `mongodb://127.0.0.1:27017/pharmavault_trustrag_test` (`assertTestDatabase`)
- `backend/tests/evidenceRoutingExplainability.test.js`: `mongodb://127.0.0.1:27017/pharmavault_trustrag_evidence_test`
- `backend/tests/pdfRenderingAndOcr.test.js`: `mongodb://127.0.0.1:27017/pharmavault_trustrag_test` (`assertTestDatabase`)
- `backend/tests/u5GoldenWorkflow.test.js`: `mongodb://127.0.0.1:27017/pharmavault_smoke_test` (`assertTestDatabase`, scoped ID teardown, opt-in `U5_RUN_REAL=true`)

No development database or shared `pharmavault_integration_v2_test` fixture was targeted or cleaned.

---

## 2. Legacy Test Files Updated
1. `backend/tests/u1AuthorizationAndLifecycle.test.js` (Test 5b): Fetches `GET /api/v1/cases/:caseId/reconciliation` and submits `snapshotToken` on `PATCH /extracted-fields/:fieldId`. Preserves patient `403`, cross-tenant, and lifecycle bypass assertions.
2. `backend/tests/evidenceRoutingExplainability.test.js` (Test 6): Subtests 6b (`RETURN_FOR_CORRECTION`) and 6c (`ESCALATE`) fetch `snapshotToken` from `GET /reconciliation`. Subtest 6a (`VERIFY`) seeds consistent `PRESCRIPTION` + `PHARMACY_INVOICE` documents/fields, confirms `HUMAN_CONFIRMED` grouping via `PUT /medicine-groups`, and submits `snapshotToken` to `POST /reviews`.
3. `backend/tests/trustRag.test.js` (Test 6): Confirms uncertain fields with `snapshotToken`, confirms `HUMAN_CONFIRMED` groupings on `PRESCRIPTION` and `PHARMACY_INVOICE` via `PUT /medicine-groups`, and submits fresh `snapshotToken` to `POST /reviews` (`APPROVE`). Preserves patient `403`, audit immutability, and `QUANTITY_MISMATCH` assertions.
4. `backend/tests/pdfRenderingAndOcr.test.js` (Test 18): Both `PATCH /extracted-fields/:fieldId` calls fetch a fresh `snapshotToken` from `GET /reconciliation`.
5. `backend/tests/u5GoldenWorkflow.test.js`: Updates `PATCH /extracted-fields/:fieldId` loop, `PUT /medicine-groups` confirmation, `POST /reviews` (`VERIFY`), and `POST /reviews` (`ESCALATE`) to fetch and submit current `snapshotToken` values.

---

## 3. Commands Executed & Exact Results
- `NODE_ENV=test node --test backend/tests/u1AuthorizationAndLifecycle.test.js`: **6 / 6 pass** (exit 0).
- `NODE_ENV=test node --test backend/tests/evidenceRoutingExplainability.test.js`: **8 / 8 pass** (exit 0).
- `NODE_ENV=test node --test backend/tests/trustRag.test.js`: **8 / 10 pass, 2 fail** (exit 1; Tests 6 and 7 now pass; Test 8 `QUANTITY_MISMATCH` fails due to production defect #2 below, plus parent suite).
- `NODE_ENV=test node --test backend/tests/pdfRenderingAndOcr.test.js`: **17 / 19 pass, 2 fail** (exit 1; Test 18 now passes; Test 16 fails due to production defect #1 below, plus parent suite).
- `NODE_ENV=test U5_RUN_REAL=true node --test backend/tests/u5GoldenWorkflow.test.js`: **1 / 5 pass, 4 fail** (exit 1; fails earlier at `CLAIM_FORM` `dosage_strength` extraction exclusion on line 177, `DOSAGE_STRENGTH_CONSISTENCY` on line 235, and `202 !== 400` on line 257 before reaching the updated `snapshotToken` callers).
- `node --check` on all 5 updated test files: **exit 0**.

---

## 4. Genuine Production Defects Reported (Not Edited — Outside Ownership)
1. **Stale-Revision Field Name Mismatch (`backend/controllers/trustRagController.js:821` vs `backend/services/trustRag/caseEvidenceMutationService.js:136`)**:
   - `bumpCaseEvidenceRevision(..., { markLegacyFindingsProcessed: true })` sets `vCase.metadata.processedEvidenceRevision = nextRev`, whereas `getResults` checks `vCase.metadata?.legacyFindingsRevision === currentRev`.
   - `findingsMatchRevision` is therefore always `false`, causing `GET /results` to discard `vCase.metadata.explanation` (which contains the orchestrator's incomplete-page-coverage warning) and regenerate a summary without `'incomplete'` or `'omitted'`, failing `pdfRenderingAndOcr.test.js` Test 16.
2. **Mismatched Session 2 Schema Properties in Quantity Check (`backend/services/trustRag/consistencyCheckService.js:312-328`)**:
   - `QUANTITY_CONSISTENCY` inspects non-existent properties (`r.issueCodes`, `'QUANTITY_EXCEEDS_PRESCRIBED'`, `r.quantityComparison`) instead of Session 2's `r.reasonCodes` (`'QUANTITY_MISMATCH'`), `r.quantityCheck`, and `r.quantity`, and skips the `invQty <= rxQty` fallback whenever a paired row exists even when unitless quantities leave Session 2 at `INSUFFICIENT_EVIDENCE`.
   - As a result, `Crocin 500mg Qty: 5` vs `Qty: 20` falsely passes `QUANTITY_CONSISTENCY` and fails to emit `QUANTITY_MISMATCH` in `trustRag.test.js` Test 8.

