# Provider comparison checkpoint — 17 November 2026

Implemented:

- Server-only OpenAI Responses and Claude Messages adapters using official API shapes, fixed destinations, matching public inputs/structured output contract and 1,024-token caps.
- Six public/synthetic development scenarios; no private patient/case data, labels in model prompts, web tools, retries, fallback models or Gemini calls.
- Exclusive durable 12-attempt approval ledger (6 per provider); attempts are reserved before egress and survive restarts. A consumed ledger cannot be overwritten to silently reuse the approval.
- Incremental private result journal, explicit unavailable/failed outcomes, token/latency reporting, byte fingerprints, shared prompt/evidence hashes and candidate-change stopping.
- Randomized blinded-review packet with empty ratings and separate private unblinding map. No automatic clinical or superiority verdict.
- A local component baseline reusing production context/safety/ranking/source-note functions with the same public source pack. This is not a whole-product benchmark.

Actual checks:

- `node --test tests/contextual-chat/provider-comparison.test.cjs`: **14/14 pass**, mocked/offline only, no paid requests.
- Dry run: local component completed six action checks, four applicable quotation checks, six word-limit checks. GPT and Claude each remain **6 NOT_RUN**, with null outcome scores.
- Both private keys and model IDs were absent at readiness inspection; actual provider access is unverified. The user approved up to 12 bounded requests **after** configuring access; zero of that budget has been spent by this checkpoint.
- Combined contextual/precision/curation/comparison suites: **66/66 pass**; frozen-result checks **3/3**; existing chat regression **53/53**; provider-readiness checks **33/33**. Backend syntax and strict TypeScript/frontend build pass. The first local database attempt was permission-blocked; these results are from the successful rerun with isolated-database access.
- Added the new precision/curation/comparison gate to the existing CI workflow. This describes configuration; hosted CI success is not claimed by the local result.

No GPT/Claude superiority has been measured. Further gates: configure keys/model IDs privately, enable the explicitly approved live flag, run once within the ledger limit, independently grade outputs, and design a larger frozen family-disjoint study before making a paper claim. Other application/demo work remains preserved and out of scope.

Run instructions and exact privacy/budget controls: `BENCHMARK_ACCESS.md`. Research scope and scoring limitations: `PROVIDER_COMPARISON_PROTOCOL.md`.
