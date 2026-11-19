# PharmaVault chatbot — final-year project completion plan

Date: 2026-11-18. Scope confirmed by the project owner: **industry-style final-year major project, not a public medical launch**.

This is the academic completion checklist. Earlier launch/pilot plans remain future-deployment guidance, not graduation or mentor-demo blockers. Keep authentication, tenant isolation, secret protection, source attribution, evidence-gap handling and educational-use boundaries in the prototype. Do not claim clinical approval, model superiority, autonomous prescribing or insurance adjudication.

## Current inspection

Read the active public/private transports, context resolution, reference registry, grounded synthesis, chat store, source-review interface and existing evaluation reports. No application code was changed and no paid model requests or dataset downloads were performed in this review.

- Active worktree: `NEWPHARMAVAULT-v3`, branch `version-3.0`; local improvements are not yet committed/pushed.
- Running authenticated API: `generationEnabled=false`, `embeddingEnabled=false`, `model=null`, public feedback receipts in MongoDB, web enabled with `ALWAYS_PUBLIC`.
- Registry: 22 routed topics, of which 10 are medicine names and 16 are web eligible. Four medicine topics have local precise references; six registered medicines have no local precise-reference content. The precise registry contains 24 references; the broader chat corpus reports 34 chunks. Counts are not medical coverage/accuracy scores.
- The ordinary precise-answer path uses BM25/local trained reranking, not demonstrated semantic/vector retrieval. Public generation adapters exist but the current demo is extractive; their prompt/support gate also deliberately limits generated prose to source sentences. Do not describe the current demo as an enabled free-form LLM, trained medical LLM or established GraphRAG implementation.
- Twelve offline diagnostic inputs exercised uses, follow-up, specific detail, coverage gaps, unsupported name, spelling confirmation, multiple details, simpler wording, unsupported language, project explanation and missing case scope. These were development diagnostics, not a clinical or held-out score.
- Five actual authenticated public chat requests returned HTTP 200: two cached cited web answers, one locally supported contextual follow-up after a web miss, one project explanation, and one clarification for a multi-detail question. No fresh paid generation was exercised.
- Authenticated case listing returned HTTP 200 with zero cases for the synthetic preview patient. This does not establish whether other users/databases have cases; it means this account has no prepared case demo yet.
- Chats are intentionally in memory: bounded history and conversation count, cleared on refresh/sign-out. English only. Unknown names and multiple requested attributes often need clarification. These are present scope limits, not deployment-policy paperwork.
- Private chat uses the protected prioritized-answer endpoint and source-bound freshness contract. Existing research results concern the older frozen bounded track; do not present them as fresh measurements of the updated full chatbot.

## Minimum complete project — four must-finish checkpoints

Progress update: the populated Academic Reference Standard v1 is now available
in `docs/chatbot-reference-standard/v1/`. It contains 100 scenarios / 50 exposed
authored families, a source catalogue, answer key, reviewer sheet, integrity
freeze and offline evaluator. Baseline: 92/100 mechanical item checks; eight
misses remain in six quality families. Human academic review and live-generation
acceptance remain open. This replaces the earlier blank-pack preparation task,
not the need for honest review or an independent future research evaluation.

| Checkpoint | Deliverable | Completion evidence | Ownership |
|---|---|---|---|
| A1 — Small, useful evidence pack | Cover the 10 already registered generic names and selected general pharmacy topics with attributed, versioned public references. Distinguish uses, side effects and storage; show a gap where a section is absent. Correct G4 rights/size claims before bounded acquisition. Dataset remains test-only until a deliberate academic-source integration step. No 1 GB target. | Coverage matrix; source URLs/version/hash/jurisdiction; measured size capped at 25 MB / 100 acquired records; no invented labels or claims of Indian brand equivalence. | Gemini: bounded metadata/data preparation under a separate prompt. Codex: source adapter and coverage wiring. |
| A2 — Finish the contextual RAG answer experience | Demonstrate the existing public-only LLM path with an exact configured model ID and source-supported fallback, or explicitly deliver an extractive mode. For the intended LLM-backed project, live bounded generation is still needed. Preserve medicine/topic and requested detail in follow-ups. Add structured section-by-section handling for common multi-detail questions rather than clarifying every combination. Improve repetitive answers without weakening citation/support checks just to make prose sound fluent. | One complete public retrieval → model → cited answer demonstration; follow-up and topic-switch examples; visible extractive fallback on provider failure; no private-case/history export. Any new synthesis contract gets focused support/failure checks. | Codex. Gemini may supply small public synthetic phrasing fixtures, not medical gold labels. |
| A3 — One reproducible evidence-case demo | Prepare synthetic prescription + invoice, with optional claim form, for the preview patient. Show upload, OCR/correction, medicine scope, mismatch explanation, source page/field inspection, human review and a cited-field correction marking the historical answer stale. | A fixed demo script with expected document facts; actual API/client walkthrough; no guessed medicine grouping or automatic claim decision. Use the existing prioritized source path and verify both documents' requested fields are visible. | Codex integration; Gemini may prepare clearly synthetic input documents under a separate prompt. |
| A4 — Honest evaluation and reproducible handoff | Freeze a new bounded evaluation set separate from source text and exposed development fixtures. Report retrieval, citation support/completeness, context routing, appropriate refusal and local/API latency separately. Prepare a clean-clone setup, mentor guide and final Git checkpoint. | Aim for 50–100 independent scenario families if feasible; otherwise report the actual smaller denominator. Group related medicine/SPL versions across splits. Use mentor/peer checking for document facts/source matching; do not call it expert clinical validation. Compare BM25 and the current reranker fairly; GPT/Claude comparisons are optional. Preserve previous frozen results. One setup/build and one bounded end-to-end acceptance run, not repeated full-suite cycles. | Gemini: format/manifest checks and isolated evaluation preparation. Codex: runner/integration, results and handoff. |

Work order: fix coverage and public answer experience, then demonstrate the evidence-case workflow, then freeze/evaluate/package. These can share one focused integration batch where ownership does not overlap. Send a bounded Gemini prompt before implementation starts; do not let both agents edit the same files.

## Useful polish, not completion blockers

- Opt-in user-scoped saved public conversations with delete/clear controls. Until implemented, retain the accurate in-memory notice; do not silently persist private case chats to browser storage.
- Supported-topic/coverage panel, clearer source badges and a compact evidence-quality summary. Do not manufacture confidence percentages.
- Additional languages, voice, SwiftUI scanning, more medicines, embeddings and a more flexible agent are extensions after the core flow works. Enable semantic retrieval only if a fair evaluation demonstrates a benefit worth its complexity.

## Explicitly deferred beyond this academic milestone

Public deployment approval, legal/regulatory certification, a multi-clinician adjudicated clinical gold standard, real-patient studies, multi-region/distributed scaling, enterprise SLAs, national terminology completeness, certified NHCX conformance, real insurer adjudication and a 1 GB training corpus. These are not required to demonstrate an industry-style engineering prototype.

For the research paper, report the implemented engineering contribution and measured bounded results. Industry-style means a coherent, secure, reproducible and evaluated workflow—not unlimited medical coverage or a claimed novelty percentage.

## Stop condition

The chatbot milestone is complete when a mentor can run the project, obtain supported public answers with context/citations and honest fallback, complete the synthetic document-evidence/correction demonstration, inspect the evaluation results and reproduce the setup. List remaining optional features as future work instead of repeatedly expanding the definition of done.
