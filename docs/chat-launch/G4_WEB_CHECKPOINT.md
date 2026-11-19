# G4 — Official public-topic web lookup

Date: 2026-11-18. Local engineering checkpoint, not medical launch approval.

## Delivered

- `RAG_CHAT_WEB_ENABLED=true` plus `RAG_CHAT_WEB_MODE=ALWAYS_PUBLIC` checks the official connector for every eligible registered public-topic question, including questions with local evidence. `FALLBACK` retains local-first behaviour; disabled remains the template default.
- `npm run dev:web` starts the normal local project with this opt-in mode. It does not enable paid model generation, embeddings or private-document export. The isolated synthetic preview is running the same web mode on loopback ports 5173/5001; restarting it requires signing in again.
- Only fixed public registry terms reach the fixed NLM endpoint. Raw questions, chat histories, identifiers and private cases are not submitted. Urgent/personal treatment, unknown-name, language, ambiguity and access boundaries run first. Project-only questions remain local. The current registry has 16 web-eligible topics; this is not unrestricted medical or internet coverage.
- Retrieved official material must match the selected topic and requested detail. Unrelated pages cannot replace missing evidence. A small one-record response can match an exact registered phrase without incorrectly failing the BM25 threshold; this is lexical matching, not semantic or clinical proof.
- Responses expose lookup status, whether web evidence actually supported the answer, citation links and publisher attribution. Cached results keep their original retrieval version; a cache hit is not labelled a new network fetch.
- Lookup has a 6-second transport cap, bounded XML, fixed-domain links, request coalescing, a 12-hour cache and local tool budgets/circuit controls. The 20-requests/minute connector budget is process-local, not a shared deployment ingress limit.
- Only MedlinePlus health-topic summaries are reused. Licensed drug monographs/encyclopedia content are not ingested by this connector.

## Verification performed

- Focused `node --test tests/chat-launch/always-web.test.cjs`: **9/9 passed**.
- `npm run build:frontend`: passed, including both TypeScript projects. Existing bundle-size and Browserslist warnings remain.
- Actual authenticated local API status: web enabled, `ALWAYS_PUBLIC`, paid generation disabled, private web policy `NEVER`.
- Actual public question “What is antibiotic resistance?”: HTTP 200, `PRECISE_WEB_EVIDENCE`, official citation/attribution, first lookup `RETRIEVED` (~2.3s); repeat `CACHED` (~12ms). These two observations are not a performance benchmark.
- Actual authenticated SSE endpoint: HTTP 200, `text/event-stream`, completed `done` event with cached web evidence and lookup metadata.
- Actual “How should I store Paracetamol?”: HTTP 200, `ABSTAIN`, `NO_RELEVANT_EVIDENCE`, no sources; no unrelated page was forced into an answer.
- Earlier fixed public transport probes returned HTTP 200/XML for both “medicine storage” and “antibiotic resistance”. The former returned unrelated disease pages, demonstrating why domain allowlisting alone is insufficient.
- Browser automation was unavailable; no new visual/browser acceptance is claimed. No broad full-suite rerun or paid model requests were performed for this slice.

## Source governance and remaining gates

Technical connector allowlisting is not clinical source approval. Academic-demo evidence is labelled `NOT_CLINICALLY_APPROVED`. Production remains `REVIEWED_ONLY`: fetching a current official page does not manufacture review records or bypass the approval gate. Coverage, professional reference-standard evaluation, shared production limits, security/privacy review and clinical sign-off remain necessary before public medical launch.

Publisher guidance and reuse boundaries were checked against:

- https://medlineplus.gov/about/developers/webservices/ — 85 requests/minute/IP service limit and recommended 12–24-hour caching.
- https://medlineplus.gov/about/using/usingcontent/ — health-topic-summary reuse/attribution versus licensed content restrictions.

## Gemini handoff

Use `docs/chat-launch/G4_PROMPT.md`. Discover up to six primary-source candidates; record actual terms, restrictions, verified size or `UNKNOWN`, and testing limitations. Propose a first sample no larger than 25 MB / 100 records. Download nothing yet; no patient data, invented clinical labels, bulk scraping or alterations to held-out tests.

All changes remain local and uncommitted/unpushed. The teammate's fetched baseline and older worktree changes have been preserved.
