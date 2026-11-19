# Live grounded chat checkpoint — 19 November 2026

Real public-only server-side Gemini generation is **enabled and demonstrated** on the local preview. This is bounded academic acceptance, not proof that all medicines, all wording or all workflows work. Full clinical/launch readiness is not claimed.

## Five areas addressed

| Previous gap | Implemented / evidence | Remaining boundary |
| --- | --- | --- |
| Runtime generation disabled | Preview now loads the ignored private provider configuration, enables public generation and web synthesis, and reports real observed readiness. Authenticated Metformin and Cetirizine questions returned `GEMINI_RAG`. | Provider failure remains possible; one initial failure is retained in the results. Readiness expires after five minutes without a new accepted response. |
| Copy-only / lossy detailed-question prompt | Canonical public task preserves registered topic, requested attributes and evidence-bounded concepts. Paraphrases are allowed. Final protocol asks the model for server-issued sentence IDs; the server resolves exact quotes and checks numeric/advice boundaries before model-assisted entailment/relevance review. | This is not formal entailment or independent clinical validation. A rejected answer remains a labelled fallback. |
| Broad health-topic-only web connector | Reviewed Gemini's standalone connector, hardened MIME/stream bounds/cancellation, and integrated transport-bound NHS medicine passages. Four generic medicines plus one fixed antibiotic-class reference; MedlinePlus remains the topic fallback. Four direct real NHS lookups succeeded. | Not a complete formulary, arbitrary internet search or Indian brand/regulatory database. Academic sources are not clinically approved. |
| Fragile exact-word / single-sentence matching | New public path uses topic/attribute scoping, BM25 plus explicit concept expansion, and a bounded medicine-to-antibiotic-class bridge across documents. Real Cetirizine follow-up handled “sleepy”; live azithromycin/class retrieval was checked with a no-model stub. | No dense embedding model or trained semantic index was added. Local concept mapping and model relevance checks have limited coverage. Azithromycin generation itself was not live tested in this batch. |
| Follow-ups / multi-part questions | Uses and possible effects can be answered together; unsupported requested sections remain explicit gaps. Exact Cetirizine pronoun follow-up passed with earlier English-only clarification retained as context. | Bounded recent-turn context and existing opt-in public history, not autonomous training, unlimited memory, a longitudinal patient profile or verified multilingual generation. |

## Independent Gemini review

Gemini supplied `approvedMedicineSearchService.js`, `approvedMedicineSearch.test.js`, and its short report. Its eight fixture tests were not accepted as end-to-end evidence. Review found missing-MIME acceptance, an unbounded text-only response fallback and a cancellation/cache race; these were corrected. A WeakMap transport provenance binding prevents plain fabricated candidates being registered as web passages. Registration binds topic/scope metadata without inventing a clinical approval record. Parser fixtures include a viral-cold sentence absent from the actual azithromycin page; runtime retrieval instead uses the separate fixed NHS antibiotic-class page when needed.

## Actual checks (do not add overlapping counts)

- Final generation + legacy source-governance run: **39/39 pass** (`grounded-generation-v2.test.cjs` 14 + `governed-generation.test.cjs` 25). Mocked provider, no database.
- Public-evidence integration/hardening suite: **11/11 pass** after correcting a test's mistaken no-evidence assumption; an existing academic azithromycin sentence genuinely supports the extractive fallback.
- Gemini connector's **8/8** fixtures passed after hardening. Its six-second timeout test was scoped, not repeatedly run as part of unrelated builds.
- Readiness **13/13**, existing question relevance **36/36** and operation safeguards **15/15** passed earlier in this batch. These overlap earlier checkpoints; no inflated combined score.
- `npm run check:ts` passed; relevant syntax/whitespace checks passed. No full repository suite, all-page audit or broad production build was repeated.
- Four direct real NHS medicine checks returned passages; a separate no-model real lookup confirmed named azithromycin evidence and live antibiotic-class evidence.
- Two scoped real generated answers passed: multi-part Metformin (9,783 ms) and exact contextual Cetirizine follow-up after the sentence-ID change (14,459 ms). The multi-part case was not paid-replayed after that final protocol change. JSON evidence records both successes, the initial provider failure and the initial browser validation failure.
- First HTTP harness sign-in omitted the required role; corrected to the existing patient role without weakening authentication. That harness failure made zero model requests.

See [machine-readable acceptance](LIVE_RAG_ACCEPTANCE_2026-11-19.json). No clinical grades, hidden gold-standard results, model training or GPT/Claude superiority were measured. Citations support traceability, not guaranteed clinical truth.

## Current local app

- Health Assistant: `http://127.0.0.1:5173/patient/health-assistant`.
- API: `http://127.0.0.1:5001/api`; synthetic preview DB reused: `pharmavault_v3_preview_20261118_0353c7bb04`.
- Final preview tool session: `2245`; machine-local wrapper: `/private/tmp/pharmavault-v3-preview.B4epop/launch.cjs`.
- Wrapper mode: `SYNTHETIC_PUBLIC_GENERATIVE_PREVIEW`; model: `gemini-3.5-flash-lite`.
- Private case/document export, external prescription generation, embeddings, email and text notifications remain disabled. Local prescription parsing and in-app reminders remain as before.
- No database reseed/deletion/reset. No commit/push or dependency installation. Existing teammate/legacy changes remain preserved.
- Provider file is Git-ignored and owner-only (`600`); no key/header/credential content is in the reports.

The already-running app should not be started a second time. For recovery, after gracefully stopping only its verified preview process, reuse the same DB:

```sh
PHARMAVAULT_PUBLIC_CHAT=1 PHARMAVAULT_PREVIEW_EXISTING_DB=pharmavault_v3_preview_20261118_0353c7bb04 node /private/tmp/pharmavault-v3-preview.B4epop/launch.cjs
```

Normal project startup also supports `npm run dev:chat`: it reads provider fields from ignored `backend/.env.provider.local` and still requires the usual database/auth configuration in `backend/.env`. The model ID was checked against [Google's model documentation](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite); actual access was established separately by real requests.

Live checks require explicit spending authorization. `verifyContextualChatLive.js` makes no calls by default, stops after a failed case, never retries automatically and supports `--only-multi` / `--only-context` for one-answer checks. At most eight model requests were allowed across this batch, including two additionally approved requests. Two early failures were not instrumented, so an exact total is not asserted. Each answer is capped at 1,024 generation + 512 review output tokens.

## Evidence / handoff

- Post-fix authenticated HTTP proof: `LIVE_RAG_ACCEPTANCE_2026-11-19.json`.
- Current UI readiness proof: `/Users/aniket/Documents/Codex/2026-07-26/y/deliverables/pharmavault-live-provider-ready-2026-11-19.jpg`.
- Earlier browser fallback screenshot retained, not overwritten: `/Users/aniket/Documents/Codex/2026-07-26/y/deliverables/pharmavault-live-generation-2026-11-19.jpg`.
- Remaining priority: broader independent multi-turn/source-grounding evaluation, qualified source review, better source coverage and richer semantic retrieval. Do not remove refusals for truly missing evidence just to increase answer rate.
