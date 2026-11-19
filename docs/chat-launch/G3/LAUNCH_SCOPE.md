# PharmaVault Chatbot Launch Scope (G3)

**Status**: `NOT_CLINICALLY_APPROVED` — Documentation boundary only; not a clinical or production release approval.

## 1. Permitted Educational & Document-Evidence Scope
- **Public Reference Scope**: Short educational summaries from governed, versioned reference entries (`healthChatKnowledge.js` and `chatReferenceExtensions.js`) with explicit citation traceability.
- **Private Case Evidence Scope**: Deterministic, local-only reporting and cross-document comparison of extracted prescription and pharmacy invoice fields (`STRENGTH`, `QUANTITY`, `IDENTITY`, `COMPARISON`, `CASE_STATUS`) within an authorized user's verification case, backed by signed dependency-freshness receipts.

## 2. Explicit Exclusions (Out of Scope)
- No medical diagnosis, symptom triage, personal treatment selection, or individualized dosing recommendations.
- No therapeutic substitution approval, drug-interaction clearance, or off-label prescribing advice.
- No automated insurance claim adjudication, reimbursement approval, or fraud verdicts.
- No emergency medical dispatch or urgent clinical care (urgent inputs must trigger immediate emergency referral).
- No inference of unknown medicine identities via fuzzy spelling or suffix matching.
- No export of private verification-case documents or patient context to external LLMs or web search providers.

## 3. Intended Users & Human Responsibilities
- **Patients / Submitters**: Read-only access to their own verification cases and public educational summaries; must consult a qualified clinician or pharmacist for personal medical decisions.
- **Authorized Staff (Pharmacists / Claims Reviewers)**: Inspect original uploaded document images/PDFs, verify OCR bounding boxes, confirm or correct extracted fields, attest medicine-row grouping completeness, and record accountable human verification decisions.
- **Clinical & Governance Owners**: Review, license-verify, approve, or withdraw every public medical reference passage before pilot exposure.

## 4. Launch-Blocking Decisions (All Pending Human Sign-Off)
1. **Qualified Clinical Sign-Off (`PENDING`)**: Pharmacist/clinical owner approval of every entry in `SOURCE_REVIEW_REGISTER.csv` and target jurisdiction alignment.
2. **Blinded Evaluation Gate (`PENDING`)**: Independent clinician grading on a frozen family-disjoint evaluation split meeting pre-specified factual support, completeness, refusal, and safety thresholds.
3. **Security & Session Architecture (`PENDING`)**: MFA recovery workflow, multi-instance distributed locking/rate-limiting, and independent penetration testing (`SECURITY_ACCEPTANCE.md`).
4. **Privacy & Legal Governance (`PENDING`)**: Consent, retention, deletion/export, processor DPAs, and breach response sign-off (`PRIVACY_DECISIONS.md`).
5. **Supervised Pilot Authorization (`PENDING`)**: Named clinical, security, privacy, and operations owner sign-off (`PILOT_RUNBOOK.md`).
