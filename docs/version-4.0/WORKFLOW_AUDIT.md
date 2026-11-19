# Version 4 workflow audit

## Verdict

**Core single-pharmacy ordering, claims/appeal, reminders, public chat history and account-security paths work in the tested synthetic setup. Not every workflow is complete or safe for real data.** Workflow Center approval/tenant isolation, multi-pharmacy prescription handoff, case OCR setup and placeholder patient features need work.

This was a diagnostic task. No application source was changed or repaired during this audit. Existing local work and the original preview database were preserved.

## Evidence and scope

- Current code: local `version-4.0`, upstream base `de60459` plus the previously preserved local fixes.
- Separate new synthetic database: `pharmavault_workflow_audit_20261118_409c99ac`. It was empty before demo seeding; the existing preview DB was never seeded, reset or cleared.
- **56 consolidated API assertions: 51 PASS, 4 FAIL, 1 BLOCKED.** These are individual assertions, including role logins and security guards, not 56 independent complete journeys or a clinical score.
- **49 role/page checks: 48 loaded without a visible crash; 1 doctor-consultation page correctly showed future work.** Loading a page does not prove every action, empty state or background API branch.
- Real browser OCR on the bundled synthetic printed prescription produced three medicine entries; archiving navigated to Health Records and displayed the saved transcript. This is one printed sample, not measured OCR accuracy or clinical validation. The displayed confidence is heuristic.
- No real orders, medicines, payments or insurance eligibility decisions were involved. Claim decisions and settlement were fictional, isolated tests. External model generation, email and SMS were disabled. Public official-source lookup remained enabled.
- Existing 206 focused tests/build results are a separate earlier checkpoint; they were not added to these workflow counts.

Raw observations, including original attempts and corrected test inputs, are retained under `workflow-audit/`. `workflow-audit/SUMMARY.json` contains the consolidated result.

## Workflow results

| Workflow | Result | What was actually observed |
| --- | --- | --- |
| Authentication / role boundaries | PASS (tested paths) | Ten role/account logins; unauthenticated blocking; patient denial from privileged routes; public registration cannot grant staff privilege. |
| Browser prescription scanner | PASS on one sample | Actual Tesseract browser OCR → 3 entries → archive saved and shown. No handwriting or PDF accuracy claim. |
| Prescription API / ownership | PASS | Local rule extraction, saved record retrieval and exclusion from another patient's prescription list. |
| Nearby inventory | PASS | Five stocked Pune pharmacy entries, nearest first, with server inventory/price data. |
| Batch/ledger check | PASS within prototype scope | Known synthetic ledger batch returned verified; unknown batch returned suspicious. This is not proof of genuine manufacture or regulator certification. |
| Single-pharmacy order journey | PASS | Prescription requirement, malformed-quantity rejection, server pricing, reserve/order creation, pharmacy review queue, clarification → patient status, approval → ready status, actual in-app notification, rejection and repeat-return guard. |
| Multi-pharmacy prescription order | **FAIL** | Two prescription orders share one prescription document; its organization/order link is overwritten, so one pharmacy loses its prescription-queue entry. |
| Stock actions | PASS (tested paths) | Markdown, reorder request, recall and refusal to order the recalled audit-only batch. |
| Workflow Center trigger/logging | PARTIAL | Trigger creates a real audit entry, but the required human approval never enters the pending queue. Some logged actions remain simulations, not domain changes. |
| Workflow Center approval / isolation | **FAIL** | Designated pharmacist denied; a foreign pharmacy could reject a controlled pending workflow belonging to another pharmacy. |
| Claimant → insurer → response → decision | PASS via API | Consent requirement, eligible-case filtering, submission, query and claimant response, human partial decision, same-reviewer appeal guard, independent appeal decision and explicitly simulated settlement. |
| Claims privacy / export | PASS (tested paths) | Other claimant/insurer denied, direct payer case access denied, withdrawal revoked consent, structural FHIR export validated. This used seeded VERIFIED case fixtures, not a completed OCR/review pipeline. |
| Secure document intake/viewing | PASS | Correct data-URI uploads, identical authenticated image bytes, no storage key in upload response, 401 without login and opaque 404 for another tenant. |
| Case OCR → correction → medicine checks → human verification | **BLOCKED** | Real printed-image processing returns 503 because local `eng.traineddata` is missing. Downstream end-to-end processing was not fabricated. Incomplete evidence correctly blocks VERIFY. |
| Context-aware public chat | PASS for selected questions | Metformin evidence/follow-up, exact public fever evidence, brand clarification, personal-treatment referral and private-access boundary. Broader evidence coverage remains limited. |
| Saved public history | PASS | Opt-in → create → server-generated streamed answer → reopen with two messages; other account denied. Private case transcripts were not saved. |
| Smart reminders | PASS for tested delivery | Created due synthetic reminder, observed actual scheduled in-app notification, then marked it taken. Email/SMS delivery was not tested. |
| Team / MFA / privacy | PASS (tested paths) | Scoped team view; dedicated audit-only MFA setup, one-use recovery sign-in and replay rejection; own-data export and erasure-request cancellation; administrator audit-chain endpoint responded. No account was erased. |
| Health-record presentation/export | **FAIL / PARTIAL** | Saved transcript displays, but medicine names are absent because UI reads `name` while saved records use `medicineName`. Download handler is only a success toast. Categories are not used in filtering. Unreviewed records still receive a verified-archive badge. |
| Personal Health Tracker | **NOT IMPLEMENTED beyond mock UI** | Source uses fixed mock vitals/reports; Upload/Download buttons have no handlers. No real tracker save/persistence path exists. |
| Doctor consultation | FUTURE WORK | Correct coming-soon page; not an implemented consultation service. |
| Admin/research/accessibility and other listed pages | LOAD CHECK ONLY | Role-specific pages opened. This does not validate every control, live metric, translation or operational action. |

