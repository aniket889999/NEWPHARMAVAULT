# Precision, reviewed retrieval and evaluation checkpoint — 17 November 2026

Status: implemented and checked as a research prototype. Independent clinical gold-standard validation and GPT/Claude comparison remain open. Other mentor-demo modules are not accepted by this checkpoint.

## What changed

- The public chatbot separates topic, question focus and answer length. Definition/prevention/side-effect follow-ups retain bounded user context; assistant messages do not become evidence. Concise source sentences keep material safety limitations.
- A reproducible **pairwise linear retrieval reranker** was trained locally on 42 developer-authored synthetic source-selection queries / 966 pairs. It ranks public references; it does **not** fine-tune Gemini, GPT or Claude weights. Training loss decreased from about 0.69315 to 0.02856; loss is not a clinical-quality score.
- The current public registry contains 24 passages, including eight short original source-checked summaries/project guides. Government summaries identify their US scope; they do not establish Indian product approval or substitution. Historical source snapshots are not represented as newly clinically validated.
- Optional public Gemini synthesis receives only registered passages and fixed topic/focus/style labels. No raw history, identifiers or private documents are exported. Unknown citations, invented quotations, dosage advice and unsupported numbers trigger source-note fallback. Mechanical citation checks cannot prove semantic entailment or medical correctness.
- Local coverage gaps can use the fixed MedlinePlus topic service when enabled. This is bounded tool routing, not unrestricted autonomous browsing. Web synthesis needs a separate flag. Private case chat never falls through to web/model generation.
- Authorized organization reviewers can propose public source-ranking preferences. A **different reviewer** must approve; atomic revisions, tenant checks, a review journal, corpus-version checks and revocation apply. Preferences change ranking inside an already topic/focus-compatible pool, not source facts or model weights. Historical answers remain unchanged. Feedback stores rating/source metadata, not raw patient text; it is not automatically applied.
- The UI now shows focus, length, sources, actual retrieval method and reviewed policy version, explicitly not a clinical-accuracy score. Existing staff login DTOs need not expose organization membership: the protected API checks membership from the authenticated database user.

## Actual development results

The 16 examples are visible, developer-authored development challenges with known source families, not an independent held-out gold standard.

| Expected top-source selection | Correct / total |
|---|---:|
| Bare BM25 | 11 / 16 |
| Strong context/focus rule baseline | 16 / 16 |
| Trained context reranker | 16 / 16 |

The trained reranker **ties** the strong rule baseline. The result does not isolate a learned-model benefit and does not prove superiority over general-purpose assistants. Full per-case outcomes and current code fingerprints: `PRECISION_DEVELOPMENT_RESULTS.json`.

## Bounded live Gemini pilot

Exactly **6** generation requests, at most **1,024 output tokens each**, zero embeddings/retries; public references only, no raw history or private data. Three developer-selected questions were answered by two pipeline variants using the same `gemini-2.5-flash` model and shared base corpus.

| Pilot observation | Prior conversational pipeline | Enhanced precise pipeline |
|---|---:|---:|
| Expected source selected | 3 / 3 | 3 / 3 |
| Generated answer passed mechanical checks | 3 / 3 | 1 / 3 |
| Source-note fallback after generation did not validate | 0 / 3 | 2 / 3 |
| Returned answer within scenario word bound | 3 / 3 | 3 / 3 |

The enhanced generator was **not more reliable in this pilot**. Its two fallbacks remain disclosed; the validator was not relaxed and no extra paid retry was made. The report does not retain provider raw text/errors, so it does not diagnose the exact rejected content. These are format/citation/length observations, not blinded medical grading. `PUBLIC_PRECISION_PILOT_2026-11-17.json` preserves the exact candidate hashes tested; later comment/UI/API metadata changes do not retroactively change that report. A future generation revision needs a new separately authorized pilot.

## Checks executed

- Context/precision/curation real-HTTP and offline suites: **52 / 52**.
- Existing chat regression: **53 / 53** (production integration expectation updated to the new precise-local mode, retaining auth/citation/local-only assertions).
- Provider readiness offline/client/schema: **33 / 33**; real HTTP: **7 / 7**.
- Frozen historical research-result integrity: **3 / 3**; old research implementations/data/results unchanged.
- Strict TypeScript and frontend production build: pass. Owned chat UI lint: pass. Backend syntax: pass.
- OpenAPI: valid, **11 pre-existing warnings**. JSON schemas: **14 / 14** valid.
- Browser walkthrough on the same application with isolated synthetic data: definition → prevention follow-up; original source visible; reviewer proposal stays pending and cannot self-approve; independent organization admin approval; next answer displays policy version 1. Screenshots saved outside the repository under the workspace `output/contextual-chat/` directory. No paid generation was enabled on the mentor server.
- Full legacy/module acceptance is **not** implied by these focused checks. Unrelated mentor/Gemini work remains separate.
- An export of the exact staged candidate, without unrelated uncommitted demo changes, also passed the frontend build, all 52 contextual checks, all 3 frozen-result checks and all 53 legacy chat checks. Dependencies were reused locally; no credentials were copied to that export.

## Remaining research gates

1. Fill server-only comparison credentials/model IDs privately as described in `BENCHMARK_ACCESS.md`; current readiness check reports both providers unconfigured. No direct OpenAI/Claude calls were made.
2. Agree a separate public-only cross-provider request/token budget before live comparisons. The six Gemini approvals are exhausted and are not an ongoing server-generation permission.
3. Independently author and medically review a test set using `GOLD_STANDARD_PROTOCOL.md` and the empty template. Freeze the candidate before independent scoring; do not fabricate experts or tune on test labels.
4. Investigate public generation rejection with a future bounded, privacy-safe diagnostic pilot. Retain fallback and refusal gates.
5. Broader language/catalogue coverage, durable multi-instance receipts and professional clinical review remain future work. No production medical, NHCX-certification, percentage-novelty or GPT/Claude-superiority claim is supported.

## Reproduce without paid calls

```sh
node backend/scripts/trainPrecisionRanker.js
node backend/scripts/evaluatePrecision.js --output docs/contextual-chat/PRECISION_DEVELOPMENT_RESULTS.json
node --test tests/contextual-chat/*.test.cjs
npm run test:chat
npm run test:readiness
npm run test:readiness:http
node --test tests/rag-v2/published-results.test.cjs
npm run build:frontend
npm run validate:contract
npm run validate:schemas
node backend/scripts/checkBenchmarkConfig.js
```

HTTP suites use guarded local test databases and delete only their run-owned synthetic records. Do not point them at a normal/development database. The live-pilot script defaults to dry-run; its explicit execution flag is not permission to spend another budget.
