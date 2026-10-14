# PharmaVault upgrade checkpoints — Codex and Gemini

Updated: 14 October 2026.

Project: `/Users/aniket/Downloads/PBL 5 TH SEM`

Branch at planning: `feature/work-order-3-domain-contract`

Last committed baseline: `dc41e1d`. Work Order 5B, SwiftUI and deployment changes are already present but uncommitted. Preserve those changes. The checkpoints below are acceptance gates, not permission to create Git commits.

## Working rules to reduce repeated work

- One owner per checkpoint and per file. Read this plan instead of repeating the project history.
- Work only on the current assigned checkpoint. Do not implement future checkpoints speculatively.
- Run tests relevant to the changed behavior. Codex runs integration checks once per integration gate; both agents do not repeat the same full suite on unchanged code.
- Report only the delta: checkpoint, changed paths, exact command/result, remaining blocker and API changes. Keep the handoff under 150 words; include additional output only for failures.
- A passing mock test does not establish real OCR accuracy, container compatibility or an iPhone build. Identify what was actually exercised.
- Preserve existing work. No bulk cleanup, destructive database operations, history reset, secret disclosure, production deployment, publishing or commits without explicit authorization.
- Normal local edits, safe builds and scoped tests are already authorized. Platform permissions may still need approval through the tool UI.

## File ownership

### Gemini

- `backend/controllers/` — authentication and TrustRAG endpoints.
- `backend/routes/`, `backend/models/` and `backend/middleware/tenantMiddleware.js`.
- TrustRAG services other than `storageService.js` and `llmExplainabilityService.js`.
- Backend tests for authentication, authorization, OCR, PDF, medicine matching, lifecycle and evidence provenance.
- `backend/package.json` and `backend/package-lock.json`.
- `contracts/` — schemas and OpenAPI; publish contract changes before Codex changes their UI consumers.
- FHIR exporter implementation in the existing TrustRAG controller.

### Codex

- `ios/` — SwiftUI, VisionKit, API client, Keychain and mobile tests.
- `backend/config/`, `backend/app.js`, `backend/middleware/errorMiddleware.js`.
- `backend/services/trustRag/storageService.js` and `llmExplainabilityService.js`.
- `backend/.env.example`, `backend/Dockerfile`, `backend/.dockerignore`, deployment examples.
- `backend/tests/productionHardening.test.js`.
- `src/modules/verification/` and affected frontend integration files.
- Upgrade tracker, current-state documentation, deployment/mobile documentation and research evaluation assets.

If a checkpoint requires another owner's file, include the exact required interface/change in the handoff and let that owner edit it. If blocking, perform that portion sequentially after the handoff. Do not overwrite the other owner's changes.

## Checkpoint table

All checkpoints start **OPEN**. Existing code does not establish that an acceptance gate has passed.

