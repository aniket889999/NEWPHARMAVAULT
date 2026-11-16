# Session 3 compatibility/release-build closure
Date: 16 November 2026. Owner: GPT, following Gemini's partial legacy-test handoff.

**PASS for the bounded academic Session 3 prototype and its current engineering gates.** This does not accept the still-pending Session 4 backend, held-out research results, deployment, devices or clinical/insurance decisions.

## Findings and corrections
- Accepted Gemini's snapshot-bound legacy caller migration after inspection; kept the initial partial report as historical evidence.
- Fixed GET results freshness to use the actual processedEvidenceRevision marker written by bumpCaseEvidenceRevision. Mutations still make cached findings stale.
- Found property drift across identity, strength, form/release AND quantity legacy projections: the frozen reconciler emits row.checks and reasonCodes, not issueCodes, rowStatus, identity.status or quantityComparison.
- Added a conservative dimension projection. Confirmed mismatches produce FAIL; complete consistent paired dimensions produce PASS; absent/unknown/unsupported dimensions remain INCONCLUSIVE. Confirmed differences are retained even when another row is unresolved.
- Unitless quantities no longer pass by default and are not compared using invented dispensing limits. Explicit unit/pack arithmetic remains entirely in the unchanged frozen Session 2 engine.
- Aligned risk flags with actual reason codes, FAIL/INCONCLUSIVE form status and the required Rx/invoice pair. A missing optional claim alone no longer creates an insufficient-evidence warning.
- Added missing disposable-database guards to two older suites. No development database was used.

## Legacy fixture migrations, not weakened product rules
- Quantity risk example now explicitly states tablet units and a medicine row; the real 5-versus-20 difference remains unchanged and still requires QUANTITY_MISMATCH.
- Real golden workflow fixtures have explicit medicine rows/units. Claims contain financial support rather than pretending to be medicine-line sources; the test asserts no claim medicine field is invented.
- Older identity-service stubs now supply their authored source case/coverage/confidence and explicit synthetic medicine attributes required by the frozen adapter. Source values already stated in each test are not overwritten.
- The explicit form-difference test now requires FAIL, which is stronger than its old INCONCLUSIVE expectation and matches the frozen reconciler. Unknown/unsupported dimensions still have separate inconclusive controls.
- The OCR test now checks that documented Crocin stays Crocin; generic identity resolution is separate. It no longer expects extraction to silently substitute Paracetamol.
- Removed dotenv loading from a synthetic identity test. No live secret was needed.

## Actual results on the publication checkout
| Run | Result |
|---|---|
| First complete backend run after five-suite migration | 250/258 pass, 8 TAP failures including parents; exposed the two additional older fixture contracts |
| Final complete backend command (21 backend test files) | **258/258 pass, zero failed/cancelled/skipped/TODO** |
| Five legacy suites together, including opt-in real OCR/PDF golden workflow | **48/48 pass, zero skipped** |
| New independent projection/real DB/HTTP revision regressions | **12/12 pass** |
| Full strict frontend build | Passed in the preceding build and client checkpoints; real app/tooling projects checked |
| Session 1/2 frozen fingerprints | Unchanged |

Runs overlap; do not sum them into a unique accuracy score. The new regression suite includes actual frozen reconciler outputs, real persisted checks/signals, same-case EvidenceItem references and a protected GET-results cache invalidation check.

## Reproduce
From the project root with local MongoDB and provisioned local English Tesseract data:
```sh
NODE_ENV=test U5_RUN_REAL=true U5_LOCAL_TESSDATA_PATH=/absolute/local/tessdata TRUSTRAG_TESSDATA_PATH=/absolute/local/tessdata npm --prefix backend test
node --test tests/release-v2/legacyProjection.test.cjs
npm run build:frontend
```
The existing backend command already serializes files because legacy suites share fixed disposable namespaces. Do not run those namespace-cleaning suites concurrently with another owner using the same test database. The new projection test cleans only its own IDs.

No OCR language data was downloaded; the real golden test copies a local provisioned file into its own temporary directory and cleans that directory. PDF parser recovery warnings and bundle-size/Browserslist warnings were not hidden. External AI was disabled for private test data.

## Remaining sprint work
Session 4 client/contract is independently tested but backend signatures/endpoints still need implementation and inspection. Session 5 has a preregistered synthetic evaluation protocol, no measured held-out result yet. Complete those gates before calling the combined sprint finished or merging the WIP feature set into main.
