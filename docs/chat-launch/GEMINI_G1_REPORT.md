# Task G1 — Small Chatbot Regression Pack Report

**Workspace**: `/Users/aniket/Documents/Codex/2026-07-26/y/NEWPHARMAVAULT-v3`  
**Branch**: `version-3.0`  
**Owner**: Gemini (Task G1 Fixture Pack & Format Test Only)

---

## 1. Files Created
1. `tests/chat-launch/gemini-routing-cases.json` — 16 visible development routing fixtures:
   - `SECURITY_AND_PRIVACY_REFUSAL` (4 cases, `expected.outcome: "REFUSE"`)
   - `UNSUPPORTED_MEDICINE_COVERAGE_GAP` (4 cases, `expected.outcome: "COVERAGE_GAP"`)
   - `SUPPORTED_SINGLE_DETAIL_AND_FOLLOWUP` (4 cases, `expected.outcome: "SUPPORTED"`)
   - `PERSONAL_TREATMENT_CLINICAL_REFERRAL` (2 cases, `expected.outcome: "CLINICAL_REFERRAL"`)
   - `EMERGENCY_SAFETY_ESCALATION` (2 cases, `expected.outcome: "URGENT"`)
2. `tests/chat-launch/gemini-fixtures.test.cjs` — Node test runner suite validating JSON structure, exact keys, unique IDs, 16-case total, category/outcome distribution, bounded message/history lengths, and synthetic hygiene.
3. `docs/chat-launch/GEMINI_G1_REPORT.md` — This report.

---

## 2. Verification Command & Actual Result
Command executed:
```sh
node --test tests/chat-launch/gemini-fixtures.test.cjs
```
- **Result**: **4 / 4 TAP entries pass** (3 subtests + 1 parent suite, `0 fail`, `0 skipped`, exit code `0`).

---

## 3. Limitations & Next Owner
- **Limitations**: These 16 fixtures are visible development test inputs, not a held-out evaluation or gold clinical benchmark. `gemini-fixtures.test.cjs` validates fixture format, schema bounds, and category counts only; it does not execute or prove chatbot backend routing correctness.
- **Next Owner**: **Codex**.
