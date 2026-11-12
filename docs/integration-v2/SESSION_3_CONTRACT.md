# Session 3 — protected case integration, grouping and human review

Date: 12 November 2026. Status: integration contract specified; implementation/acceptance pending. This checkpoint connects the accepted standalone work; it does not claim arbitrary-layout OCR, production readiness or clinical/claim approval.

## 1. Ownership and scope

Project: `/Users/aniket/Downloads/PBL 5 TH SEM`. Verify both accepted freeze files before editing. Frozen Session 1/2 adapters, matchers, schemas, catalogue and standalone comparison component/model/types remain unchanged. Propose a reviewed delta rather than silently changing their meaning.

GPT owns `docs/integration-v2/**` except Gemini's report, `tests/integration-v2/**`, `src/modules/verification/integration/**`, and these existing frontend files: `pages/CaseDetailPage.tsx`, `api/verificationApi.ts`, `types.ts`, `components/ReviewActionModal.tsx`, `DocumentEvidenceViewer.tsx`, `ExtractedFieldsEditor.tsx`, `LifecycleStepper.tsx` (paths relative to `src/modules/verification`).

Gemini owns these backend integration files for this checkpoint:

- New: `backend/services/trustRag/caseReconciliationService.js`, `caseEvidenceMutationService.js`, `localMedicineRowExtractor.js`.
- Existing: `backend/controllers/trustRagController.js`, `backend/routes/trustRagRoutes.js`, `backend/models/verificationCaseModel.js`, `backend/models/extractedFieldModel.js`, `backend/services/trustRag/localOcrService.js`, `documentExtractorService.js`, `trustRagOrchestrator.js`, `consistencyCheckService.js`, `riskSignalService.js`.
- Contract: `contracts/openapi/pharmavault-trustrag-v1.yaml` (additive snapshot/grouping endpoints and review-token requirement only; reference frozen schemas where appropriate).
- Tests/report: new `backend/tests/caseReconciliationIntegration.test.js`, `backend/tests/localMedicineRows.test.js`, `docs/integration-v2/GEMINI_SESSION_3_REPORT.md`.
- Test isolation: `backend/utils/testDatabaseGuard.js` may add only the exact disposable name `pharmavault_integration_v2_test`; do not loosen other checks. Existing affected backend tests may be updated only for a documented legitimate contract/field-output delta, not to weaken auth/coverage assertions; report exact files.

No unrelated frontend/backend refactor, package/lockfile/environment edit, source deletion, Git staging/commit/push/deployment or real-patient data. Preserve the dirty worktree. If more ownership is needed, report the exact delta before editing another owner's file.

## 2. Authentication, roles and bounded workflow

Use existing protect/tenant middleware and getAccessibleCase checks. Owner patients may read their own snapshot, never correct/group/review. Existing correction roles: pharmacist, pharmacy, claims_reviewer, org_admin. Existing review roles also include super_admin; do not grant it new source-correction permissions. Cross-tenant/other-patient reads return opaque 404, evaluator stays blocked, tenantless staff fails closed. Never trust a request role, organisation, clinical identity or comparison outcome.

Pilot supports one prescription and one invoice per case; claim forms are optional supporting metadata, not invented medicine lines or automatic eligibility checks. Multiple prescription/invoice documents are explicitly unsupported, not resolved by choosing the first/latest. Return a snapshot with a blocker and null comparison rather than pretend a selected subset verifies the whole case. All uploaded documents' actual page coverage still matters to final verification.

Finalised VERIFIED/REJECTED/CLOSED evidence is not silently edited. Reject source/group mutation with a controlled 409; amendments/reopening need a separately designed workflow. Mutable source states: DRAFT, DOCUMENTS_PENDING, READY_FOR_PROCESSING, NEEDS_CORRECTION, NEEDS_REVIEW, FAILED. No automatic approval/rejection during processing or grouping.

## 3. GET /api/v1/cases/{caseId}/reconciliation

Read-only, authenticated, authorised, private/no-store. Compute from current server-loaded documents/fields/grouping and frozen services, without an LLM or network request. Never return paths, storage keys, raw document metadata or client-authoritative grouping. Exact wrapper:

```text
schemaVersion: '2.0.0-session3'
caseId: string
caseStatus: existing lifecycle value, including FAILED
snapshotToken: 'rs_' + 64 lowercase hex
evidenceRevision: nonnegative integer
prescription: frozen Session 1 envelope | null
invoice: frozen Session 1 envelope | null
comparison: frozen Session 2 result | null
groupingDocuments: GroupingDocument[] // prescription/invoice only
permissions: { canCorrectFields, canConfirmGroups, canReview } // server role-derived booleans
reviewEligibility: { canVerify: boolean, blockerCodes: string[], allowedActions: PublicReviewAction[] }
notices: [{ code: string, documentId: string | null, message: string }]
legacyFindingsCurrent: false
```

