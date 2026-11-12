# Foundation V2 — GPT baseline and Session 1 checkpoint

Baseline date: 9 November 2026. Latest independent re-inspection: 12 November 2026.

Checkpoint: **Session 1 Foundation PASS for the standalone adapter/contract and test-data package. Corrections independently accepted; see `SESSION_1_ACCEPTED_CONTRACT.md` and `SESSION_1_CONTRACT_FREEZE.json`. Session 2 is not started.**

## 1. Exact project baseline

- Active implementation path: `/Users/aniket/Downloads/PBL 5 TH SEM`.
- Branch inspected: `feature/work-order-3-domain-contract`.
- HEAD inspected: `dc41e1d`.
- Runtime used: Node `v22.15.0`.
- Worktree already contains many modified/untracked backend, frontend, deployment, iOS and chat files. Preserve them. No staging, reset, cleanup, commit or push was performed.

## 2. Read-only findings

1. `backend/services/trustRag/localOcrService.js` stops after the first medicine-name/strength/quantity candidate for each field type. Its outputs cannot be re-labelled as complete multi-item extraction.
2. `backend/services/trustRag/documentExtractorService.js` explicitly documents the single-medicine boundary. Multi-item extraction/group persistence is later integration work, not delivered by a standalone adapter.
3. `backend/services/trustRag/consistencyCheckService.js` uses one document entry per type and first matching field lookup. Reusing it unchanged for multiple items would risk associating the wrong medicine with strength/quantity. Multiple invoices are outside this pilot.
4. The orchestrator currently resolves a medicine field per document rather than a separate structured item. Session 2/3 must not simply copy that result onto every item.
5. Server extracted fields use `extractionConfidence`, while frontend `ExtractedField` declares `confidenceScore`. Frontend document processing-status types also omit actual backend states such as `PROCESSED` / `PDF_OCR_PENDING_RASTERIZATION`. Contract alignment is required before UI integration.
6. Document coverage exists, but defaults and supplied counters can conflict. An adapter must not interpret an asserted COMPLETE label as sufficient when processed count is below total or unknown.
7. The root TypeScript configuration has `files: []` and project references. Its current `tsc --noEmit` script returns success without the application-project check below. A normal script pass is not proof the app is strictly typed.

These findings are recorded, not repaired by editing shared application files during Foundation ownership separation.

## 3. Commands actually run

| Check | Actual result | Scope / limitation |
|---|---|---|
| `node --test --test-skip-pattern='real MongoDB and HTTP' backend/tests/chatRag.test.js backend/tests/conversationalRag.test.js backend/tests/pharmacyChatPolicy.test.js tests/chatClient.test.cjs` | 45/45 pass, exit 0 | Database-free chat/policy/client baseline. The MongoDB/HTTP integration block was deliberately excluded. No live model calls. |
| `npm run validate:schemas` | Nine existing schemas compile, exit 0 | Baseline before new adapter/schema acceptance. Compilation is not output-instance validation. |
| `npm run validate:contract` | Valid, 12 existing warnings, exit 0 | Existing OpenAPI only; no new endpoint/schema response was published. |
| `npm run check:ts` | Exit 0 | Root script limitation described above; not a strict application pass. |
| `./node_modules/.bin/tsc --noEmit --project tsconfig.app.json` | Exit 2; 98 diagnostics across 36 files | Existing app-wide type/unused-code debt, including verification components. Not fixed or hidden by weakening rules. |
| `node --test tests/foundation-v2/manifest.test.cjs` | 59/59 pass, exit 0 | Fixture schema, data coherence, controlled perturbations and frozen dataset lock only. Not application matching accuracy. |

No frontend build, live provider test, database test, full security audit, iOS acceptance or production acceptance was claimed in this checkpoint.

## 4. GPT-owned work created

- `docs/foundation-v2/SESSION_1_CONTRACT_BRIEF.md`: bounded adapter semantics and exact Gemini/GPT file ownership.
- `docs/foundation-v2/GEMINI_SESSION_1_PROMPT.md`: reusable bounded builder prompt.
- `docs/foundation-v2/ACCEPTANCE_AND_UI_STATES.md`: 16 adapter acceptance cases, later integration requirements and planned reviewer states.
- `docs/foundation-v2/BASELINE_AND_CHECKPOINT.md`: this actual-evidence checkpoint.
- `tests/foundation-v2/development.manifest.json` and `heldout.manifest.json`: ten families, four variants per family; 24 development and 16 held-out scenarios.
- `tests/foundation-v2/manifest.schema.json`: strict Draft 2020-12 manifest schema.
- `tests/foundation-v2/fixtures.cjs`: deterministic offline fixture materialiser, development-only by default.
- `tests/foundation-v2/manifest.test.cjs`: independent fixture-integrity and counterfactual tests.
- `tests/foundation-v2/dataset-lock.json`: hashes of manifest/schema/materialiser bytes and materialised gold.
- `tests/foundation-v2/README.md`: safe usage, interpretation, split rules and limitations.

