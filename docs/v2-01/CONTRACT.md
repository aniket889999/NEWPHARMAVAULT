# V2-01: Acceptance and public-provider readiness

Baseline: a9ffca1. Branch: feature/v2-01-readiness. This is P0, not completion of every V2 feature.

## Ownership

- GPT: production readiness service, existing chat route integration, frontend readiness presentation, public-only diagnostic, independent tests and CI integration.
- External Gemini: new isolated browser acceptance package under tests/v2-01/browser/ and docs/v2-01/GEMINI_REPORT.md only.
- Neither owner changes the frozen Session 1/2/4 implementations, published research data/results or old evaluated protocols. Do not concurrently edit package.json, root lock files, app.js or shared source files.
- Git commits/publication and syncing reviewed files to the original Downloads workspace belong to GPT. Gemini must not switch branches, stage, commit, push or clean another owner's files.

## Compatible status extension

GET /api/v1/chat/status remains protected by the existing app authentication/tenant middleware. Keep its current fields; add providerReadiness. Status reads never contact Google, load an environment file or enable export. Cache-Control is private, no-store.

providerReadiness schemaVersion is chat-provider-readiness/1.0.0:

- state: LOCAL_ONLY | MISCONFIGURED | CONFIGURED_UNVERIFIED | VERIFIED_RECENTLY | DEGRADED.
- reasonCode: GENERATION_DISABLED | PUBLIC_EXPORT_NOT_ALLOWED | MISSING_CREDENTIAL | INVALID_MODEL | NOT_CHECKED | CHECK_EXPIRED | LIVE_RESPONSE_VALIDATED | PROVIDER_RATE_LIMIT | PROVIDER_UNAVAILABLE | PROVIDER_TIMEOUT | ANSWER_VALIDATION_FAILED.
- configured: boolean. Legacy generationEnabled means configuration eligibility, not proven availability.
- model: safe model identifier or null. Never echo unvalidated configuration strings.
- checkedAt, lastSuccessAt, expiresAt: ISO timestamps or null.
- liveProviderVerified: true only for an unexpired observed successful public generation, never a flag/configuration check.
- verificationScope: NONE | PUBLIC_REFERENCE_GENERATION. This never attests clinical accuracy, privacy compliance, embedding availability or private-case answer correctness.
- privateCasePolicy: LOCAL_ONLY; statusDoesNotProbe: true.

Public permission requires both RAG_CHAT_LLM_ENABLED=true and RAG_CHAT_PUBLIC_EXPORT_ALLOWED=true plus a usable credential/model configuration. Private case answers remain local regardless of those flags.

Runtime readiness observes only results from the existing public conversational pipeline. A successful, citation-validated GEMINI_RAG result can establish recent verification. A recognized provider/answer-validation fallback marks degraded. Greetings, refusals, clarification, local-only requests, private cases and client cancellation do not establish successful provider operation. Configuration changes invalidate earlier observations; observations expire after five minutes. No raw query, reply, API key, patient context, upstream response/error body or receipt is stored in readiness.

An optional local CLI diagnostic is separate from the server's in-memory observation. Default is configuration-only, zero network. A live public probe requires explicit opt-in, at most one bounded generation request, no embedding request/retry, only the packaged human-review public passage and built-in educational question. Never load normal private cases or claim an HTTP/browser acceptance pass from a direct adapter probe. Never auto-enable public generation in the normal local launcher.

## Browser acceptance scope assigned to Gemini

Use the real application and authorization middleware, guarded loopback MongoDB and run-scoped synthetic actors/documents. Test patient, same-tenant reviewer and outsider. No normal .env, normal database, real patient document, external AI, email or payment call. Explicitly disable all external AI/export flags.

Parallel database ownership: Gemini browser fixtures use pharmavault_integration_v2_test; GPT readiness fixtures use pharmavault_smoke_test. These remain disposable allow-listed targets, and all cleanup must still be scoped to owned records. Do not run broad legacy suites while either owner's fixture is active.

Required scenarios:

1. Patient login, prominent Evidence Chat and Verification Cases entry points, logout/private-conversation clearing.
2. Create a case through the UI and upload a clearly watermarked synthetic printed-English prescription and pharmacy invoice. The claim form is optional for this base workflow.
3. Run actual local OCR when locally provisioned; otherwise mark real OCR acceptance BLOCKED/SKIPPED, not PASS. Deterministically seeded extraction is allowed only as a separate labelled UI fixture, not an OCR demonstration.
4. Patient cannot perform staff corrections/grouping/review actions. Same-tenant staff can inspect source and perform permitted corrections/group confirmation.
5. Scoped chat asks for medicine clarification, then returns exact document/page/field evidence; all additional cited sources remain accessible.
6. A dependent correction marks affected historical answers stale. An unrelated change does not falsely invalidate the same answer. Old text remains history.
7. Review uses the current snapshot token; missing coverage/mismatches block inappropriate VERIFY. A stale token cannot silently finalize a case.
8. Outsider/cross-tenant access is denied opaquely; data from another case cannot enter the selected one.
9. Cancelled/failed upload has an actionable error and does not masquerade as a processed document.
10. Public local-only status says local/unverified, not live Gemini success. Private scope never displays a public-provider success as a private case guarantee.

Browser interaction must use an authorized browser interface available in your environment. If a browser runner/dependency is unavailable, report it and keep actual browser acceptance open. HTTP-only/SSR/source-text checks do not count as full browser checks.

## Evidence and release gate

Report actual executed commands, results, skips, environment boundary and screenshots/artifact paths. Scope cleanup to this run's owned synthetic records and temporary directory, using the existing test database guard. Never deleteMany({}) or reset a worktree for convenience. Do not run broad legacy cleanup suites concurrently with another owner's active fixture.

GPT's independent readiness acceptance can close before Gemini's browser report; V2-01 as a whole cannot be marked PASS until both appropriate gates have evidence. Live-provider verification remains explicitly not run or blocked unless a real approved request succeeds. No new clinical/OCR accuracy, research novelty percentage or held-out improvement is inferred from passing tests.
