# U4/U5 handoff — 14 October 2026

Owner: Codex. No commit or deployment. Gemini-owned production services were not edited.

## U4 — PARTIAL

Changed: `ios/PharmaVault/PharmaVault/PharmaVaultApp.swift`, `ClientPolicy.swift`, Xcode source references, `Package.swift`, policy tests/smoke runner and README.

- First-launch HTTPS configuration before login; rejects credentials/query/placeholder URLs and requires `/api`.
- Camera capability/permission checks and Settings guidance; rejects multi-page captures rather than dropping pages.
- Bounded, pixel-only JPEG preparation; preview/discard; three-document tracking and processing action.
- Keychain tokens bound to the endpoint; no cached personal profile; 401 invalidation, offline retry, delayed-login guards and no redirects/cookies/cache.
- ISO server timestamp decoding, case-ID validation and server problem details.

Verified:

- Swift frontend parsing on both production Swift files: PASS.
- `plutil -lint` on Info.plist/project: PASS.
- Direct compilation/execution of `ClientPolicy.swift` + `scripts/PolicySmoke.swift`: 9/9 groups PASS (URL/page/case/request/session/redirect policy; no network).
- SwiftPM/XCTest: NOT PASS; installed Command Line Tools manifest module/runtime disagree (old `SwiftVersion` ABI versus `SwiftLanguageMode`). Preserved the conventional Swift 5.9 manifest; independent runner provided without modifying the toolchain.
- Full iOS build, camera, Keychain and authenticated mobile upload: UNRUN. Full Xcode/device required; syntax parsing is not UIKit/SwiftUI type-checking. Device checklist in the iOS README.

## U5 — PARTIAL, real workflow failures

Added opt-in `backend/tests/u5GoldenWorkflow.test.js`. From the repository root:

```sh
U5_RUN_REAL=true node --test backend/tests/u5GoldenWorkflow.test.js
```

Uses fixed loopback `pharmavault_smoke_test`, explicit database guard, random run-owned identities/cases, temporary private storage and a temporary local-language-data copy. No development database access or collection-wide deletion. Cleans only created/ownership-checked IDs and its exact generated temporary directory. Full test discovery skips this expensive opt-in suite.

Coverage implemented: actual authenticated HTTP, MongoDB, synthetic PDF-to-PNG, local Tesseract, extraction, human confirmation/correction, reprocessing, canonical matching, consistency/evidence, review queue, human review, audit, draft export, cross-tenant/role/lifecycle negatives and optional real PDF intake/preview.

Actual child results: **1 PASS, 2 FAIL, 1 SKIP**. TAP counts the failed parent too (aggregate: 1 pass, 3 fail, 1 skip). Access/lifecycle negatives passed. Both golden image workflows failed because the real provider produced zero extracted fields. PDF gate skipped because `pdfRenderingService.storageRoot` ignores `DOCUMENT_STORAGE_ROOT`; the test deliberately does not monkeypatch this.

Independent synthetic SDK probe:

```text
defaultTextCharacters: 54
defaultBlockCount: 0
explicitBlockCount: 1
externalCalls: false
```

`tesseractOcrProvider.js` calls `worker.recognize(imageBuffer)` but reads `result.data.blocks`. Tesseract 7 defaults `blocks: false`. Gemini should explicitly request `{ text: true, blocks: true }` as the third recognize argument, preserve real coordinates and add a real-provider regression. Do not weaken U5 assertions or invent fields.

The probe compared default and explicit blocks without modifying production. U5 must rerun after U3. No OCR accuracy/reviewer-time percentage or FHIR conformance established; export check is structural only. Browser UI acceptance pending.

U1.1 database-free guard suite: 5 child tests + parent, 6/6 PASS. Prior guard blocker fixed; final U1 database report remains Gemini's gate.
