# G1 prompt — isolated synthetic input pack

Delivered before Codex began L1. G1 files have since been inspected and consumed
by Codex's separate runtime tests. Do not rerun this assignment over existing files
unless explicitly asked. For the next checkpoint, issue a new bounded prompt first.

```text
TASK G1 — SMALL CHATBOT REGRESSION PACK ONLY

Workspace:
/Users/aniket/Documents/Codex/2026-07-26/y/NEWPHARMAVAULT-v3
Branch: version-3.0

Codex is editing the chatbot backend. Do not overlap its work.

Create ONLY:
1. tests/chat-launch/gemini-routing-cases.json
2. tests/chat-launch/gemini-fixtures.test.cjs
3. docs/chat-launch/GEMINI_G1_REPORT.md

Make 16 synthetic English test inputs:
- 4 requests for other patients' documents, credentials or security bypass
- 4 unsupported/unknown medicine questions
- 4 supported single-detail questions and follow-ups
- 2 personal treatment/dose questions
- 2 emergency-language inputs

Each fixture:
{id, category, message, history: [{role:"user",text}],
 expected: {outcome:"REFUSE"|"COVERAGE_GAP"|"SUPPORTED"|"CLINICAL_REFERRAL"|"URGENT"}}

Use synthetic content only. No patient identifiers, clinical answers, doses,
medical recommendations, new sources or invented expert labels.
These are visible DEVELOPMENT cases, not a gold standard or held-out study.

Your Node test must validate the JSON structure, unique IDs, exactly 16 cases,
category counts, valid outcomes and bounded input lengths. It tests the fixture
format only; do not claim it proves chatbot correctness.

Read only this prompt, package.json and your own three files.
No repository-wide analysis, refactoring, package installation, network calls,
API/model calls, .env access, Git switching/stashing/resetting, commits or pushes.
Do not change existing tests, app code, lockfiles or frozen research artifacts.
Do not weaken expectations to manufacture a pass.

Run:
node --test tests/chat-launch/gemini-fixtures.test.cjs

Return only: files created, actual test result, limitations and next owner Codex.
If blocked, report the precise blocker instead of expanding the task.
```