`GroupingDocument`:

```text
documentId, documentType: PRESCRIPTION | PHARMACY_INVOICE
processingStatus: actual backend processing state
mode: UNCONFIRMED | AUTO_PROPOSED | HUMAN_CONFIRMED | STALE
observedItemCount: integer 1..3 | null
confirmedBy: server user ID | null
confirmedAt: ISO timestamp | null
groups: [{ anchorFieldId, fieldIds: string[] }]
fields: [{ id, caseId, documentId, fieldType, rawValue, normalizedValue,
           pageNumber, extractionConfidence: number | null, needsCorrection,
           correctedBy: string | null, correctedAt: ISO | null }]
```

Fields are explicitly projected recognised eight-slot candidates from that same case/document. Unknown confidence stays null; no fake 0.9/1.0, boxes, IDs, values or documentType supplied by a client. Do not invent missing fields or include unrelated claim/patient metadata. Incomplete fields remain available for human correction; frozen envelopes may be unresolved.

When persisted grouping is stale because a referenced field was deleted or reprocessed, retain the private historical grouping/audit but project only structurally valid current-field groups (or `groups: []`) with mode STALE. Do not publish dead/cross-scope references as editable current groups. Every projected grouping field/reference must satisfy the current source scope.

Blocker/notice vocabulary: DOCUMENTS_MISSING, MULTIPLE_DOCUMENTS_UNSUPPORTED, GROUPING_CONFIRMATION_REQUIRED, GROUPING_STALE, GROUPING_INVALID, ITEM_LIMIT_EXCEEDED, EXTRACTION_INCOMPLETE, PAGE_COVERAGE_INCOMPLETE, FIELD_CORRECTION_REQUIRED, COMPARISON_MISMATCH, COMPARISON_INSUFFICIENT, CASE_NOT_REVIEWABLE, LEGACY_FINDINGS_STALE, UNSUPPORTED_LAYOUT. Use generic safe messages, not private stack traces. Grouping/case notices are separate from frozen Session 2 reason codes.

`canVerify` requires a reviewable case (NEEDS_REVIEW / NEEDS_CORRECTION), one pair, current human-confirmed row completeness for both medicine documents, supported complete extraction, complete coverage for all uploaded sources, no outstanding correction/uncertainty, and comparison CONSISTENT with no insufficient evidence. Client permissions are advisory only; POST rechecks everything. Allowed actions are [] for non-reviewers/non-reviewable cases; otherwise Return/Escalate, plus Verify only when eligible.

MISMATCH goes to correction/escalation, not an override Verify in this pilot. This is medicine-document consistency, not claim adjudication. Do not hide genuine differences to make a case pass.

## 4. PUT /cases/{caseId}/documents/{documentId}/medicine-groups

Staff correction roles only. Exact body:

```json
{"snapshotToken":"rs_<64hex>","observedItemCount":2,"completenessAttested":true,"groups":[{"anchorFieldId":"existing-field-id","fieldIds":["existing-field-id"]}]}
```

Reject extra keys and fake values/roles/IDs. Re-read the document/fields after access checks and validate all membership through the frozen adapter: anchors exist, name fields belong to that document/case, every recognised field is assigned exactly once, no competing slots, no shared fields and max three groups. `groups.length === observedItemCount`. Human attestation means the reviewer inspected the original document and counted all visible items; it does not authorise inventing missing OCR records or clearing correction flags.

Persist only validated references plus server actor/time, observed count and a server fingerprint of the source field set; raw private metadata may hold this record because document serializers already strip metadata. A changed/deleted/reprocessed field set makes prior grouping STALE until reconfirmed. No explicit true correction flag is cleared automatically. Claim grouping is rejected. Unknown/omitted rows or a known detection count exceeding represented groups must remain blocked. Missing fields require a better source/correction, not fake OCR injection.

Return the new full snapshot. Append an immutable GROUPING_CONFIRMED event with actor and reference/version information, not patient text. Invalidate prior review readiness, not immutable review/audit history.

## 5. Freshness and human decision contract

Extend existing POST /cases/{caseId}/reviews with required `snapshotToken` alongside action/legacy decision, reasonCode, notes, optional same-case evidenceItemIds. Recheck role, case access, reviewable lifecycle, and fresh current snapshot before writing. Legacy APPROVE maps to the same Verify gate and cannot bypass it. Reject unknown keys/forged evidence IDs. Require meaningful bounded reviewer notes (10..2000 trimmed characters) and bounded reasonCode (1..80).

