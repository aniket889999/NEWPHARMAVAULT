# Chatbot checkpoint — 19 November 2026

Current update: **gaps 3/4/5 implemented and live-verified within the academic public scope**: broader official-source routing, actual dense-vector + lexical retrieval, and encrypted scoped conversation/saved-chat context. The existing preview now enables embeddings as well as generation. Two new real public HTTP answers passed with `HYBRID_BM25_VECTOR`, including a follow-up beyond the raw-history window. No clinical or universal chatbot correctness claim.

Read the latest [gaps 3/4/5 checkpoint](GAPS_345_CHECKPOINT_2026-11-19.md) and [sanitized live acceptance](GAPS_345_LIVE_ACCEPTANCE_2026-11-19.json). Exactly two embedding batches and four generation/review calls were used. These supersede older coverage/embedding/40-message-limit notes. No commit/push or reseeding was performed.

Earlier same-day provider acceptance, including failures, remains in [the prior live checkpoint](LIVE_GROUNDED_CHAT_2026-11-19.md) and [its evidence](LIVE_RAG_ACCEPTANCE_2026-11-19.json).

## Historical snapshot — 18 November 2026

Workspace: `/Users/aniket/Documents/Codex/2026-07-26/y/NEWPHARMAVAULT-v3`  
Branch: `version-4.0` (upstream base `de60459` plus preserved local work)  
Status: **local academic integration verified; Gemini reports a partial live LLM pass**. The medicine-provider check remains pending. Not an industry-launch or clinical approval claim. No commit/push performed in this batch; unrelated teammate/older worktree changes were preserved.

## Completed locally

1. Fixed the six recorded v1 quality issues (eight scenarios): requested fact selection, complete OCR/correction explanation, project identity explanation, evidence freshness mechanism, topic versus treatment switches, and ambiguous known-name clarification. The pre-expansion candidate achieved 100/100 exposed engineering reference checks; its result is preserved in `CODEX_QUALITY_RESULTS.json`.
2. Added opt-in, account/organization-scoped public chat persistence. Protected consent/list/create/read/delete/clear routes live under `/api/v1/chat/history`; saved streaming is `/api/v1/chat/history/conversations/:conversationId/stream`. New chats are not silently opted in, and old in-memory chats are not silently imported.
3. Saved-history controls support reopen, per-chat deletion and disable/delete-all. Limits: 20 conversations, 40 messages per conversation, 30 days since last saved-history change, bounded document size. Server-generated evidence is saved; the client cannot submit an authoritative transcript. Private case evidence is excluded. History provides conversation context, not new medical facts or automatic model training.
4. Integrated 12 directly checked, attributed academic summaries for the six medicine routes missing local evidence. All ten registered generic medicine topics now have narrow uses/possible-side-effects reference coverage. See `EVIDENCE_INTEGRATION.md`; no product-specific temperatures/doses/substitution/Indian approval claims were added.
5. Kept the historical local retrieval-ranker artifact unchanged. Its corpus binding is stale after expansion, so it is honestly inactive, not described as newly trained. Current retrieval is source-policy/request/topic/focus scoped, using BM25 or exact topic/section lookup. API/UI disclose the actual route.
6. Prepared a bounded provider probe and handed configuration/live checks to Gemini in `GEMINI_API_HANDOFF.md`. The model selected earlier from official Google docs is `gemini-3.5-flash-lite`. Provider files stay ignored; no secrets are in this checkpoint. The key exposed in chat must be replaced privately, not reused.

## Actual verification

