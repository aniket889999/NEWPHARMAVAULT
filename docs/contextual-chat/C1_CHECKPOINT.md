# C1 — context-aware public retrieval and approved web fallback

Date: 17 November 2026. Scope: first bounded chatbot-first checkpoint. C2–C4 in PLAN.md remain open. Not a trained new model, expert medical gold standard or production release.

## Implemented

- Bounded conversation topic/intent/style resolution for approved medicines and project concepts, with multi-turn follow-ups, topic switching, ambiguity clarification and carried personal-safety boundaries. Assistant-authored history is not accepted as factual evidence.
- Existing local BM25/optional public hybrid-generation pipeline retained. Private case answering and frozen evaluation files are unchanged.
- Local public coverage miss can use the fixed MedlinePlus health-topic API when explicitly enabled. Only registry terms leave the server; no raw questions, histories, person/case identifiers or documents. Redirects, unapproved result URLs, oversized responses, unsupported XML, missing relevance and provider failure fail closed. Caching, time and request bounds are implemented.
- Source notes use complete sentence groups, retrieval timestamps, official links, explicit US/non-regulatory scope and a no-LLM-synthesis label. They are related educational source material, not necessarily an exact medicine monograph.
- Tool outcome/context display and protected feedback. Public-answer receipts are owner-bound, process-local and valid for one hour. Feedback stores hashes/source metadata/rating only; no raw text or proposed corrections. The requested 30-day MongoDB TTL index requires operational provisioning/retention verification before production. No knowledge or model update happens automatically.
- OpenAPI/status/response extension, disabled example configuration, and an offline/mocked-HTTP CI step. No runtime dependency added.

## Actual verification

| Executed scope | Result |
|---|---|
| New context/tool/feedback development + protected HTTP suites | 32/32 pass; no live provider used in these tests |
| New suites + existing conversational/policy/client regression + frozen published-result integrity | 71/71 pass; no skips |
| New suites + existing actual protected provider-readiness regression | 39/39 pass; scoped disposable DB cleanup only |
| Full existing `npm run test:chat` including actual protected case HTTP | 53/53 pass; no skips |
| Existing UI/citation/readiness/integrated-portal client checks | 29/29 pass |
| Strict app/tooling TypeScript | PASS |
| Production frontend build | PASS; existing bundle-size and Browserslist warnings remain |
| OpenAPI | Valid; 11 existing warnings |
| JSON schemas | 14/14 valid |
| Owned chat frontend lint / backend syntax | PASS |

The new HTTP suite uses run-owned records in `pharmavault_smoke_test` and validates real authentication, status, public JSON/SSE, owner-bound persisted feedback and private-case/outsider isolation. Official API responses are mocked in deterministic tests; this is stated rather than counted as live web acceptance.

## Live checks

- A first public MedlinePlus attempt used an incompatible XML response shape and found no accepted evidence. The adapter was corrected to the documented brief response format; poor-match results still abstain rather than accepting unrelated safety pages.
- Subsequent live `antibiotic resistance` lookup returned MedlinePlus Antibiotic Resistance evidence. No credential or paid model was used for web lookup.
- One separately approved Gemini contextual public-workflow test returned `GEMINI_RAG`, carried the human-review topic, validated its citation and made exactly one generation request, zero embeddings/retries. Metadata is in LIVE_PUBLIC_TEST_2026-11-17.json. The key was loaded in memory, not printed/copied; actual private-export settings were not enabled.
- Real in-app browser on the isolated same-app demo: synthetic sign-in → Evidence Chat → public official-source lookup → source/route inspection → Helpful feedback saved for expert review → “Explain it more simply” retained Antibiotic resistance and reduced notes to one cited passage. The browser badge honestly says local generation disabled; this does not claim live browser Gemini generation.
- Screenshot outside Git: `../output/contextual-chat/official-source-followup.png` relative to the desktop workspace, actual absolute path `/Users/aniket/Documents/Codex/2026-07-26/y/output/contextual-chat/official-source-followup.png`.

Only run-owned synthetic mentor fixtures were refreshed to reload the server. The normal app/database, .env values, original Downloads worktree and existing Gemini-owned files were not replaced or deleted. Other mentor-demo edits are separate uncommitted work, not C1 acceptance.

## Reproduce

`node --test tests/contextual-chat/contextual.test.cjs tests/contextual-chat/http.test.cjs`

For the normal local app, after freeing its expected ports and configuring its usual local environment, `RAG_CHAT_WEB_ENABLED=true npm run dev:all` enables only the approved public lookup. That launcher keeps external LLM/private-document export disabled. Web lookup needs network access but no new search credential. Do not confuse this with enabling generative answers or training.

## Remaining

Small routing vocabulary; English search only; no durable personal memory; bounded rule-based tool routing; no unrestricted web agent; no expert curation UI/promotion; no fine-tuning; no independent new held-out experiment; no GPT/Claude superiority claim. C2 corpus review handoff is in GEMINI_C2_PROMPT.md. Do not reuse published held-out labels as new evaluation data.
