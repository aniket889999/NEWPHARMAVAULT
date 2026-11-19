# Chatbot launch-readiness delivery plan

18 November 2026. Working branch: `version-3.0`, starting at `92cffb3`.
This plan advances an educational/document-evidence assistant. It is not approval
to diagnose, prescribe, handle real patient data, decide insurance claims or launch
publicly. Clinical and privacy acceptance cannot be supplied by coding agents.

## Work split and order

| Checkpoint | Codex / Aniket (implementation and integration) | Gemini (small isolated handoff) | Exit evidence |
|---|---|---|---|
| L1: request boundaries and focused answers | Explicit private-data/credential/bypass refusals; unknown-name coverage; precise uses selection; actual JSON/SSE and authorization regressions | G1: 16 visible synthetic input fixtures and format validation only | Offline + guarded HTTP tests, strict build, live local smoke; no external provider calls |
| L2: governed knowledge | Approved-source ingestion/versioning, review/withdrawal controls, explicit coverage and expiry policy; evaluate semantic retrieval before adding it | Small candidate-source metadata packet, only after a separate prompt; no automatic promotion | Actual source/license checks and qualified pharmacist approval; preserve source jurisdiction |
| L3: contextual generation and evaluation | Bounded public-only generation, claim-level support evaluation, omissions/contradictions/refusals; case context stays local | Bounded failure-case annotation assistance; not expert medical labels | Frozen independent test families, blinded professional review and documented accuracy/safety targets before release |
| L4: reliability and privacy | Durable receipts/jobs, shared-state/fault testing, observability without PHI, budgets, deletion/export, recovery and access lifecycle | One focused UI/accessibility or offline test task at a time | Failure/load evidence, privacy/security review, tested backup restoration and same-origin HTTPS staging |
| L5: supervised pilot decision | Resolve reviewed blockers, release manifest, rollback drill, monitoring and user guidance | Reproduce a bounded acceptance checklist | Qualified clinical, security, privacy and business owners approve a precisely limited pilot; no automatic public launch |

Send Gemini's prompt **before** Codex begins each corresponding checkpoint. Its
ownership is limited to the exact files in that prompt. A Gemini completion report
is input to independent inspection, not acceptance. Do not repeatedly scan the
repository or let two agents edit the same files. No new dependencies, models,
paid calls, patient-data exports or deployment permissions are implicit.

## L1 ownership

Codex owns the new `chatLaunchBoundaryService.js`, modifications to
`contextualChatService.js`, `chatQuestionService.js`, `preciseAnswerService.js`,
the additive `NONE` retrieval DTO value, `tests/chat-launch/boundary.*.test.cjs`,
the independent G1 runtime consumer, and this plan/checkpoint. Merged local-only
cookie/rate-limit relaxations must be restricted to explicit development mode;
production and unknown environments retain conservative defaults.
Frozen research implementations, source snapshots,
trained reranker weights and held-out artifacts must stay unchanged.

Gemini owns only `tests/chat-launch/gemini-routing-cases.json`,
`tests/chat-launch/gemini-fixtures.test.cjs` and `GEMINI_G1_REPORT.md` in this folder.
G1 validates fixture **format**, not runtime, medical correctness or a gold set.
Codex will run its inputs separately against the implementation after inspection.

## Release boundaries that stay in force

- No unrestricted web browsing, model-chosen URLs or arbitrary query export.
- Never infer an unknown drug's identity by fuzzy spelling or known-name suffixes.
- No clinical source expansion without provenance, licensing and qualified review.
- No automatic learning from user feedback or fabricated expert/gold labels.
- Citations establish traceability, not semantic truth or clinical confidence.
- Personal treatment decisions and urgent situations are not automated services.
- Patient/case access remains server-authorized, even for a harmless refusal.
- Test fixture code and broad seed scripts must never target a normal database.
- Current source and credentials are not permission to make paid API calls.
- Earlier container/test results do not certify this changed merged composition.

## Definition of done

Every checkpoint records exact changed files, commands, actual pass/fail/skip
counts, API deltas, observed examples and remaining limits. Functional checks are
separate from clinical grading, live-provider acceptance and operational release.
Do not advertise GPT/Claude superiority, universal medicine coverage, complete
prompt-injection prevention or a novelty percentage without corresponding evidence.
