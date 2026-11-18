# GPT V2-01A — public-provider readiness

Date: 16 November 2026. Baseline: a9ffca1. Branch: feature/v2-01-readiness.

Status: PASS for the bounded readiness implementation and approved live public adapter diagnostic. Overall V2-01 remains OPEN pending Gemini's full browser acceptance report and independent review. This is not completion of P0 or the full product backlog.

## Implemented

- Added a bounded, secret-free readiness monitor, with explicit local-only, invalid configuration, configured/unverified, recently verified and degraded states.
- Integrated passive observations into the existing protected public chat JSON/SSE routes. Status reads themselves make zero external requests. Private cases and non-generated replies cannot establish public provider success.
- Added a compatible status DTO and schema, preserving the existing operation ID, endpoint and configuration fields. A flag is no longer presented in the UI as evidence that the provider actually worked.
- Added accessible, expiring readiness presentation, honest embedding configuration wording and refresh/cancellation/race protection. Private scope never inherits a public success claim.
- Added a configuration-only-by-default diagnostic with an explicit one-call public probe, source/request bounds, a 1024 output-token ceiling, no embedding/retry/private-case export and sanitized result output.
- Added focused unit/client/schema and real protected HTTP regression tests plus CI steps. Existing frozen paper code/data and held-out metrics were not edited or rescored.

## Executed verification

| Scope | Actual result |
|---|---|
| New readiness unit/probe/client/schema suite | 33/33 passed, zero skips |
| New actual router/disposable-MongoDB suite with mocked provider | 7/7 TAP entries passed (6 behaviours plus parent), scoped records cleaned |
| Existing chat regression including protected HTTP cases | 53/53 passed |
| Existing RAG/chat/citation/integrated-portal client regression | 121/121 passed |
| Offline foundation / matching / report / Session 3 client groups | 125 / 138 / 7 / 60 passed; frozen fingerprints PASS |
| Strict frontend/tooling checks and production frontend build | Passed; existing bundle-size/Browserslist warnings remain |
| New/owned frontend targeted lint | Passed, zero warnings |
| New/changed JavaScript syntax | Passed |
| JSON schemas / OpenAPI | 14 valid / valid with 11 existing warnings |
| One explicitly approved real public adapter call | HTTP 200, VERIFIED; 1 generation request, 0 embeddings, 0 retries |

The live request used only the packaged human-review project passage and a built-in workflow question. It used the existing backend credential without printing/copying it or modifying its environment file. The normal local app's export flags were not enabled. A CLI success does not establish browser acceptance or update a different running process's readiness observation.

## Actual browser smoke

Used a new run-scoped synthetic fixture on 5176/pharmavault_smoke_test, separate from Gemini's fixture. Logged in through the UI, entered the main Evidence Chat, observed the local-only header, asked a workflow question and saw labelled local source notes. Selected the authorized synthetic draft case and verified the private-case local-only notice. Returned through responsive navigation, logged out and confirmed the protected chat URL returned to portal selection.

Screenshot outputs are outside Git: output/v2-01/local-provider-readiness.png and output/v2-01/private-local-readiness.png in the desktop workspace. This smoke contains no actual OCR, real patient data, live provider call or full case-review acceptance. Teardown acknowledged removal of only this fixture's synthetic accounts/cases and private temporary assets. Other users' records and Gemini's fixture were not targeted.

## Open boundaries / next owner

- Gemini: complete/report the full browser scenarios under the agreed ownership. Send GEMINI_REPORT.md for GPT inspection; do not edit shared production files.
- GPT: inspect that report, rerun the appropriate joint regression gate after active fixtures stop, and resolve any demonstrated production blocker.
- Broad legacy full-backend cleanup suites were not run while the external browser owner could have an active fixture. Earlier baseline full-suite results are historical, not claimed as a fresh run of this branch.
- Normal Downloads source and running main prototype are not replaced by this candidate before the joint acceptance review. Git publication of this isolated sub-checkpoint does not mean the whole phase is accepted.
- The monitor is intentionally process-local. Durable evidence/history, distributed controls, new research evaluation and all later legacy features remain on the roadmap.