| Check | Result / limit |
|---|---|
| Focused medicine/context/precision/boundary/web-policy/history-client run | 106/106 passed. Not the full repository test suite. |
| Saved-history mounted HTTP suite, previous batch | 9 subtests plus suite parent passed, including ownership, lease, expiration, limits, and delete/no-resurrection. Disposable guarded test DB; no existing preview records deleted. |
| Frozen academic reference inputs | 100 items / 50 authored families; reference freeze intact. Human grades remain pending. |
| Current expanded-corpus v1 replay | 98/100. Only F34-01/F34-02 differ: old no-coverage abstentions now have atorvastatin/losartan evidence. Labels unchanged. `CODEX_COVERAGE_RESULTS.json` records current hashes and the policy difference. |
| Current source-selection challenge | 16/16; ties strong rule-scoped baseline 16/16. No GPT/Claude/clinical superiority claim. |
| Frontend build and TypeScript | Passed; existing large-bundle/Browserslist warnings remain. |
| Git diff whitespace check | Passed. |
| Browser walkthrough | Synthetic demo sign-in → Health Assistant → Losartan uses → cited answer → NHS/UK/date/source card → session-only controls. Real UI observed; saving was not enabled during this walkthrough. |
| Paid provider calls by Codex in this batch | 0. Gemini's `API_REPORT.md` reports 1 actual provider call: project-guide `GEMINI_RAG`, 1 source, 1,621 ms. Medicine task locally abstained before egress. Codex fixed the retrieval issue and independently confirmed a local cited Metformin answer; this is not a live medicine-provider pass. One approved call remains, with a new one-request-only probe mode. |

Do not add overlapping test counts together, call these exposed scenarios a hidden gold standard, or report the historical 100/100 as the current expanded-corpus score.

## Running local preview

- App: `http://127.0.0.1:5173/patient/health-assistant`
- API: `http://127.0.0.1:5001/api`
- Reused synthetic DB: `pharmavault_v3_preview_20261118_0353c7bb04`
- Preview session after version-4.0 integration: `62385` (ephemeral tool session, may not survive restarts).
- Local wrapper: `/private/tmp/pharmavault-v3-preview.B4epop/launch.cjs`.
- Paid generation/embeddings/private export remain disabled. Approved public-topic web lookup remains enabled. Several legacy external-provider features are intentionally disabled in this synthetic preview; this is not a claim that every project feature works.

For a safe restart, reuse the same explicit database. Do not run a broad seed against it:

```sh
PHARMAVAULT_PREVIEW_EXISTING_DB=pharmavault_v3_preview_20261118_0353c7bb04 node /private/tmp/pharmavault-v3-preview.B4epop/launch.cjs
```

## Finite remaining chatbot work / owners

| Priority | Deliverable | Owner and completion evidence |
|---|---|---|
| 1 | Public model-backed RAG acceptance | Initial Gemini report received: partial, 1 actual request. Gemini follows the current resume section of `GEMINI_API_HANDOFF.md`: fresh key private, at most ONE remaining public medicine call, `--only-public-medicine`; record a separate `gemini/API_FOLLOWUP_REPORT.md`. Do not repeat the successful project task or enable unbounded paid generation. |
| 2 | Multi-detail conversational answers | Codex: separate sourced uses/side-effects sections for one unambiguous medicine, honest per-section gaps, inherited follow-up context; preserve safety/private boundaries. Current v1 policy still clarifies multiple details. Version the new policy/oracle rather than editing old labels. |
| 3 | Full synthetic case evidence demo | Codex: convert Gemini's clearly synthetic HTML inputs to supported upload formats, then demonstrate upload/OCR/correction → 500 mg vs 650 mg evidence → authorized human review → stale answer after a cited correction. Documents are prepared, but the end-to-end walkthrough is not complete. Do not call seeded fields measured OCR. |
| 4 | Human academic fact review | Mentor/teammate uses v1 rubric and blank review sheet; record actual reviewer/grades. Gemini's source audit supports review but does not substitute for human or clinical approval. |
| 5 | Final reproducible mentor handoff | Codex: update current supported scope/setup/demo guide and checkpoint Git changes after reviewing teammate edits and secret-ignore rules. No claim that all legacy features or production operations have been verified. |

