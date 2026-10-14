# Current State of PharmaVault Prototype

## Current acceptance boundary — 14 October 2026

The detailed sections below retain historical work-order reports. Current acceptance status is maintained in `UPGRADE_CHECKPOINTS.md`, `U4_U5_HANDOFF.md` and `PUBLICATION_VALIDATION.md`. Real U5 OCR currently extracts zero fields; U3 fixes are pending. U4 source/policy checks pass but device/Xcode testing is unrun. PDF/container/standards acceptance is incomplete. Do not treat historical mocked results, legacy sample metrics or an IMPLEMENTED label as an end-to-end acceptance pass.

This document outlines the current state of the PharmaVault prototype as of Work Order 4A (Local Image OCR for TrustRAG). It provides an honest accounting of implemented capabilities, deferred modules, and security safeguards.

## Document Intake & OCR Status

- **Secure Real-File Intake**: **IMPLEMENTED**
  - Accepts real user file bytes via `FileReader.readAsDataURL()` across PDF, PNG, JPEG, and WEBP formats.
  - Strict 5 MiB size enforcement (`MAX_FILE_BYTES = 5,242,880`).
  - Server-side pre-decode base64 validation and binary magic-byte inspection (PDF `%PDF-`, PNG `89 50 4E 47`, JPEG `FF D8 FF`, WEBP `RIFF...WEBP`).
  - Stored outside MongoDB in isolated sandbox (`ADR-002`); zero local filesystem paths leaked to clients.
  - Quick Synthetic Fill is strictly a development fixture (`import.meta.env.DEV === true`) and dead-code eliminated in production builds.

- **Local Image OCR Engine (Work Orders 4A & 4A.1)**: **IMPLEMENTED (SERVER-SIDE)**
  - Dedicated provider architecture under `backend/services/trustRag/`:
    - `ocrProvider.js`: Base provider contract.
    - `tesseractOcrProvider.js`: Server-side native Tesseract OCR engine for English text with worker lifecycle management.
    - `mockOcrProvider.js`: Deterministic test provider for internal test setup only; public backdoors prohibited.
    - `localOcrService.js`: High-level coordination, single-document mutex queue, timeout protection, and conservative candidate field extraction.
  - **Local Language Data Provisioning**: Tesseract language data must be provisioned locally via `TRUSTRAG_TESSDATA_PATH`. Remote language-data URLs and runtime downloads are prohibited and blocked. Missing local language data returns a controlled 503 error; fake extraction is never used as fallback.
  - **Worker Lifecycle & Concurrency**: OCR timeout terminates the native worker process and keeps the OCR mutex locked until worker termination finishes, preventing concurrent worker resource exhaustion.
  - **Client-Controlled Extraction Prohibited**:
    - The document upload endpoint strictly rejects client-injected fields (`sampleFields`, `lowConfidence`, or unknown extraction options) with HTTP 400.
    - The case processing endpoint (`POST /cases/:caseId/process`) rejects request-body options with HTTP 400.
    - Document metadata is never merged into extractor options.
    - Zero fake fallback fields are generated if OCR produces no text or fails.
  - Actual OCR output parsed: text, line and word confidences, and normalized bounding boxes `[x_min, y_min, x_max, y_max]` in 0–1 space.
  - Conservative rule & regex candidate extraction for:
    - `medicine_name` (matched against canonical medicine model and common drug patterns)
    - `dosage_strength` (e.g. `500 mg`, `500mg`)
    - `quantity` (e.g. `10 tablets`, `Qty: 10`)
    - `date` (`prescription_date`, `invoice_date`, `claim_date`)
    - `amount` (`total_amount`, `claimed_amount`)
    - `prescriber_name` / `pharmacy_name`
  - Unresolvable medicines and candidates with confidence < 0.75 are flagged with `needsCorrection: true`.
  - Zero external AI calls: Raw documents, OCR text, and patient data are never sent to Gemini or external LLMs.
  - Operational logs are sanitized: raw OCR text, tokens, and patient data are strictly forbidden from logs.

- **Deterministic Prototype Extraction Fallback**: **REMOVED AS FALLBACK FOR IMAGE OCR**
  - When image OCR fails or produces no text, the system produces a controlled error and never invents synthetic fields.

