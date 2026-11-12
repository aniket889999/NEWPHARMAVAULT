# Copy into Gemini — Session 2 backend matching and quantity checks

Project: `/Users/aniket/Downloads/PBL 5 TH SEM`, not the old NEWPHARMAVAULT copy.

Read `docs/reconciliation-v2/SESSION_2_CONTRACT.md`, the GPT-owned `contracts/schemas/medicine-reconciliation.schema.json`, and `docs/foundation-v2/SESSION_1_ACCEPTED_CONTRACT.md` fully. Verify Session 1 frozen fingerprints first. Preserve the dirty worktree and existing local data/secrets.

Implement only the two pure offline services, builder tests/development fixtures and report assigned to Gemini in the contract. The main export is `reconcileMedicineDocuments({ caseId, prescription, invoice, catalogue })`; quantity helper is `normalizeItemQuantity(item)`. Inputs are authorised server envelopes, not client grouping/identity assertions.

Build conservative one-to-one, order-independent medicine matching and explicit administrative quantity normalisation. Use exact academic catalogue families/aliases; retain strength/form/release distinctions and ambiguity. Never infer missing pack size, quantities from dosage instructions, therapeutic substitution or claim eligibility. Missing pages/documents must not become confirmed missing billed items. Preserve confirmed mismatch plus uncertainty together.

Return the exact GPT-owned result schema with source field references, row counts, reason codes, coverage and mandatory human-decision boundary. Do not invent a different DTO or edit the shared schema; report a proposed delta if necessary. Retain the frozen Foundation adapter unchanged.

GPT owns the shared result schema, standalone comparison UI, consumer types, independent tests and documentation except your report. Do not edit those files. Do not inspect held-out labels or change locked benchmark data. No routes/models/controllers/orchestrator/API wiring, existing frontend/shared types, OpenAPI, dependencies, environment changes, database writes, live model/network calls, commits, pushes or deployment.

Use the existing dependencies. Validate actual result instances (including negative/tampered examples), not just schema compilation. Run your two backend suites, Foundation regression checks, schema validation and syntax checks. Run GPT's backend acceptance suite if available; never edit it to obtain a pass.

Keep the scope bounded: quantity maths and matching only. OCR grouping/persistence and live API/UI wiring remain later work. Save your detailed report to `docs/reconciliation-v2/GEMINI_SESSION_2_REPORT.md`; return <=150 words with exact files/interface delta, actual counts, remaining limitations, next owner GPT and commit none.
