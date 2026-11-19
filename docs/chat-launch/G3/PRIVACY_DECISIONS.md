# Privacy Governance Decision Template (G3)

**Status**: `DECISION_TEMPLATE_ONLY` — Not legal advice, privacy certification, or an assertion about any deployed environment. All decisions require qualified privacy/legal owner sign-off (`PENDING`).

## 1. Required Privacy Decisions Before Pilot
| Decision Area | Required Policy Decision | Accountable Owner | Status |
|---|---|---|---|
| **1. User Notice & Consent** | Define explicit pre-use notice and consent capture distinguishing public educational reference chat from private verification-case processing. | Privacy / Legal Owner | `PENDING` |
| **2. Data Minimization & Scope** | Confirm whether pilot cases use strictly synthetic documents or de-identified records; prohibit real patient PHI until legal sign-off. | Clinical & Privacy Owners | `PENDING` |
| **3. Retention Schedules** | Set maximum retention TTLs for uploaded documents, extracted fields, audit events, and ephemeral session artifacts. | Data Governance Owner | `PENDING` |
| **4. Deletion & Subject Export** | Define verified workflows and SLAs for user-requested case deletion, storage blob purging, and data export. | Engineering & Privacy Owners | `PENDING` |
| **5. Encryption at Rest & in Transit** | Specify KMS/disk encryption standards for document storage and MongoDB volumes, plus mandatory TLS 1.2+/1.3 in staging/pilot. | Security & Infra Owners | `PENDING` |
| **6. Observability & Log Redaction** | Enforce zero-PHI logging policy (no raw OCR text, patient names, chat prompts, JWTs, or receipts in application/access logs). | Security & Engineering Owners | `PENDING` |
| **7. External Processors & Egress** | Keep private case evidence 100% local (`LOCAL_ONLY`); document whether any public-only LLM/web provider is permitted and under what DPA. | Legal & Security Owners | `PENDING` |
| **8. Access Control & Audit Review** | Define periodic review cadence for tenant isolation, staff role provisioning, and immutable `AuditEvent` access logs. | Org Admin / Security Owner | `PENDING` |
| **9. Breach Notification & Response** | Establish incident classification thresholds, regulatory notification timelines, and affected-party communication templates. | Legal & Incident Commander | `PENDING` |

## 2. Explicit Non-Assertions
- This document does not certify compliance with DPDP Act, HIPAA, GDPR, NHCX, or any other regulatory framework.
- No production environment, external processor agreement, backup encryption, or automated retention purge is claimed to be deployed by this template.
