# L1 — bounded request safety and answer focus

18 November 2026. Base: `version-3.0` / `92cffb3`. Status: **bounded functional
checks PASS; launch gates OPEN**. Changes are local and have not been committed or
pushed by this checkpoint. This does not claim a public medical release.

## What changed

- Added `chatLaunchBoundaryService.js` with explicit refusal wording for requests
  for another person's/tenant's records, credentials or access-control bypasses.
  NFKC/zero-width normalization covers some simple text obfuscations, not every
  injection or language. Database authorization is still the actual access control.
- `contextualChatService.js` checks urgent language and access boundaries before
  public retrieval/model/web tools. A selected case is still authorized before
  returning either a refusal or urgent response; outsiders keep an opaque 404.
  Ordinary private-case evidence stays owned by the existing frozen implementation.
- Unsupported names in bounded explicit medicine/reference question frames now
  produce `UNSUPPORTED_MEDICINE_REFERENCE`, no sources and missing-evidence status.
  No fuzzy identity guesses, raw name export, new medical facts or arbitrary URLs.
- Tightened uses matching in `chatQuestionService.js`: “used correctly” and “seek
  medical help” no longer count as indications. `preciseAnswerService.js` retains
  a suitable source caveat without attaching a separate side-effect passage to the
  demonstrated uses query. This remains lexical selection, not semantic proof.
- `pharmacyChatPolicy.js` also recognizes explicit personal treatment/dose-schedule
  requests as a professional-referral boundary.
- Added `NONE` to the client retrieval-method DTO for pre-retrieval boundary results.
  No endpoint, clinical-confidence score, medicine recommendation or claim decision
  was added. Reason-code additions are `PRIVATE_DATA_ACCESS_DENIED`,
  `CREDENTIAL_REQUEST_DENIED`, `SECURITY_BYPASS_DENIED` and
  `UNSUPPORTED_MEDICINE_REFERENCE`.
- Broader regression exposed merged development relaxations applying to every
  non-production environment. `browserSession.js` now uses Lax only in explicit
  development; other environments default to Strict (production also Secure).
  `rateLimiter.js` similarly keeps the 200-request local-development sign-in budget
  only in explicit development, with the conservative 10 default elsewhere.
  Existing assertions were not weakened to accept the regressions.

## Ownership and files

Codex modified the six backend files listed above plus `src/types/index.ts`, and
added `tests/chat-launch/boundary.acceptance.test.cjs`, `boundary.http.test.cjs`,
`gemini-consumer.test.cjs`, this checkpoint, the saved G1 prompt and `PLAN.md`.

Gemini created exactly its three assigned G1 files: 16 visible synthetic inputs,
their format test and its report. Codex read those files, ran the format test and
independently executed all 16 inputs against the implementation. The cases exposed
additional question phrasings and dose-schedule handling, now covered without
changing their expected outcomes. They are development data, not unseen/expert
medical evidence. Do not merge G1's format count with a clinical-accuracy score.

## Actual verification

```sh
node --test --test-timeout=30000 tests/chat-launch/*.test.cjs \
  tests/contextual-chat/*.test.cjs \
  backend/tests/chatRag.test.js backend/tests/conversationalRag.test.js \
  backend/tests/pharmacyChatPolicy.test.js tests/chatClient.test.cjs \
  backend/tests/browserSession.test.js backend/tests/security.test.js
npm run build:frontend
npm run check:backend:syntax
npm run validate:schemas
npm run validate:contract
git diff --check
```

- Selected regression command: **244/244**, 0 failed/cancelled/skipped; parent
  entries are included in Node's count. Actual protected JSON/SSE, owner/outsider
  authorization and MongoDB checks use guarded disposable databases and run-owned
  cleanup. No normal application database is a test target.
- New L1 boundary acceptance: 26 checks; HTTP suite: 8 including its parent;
  G1 consumer: 16 inputs plus 1 cookie-policy test; G1 fixture format: 4 including
  its parent. These are subsets of 244, not additional independent results.
- Strict TypeScript/production build pass. Large-bundle and outdated Browserslist
  warnings remain. Backend syntax: 255 files pass. 14 schemas valid; OpenAPI valid
  with 11 existing warnings. Whitespace check passes.
- All files listed in the Session 4 freeze, medical source snapshots and reranker
  weights are byte-identical to the fetched HEAD for this checkpoint. This does
  not attest that every older frozen hash was preserved by the teammate's merge.
- Refreshed the existing loopback preview using its same synthetic database,
  without re-running the broad seed script. Local login/API calls confirm the
  one-source uses answer, explicit unknown-medicine gap, private-data refusal and
  treatment-plan refusal. Temporary signing keys reset; sign in again.
- Post-refresh browser-control calls were unavailable (`browser.user` tool error).
  No new visual walkthrough/screenshot is claimed. App/API startup and direct HTTP
  checks succeeded. No paid model calls, patient-data export, email or deployment.

Initial broad runs failed on merged cookie defaults, then rate-limit defaults.
Those failed attempts are not passes; the final 244 result follows the two narrow
configuration fixes. A stuck test runner from the first failed session was stopped.

## Still open

No comprehensive Indian medicine corpus, independent pharmacist-reviewed gold
set, semantic support/contradiction proof, validated generative clinical answers,
multilingual safety validation, unrestricted agent, model fine-tuning or proven
GPT/Claude superiority. Unknown-name detection covers selected question frames,
not every wording. Emergency rules are not a medical triage model. Browser-wide
acceptance, load/fault/security/privacy work and controlled HTTPS staging remain.
Generation, embeddings and online fallback remain disabled in the local preview.

Next: L2 source governance and coverage lifecycle. Follow `PLAN.md`; deliver a new
small Gemini prompt before beginning its next task. Real clinical labels and
source approval require qualified reviewers, not an AI completion report.