| ID | Owner | Deliverable | Dependency | Acceptance gate | Status |
|---|---|---|---|---|---|
| U1 | Gemini | Authorization, lifecycle enforcement and safe test database | None | Patient cannot set VERIFIED/REJECTED; public signup cannot grant staff roles; missing staff tenant is denied; correction/review permissions match the contract; tests cannot erase a development database | PARTIAL — U1.1 explicit guard independently passes 6/6; final database-dependent confirmation pending Gemini |
| U2 | Codex | Correct deployment and outbound privacy controls | Can run alongside U1 | Compatible Node runtime; catalogue included; trusted server queries still work; shared document storage configuration; unexpected errors are safe; outbound LLM payload excludes identifying data; container smoke test succeeds | PARTIAL — host checks pass; Docker engine and U3 preview-storage integration pending |
| U3 | Gemini | Close Work Order 5B PDF/evidence gaps | U1 | Pre-allocation resource limits, timeout/cancellation and global concurrency bounds; bounded preview cache; incomplete page coverage is explicit; valid EvidenceItem links; real PDF-provider checks and corrected retry behavior | OPEN — also fix real Tesseract structured output discovered by U5; see U4_U5_HANDOFF.md |
| U4 | Codex | Complete SwiftUI scanning client | Can run alongside U1/U2 | API setup available before login; camera support/permission handling; Keychain session behavior; explicit page handling; reachable authenticated upload; Xcode build and physical-device scan test | PARTIAL — safeguards implemented; 9/9 pure policy groups and parse/plist checks pass; Xcode/device gate unrun |
| U5 | Codex | Reproducible golden-workflow acceptance | U1/U2/U3 | Synthetic Rx + invoice + claim completes upload, OCR, correction, medicine resolution, evidence, review and export; isolated integration suite; cross-tenant and lifecycle negative cases pass | PARTIAL — real integration added; child results 1 pass, 2 OCR failures, 1 PDF-storage skip; rerun after U3 |
| U6 | Gemini | Multiple-medicine model and unit/pack reconciliation | U5 | Each medicine line is matched independently; units/pack counts normalized; formulation attributes preserved; uncertain matches remain unresolved; contracts updated with regression cases | OPEN |
| U7 | Gemini | Correction-aware evidence dependencies and versions | U6 | Every check/signal links to actual source evidence; a correction invalidates and recomputes affected results; original values and decisions remain auditable; retries do not duplicate findings | OPEN |
| U8 | Codex | Reviewer evidence comparison and capture guidance | U6/U7 contracts frozen; U4 for mobile guidance | Compare Rx/invoice/claim by medicine; open exact page/box; separate OCR/match/coverage indicators; show before/after corrections; missing pages visible; scan-quality warnings exercised | OPEN |
| U9 | Gemini | Validate the expanded FHIR export and API contracts | U6/U7 | Actual response payloads pass contracts; exported FHIR resources pass selected R4/profile validation; broken references rejected; alignment stated accurately without NHCX certification claims | OPEN |
| U10 | Codex | Research benchmark and recruiter demonstration | U8/U9; U4 for mobile demo | Held-out evaluation, baseline comparison, measured error/latency/reviewer-time results, final integration run and short reproducible demo; source/device/container limitations disclosed | OPEN |

## Execution waves

1. **Start:** Gemini U1; Codex U2 and U4. Codex performs these as separate tasks within its workstream.
2. **Foundation closure:** Gemini U3; Codex resolves deployment/mobile findings. Do not call the whole project complete while U4 device testing is pending.
3. **Web integration gate:** Codex U5. A pending physical-device test does not prevent validating the web workflow; mobile remains an open gate.
4. **Domain upgrade:** Gemini U6, then U7. Codex can prepare UI designs and evaluation cases against agreed contracts without changing Gemini's backend files.
5. **Presentation and standards:** Codex U8 and Gemini U9 can run in parallel once U6/U7 contracts are stable.
6. **Final evaluation:** Codex U10. Close only gates with actual evidence; leave environmental blockers explicitly open.

## Important acceptance details

### U1 review handoff — 13 October 2026

Gemini reports 6/6 U1 tests and 86/86 backend tests passing. Codex verified the presence of the registration, staff-provisioning, missing-tenant, patient PATCH and correction-role guards without rerunning the full suite.

Historical blocker (now corrected): `testDatabaseGuard.isTestDatabase()` used `dbName.includes('test')`, accepting `billing_latest` and `production_test`. Current source uses an explicit allow-list. Codex independently ran the database-free U1.1 suite: 6/6 including parent PASS. Final database-dependent U1 confirmation remains Gemini's responsibility.

**Gemini U1.1:** Replace substring matching with an explicit allow-list of the currently used local disposable test database names, or another equally strict anchored convention that rejects ambiguous/non-test targets. Add database-free negative tests for `billing_latest`, `pharmavault_latest`, `production_test`, `prod_test`, `dev_test`, protected databases and missing database names. Retain `NODE_ENV=test` enforcement, URI/Connection/Mongoose-instance support and guards before all collection-wide cleanup. Confirm current legitimate test names are accepted. Do not connect to or clean any negative-test target.

Run the focused guard and U1 suites against the existing isolated test target. Return only the changed paths, exact pass/fail counts and any blocker. U3 remains queued until this correction closes U1; U2's Codex work is already implemented with container/preview-consumer gates pending.

### U1: Authorization and test safety