## Fix first

### 1. Workflow Center tenant isolation — high priority

**Observed:** another pharmacy's bearer account submitted `action: reject` against an audit-only pending workflow and received HTTP 200. This is a workflow integrity/authorization flaw; it is not a demonstrated leak of private claim documents.

**Cause:** `backend/routes/workflowRoutes.js` and `backend/workflows/workflowEngine.js` use workflow IDs without enforcing the requesting pharmacy/organization on rejection. `rejectWorkflow` also does not check the configured approver role.

**Required:** derive tenant from the authenticated user, scope every view/approval/rejection lookup, enforce the proper role, and return an opaque denial. Add same-tenant and cross-tenant tests for both approve and reject. Keep real patient/company data out until this is addressed.

### 2. Human approval queue and role mismatch — high priority

**Observed:** the real low-OCR trigger produced `approvalRequired: true` but `approvalStatus: not_required`; the sign-off queue was empty. A separate explicitly pending control fixture was then used to test the next gate: the designated pharmacist received HTTP 403.

**Cause:** `workflowAuditLogger.logTrigger` does not persist the pending approval state (model default is `not_required`). Approval routes allow `pharmacy/admin`, while the registry requires `pharmacist` and current privileged roles use `super_admin`.

**Required:** persist the correct state and align route/engine role rules without weakening human review. Do not mark mock `generate_reminder`, queue or stock actions completed unless their actual integration occurred.

### 3. Multi-pharmacy prescription linkage — high priority

**Observed:** two synthetic Rx orders were created, but their common prescription appeared in only one pharmacy queue.

**Cause:** `backend/controllers/orderController.js` updates one prescription's `organizationId` and `orderId` in each pharmacy-group iteration.

**Required:** separate per-order/per-pharmacy review assignments or appropriately scoped copies; independent notes/status and traceability. Test two pharmacies through approval/rejection and patient updates. Transaction failure recovery and concurrent cancellation were not proven by this audit.

### 4. Case OCR runtime configuration — demo blocker

Provision the required local English Tesseract language asset at the configured `TRUSTRAG_TESSDATA_PATH` (or documented local default), then rerun real PNG/JPEG and PDF-page processing, corrections, identity/reconciliation, human review and answer-freshness checks. Browser OCR working does **not** resolve this separate backend OCR asset failure.

### 5. Finish or clearly label placeholder patient features

- `src/pages/patient/HealthRecords.tsx`: implement real PDF export; render `medicineName`; make category filters functional; remove fake verification/default doctor/medication fallbacks where evidence is absent.
- `src/components/features/PersonalHealthTracker.tsx`: implement real upload/download/vitals persistence or explicitly mark the entire feature illustrative/future work.
- Patient dashboard still contains illustrative appointments, doses and verification metrics. Workflow Center footer scans only show success toasts. Do not present these as completed measured workflows.

## Additional configuration/privacy findings

- The API client forces loopback requests to port 5001 even when `VITE_API_URL` is configured. A temporary **audit-only** Vite transform redirected that constant to the isolated API on port 5011. No repository source was modified. Default-port operation is a separate case; alternate-port deployment/test configuration is currently fragile.
- Reminder creation calls the email helper even with notification/email flags disabled, and its confirmation template includes medicine/dosage text. The audit replaced that helper with a throwing no-network stub, so no email was sent. The application should honour explicit opt-in/configuration and its stated outbound-data policy.
- Legacy error middleware omits `err.code`; missing-Rx requests correctly return HTTP 400 and the required message, but do not expose the controller's machine-readable `PRESCRIPTION_REQUIRED` code.
- New symptom-title matching is intentionally conservative; context-aware chat still has evidence/phrasing gaps and no clinical approval. Paid Gemini acceptance and broad benchmark superiority were not tested.

## Test-attempt corrections and browser limitation

The first document upload probe incorrectly supplied bare Base64; the API correctly rejected it. Retrying with `data:image/png;base64,...` passed. The missing-Rx probe initially asserted a code omitted by the legacy response handler; functional refusal was confirmed separately. Initial attempts were preserved rather than hidden or called product failures.

The browser's download-event wait stalled. That control session was abandoned; a fresh tab completed the remaining page checks. The PDF export finding is source-confirmed (handler only calls `toast.success`), not a completed browser download-event measurement. The OCR/archiving observations occurred before the stall. Do not equate page-load passes with complete browser interaction coverage.

The audit server was restarted once to isolate its API port; `egress-summary.json` reflects only its final process, not an aggregate count across restarts. No paid-provider or outbound email/SMS operation was enabled. Public MedlinePlus responses were actually used by the API chat check; browser OCR downloaded its public runtime/language assets.

## Artifacts and preservation

- Consolidated API/page results: `workflow-audit/SUMMARY.json`.
- Raw initial, retry and edge-case results: other JSON files under `workflow-audit/`.
- Order-screen evidence: `/Users/aniket/Documents/Codex/2026-07-26/y/deliverables/pharmavault-workflow-audit-orders.jpg`.
- Audit harness and temporary storage: `/private/tmp/pharmavault-workflow-audit.MOdvxL/`.
- Synthetic audit database retained for reproductions; only its two local services were stopped. Original preview data/server were not reset.

Scope excludes real-patient clinical testing, native iOS/device builds, production load, real payments, live insurer/NHCX certification and delivery through real email/SMS gateways.