- **PDF OCR & Rasterization**: **PLANNED**
  - PDF files are securely validated and stored in physical storage, but are not falsely processed as image OCR.
  - PDFs receive an honest `PDF_OCR_PENDING_RASTERIZATION` processing status with metadata message: `"PDF OCR is pending rasterization support"`.
  - Frontend clearly displays: *"Image OCR is available in this MVP. PDF page rendering is the next planned module."*

## TrustRAG Pipeline & Human-in-the-Loop Review

- **Tri-Document Ingestion**: Prescription (Rx), Pharmacy Invoice, and Health Claim Form.
- **Explainable Medicine Identity Resolution (Work Order 5A)**: **IMPLEMENTED**
  - **Academic Boundary Safeguard**: Curated academic MVP catalogue only. Not a live CDSCO, NHCX, AB-PMJAY, or national medicine database. Zero web scraping, zero external LLMs, and zero live regulatory verification claims.
  - **Idempotent Explicit Seeder**:
    - Command: `npm run seed:catalogue` (backend script `node seeders/catalogueSeeder.js`).
    - Explicit, idempotent upsert of curated Indian pharmacy formulations (Paracetamol 500mg/650mg/120mg syrup, Metformin 500mg/850mg, Cetirizine 10mg/5mg syrup, Azithromycin 250mg/500mg, Pantoprazole 40mg/Pan-D capsule, Amoxicillin-Clavulanate 625mg/suspension, Atorvastatin 10mg/20mg, Losartan 50mg, Omeprazole 20mg).
    - Every catalogue entry includes: `brandName`, `genericName`, `strength`, `dosageForm`, `aliases`, `manufacturer`, `catalogueVersion: '2026.1-academic'`, and source note: *"Curated academic reference catalogue — not live regulatory verification."*
    - Zero silent runtime database insertions: runtime queries never invent database records.
  - **Explainable Match Result**:
    - Returns structured output: `{ resolved, ambiguous, matchScore, matchBasis, canonical, candidates, rawQuery, sourceNote, catalogueVersion }`.
    - Match bases: `Brand + Strength`, `Exact Brand Alias`, `Exact Generic`, `Partial Candidate`, `Weak OCR Text`, `None`.
    - Weak OCR text guard: queries with < 3 characters or non-letter gibberish are never auto-resolved (`matchBasis: 'Weak OCR Text'`, `matchScore: 0`, `needsCorrection: true`).
  - **Cross-Brand Generic Consistency**:
    - `consistencyCheckService.js` reads `resolution.canonical.genericName` from `resolutions['PRESCRIPTION']` and `resolutions['PHARMACY_INVOICE']`.
    - Cross-brand alignment: Two differing brand names (e.g. Crocin vs Dolo) resolving to the same generic active ingredient (`Paracetamol`) evaluate to `PASS`.
    - Separated Strength Check: `DOSAGE_STRENGTH_CONSISTENCY` runs independently. Same generic with different strengths (e.g. 500mg vs 650mg) fails with `HIGH` severity and raises `MEDICINE_STRENGTH_MISMATCH`.
    - Separated Dosage Form Check: `DOSAGE_FORM_CONSISTENCY` runs independently. Same generic with differing dosage forms (e.g. Tablet vs Syrup) produces `INCONCLUSIVE` requiring clinical review and raises `DOSAGE_FORM_DISCREPANCY`.
    - Honest Inconclusive & Unresolved Safeguards:
      - Unresolved or ambiguous medicine identity produces `INCONCLUSIVE` check status (`reviewRequired: true`) and raises `UNRESOLVED_MEDICINE_IDENTITY` risk signal.
      - An unresolved identity is NEVER called a `MEDICINE_NAME_MISMATCH` without conclusive evidence of conflicting active ingredients.
    - Grounded Evidence Citations: Evidence items explicitly state whether citations derive from OCR document evidence or the curated local academic medicine catalogue.
  - **Frontend Review Clarity**:
    - `ExtractedFieldsEditor` and `DocumentEvidenceViewer` show Generic Name, Brand Name, Strength, Dosage Form, Match Score, Match Basis, and the mandatory academic boundary disclaimer.
    - Ambiguous or unresolved items display a prominent *"Needs human confirmation"* badge.
    - Interactive candidate viewer allows reviewers to inspect ranked candidate formulations and prefill correction fields without automated unconfirmed changes.