Synthetic gold distribution: 16 consistent, eight mismatch and 16 insufficient-evidence scenarios. This is an authored test distribution, not a real-world prevalence estimate. No rendered prescription/invoice PDF, OCR benchmark or clinical validation was produced.

## 5. Initial changes-required gate (historical; closed by section 8)

1. Gemini's initial five-file handoff was inspected. Its 33 tests and ten schema compilation checks pass.
2. GPT's new independent adapter suite passes 19/28, with nine failing checks across field retention, review flags, ambiguous list handling and schema implications.
3. Gemini applies the bounded correction prompt without editing GPT tests or locked gold data; GPT reruns independent acceptance and reviews the actual delta.
4. Freeze exact DTO/issue codes only after the correction gate passes; no frontend types or Session 2 integration yet.

No public API or persisted domain-model delta exists from GPT's work. No new UI feature is presented as implemented. Session 2 has not started.

## 6. Original GPT-only verification (9 November)

- Final locked fixture suite: **59/59 pass**, zero failed/skipped, exit 0 (approximately 151 ms in this run).
- `node --check tests/foundation-v2/fixtures.cjs`: exit 0.
- `node --check tests/foundation-v2/manifest.test.cjs`: exit 0.
- Dataset bytes/materialisation are hash-locked at version 1.0.0. Four manifest/schema/materialiser files and all 40 materialised scenarios are checked by the lock test.
- GPT changed only the eleven new files under its two assigned directories. Application source, existing contracts, package files, environment files and local data were not edited by GPT in this session.
- Combined Foundation is **PARTIAL** until the independent adapter/schema acceptance gate is met. Next owner: Gemini for its builder handoff, then GPT for independent inspection. Commit: none.

## 7. Initial independent review after Gemini handoff (historical)

- Builder suite reproduced: 33/33 pass.
- Existing/new medicine-item schemas: ten compile successfully.
- Frozen fixture suite reproduced: 59/59 pass.
- New adapter acceptance suite: 19/28 pass, nine fail. No failures skipped or relabelled as success.
- Added by GPT in this review: `tests/foundation-v2/adapter.acceptance.test.cjs`, `docs/foundation-v2/SESSION_1_INDEPENDENT_REVIEW.md`, `docs/foundation-v2/GEMINI_SESSION_1_CORRECTIONS_PROMPT.md`. Existing GPT checkpoint/README updated. Gemini's implementation and the locked dataset remain unchanged by GPT.
- Next owner: Gemini, Session 1 corrections only. API/UI integration, matcher and Session 2 are not started. Commit: none.

## 8. Correction re-inspection and contract freeze — 12 November

- GPT reproduced Gemini's corrected builder suite: **35/35 pass**.
- The original independent adapter suite passed **28/28 unchanged**. GPT added three further regression checks; the final suite passes **31/31**, no skipped failures.
- Frozen dataset/manifest/materialiser checks: **59/59 pass**. Gold values, family split and dataset hashes remain unchanged.
- JSON Schemas: **10/10 compile**. Existing OpenAPI validates with **12 existing warnings**. Adapter syntax check exits 0.
- All four previously documented root causes are corrected within the reviewed standalone scope. The accepted eight-slot DTO, semantic limits and exact source/schema fingerprints are recorded in `SESSION_1_ACCEPTED_CONTRACT.md` and `SESSION_1_CONTRACT_FREEZE.json`.
- GPT modified only its independent acceptance suite and Foundation documentation in this re-inspection. Gemini's implementation was inspected but not edited by GPT.
- No matching/unit conversion, OCR grouping, persistence or public API/UI integration was added. No held-out product score, clinical accuracy, production readiness or repaired app-wide TypeScript status is claimed.
- Current decision: **Session 1 Foundation PASS (scoped)**. Next: await student `2` for the matching/quantity checkpoint. No commit, push or deployment.
