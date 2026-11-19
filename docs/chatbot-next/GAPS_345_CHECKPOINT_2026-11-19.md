# Chatbot upgrade checkpoint: gaps 3, 4 and 5

Status: implemented and technically verified in the local academic prototype on 19 November 2026. This checkpoint supersedes earlier statements that embeddings were disabled or that saved chats were limited to 40 messages. It does not certify clinical correctness, all project workflows, or production launch readiness.

## 3. Broader official medicine evidence

- Added an actual NHS directory snapshot: 256 official index records, with exact-name routing and formulation-specific labels. Index membership is metadata, not a promise that every question has a supporting passage.
- Expanded the bounded NHS connector to uses, side effects, storage, mechanism, prevention and specific facts, as well as general information. Only observed same-root child links may be followed. No guessed source URLs or arbitrary browsing.
- Added a bounded openFDA label fallback for the original Ondansetron and Telmisartan routes absent from the NHS directory. Single-ingredient metadata is checked; product-specific US information is not Indian approval or brand-equivalence evidence.
- All original 19 medicine routes demonstrated actual source retrieval across checks: the initial transport run returned 18/19; Telmisartan had one transient unavailable response, then its isolated connector check returned three attributed passages. The remaining indexed topics were not all live-tested.
- Official evidence retains publisher, URL, jurisdiction and `NOT_CLINICALLY_APPROVED` status. Production review policy remains separate. Insulin storage and unspecified iron compounds require exact product/ingredient clarification.

## 4. Real dense semantic retrieval

- Added `gemini-embedding-001`, 768-dimensional normalized vectors, cosine similarity, and reciprocal-rank fusion with the existing lexical/concept ranking.
- At most one bounded embedding batch per public answer; canonical public question tasks only, never raw chat history or private case documents.
- Verified the real API path, not just a configuration flag: both live answers reported `HYBRID_BM25_VECTOR` with one embedding request each.
- Verified seven public vectors persisted in Mongo. Cache rows contain model/task/dimension/vector/hash/expiry, not raw text or user IDs. TTL is 30 days; memory cache is bounded.
- Provider/cache failure falls back honestly to scoped lexical/concept retrieval; it must not retain a false vector-success label. This is a small per-topic candidate ranker, not a benchmarked million-document ANN database.

## 5. Scoped context and saved-chat memory

- Added encrypted, expiring, account/organization/conversation-bound context envelopes. Stored context contains canonical topics, question attributes and bounded public intent—not a raw transcript or new medical evidence.
- Follow-ups preserve topic, requested detail and concise preference beyond the ten-turn raw window. Explicit topic switches reset old intent; unresolved/private/personal context remains conservative.
- Saved public chats remain opt-in and account-scoped: up to 20 chats, 200 messages each, bounded storage, and 30-day inactivity expiry. Reopening restores a sanitized context checkpoint. Clear/delete and stream-lease protections remain enforced.
- Local session context lasts up to one hour and clears on refresh/sign-out/new chat. Saved-chat context is restored from its account-scoped checkpoint. Neither mode is automatic model training or a permanent medical profile.

## Actual verification

| Check | Observed result |
|---|---|
| New source/semantic/memory suites | 16/16 passed; synthetic provider vectors are labelled unit tests, not live proof. |
| Client + new suites + generation/public-evidence focused run | 48/48 passed. Overlaps the preceding row; do not add counts together. |
| Existing question-relevance/wording/connector regression plus memory/semantic tests | Passed after fixing a real generic-versus-child-page alias regression. |
| Saved-history mounted HTTP suite on guarded disposable test DB | 12/12 including suite parent; ownership, long reopen, encrypted scope and no-resurrection checks. |
| Live public RAG acceptance | 2/2 HTTP answers passed: new Allopurinol topic and its contextual follow-up without a medicine in the recent history. |
| Actual paid provider use for this checkpoint | Exactly 2 embedding batches + 4 generation/review calls, no retries, no private data. Budget exhausted; no further live model calls made. |
| Public vector persistence | Seven rows observed in the existing synthetic preview DB. |
| Final frontend build / TypeScript | Passed; existing large-bundle and outdated Browserslist warnings remain. |
| Final backend syntax | Passed, 316 JavaScript files checked. |
| Browser | Synthetic patient sign-in, real provider-readiness banner, semantic configuration and session/saved-history controls visible. No additional paid question submitted in the browser. |

The first live answer took 4,992 ms and the follow-up 4,964 ms in this two-case run. These are observations, not latency guarantees. Source/citation and model-assisted support checks are engineering checks, not pharmacist validation. In particular, frequency categories and complete warning coverage still require qualified review before medical reliance.

Detailed sanitized output: [GAPS_345_LIVE_ACCEPTANCE_2026-11-19.json](GAPS_345_LIVE_ACCEPTANCE_2026-11-19.json).

## Running preview and handoff

- Frontend: `http://127.0.0.1:5173/patient/health-assistant`
- API: `http://127.0.0.1:5001/api`
- Existing synthetic database preserved; no reseed or deletion.
- Public generation, official lookup and embeddings enabled. Private case export and unrelated legacy provider routes remain disabled in this synthetic preview.
- Source, tests, private credential file and prior user changes preserved. No commit, push, deployment, or production approval claimed by this checkpoint.

Try in a new public chat: “What is Allopurinol used for?” then “What about its common side effects? Keep it concise.” Each new answer may consume provider credits. Inspect its sources and actual retrieval method rather than treating the readiness badge as proof of every answer.

## Remaining limits

Exact-name English public education only; no diagnosis, prescribing, dose selection, interactions clearance, claim adjudication or guaranteed answers. Source outages, unsupported products, incomplete passages and provider validation failures may still result in explicit gaps or clarification. The 256-entry source index and two live cases are not a hidden gold standard, clinical validation, or evidence of superiority over GPT/Claude.
