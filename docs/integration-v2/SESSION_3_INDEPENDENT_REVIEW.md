# Session 3 independent acceptance — 13 November 2026

> Historical first-pass findings. The corrective re-inspection is recorded in [SESSION_3_REINSPECTION.md](SESSION_3_REINSPECTION.md): the four failures are fixed and the scoped core workflow passes; full release gates remain open.

**Decision: PARTIAL / NOT ACCEPTED.** Gemini's supplied suites pass, but four additional contract checks fail. Do not merge as a completed Session 3 release, start Session 4, or advertise live verification readiness yet.

## Results actually observed

| Check | Result | Scope |
|---|---|---|
| Gemini local row + HTTP integration suites | 16/16 passing | Includes real printed-PNG Tesseract and the upload/process/results route path on the exact disposable test database |
| Accepted Foundation/matcher/consumer/guard + local rows + new creation-gate tests | 336/336 passing | Original 331 engineering checks plus five new UI-readiness checks; not a clinical or held-out score |
| Independent HTTP edge-case suite | **2 of 6 child checks pass; 4 fail** | TAP includes the failing parent: 7 entries, 2 pass / 5 fail; exit 1 |
| Strict integration typecheck + owned full-app diagnostics | Pass / 0 owned diagnostics | Creation wizard is now included in the owned scope; full app retains 76 other strict diagnostics |
| New integration + creation-wizard lint | Pass | No disabled rules |
| Backend syntax, OpenAPI, schemas | Pass; OpenAPI has 11 warnings; 11 schemas valid | No claim of full backend regression acceptance |
| Frozen Session 1/2 fingerprints | Unchanged | No frozen source, catalogue or schema was edited |

All database checks used `mongodb://127.0.0.1:27017/pharmavault_integration_v2_test`, `NODE_ENV=test`, synthetic actors, development fixtures and temporary storage. Cleanup was restricted to records created by each run. No development patient data or external AI was used.

## Four reproducible failures

1. **Coverage contradiction can still be verified (P1).** A Mongoose-valid synthetic supporting claim has top-level counts `1/1/0` but `pageCoverage = { total: 2, processed: 1, omitted: 1, status: COMPLETE }`. The fresh snapshot reports `canVerify: true`; a fresh authorised VERIFY POST returns **201**, rather than `canVerify: false` and **409 REVIEW_BLOCKED**. The document loop in `caseReconciliationService.js` prefers one count representation and does not require all representations/status to agree. Validate every uploaded source, including optional claims, conservatively. This is a seeded inconsistent-record regression, not a claim that a public upload request accepts client-supplied coverage metadata.
2. **Snapshot reads bypass the mutation guard (P2).** Hold `withCaseMutationGuard(caseId, barrier)` and issue GET reconciliation. It returns **200**, not **409 CASE_BUSY**. `getCaseReconciliation` currently loads/builds outside the guard. Acquire the same canonical-case guard, re-read the case inside it, and handle controlled errors. Do not put a second lock inside the reusable builder, which is already called by guarded mutations.
3. **Optional-claim workflow does not become ready (P2).** Actual protected uploads of one Rx and one invoice leave a DRAFT case in **DOCUMENTS_PENDING**, not **READY_FOR_PROCESSING**. `uploadDocument` still uses `hasTriangle` requiring CLAIM_FORM. The declared pilot requires the medicine pair; supporting claims are optional. Preserve later duplicate/coverage blockers.
4. **FAILED retry is offered but rejected (P2).** A case with existing synthetic processed medicine fields is set to FAILED and POST process is called. It returns **400**, rather than **202** and a review/correction state. `trustRagOrchestrator.processCase` excludes FAILED from its allowed source states, while the agreed mutable lifecycle and case-page retry control include it. Keep finalised cases immutable and retries non-final.

Independent suite: `tests/integration-v2/backend.independent.test.cjs`. Run it unchanged from the active project root:

```sh
node --test tests/integration-v2/backend.independent.test.cjs
```

The independent positive controls confirm a human-confirmed medicine pair can be eligible without a claim form and that unflagged low-confidence input remains decodable/correctable. Those suspected paths were tested and are not reported as failures.

## GPT's completed follow-up

- Updated the creation wizard for required Rx + invoice and explicitly optional claim metadata.
- Processing still requires actual server READY_FOR_PROCESSING status; the UI does not bypass the backend defect.
- Added five pure readiness tests, safe case-ID checks, safe error text and prevention of repeat upload after acknowledged upload + failed status refresh.
- Included the wizard in owned-file strict checking and removed its unsupported LifecycleStepper prop. Wider-app debt is not waived.

## Remaining work and reporting boundary

Gemini owns the narrow backend correction in `trustRagController.js`, `caseReconciliationService.js`, `trustRagOrchestrator.js`, and only the corresponding OpenAPI descriptions if necessary. Preserve frozen files, GPT tests/frontend and actual source differences. Fix these four checks, rerun supplied suites, and update its report with exact outcomes.

The token/revision are visible in the review response and persisted AuditEvent metadata; the current ReviewDecision constructor/schema does not itself store those two fields. Correct the report's stronger wording instead of claiming extra persistence. Single-process locking and lack of distributed/multi-collection transaction guarantees remain declared production limits, not newly invented acceptance gates.

Legacy pre-token suites have not been migrated or declared green. Real browser/reviewer walkthrough, source-page behaviour after corrections, baseline caller compatibility and full-app release checks remain open. These corrections alone do not automatically close all of Session 3.

Publication must stay on a clearly labelled WIP integration branch. Passing offline CI is not acceptance of these currently failing database checks. Main's accepted Session 1/2 history remains untouched.
