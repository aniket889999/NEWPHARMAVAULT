# Grounded conversational chat — 19 November 2026

Historical pre-live checkpoint. Superseded later the same day by [real generation acceptance](LIVE_GROUNDED_CHAT_2026-11-19.md); preserve the earlier limitations/results below as development history.

Status: GPT-owned generation changes implemented and checked offline. Gemini source connector and real-provider/runtime acceptance remain pending. This does not close all chatbot gaps or establish clinical readiness.

Workspace: `/Users/aniket/Documents/Codex/2026-07-26/y/NEWPHARMAVAULT-v3`, branch `version-4.0`. Existing dirty changes preserved. No commit/push, dependency installation, database mutation, preview restart or paid API call in this batch.

## Ownership

| Owner | Work |
| --- | --- |
| GPT | Public-task export, grounded generation, support review, routing, readiness and explicit launcher. |
| Gemini | Only the three new files in `GEMINI_MEDICINE_CONNECTOR_PROMPT.md`: standalone NHS medicine candidates, mocked tests, short report. No integration before GPT review. |

## Implemented by GPT

- New `publicAnswerTaskService.js` builds a canonical task from registered topic IDs, fixed attributes and evidence-bounded detail words. It never exports raw questions, arbitrary labels, history, private IDs or selected cases. Unknown/unrepresentable details refuse public generation rather than silently dropping them.
- Explicit `RAG_CHAT_ANSWER_STYLE=GROUNDED_PARAPHRASE` mode permits readable paraphrases instead of copy-only sentences. Existing extractive behavior remains default.
- Generation and model-assisted support review share a 25-second deadline, at most two model calls, 1,024 + 512 output-token caps, bounded payload/response sizes and no retries. Each real provider request passes existing tool limits separately.
- Citation existence/quotes, numeric claims and prohibited advice checks still run locally. The second model stage checks entailment, question relevance and retained qualifiers before any candidate paragraph is emitted. On failure, return the original cited extractive answer.
- Model-assisted checking is NOT independent verification or clinical validation and can still miss errors. Provider availability and live model behavior remain unverified in this batch.
- Detailed questions can reach generation in the new mode; the legacy mode retains the earlier no-export rule. Missing evidence still does not authorize a model-only medical answer.
- Readiness does not accept the known preview dummy credential and invalidates prior observations after synthesis-policy changes.
- Added `npm run dev:chat` as an explicit public-only generative launcher. It preserves private-document/case export restrictions and warns about provider consumption. `dev:all` / `dev:web` remain non-generative by default.

## Actual focused checks

- Latest `node --test --test-reporter=dot tests/contextual-chat/grounded-generation-v2.test.cjs backend/tests/chatProviderReadiness.test.js`: **26/26 pass**, mocked provider, no database or paid requests.
- Earlier relevant `question-relevance` and `governed-generation` suites: **61 existing checks passed**. Initial new generation-suite run had two failures because deliberately failed fixtures opened the shared circuit before later cases. Test environment isolation was corrected; production limits were not weakened. Do not add earlier overlapping new-test counts to the latest total.
- Both local launcher files passed `node --check`; scoped tracked-file `git diff --check` passed. No frontend/source UI changes, full repository test, build, browser walkthrough or live model call was performed for this milestone.

## Runtime / remaining acceptance

The already-running temporary preview is unchanged and still disables generation. Code on disk is not proof the visible browser is using this new mode. Do not stop/reseed an existing preview casually.

To explicitly use the new local mode, after stopping the old local stack, configure a valid replacement Gemini key and desired supported `RAG_CHAT_MODEL` privately in ignored `backend/.env` and run `npm run dev:chat`. Never reuse a key exposed in chat or commit secrets. The backend reads its own environment; this command does not copy or print keys. Do not call configured status a live pass; readiness requires a real accepted public response.

Next: review Gemini's three-file diff, verify fixed URLs/byte/deadline/cancellation/parser behavior, integrate candidates through existing passage/source governance, then run one bounded public end-to-end check when a valid private credential and API-call authorization are available. No clinical-review records may be invented.

Still open: medicine connector integration, broader semantic retrieval, source coverage, multi-attribute answers, richer conversational handling and held-out human evaluation. This batch did not train an LLM, certify healthcare safety or demonstrate superiority over GPT/Claude.
