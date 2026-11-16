# PharmaVault Session 4 — Item-Bound, Correction-Aware Case Assistant Report

**Date**: 16 November 2026
**Owner**: Gemini (Backend Case Assistant Service, Child Router, Unit & Real HTTP Integration Tests)
**Status**: Complete — Ready for GPT Independent Inspection

---

## 1. Assigned Files Created & Updated

### Created Files (5)
- `backend/services/trustRag/caseAssistantService.js`
  - Exports pure functions:
    - `buildCaseAnswer({ snapshot, message, medicineItemId = null }) -> AnswerDraft`
    - `buildDependencyIndex(snapshot) -> Map<string, string>`
    - `finalizeCaseAnswer({ draft, snapshot, userId, secret, now = new Date() }) -> CaseAssistantAnswer`
    - `checkAnswerFreshness({ snapshot, receipts, userId, secret, now = new Date() }) -> FreshnessResponse`
  - Exports authorized async functions:
    - `answerCase({ caseId, user, tenantContext, message, medicineItemId = null, rawBody = null })`
    - `freshnessForCase({ caseId, user, tenantContext, receipts, rawBody = null })`
  - Enforces private-case authorization (`caseScope`) before any subordinate read, acquires `withCaseMutationGuard` on the canonical case ID (`409 CASE_BUSY` on concurrent operations), re-verifies `caseScope` inside the guard, and reads the live Session 3 snapshot via `buildCaseReconciliationSnapshot`.
  - Computes domain-separated SHA-256 content fingerprints (`field:<id>`, `doc:<id>:source`, `item:<id>:membership`, `item:<id>:slot:<slot>`, `case:status`, `case:comparison`) excluding `evidenceRevision`, `snapshotToken`, `updatedAt`, `correctedAt`, and wall clock.
  - Signs bounded user/case/answer-bound HMAC-SHA256 receipts (`pvr1.<payload>.<sig>`, 12-hour TTL, `crypto.timingSafeEqual`) using a domain-separated key derived from `JWT_SECRET`.
- `backend/routes/caseAssistantRoutes.js`
  - Express child router (`express.Router({ mergeParams: true })`) applying `aiLimiter` and `Cache-Control: private, no-store` on all responses:
    - `POST /api/v1/cases/:caseId/assistant/answers`
    - `POST /api/v1/cases/:caseId/assistant/freshness`
- `backend/tests/caseAssistant.test.js`
  - Offline unit suite (6 subtests / 7 TAP entries) testing `buildCaseAnswer`, `buildDependencyIndex`, `finalizeCaseAnswer`, `checkAnswerFreshness`, Ajv validation against `case-assistant-answer.schema.json` and `case-assistant-freshness.schema.json`, 500 mg vs 650 mg mismatch preservation, multi-item clarification, citation budget overflow (`> 12` sources), dependent vs unrelated edits, source deletion, and Markdown injection escaping.
- `backend/tests/caseAssistantIntegration.test.js`
  - Real HTTP + MongoDB integration suite (4 subtests / 5 TAP entries) against guarded disposable database `mongodb://127.0.0.1:27017/pharmavault_smoke_test` with `assertTestDatabase` and run-scoped cleanup.
- `docs/rag-v2/GEMINI_SESSION_4_REPORT.md`

### Updated File (1)
- `backend/routes/trustRagRoutes.js`: Mounted `router.use('/cases/:caseId/assistant', require('./caseAssistantRoutes'));`.

---

## 2. Verification Results

### Offline Unit & Acceptance Suites (Zero DB / Zero Network)
- `node --test backend/tests/caseAssistant.test.js`: **7 / 7 TAP entries pass** (6 subtests, exit 0).
- `node --test tests/rag-v2/backend.acceptance.test.cjs`: **20 / 20 pass** (exit 0).
- `node --test tests/rag-v2/*.test.cjs`: **92 / 92 pass** (exit 0).
- `node --test backend/tests/caseAssistant.test.js tests/rag-v2/backend.acceptance.test.cjs tests/rag-v2/consumer.test.cjs tests/rag-v2/schema.test.cjs tests/rag-v2/store.test.cjs tests/rag-v2/ui.test.cjs backend/tests/testDatabaseGuard.test.js backend/tests/foundationMedicineItems.test.js tests/foundation-v2/adapter.acceptance.test.cjs tests/reconciliation-v2/backend.acceptance.test.cjs tests/integration-v2/consumer.acceptance.test.cjs`: **269 / 269 pass** (exit 0).

### Real HTTP + Disposable MongoDB Integration Suite
- `NODE_ENV=test node --test backend/tests/caseAssistantIntegration.test.js` (against `mongodb://127.0.0.1:27017/pharmavault_smoke_test` with `assertTestDatabase` and scoped cleanup): **5 / 5 TAP entries pass** (4 subtests, exit 0).

### Schema, OpenAPI & Syntax Checks
- `npm run validate:schemas`: **13 / 13 schemas valid** (exit 0).
- `npm run validate:contract`: **Valid (0 errors, 11 pre-existing warnings)**.
- `npm run check:backend:syntax`: **Pass (exit 0)**.

---

## 3. Remaining Limitations & Boundaries
- **Deterministic Local Scope**: Private case assistant answers only bounded document questions (`STRENGTH`, `QUANTITY`, `IDENTITY`, `COMPARISON`, `CASE_STATUS`) from the current Session 3 snapshot; clinical dosing, treatment, substitution, fraud conclusions, and claim adjudication are refused (`ABSTAIN`/`SAFETY`).
- **Memory-Only Receipts & Single-Process Lock**: Signed receipts (`bindingToken`) are stateless with a 12-hour server-time expiry and no durable chat storage; `withCaseMutationGuard` serializes per-case access within a single Node.js process.
- **Session 3 Legacy Projection Gate**: Session 3 legacy projection fixes in `trustRagController.js` and `consistencyCheckService.js` remain under GPT ownership per handoff.
