# Session 3 corrective re-inspection — 13 November 2026

## Checkpoint decision

**PASS for the corrected Session 3 core integration, with full release acceptance still PARTIAL.** The four previously failing independent checks now pass. The isolated browser workflow also reaches a human-verified consistent case and safely handles a genuine medicine-strength discrepancy.

Keep this checkpoint on `wip/session-3-integration-review`. Do not automatically merge main, start Session 4, claim all legacy callers pass, or advertise clinical/production readiness.

This report supersedes the current decision in `SESSION_3_INDEPENDENT_REVIEW.md`; the earlier four-failure report is retained as historical evidence.

## Corrections independently inspected

| Item | Observed result |
|---|---|
| Coverage for every uploaded document, including optional claims | Missing, incomplete or contradictory count representations block Verify; nested and top-level counts must agree. Field pages above inspected coverage also block. |
| Snapshot read and mutation guard | A read during an active case mutation returns controlled 409 CASE_BUSY. |
| Required document pair | Actual prescription + invoice uploads reach READY_FOR_PROCESSING without a mandatory claim form. |
| FAILED retry | The real process endpoint accepts the offered retry without permitting finalised-case mutation. |
| Review persistence wording | The report now distinguishes AuditEvent token/revision metadata and review response from the ReviewDecision model. |

## Additional GPT corrections

Browser testing exposed two real CORS preflight failures that HTTP-only authenticated calls had not caught. `createCorsOptions` now permits the existing grouping PUT method and processing Idempotency-Key header. It still rejects an unapproved origin; authentication, tenant checks and export restrictions remain in place. Added a real app OPTIONS regression for both allowed operations and the denied-origin control.

Small UI corrections prevent an uploaded document from advertising an unsupported replacement action, label extracted field values as “Extracted” rather than “Verified”, and present terminal cases as read-only completed reviews. The new terminal-copy regression uses static React rendering. The live browser had cached the earlier copy; do not treat its screenshots as proof of these final copy edits.

## Tests actually rerun in the clean publication checkout

| Check | Actual result |
|---|---|
| Offline checkpoint runner | 330/330: Foundation 125; matching/quantities 138; report integrity 7; Session 3 client/creation 60 |
| Independent real HTTP/DB + two production boundary/privacy suites | 20/20: independent suite 8 TAP entries including parent; production suites 12 |
| Local row OCR + protected HTTP integration + database guard | 22/22: local rows 8; integration 8; database guard 6, including TAP parents |
| Strict integration project typecheck | Pass |
| Owned-file strict diagnostics | 0 in both checkouts |
| Full-app strict diagnostics (not waived) | Active working project 76; clean publication snapshot 83; neither is a full-app pass |
| Owned integration + creation-wizard lint | Pass without disabled rules |
| Backend JavaScript syntax | Pass |
| OpenAPI / JSON schemas | Valid with 11 existing OpenAPI warnings; 11/11 schemas valid |
| Session 1/2 frozen fingerprints | Unchanged |

Counts are execution evidence, not measured OCR accuracy, novelty or a clinical quality score. These rows overlap earlier runs and must not be summed into a claimed unique project-test total.

The first clean-checkout OCR run failed because its ignored local English language file was absent (OCR_LANGUAGE_DATA_UNAVAILABLE; the HTTP test received a safe 503). No assertion was weakened or skipped. Rerunning with the existing locally provisioned English data via TRUSTRAG_TESSDATA_PATH passed all 22 checks. A fresh installation must provision that file; OCR does not silently download language data or export documents.

## Real browser walkthrough

Used a separate loopback frontend on port 5174, a disposable test backend, synthetic accounts and clearly watermarked generated PNGs. The existing developer tabs on 5173 were not modified. External LLM/export flags were disabled. The only database target was the guarded `pharmavault_integration_v2_test`, never a development patient database.

1. Logged in through the UI and uploaded the two actual image files through the file chooser. No claim form was needed to become Ready.
2. Ran OCR through the UI. Opened the exact prescription/invoice field and page, with genuine source bounding boxes.
3. Inspected and confirmed four uncertain medicine-name transcriptions unchanged. These flags arose from the legacy catalogue lookup, not invented successful OCR or a forced medicine-strength correction.
4. Explicitly confirmed both document groupings. Only then did the consistent pair become eligible for human verification.
5. Opened the reviewer confirmation against one revision, then performed another legitimate grouping update. Submitting the stale review was rejected; actions were disabled and inspection acknowledgement reset.
6. Refreshed and re-inspected the evidence, entered accountable notes, acknowledged source inspection and completed the second confirmation. The consistent case actually reached VERIFIED.
7. Created a second case with prescription Paracetamol 650 mg and invoice Paracetamol 500 mg. The comparison displayed the difference, linked to the exact invoice source, and disabled Verify.
8. Recorded Escalate: status changed to NEEDS_REVIEW with an audit entry. Then recorded Return for Correction: status changed to NEEDS_CORRECTION with a second audit entry. The true 650/500 difference was not edited away.

Screenshots retained outside Git include stale-review rejection, the mismatching invoice source, and the final correction audit. They contain synthetic examples only.

### Fixture teardown limitation

The temporary browser tab was closed. The host denied control of the earlier long-running harness process, so automated shutdown/fixture cleanup could not be confirmed. Its isolated server on 5174 and run-scoped synthetic records may remain until its terminal receives `cleanup` or Ctrl+C, which invokes the harness's scoped teardown. Do not delete the whole test database or stop the user's normal 5173 development server to clean this up.

## Reproduction

From the project root, with MongoDB available locally and the English OCR data already provisioned:

```sh
node scripts/checkpoint-checks.cjs --report-dir=reports/checkpoints
node --test tests/integration-v2/backend.independent.test.cjs backend/tests/productionHardening.test.js backend/tests/productionHardening.u2.test.js
TRUSTRAG_TESSDATA_PATH=/absolute/local/tessdata node --test backend/tests/localMedicineRows.test.js backend/tests/caseReconciliationIntegration.test.js backend/tests/testDatabaseGuard.test.js
node node_modules/typescript/bin/tsc --noEmit -p tests/integration-v2/tsconfig.json
node tests/integration-v2/typecheck-owned.cjs
npm run validate:contract
npm run validate:schemas
npm run check:backend:syntax
```

The opt-in `node tests/integration-v2/browserHarness.cjs --synthetic-browser-check` is a manual browser fixture, not an automated browser test. It never reads .env and uses only its explicit guarded database. Enter `cleanup` in its terminal when finished and verify the scoped-cleanup acknowledgement.

## Release gates still open

- Migrate and rerun legacy pre-token callers/suites; the full backend suite has not been declared green.
- Resolve the full-app strict diagnostics and run the actual release build.
- Confirm browser harness teardown, then cover broader device/browser and upload/PDF layouts.
- Single-process locks do not provide distributed or multi-collection transaction guarantees.
- The pilot remains printed English, at most three medicine items and three OCR pages; review is not clinical treatment or insurance approval.
- Held-out research evaluation, representative accuracy, reviewer-time impact, FHIR/NHCX certification and novelty claims remain unmeasured.
