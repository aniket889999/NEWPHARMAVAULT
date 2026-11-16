# Evidence chatbot checkpoint - 15 October 2026

## Domain policy hardening - 9 November 2026

The current assistant has a deterministic pharmacy/document domain router with
versioned reason codes. It distinguishes medicine education, academic identity,
case evidence, workflow help, clarification, clinical referral, emergencies and
out-of-domain requests. Missing case selection, ambiguous brands and substitution
questions are handled locally before public retrieval; identity lookup does not
use a clinical passage as a medicine identity certificate. This is an engineering
policy, not a validated medical triage system or proof of paper novelty.

This hardening passes 71/71 focused chat/policy/client/security TAP checks, the
frontend bundle and the API contract check (12 existing warnings). The running
development API was reloaded and reports READY. Wider strict app type failures
remain separate and unresolved; no production or clinical acceptance is implied.

The next scoped work is defined in `FIVE_DAY_INDUSTRY_RESEARCH_PLAN.md`: five
two-hour sessions focused on evidence-version/identity binding and a small paired
benchmark. Those research features are planned, not marked implemented here.

## Current checkpoint - conversational RAG, 9 November 2026

The sections dated 15 October below describe the earlier extractive baseline.
The Health Assistant now has a separate conversational pipeline and a redesigned
full-height chat screen. Features include New Chat, bounded in-memory history,
follow-up topic resolution, Copy, Stop, Regenerate and expandable source cards.
The patient route and shared `/assistant` route use the same implementation.
Chat history is not persisted across page reloads or sign-out.

### Actual RAG flow

Validated message/history -> local topic resolution -> public-source selection ->
BM25 plus optional `gemini-embedding-001` vectors -> reciprocal-rank fusion with
a relative context cutoff to reduce loosely related passages ->
Gemini-written explanation -> supporting-quotation/citation checks -> SSE
paragraph delivery. Vectors are a bounded in-memory index, not a managed vector
database. Public corpus vectors are reused; private case data is never embedded
or sent to the external model. Retrieval or provider failure visibly falls back
to keyword search or local source notes, without claiming generative success.

Generation uses Gemini `streamGenerateContent` with structured paragraphs. The
server emits each complete paragraph only after checking source IDs and supporting
quotation substrings (with harmless whitespace/case/quote normalization, without
changing word order or dropping negation). Simple temporary source aliases reduce
provider citation-copy errors. It does not animate a prewritten answer to
simulate model streaming. These mechanical checks are not semantic entailment
or a clinical correctness guarantee. Generated errors remain possible.

Public egress now has its own explicit flag pair:

```dotenv
RAG_CHAT_LLM_ENABLED=true
RAG_CHAT_PUBLIC_EXPORT_ALLOWED=true
RAG_CHAT_EMBEDDINGS_ENABLED=true
RAG_CHAT_MODEL=gemini-2.5-flash
RAG_CHAT_EMBEDDING_MODEL=gemini-embedding-001
```

Only locally filtered public-vocabulary topic terms, a fixed intent label and
allow-listed public passages leave the server. Raw questions, raw conversation
history, persistent case/user IDs and private document passages do not. Requests
with `caseId` always use the existing authorized local extractive path, even when
public generation is enabled. Authentication and tenant boundaries remain active.

The small educational reference corpus contains seven original summary passages
covering Paracetamol, Metformin, Cetirizine, Amoxicillin and antibiotic basics,
with original NHS page links and snapshot/review dates. It is not a comprehensive
clinical knowledge base, current Indian prescribing guidance, or a licensed
clinical decision-support product. The October snapshots remain dated as such.
Personalized dose selection, diagnosis, medicine suitability and claim decisions
are out of scope. The chatbot abstains or directs the user to professional help.

### Start locally

With local MongoDB, dependencies and the existing server-only key configured:

