# PharmaVault Context-Aware Evidence Assistant

Priority reset: 17 November 2026. Chatbot first; other mentor-demo modules are on hold. Existing work is preserved, not deleted. This is a new extension; frozen Sessions 1–6 implementation/data/results are unchanged.

## Product objective

Answer pharmacy-document and bounded educational questions with the right conversation/case/medicine context, inspectable evidence, explicit uncertainty and accountable review. Evaluate whether it outperforms a general assistant on these specific tasks; do not claim global superiority over GPT/Claude or a novelty percentage.

## Architecture

Validated question + bounded history → safety/domain boundary → topic/intent context → authorized case retrieval OR public local retrieval → if public evidence is missing, approved official-topic search → source-linked answer or abstention → optional feedback receipt.

- Private documents and case questions stay on the existing local, authorized case-answer path. A missing private field never causes a web lookup for that patient's information.
- Public reference mode retains the existing optional BM25 + Gemini embedding/RRF retrieval and Gemini explanation adapter. The default offline run does not claim that a model is active.
- C1 web lookup is the MedlinePlus health-topic search API, not general Google Search or arbitrary web scraping. Only fixed registry terms leave the server. Raw questions, histories, identifiers and patient documents do not.
- The C1 web answer is labelled extractive official source notes, not LLM synthesis, a medicine monograph or India-specific regulatory guidance. Unsupported topics and poor matches abstain.
- Context carries topic and bounded intent/style, not assistant-authored facts. New chats have no inherited context. Ambiguous medicine references ask for clarification.

## Checkpoints and acceptance

| Order | Work | Acceptance boundary |
|---|---|---|
| C1 | Context + bounded web fallback + feedback foundation | Correct follow-ups/topic switches; no private egress; visible source/mode/tool outcome; no automatic training. |
| C2 | Broader reviewed corpus + contextual synthesis | Source/version/coverage registry, meaning-preserving summaries, safe public generation, citation/relevance evaluation, failure/latency/cost limits. Expert approval before clinical reference expansion. |
| C3 | Review-controlled improvement loop | Feedback → expert-selected de-identified candidate → source verification → versioned knowledge change → regression tests → approved release. User feedback alone cannot become knowledge. |
| C4 | Gold-standard evaluation and research | Independently prepared reference labels, expert review where clinical content is involved, frozen test split, paired baselines, per-task results and error analysis. |

## What “training” means here

RAG updates the retrieved knowledge/context; it does not update model weights. C1 stores rating metadata only, not raw chats or proposed patient facts. A receipt expires after one hour; stored feedback metadata has a 30-day TTL. No durable personal memory, fine-tuning job, autonomous knowledge promotion or self-learning is implemented.

Fine-tuning is optional later, only if a separately consented, de-identified, licensed and reviewed dataset establishes a need. It is not required to demonstrate contextual retrieval.

## Proposed gold-standard protocol — not completed results

The current `tests/contextual-chat/context-development.json` has 19 synthetic development routing examples. Its status is **PROPOSED_REFERENCE_NOT_EXPERT_VALIDATED**. It is not unseen data, clinical accuracy evidence, or a gold-standard medical dataset.

Prepare a separate new evaluation set with dialogue families: direct question; multi-turn pronoun; changed topic; ambiguous medicine; source contradiction; missing evidence; outdated evidence; private-case isolation; personalized treatment request; and official-search failure. Expected fields: topic/item scope, required supporting source/field IDs, acceptable answer claims, prohibited claims, abstention/clarification requirement, and reference version. Clinical answer labels require qualified review; synthetic document facts can be independently checked against the disclosed documents.

Compare (1) ungrounded model, (2) basic single-turn RAG, (3) context-aware local RAG, (4) context-aware approved-web RAG. Keep model/version, evidence access and task conditions comparable. Report scope accuracy, retrieval recall/precision, citation support, unsupported claims, correct abstention, privacy-tool violations, answer-change sensitivity, latency and cost separately. Testing GPT/Claude by name needs a recorded model/version and controlled authorized runs. Do not tune on the test labels or replace the historical paper results.

## Provider documentation

[MedlinePlus Web Service](https://medlineplus.gov/about/developers/webservices/) documents the fixed HTTPS search endpoint, XML response formats, attribution and caching/rate guidance. PharmaVault displays MedlinePlus attribution without implying endorsement. A bounded cache is not proof that source content is currently unchanged.

## Current limits

Small routing vocabulary; English official search; short in-memory conversation context; deterministic tool routing rather than an unrestricted autonomous agent; no new fine-tuned model; no expert-validated clinical gold set; no demonstrated GPT/Claude superiority. A rule/quote test pass does not prove semantic entailment or clinical safety. Web lookup is separately opt-in with `RAG_CHAT_WEB_ENABLED=true`; external LLM generation retains its own explicit flags. Default environment files and private-export policy are not silently enabled.