Not required for this milestone: real-patient use, clinical certification, paid GPT/Claude superiority trials, a 1 GB corpus, training an LLM from scratch, or public deployment approval.

## Screenshot-reported wording fix — 18 November 2026

Reproduced and corrected the false rejection of `What are Metformin’s possible side effects?` and its pronoun follow-up. The medicine-name guard now separates grammatical possessives/side-effect qualifiers from the identity without approving unknown names. A narrow allowlist separates standalone trailing citation/format instructions from retrieval text; raw messages still reach safety, privacy, personal-context and language checks.

Added a separately attributed academic NHS antibiotic-scope passage for `Does Azithromycin treat viral colds?`. It remains unapproved for clinical use and blocked in production/reviewed-only mode. Its metadata explicitly records that the publisher's stated next-review date has passed; an engineering source check is not a fresh clinical review. Existing reference versions and frozen evaluation labels were not rewritten.

Actual verification: **123/123** focused checks across wording regression, question relevance, medicine pack, precision, boundary and always-web suites; changed JavaScript syntax checks passed. Live UI: synthetic patient login → both exact screenshot questions → `PRECISE_LOCAL_EVIDENCE`, supporting text and one citation each. Official MedlinePlus lookup returned no relevant evidence; the answers honestly use local source-bound references, not newly fetched web evidence or LLM generation. Zero paid provider calls. Same preview database reused without seeding or deleting records. This does not establish all chatbot features or clinical readiness. Changes remain local/uncommitted.

## Teammate integration checkpoint

Fetched and fast-forwarded the local base to upstream `8248042` (chatbot PR #6 and intervening module updates), then reapplied the three overlapping local files without conflicts. Prior work is preserved and the narrow recovery stash remains available. Added accurate visible source provenance and a v2 brand-label confirmation boundary rather than equating commercial names with a single ingredient. **180 distinct focused checks passed**, frontend TypeScript/build passed, backend syntax passed (303 files). Live UI proved actual MedlinePlus retrieval for antibiotic resistance, safe brand clarification and separately labelled stored NHS evidence. See `TEAMMATE_INTEGRATION_2026-11-18.md` for scope, recovery hash and remaining work. No new commit/push or clinical-readiness claim.

## Latest: approved version-4.0 integration

After the user's explicit approval, integrated `de60459` into local `version-4.0`, preserving all prior fixes. Added gateway alignment, strict order quantities/eligible inventory lookup and focused symptom-definition web filtering. Final run: **206/206 focused checks**, frontend TypeScript/build and backend syntax (305 files) passed. Two authenticated synthetic API smoke checks passed. Final browser fever answer cited one matching MedlinePlus page without unrelated-disease drift. Offline developer-labelled evaluation: 23/30 outcome matches, 14/19 expected answers, 5/5 safety referrals; labels unchanged. Existing DB retained, no seed/reset, no paid provider calls. See `../version-4.0/INTEGRATION_CHECKPOINT_2026-11-18.md`. Full order-browser journey and production/clinical readiness remain unverified; local changes are not committed or pushed.

## Latest: requested workflow audit (diagnosis, not fixes)

Completed an isolated synthetic audit without changing application source or the original demo DB. **56 consolidated API assertions: 51 pass, 4 fail, 1 blocked.** **49 role/page checks: 48 render passes, one future-work consultation page.** Browser printed-sample OCR and archiving worked. Single-pharmacy ordering, claims/query/appeal/consent, actual in-app reminders, saved history and MFA recovery passed the tested API paths. Found Workflow Center cross-tenant rejection, missing pending approval state/role mismatch, multi-pharmacy Rx review-link overwrite, missing backend OCR language assets and placeholder health-record/tracker actions. See `../version-4.0/WORKFLOW_AUDIT.md` and raw JSON evidence. Separate audit DB `pharmavault_workflow_audit_20261118_409c99ac` retained; audit services stopped. No paid AI/email/SMS operations enabled. These diagnostics do not mark all workflows complete or clinically approved.