```sh
npm run dev:chat:backend
VITE_API_URL=http://127.0.0.1:5001/api npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Run those in separate terminals. The explicit development-only launcher enables
public RAG, but keeps both private-case export flags false. It does not edit
`.env`, seed accounts, reset a database or weaken authentication. Normal
production startup remains opt-in and unchanged. API quota/availability can vary.

Open `/patient/health-assistant` with an existing patient session or `/assistant`
with an authorized session. Ask a supported medicine question, then ask “What
about its side effects?” and “Explain it more simply.” Check the generation-mode
label and the Sources panel; never present fallback notes as a live LLM answer.

### Current verification

- `npm run test:chat`: 34/34 TAP checks pass, including real isolated MongoDB/HTTP
  case scoping and SSE authorization, plus mocked provider/client edge cases.
- Security and U2 privacy regression suites: 18/18 pass.
- A real public-project RAG request returned `GEMINI_RAG` with
  `HYBRID_BM25_VECTOR`, source citations and streamed validated paragraphs.
- A real educational-reference generation request also passed paragraph checks.
  The browser correctly displayed local fallback on one separate provider/check
  failure; that variability is intentional and must not be hidden.
- Production bundle and backend syntax pass; OpenAPI is valid with the same
  12 historical warnings in unrelated operations.
- Strict whole-app TypeScript checking still reports older unrelated errors;
  a passing root `check:ts` is not proof of strict app-wide correctness.
- Signed-in browser verification passed for a live generated medicine answer,
  its source panel, a contextual side-effect follow-up, Stop, Regenerate and
  New Chat. The interrupted follow-up regenerated successfully without repeating
  its medicine name. The final targeted strict scan reports 98 diagnostics in
  the wider app and none in the new chat modules or patient layout; targeted
  chat lint passes. Conversation history remains memory-only, not durable storage.
- No production deployment, source deletion, secret-file change, dependency
  installation, Git commit/push or development-database cleanup was performed.

Research work still open: a held-out retrieval/answer benchmark, independent
clinical review of reference summaries, systematic red-team testing, broader
approved content, durable privacy-reviewed conversation storage, U7 evidence
versioning and full mobile/production acceptance.

## What changed

The main chat store now uses `POST /api/v1/chat`, not the legacy agent endpoint.
The patient Health Assistant and shared `/assistant` page both expose the evidence
chat. Reviewers can open **Ask about this case** from a case detail page.

Pipeline: validated question -> authorized case scope, when selected -> local
passage construction/chunking -> BM25 ranking -> bounded source selection ->
cited answer or abstention -> source cards. No vector database is claimed.

## Sources and provenance

- Ten versioned first-party project-guide passages in `backend/data/chatKnowledge.js`.
- Existing small academic medicine catalogue, read from its versioned source file.
  These are identity records, not medical monographs or live regulatory facts.
- Optional case records: current allowed medicine/date/quantity/amount fields,
  document page coverage, current status and structural check/risk findings.
  The server authorizes the case *before* reading its subordinate records.
  Personal names, filenames, storage metadata, free-text review notes and historic
  evidence strings are not retrieved into the chat context.

Passages use stable content-derived chunk IDs, title, source category and version.
Private field citations include document ID and page number. Links open the
protected source case. Scores are lexical retrieval rankings, not accuracy or
clinical confidence. Case questions prefer current private sources; a worked
example is never mixed into a case answer. Old findings are withheld when a newer
field correction exists or the case is processing. This read-side safeguard does
not replace U7's full evidence versioning work.

## Generation boundary - do not overclaim

The default and currently running demo uses **LOCAL_EXTRACTIVE** mode: it retrieves
and quotes passages, without an LLM call. This is a retrieval-first baseline, not
proof that a live generative/semantic RAG model has been exercised.

An optional native-fetch Gemini REST adapter implements constrained public-source
quotation selection. It needs both server flags:

```dotenv
RAG_CHAT_LLM_ENABLED=true
TRUSTRAG_LLM_EXPORT_ALLOWED=true
RAG_CHAT_MODEL=gemini-2.5-flash
```

Do not change deployment export policy merely for a demo. Existing `.env` secrets
and flags were not changed. Use a currently available permitted model configured
by the operator. No new dependency, key in browser, automatic web search or cloud
upload was added. The adapter's shape follows Google's
[generateContent REST API](https://ai.google.dev/api/generate-content) and
[structured output guidance](https://ai.google.dev/gemini-api/docs/structured-output).

Only immutable public passages and matching public vocabulary terms are exported.
Raw questions, chat history, persistent case/user IDs and private case passages
are excluded. Any request carrying a caseId stays local even if both flags are on.
Model-selected quotes must match actual retrieved source substrings and IDs;
unavailable models, malformed JSON or forged citations fall back locally.
This constrains unsupported wording; it does not prove semantic entailment or
clinical correctness. The model can still select an unhelpful excerpt.

No live Gemini call was made during validation: the outbound adapter and failure
paths were tested with synthetic model responses. Live provider/quota/model
verification remains open. Full clinical RAG requires licensed/current curated
guidelines, clinical review, held-out evaluation, and an approved privacy design.

## Demo

1. Sign in with an existing account and open `/assistant`.
2. General question: **What is human-in-the-loop validation?**
3. Open **Sources** and explain the passage, source version and [S1] citation.
4. Select an accessible processed synthetic case, or use **Ask about this case**.
5. Ask **Show prescription and invoice strength fields**. Inspect source pages.
6. Ask **Why is my case flagged?** after a case has current risk findings.
7. Ask an unsupported clinical question. Explain that missing evidence causes
   abstention instead of an invented prescription or claim decision.

English lexical retrieval MVP. Raw patient data must not be used. No automatic
case mutation, prescribing, claim approval, unrestricted web fallback or clinical
accuracy percentage is implied.

## Verification

Run `node --test backend/tests/chatRag.test.js` from the project root. The HTTP
part uses the fixed loopback allow-listed disposable `pharmavault_smoke_test`
database with unique synthetic records. Cleanup is limited to this run's IDs;
no development database or existing accounts are changed. Model responses are
mocked; HTTP authentication, database scope and field retrieval are real.

Also run frontend build, backend syntax and API contract checks. Important:
`npm run check:ts` currently invokes `tsc --noEmit` on a root config containing no
files; it does not establish that app code passes strict checking. Running
`npx tsc -p tsconfig.app.json --noEmit` exposes existing project-wide errors.
These must be tracked separately, not mislabeled as a zero-error app check.

Next research upgrades: held-out retrieval relevance/citation tests, better intent
and synonym handling, approved clinical content, semantic retrieval/reranking if
measured gains justify it, U7 snapshot-aware evidence, and browser/mobile review.

### Observed results on 15 October

- Chat-specific suite: 16/16 TAP tests pass, including six actual MongoDB/HTTP
  subchecks for owner/staff scope, denials, current corrections and production
  routing. The remaining cases test pure retrieval, validation and mocked egress.
- Existing security plus U2 privacy regression suites: 18/18 TAP tests pass.
- Backend syntax and production frontend bundle: pass.
- OpenAPI contract: valid with 12 pre-existing warnings in unrelated operations.
- Strict app-project type check: fails on existing wider project errors; not
  represented as a passing gate. Live Gemini and full signed-in browser testing
  are not established by the build or backend tests.
- Login, signup and logout clear in-memory conversations so a subsequent session
  cannot inherit previous case chat. Pending replies append only to the original
  conversation, never a newly selected case conversation.
- No Git commit/push, deployment, secret edit, new dependency or development-data
  cleanup was performed for this checkpoint.
