# Copy into Gemini — Session 3 backend integration only

Project: `/Users/aniket/Downloads/PBL 5 TH SEM`.

Read `docs/integration-v2/SESSION_3_CONTRACT.md` fully, the accepted Session 1/2 contracts and both freeze JSON files. Verify their fingerprints before changes. Preserve the dirty checkout and local secrets/data.

Implement the backend files explicitly assigned to Gemini in that contract. Main deliverables:

1. Authorised read-only GET `/api/v1/cases/:caseId/reconciliation` returning the exact fresh snapshot wrapper.
2. Staff-only PUT `/cases/:caseId/documents/:documentId/medicine-groups`, validating existing server field IDs, completeness attestation and fresh token; persist/audit only safe references and server actor/time.
3. Snapshot-bound existing human-review POST. Missing/stale tokens and ineligible Verify fail closed; legacy APPROVE cannot bypass. Keep Return/Escalate usable with fresh accountable review. No automated final decision.
4. Per-case mutation guard, evidence revision and current field/document/group fingerprints; protect upload/correction/grouping/process/review and finalised cases without claiming distributed transaction safety. Existing field PATCH now requires the displayed `snapshotToken` with `normalizedValue`, rejecting stale edits with 409 (GPT updates the client).
5. Conservative printed-English local row extraction with real provenance, explicit units/counts and bounded proposed grouping. No guessed OCR fields, quantity inference, automatic grouping confirmation or silent row/page truncation.
6. Processing integration using the frozen matcher rather than first-field medicine checks; current evidence summaries and honest incomplete/legacy notices. Claim forms need no invented medicine lines.

Do not change the frozen Session 1/2 source/schema/catalogue/component files. GPT owns frontend, client types, independent tests and the other integration documentation. Do not edit those files or held-out gold. OpenAPI is yours for this checkpoint, limited to the declared endpoint/payload delta.

Use the exact guarded local disposable test DB specified in the contract; add only that exact name to the guard. No cleanup on dev data, package installation, .env/lockfile edits, outbound patient data, commit, push or deployment. If another file is needed, report the ownership delta instead of editing it silently.

Run focused unit and real-router/isolated-DB integration checks, accepted regressions, syntax and schema/OpenAPI validation. Separate mocked extraction from real OCR evidence. Return <=150 words: actual files/API delta, exact results, atomicity/OCR limitations, next owner GPT, commit none. Save details to `docs/integration-v2/GEMINI_SESSION_3_REPORT.md`. A partial result is acceptable; never weaken checks or fabricate completion to meet the timebox.
