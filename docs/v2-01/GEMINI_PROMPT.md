# Gemini task — V2-01 browser acceptance only

Work in this exact repository:
/Users/aniket/Documents/Codex/2026-07-26/y/NEWPHARMAVAULT

Expected shared branch: feature/v2-01-readiness. GPT owns branch changes and production implementation. The original Downloads workspace has a different dirty Git history: do not work there or push it.

Your job is an isolated, reproducible browser acceptance package for the existing PharmaVault TrustRAG workflow. Keep token/time use focused. Do not rescan or re-explain the whole repository, redesign the UI, rebuild accepted services, solve unrelated lint debt or expand legacy features during this task.

Read first:
- docs/v2-01/CONTRACT.md (all ownership, status DTO and acceptance rules)
- docs/PROJECT_INTEGRATION_AUDIT.md
- tests/integration-v2/browserHarness.cjs
- tests/rag-v2/browserHarness.cjs
- backend/utils/testDatabaseGuard.js

Then read only exact route/component/API files necessary for the scenarios. Existing API modules are src/modules/verification/api/verificationApi.ts, src/modules/verification/integration/api.ts and src/features/caseAssistant/api.ts. Current chat is src/pages/patient/HealthAssistant.tsx plus src/components/chat/. Expand inspection only for a concrete blocker; record why.

WRITE OWNERSHIP — ONLY:
- tests/v2-01/browser/** (new fixture, runner/tests, local package/lock if needed, instructions and ignored runtime artifacts)
- docs/v2-01/GEMINI_REPORT.md

Do not edit production code, old harnesses/tests, frozen files, root/backend package files, shared contracts, CI, .env or any other GPT-owned file. Do not switch branches, stage, commit, push or delete another owner's files. If production changes are required, give GPT a minimal file/line-level request.

Implement the ten browser scenarios in CONTRACT.md using real UI actions and real protected HTTP behind them. Use a guarded loopback disposable test database, run-scoped synthetic users/organization/documents, private temporary storage and watermarked documents. Disable external AI/export/email/payment calls. The required documents are prescription plus pharmacy invoice; claim form is optional. Do not bypass role middleware or fabricate provider health.

Use existing helpers when practical without modifying them. A separate package inside your owned folder may hold browser-test dependencies if required. Follow your environment's allowed browser tooling; do not bypass a tool restriction. Do not download/install an unrelated tool or change global configuration. Actual browser checks must be reported separately from HTTP, SSR and static checks.

Prefer a small deterministic two-medicine fixture with a clear match and one controlled mismatch. Actual OCR and seeded extraction-error fixtures are separate test categories. If trained data/native rendering/browser access is missing, mark that gate BLOCKED or SKIPPED, never PASS, and finish the unaffected package/tests. Never infer OCR or medical accuracy from the fixture.

All cleanup must use testDatabaseGuard and delete only records owned by this run. No collection-wide deleteMany({}), normal .env/database use, git reset, broad cleanup, private data export, auto-approval, hidden skips or fake screenshots. Coordinate with GPT before running a broad test suite that could clear shared disposable databases. Use your isolated fixture DB and report when the fixture is running/stopped.

Routine in-scope local implementation and synthetic test steps are authorized; do not ask repeatedly to proceed. Respect genuine environment permissions and external-service boundaries; do not bypass approval systems.

Finish with:
1. Checkpoint: PASS/PARTIAL/BLOCKED, with the exact scope.
2. Files changed (owned paths only).
3. Scenario-by-scenario real results and actual commands/counts.
4. Synthetic DB/storage isolation and scoped-cleanup confirmation.
5. Browser/OCR evidence paths; never include credentials/tokens in tracked artifacts.
6. Minimal production blockers for GPT, remaining gaps and next owner.
7. Commit: none (GPT publishes after independent inspection).

Stop after this checkpoint. Do not begin V2-02 or rewrite the paper evaluation.