Existing PATCH /cases/{caseId}/extracted-fields/{fieldId} also requires `{ normalizedValue, snapshotToken }`. Bind correction to the snapshot the staff member actually saw; do not fetch a new token silently immediately before overwriting an old edit. Reject stale edits with 409 and preserve raw OCR. GPT updates that client in this checkpoint.

Missing/malformed token: 400 INVALID_SNAPSHOT_TOKEN. Stale token after any document/field/group/process change: 409 STALE_REVIEW_SNAPSHOT. Ineligible Verify: 409 REVIEW_BLOCKED. Include safe machine code plus message/problem detail in controlled errors. Return/Escalate remain available on current blocked snapshots for reviewable cases; they also require a fresh token and accountable notes.

Use a deterministic server fingerprint of current case/revision, document set/content/coverage/processing state, fields/correction markers, confirmed grouping and frozen ruleset/catalogue version. Exclude request timestamps/order. Add a durable `evidenceRevision` (default 0) and invalidate readiness before evidence-changing mutations. GET must not write or increase revision. Record the reviewed token/revision in decision audit metadata without overwriting prior decisions.

Serialise source mutation, snapshot generation and review within a per-case single-process guard, and use a revision/status conditional update for final review. A busy case returns controlled 409 CASE_BUSY rather than racing or hanging. Apply the same guard/revision policy to upload, correction, grouping and processing; re-read the case inside the guard and always release on errors. Source mutation must never leave a finalised case silently verified against changed data. This is a single-backend-instance pilot; do not claim distributed transaction guarantees. Production multi-instance/atomic audit persistence remains a separate release gate.

## 6. Real OCR/grouping and legacy findings

Add a conservative local row extractor for **printed English, explicit medicine-row layouts**, up to three items/document with the existing three-page/file/pixel limits. It operates only on real local OCR lines and retains actual page/line coordinates. Emit a server-only row key for candidates, persist it in ExtractedField, and propose groups from those keys. Do not infer medicine identity, missing units/pack counts, prescription totals from dosage instructions or default confidence/coordinates.

Supported row fields are the frozen eight slots when explicitly printed. Quantity/unit and pack count/unit require explicit source text. Multiple strengths/names on one unsupported row or excess/omitted rows must produce an honest extraction/grouping blocker, not first-row-only successful coverage. Preserve legitimate old single-row extraction as unconfirmed legacy input. Arbitrary handwritten/multilingual/complex table OCR is not promised.

Proposed groups require human completeness confirmation; never auto-confirm them. Existing true low-confidence/conflict flags require explicit field correction. Treat separate confirmed medicine rows as separate scope rather than global multi-page disagreement, but do not erase a real within-item conflict. Preserve raw OCR and prior audit.

Connect processing to the new snapshot/matcher. Do not continue using first-field-per-document medicine comparison or resolution for grouped cases. Produce current item-level evidence/check summaries from the accepted reconciliation. Keep claim metadata separate; do not require medicine_name in a claim form. Cached legacy explanation/check/risk output must not be presented as current after a correction/grouping change; invalidate/mark it and generate a local grounded comparison summary. Processing still ends NEEDS_REVIEW/NEEDS_CORRECTION, never VERIFIED/REJECTED. Preserve immutable source/review/audit records.

## 7. Acceptance

Builder HTTP integration tests use the guarded exact local disposable DB `mongodb://127.0.0.1:27017/pharmavault_integration_v2_test`, NODE_ENV=test, synthetic fixture actors/data. Never run cleanup against the development DB or loosen the guard. Use a unique temp storage root where needed. Explicitly report mocked OCR vs real printed-file coverage; do not label mocked fields as successful OCR.

Required checks: unauthenticated 401; same-case reads; other patient/tenant opaque404; evaluator/tenantless failures; patient cannot group/correct/review or spoof roles; one..three trusted groups persist; duplicate/cross-document/injected values rejected; stale grouping/token blocked; field correction changes fingerprint; old VERIFY rejected; incomplete pages/unknown pack/mismatch/unconfirmed grouping cannot Verify; fresh eligible human action creates review/audit; Return/Escalate still work; legacy APPROVE cannot bypass; closed/finalised evidence cannot mutate; guard failure cleanup/busy path; GET causes no writes; storage identifiers never leak; multiple docs do not auto-select; same-case evidence references validated. Keep all accepted Session 1/2 regressions intact.

GPT builds client-side stale-response protection, grouping UI, proper source opening, field-confidence/status alignment and a snapshot-bound review modal. API/DB acceptance is pending until the actual backend handoff is inspected; mocks/rendering alone do not close Session 3. If the timebox runs out, report PARTIAL and list the exact remaining gates rather than claim a complete workflow.
