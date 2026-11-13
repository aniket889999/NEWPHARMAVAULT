# Gemini — Session 3 corrective pass only

Workspace: `/Users/aniket/Downloads/PBL 5 TH SEM`.

Resume existing work; do not rescan/rebuild the project. Read `docs/integration-v2/SESSION_3_INDEPENDENT_REVIEW.md`, the relevant Session 3 contract sections, and run:

```sh
node --test tests/integration-v2/backend.independent.test.cjs
```

Fix only these four proven backend gaps, one at a time:

1. `caseReconciliationService.js`: reject unknown, incomplete or contradictory coverage on **every uploaded document**, including optional claim forms. Require coherent positive integer totals/processed counts, zero omitted pages, COMPLETE status, and agreement of top-level counts with pageCoverage. Fresh VERIFY must return 409 REVIEW_BLOCKED when coverage conflicts.
2. `trustRagController.js` / `getCaseReconciliation`: use the same per-case guard and re-read the case inside it; concurrent GET must return 409 CASE_BUSY. Keep `buildCaseReconciliationSnapshot` reusable without nested locking.
3. `trustRagController.js` / `uploadDocument`: mark the case ready after Rx + invoice; claim form is optional. Preserve duplicate-document and evidence-completeness blockers.
4. `trustRagOrchestrator.js` / `processCase`: support explicit FAILED retry, keeping finalised cases immutable and processing unable to auto-verify/reject.

Ownership: those three backend files, matching OpenAPI descriptions if needed, and your existing `GEMINI_SESSION_3_REPORT.md`. Do not edit GPT's independent tests or frontend, frozen Session 1/2 files, held-out data, environment/dependencies or unrelated modules. GPT has already updated the creation UI and added its five passing readiness checks.

Use only the guarded disposable DB from the existing test; never development data. Run the independent suite unchanged after each relevant fix, then the two original focused suites and required regressions once. Do not suppress failures or alter expected outcomes to get a pass. No old-checkout Git commit/push; GPT publishes independently reviewed checkpoints.

Save progress in your report after each fix: files, actual command/exit/results, remaining gap and exact next command. Correct the earlier ReviewDecision token-persistence wording: currently it is in the response + AuditEvent, not the ReviewDecision record itself. Keep known legacy-test/browser/production limits explicit.

Final reply <=120 words. Report READY FOR RE-INSPECTION or PARTIAL, not whole-Session PASS. Work in one bounded batch; save a continuation checkpoint before stopping or exhausting context.
