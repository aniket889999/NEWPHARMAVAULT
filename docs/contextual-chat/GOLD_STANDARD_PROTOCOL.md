# Reference standard and superiority protocol

Prepared 17 November 2026. This protocol is ready; independent/expert annotation and direct GPT/Claude scoring are not completed.

1. Freeze the candidate code, source versions, trained reranker, prompt and model configuration. The local evaluation records actual source hashes, not a claimed independent acceptance signature.
2. An independent author prepares new dialogue/document families without exposing test answers to the implementation owner. Use synthetic document facts or consented de-identified data. Never export private case material for a model benchmark by default.
3. Label expected action, item/topic, required/forbidden claims, exact supporting sources and evidence version. A qualified pharmacist must review medical labels; a source-checking script is not a clinician. For document facts, independently verify against the controlled documents. Resolve disagreements and record the adjudication.
4. Use an adequate family-disjoint sample and state denominators. Keep training/development/reference-standard data separate. The included 16-case challenge is developer-authored development data with known source families, not an unseen gold set.
5. Compare bare retrieval, strong context/focus-filtered retrieval and trained reranking. Compare generative systems with the same task/evidence access, documented model IDs, token limits, dates, prompts, tools and prices. Record unavailable/failed runs rather than silently dropping them. A ChatGPT or Claude product subscription does not identify an API model.
6. Score topic/item scope, source selection, claim-level factual support, completeness, correct abstention, unsafe claims and privacy violations separately. Include blinded human answer grading and uncertainty intervals. Mechanical citation matching is only a traceability check; it does not establish semantic entailment.
7. Report latency, input/output usage and cost alongside quality. A six-request Gemini pilot is a smoke/precision diagnostic, not statistical superiority evidence.
8. Release a reviewed knowledge or model change only after regression checks. Feedback is not a factual label. The current two-reviewer workflow changes organization-scoped source preferences, not medical content or model weights.

Use `gold-standard.template.json` as the annotation envelope. It is intentionally empty until an independent reviewer supplies labels. Do not fill it with fabricated expert names, clinical ratings, novelty percentages or claimed GPT/Claude wins.