- **Controlled Evidence Routing**: Routes across Private Case Data (Tier 4), Curated Medicine Knowledge (Tier 2), and Official Sources (Tier 1). Outbound live HTTP calls are disabled.
- **Explainability**: Grounded explanations citing exact EvidenceItem IDs.
- **Human-in-the-Loop Safeguard**: Automated approval is prohibited. Cases require human reviewer adjudication (`VERIFY`, `RETURN_FOR_CORRECTION`, `ESCALATE`).
- **Audit Trails**: Immutable `AuditEvent` logs recorded for all lifecycle events.

## Visual Evidence Reviewer & Secure Document Delivery (Work Orders 4B & 4B.1)

- **Secure Document-Content Endpoint & Storage Sanitization (WO 4B.1)**: **IMPLEMENTED**
  - Route: `GET /api/v1/cases/:caseId/documents/:documentId/content`
  - Authentication and tenant access control enforced; cross-tenant or invalid requests return an opaque HTTP 404 to block tenant enumeration.
  - Streams validated binary file bytes from secure disk storage without loading entire files into MongoDB.
  - Strict security headers applied:
    - `Content-Disposition: inline`
    - `X-Content-Type-Options: nosniff`
    - `Cache-Control: private, no-store`
    - Detected `Content-Type` and `Content-Length`
  - **Zero Storage Identifier Exposure (Work Order 4B.1)**:
    - `objectStorageKey`, `localPath`, and `storageRoot` are deleted during `Document` model `toJSON` and `toObject` serialization; never returned in `POST /cases/:caseId/documents`, `GET /cases/:caseId/documents`, or result payloads.
    - Frontend `DocumentItem` type decouples completely by eliminating `objectStorageKey`.
    - JSON Schema (`contracts/schemas/document.schema.json`) removes `objectStorageKey` from properties and required fields.
    - Controlled error sanitization: missing or inaccessible document content in `storageService.getDocumentBuffer` throws a generic error (`Document content is unavailable.`), ensuring filenames, storage keys, and disk paths are never exposed in responses or error stacks.
  - Dedicated rate limiter (`documentContentLimiter`, 120 req / 15 min).

- **DocumentEvidenceViewer Component**: **IMPLEMENTED**
  - Reusable reviewer component under `src/modules/verification/components/DocumentEvidenceViewer.tsx`.
  - Document selector for Prescription, Pharmacy Invoice, and Claim Form.
  - Protected binary content fetched via authenticated Axios client as a `Blob` (`responseType: 'blob'`).
  - Temporary browser Object URL generated and revoked on document switch and component unmount to prevent browser memory leaks.
  - Responsive image review canvas with zoom controls (+, -, reset) and normalized `[x_min, y_min, x_max, y_max]` bounding-box overlays.
  - Color-coded evidence states:
    - **Teal**: Verified / high confidence (`>= 0.75`).
    - **Amber**: Needs correction / low confidence (`< 0.75`).
    - **Red**: Connected to high-risk mismatch signals or failed consistency checks.
    - **Indigo**: Currently selected field.
  - Two-way sync: clicking field in list highlights box in image canvas; clicking box selects field and displays raw OCR value, normalized value, confidence score, extraction method, and correction status.
  - **Honest Coordinate Guarding**: Missing or `[0,0,0,0]` coordinates display *"Source location unavailable"* without rendering false highlights.
  - **Honest PDF Handling**: PDFs display a secure placeholder (*"PDF stored securely. Page rendering and PDF OCR are planned."*) with zero false highlights.
  - **Mandatory Reviewer Disclaimer**: *"OCR highlights are evidence aids. The reviewer validates the source document before making a decision."*
  - Fully keyboard-accessible controls with visible focus rings (`focus:ring-2 focus:ring-indigo-500`) and ARIA labels.

- **Case Detail Page Integration**: **IMPLEMENTED**
  - Dedicated `Document Evidence` tab in `CaseDetailPage.tsx`.
  - Evidence Cards include *"Inspect Document Evidence"* action when document references exist.
  - Risk Signal Cards include *"Inspect Source"* action linking directly to the source document evidence tab.
  - Human-in-the-Loop review workflow remains preserved and unaltered: `Verify` • `Return for Correction` • `Escalate`.

## Implemented Core Features
- React 18 + TypeScript frontend with role-based routing and Tailwind CSS.
- Express.js backend with tenant isolation, rate limiting, and JWT authentication.
- OpenAPI 3.1 specification (`contracts/openapi/pharmavault-trustrag-v1.yaml`) and Draft 2020-12 JSON schemas.
