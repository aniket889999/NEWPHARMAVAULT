# Supervised Pilot Runbook (G3)

**Pilot Authorization Status**: `PENDING` — No pilot or public launch is authorized until all named human owners sign off below.

## 1. Synthetic-First Pilot Staging Policy
- **Phase 0 (Current)**: Local/staging execution using **synthetic watermarked documents and synthetic accounts only** (`SYNTHETIC DEMO ONLY`).
- **Egress Posture**: Private case evidence remains strictly local (`TRUSTRAG_LLM_ENABLED=false`, `TRUSTRAG_LLM_EXPORT_ALLOWED=false`); public external generation remains disabled unless separately approved.

## 2. Accountable Human Owners (All Approvals `PENDING`)
- **Clinical & Source Governance Owner**: `[Name / Registration: ___________]` — Approval: `PENDING`
- **Security & Infrastructure Owner**: `[Name / Role: ___________]` — Approval: `PENDING`
- **Privacy & Legal Owner**: `[Name / Role: ___________]` — Approval: `PENDING`
- **Operations & Release Owner**: `[Name / Role: ___________]` — Approval: `PENDING`

## 3. Pilot Entry & Stop Criteria
- **Entry Criteria**: All L1–L5 gates in `docs/chat-launch/PLAN.md` closed; `SOURCE_REVIEW_REGISTER.csv` approved by a qualified pharmacist; blinded evaluation rubric thresholds met; security and privacy checklists signed.
- **Immediate Stop / Kill-Switch Triggers**:
  1. Any cross-tenant or cross-patient data exposure (`404`/`403` boundary failure).
  2. Any private case content transmitted to an external API or logged in plaintext.
  3. Any missed emergency escalation (`URGENT`) or fabricated clinical dosing/treatment instruction.
  4. Any stale or unconfirmed snapshot permitting `VERIFY` on mismatched case evidence.

## 4. Incident Escalation & Rollback Procedure
1. **Contain**: Immediately disable `/api/v1/chat` and `/api/v1/cases/:caseId/assistant` routes or set external provider/export flags to `false`.
2. **Rollback**: Revert deployment to the last signed baseline commit and invalidate active web/API sessions by incrementing `sessionVersion` or rotating `JWT_SECRET`.
3. **Preserve Evidence**: Snapshot audit trail metadata and error codes without copying raw private documents into issue trackers.
4. **Post-Incident Review**: Require written root-cause analysis and re-approval by Clinical, Security, and Privacy owners before resuming.