- Public self-registration creates only the allowed submitter role. Staff provisioning requires an authorized organization administrator and explicit organization membership.
- Case PATCH cannot bypass a ReviewDecision to set final states or inject internal explanation/resolution metadata.
- Tenant-neutral patients retain only their permitted own-case operations. Staff with missing tenant context receive a denial, not a global query or production demo-organization fallback.
- Research-evaluator access, if enabled, must follow the documented de-identified contract; otherwise deny it.
- Use a dedicated test database and a guard that rejects non-test database targets before any cleanup. Cleanup is restricted to test-owned fixtures or an explicitly disposable test database.
- Follow the authorization matrix for corrections. If submitter corrections are a deliberate requirement, update the matrix and tests before accepting them; expert verification remains staff-only.

### U2: Deployment and privacy

- Use a runtime supported by `pdf-to-img` and PDF.js. The present Node 20 image is incompatible with the installed dependencies.
- Include required catalogue code in the image; exclude secrets, private uploads and OCR language data from image layers.
- Test the production configuration, including trusted server-generated MongoDB operators; the global sanitizeFilter setting currently breaks the review-queue query.
- Provide one storage-root interface to Gemini: original documents and previews must respect `DOCUMENT_STORAGE_ROOT`. Do not expose it through public responses.
- Build an explicit outbound LLM payload allow-list. Raw evidence text and filenames are not automatically de-identified. Keep external explanation disabled until the privacy tests pass.
- Prepare and validate deployment artifacts locally. Actual hosting/domain/credentials are a separate deployment action.

### U3: PDF and evidence closure

- Fix real OCR structured output first: installed Tesseract 7 defaults `blocks: false`, while the provider reads `data.blocks`. U5 actual OCR extracted zero fields. An independent probe produced text but zero blocks by default and one block when explicitly requested. Request structured output and add a real-provider regression; never use template/mocked fallback to pass acceptance.
- Validate viewport dimensions before allocating a canvas; enforce time, concurrency and cache limits on processing and on-demand previews.
- Record rendered/processed page coverage. A document with more than three pages cannot be presented as fully analyzed.
- Use the shared storage-root interface from U2 for previews; retain safe errors for storage failures.
- `RiskSignal.evidenceItemIds` must reference EvidenceItem records in the same case, not ExtractedField records. Evidence for missing information must accurately identify the missing requirement and inspected document coverage.
- Resolve document-level correction flags after legitimate corrections/reprocessing. Preserve the old extraction/correction record rather than silently overwriting history.
- Test real PDFs for rendering and sanitized error paths; use mocks for controlled edge cases, clearly labelled.

### U6/U7: Research feature scope

- Replace the current single-medicine assumption explicitly in domain documentation and schemas before adding line-item behavior.
- Test equivalent units such as 500 mg vs 0.5 g and documented pack quantities such as 10 tablets vs one strip containing 10 tablets.
- Ingredient, strength, dosage form, concentration and release formulation remain separate properties. Ingredient equality does not establish interchangeability.
- Each correction records actor, time, original value, corrected value and affected checks. Regenerated explanations cite the correct evidence version.
- Retrieval can remain deterministic where appropriate. Do not add an unrestricted web agent or a second LLM just to increase the technology list.

### U10: Evaluation

- Use labelled synthetic cases initially; do not collect identifiable patient data to meet a benchmark target.
- Split by case/template so variations of the same document do not leak across development and test sets.
- Compare raw-string matching, canonical matching, and the complete evidence/correction workflow.
- Report field extraction accuracy, medicine-line matching precision/recall, mismatch false-positive rate, evidence-reference validity, incomplete-coverage handling and processing latency.
- Report reviewer time only after an actual reviewer study; otherwise mark it unmeasured. Do not convert test counts or heuristic match scores into accuracy claims.
- Maintain a three-minute demonstration with one normal case, one true mismatch, one OCR correction, one incomplete/unresolved case and an authorized final review.

## Compact handoff format

```text
Checkpoint: Ux — PASS / PARTIAL / BLOCKED
Changed: paths only
Verified: exact command(s), pass/fail counts; real vs mocked
API/contract delta: none or concise field/route changes
Blocker/next: one sentence
Commit: none
```

After each handoff, Codex updates only the corresponding checkpoint status. A status of PASS requires its acceptance gate, not just a successful build.
