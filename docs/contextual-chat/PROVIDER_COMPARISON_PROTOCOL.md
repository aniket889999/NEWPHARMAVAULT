# GPT/Claude comparison — component pilot, not a promised win

Prepared 17 November 2026. Protocol status: developer-authored diagnostic; no independent gold-standard, medical review or live GPT/Claude result yet.

## Research question

Under a fixed public-evidence budget, how do PharmaVault's local evidence reader and the explicitly configured GPT/Claude API models differ in contextual relevance, source traceability, evidence-gap handling and answer usefulness?

This is **not** a comparison with the whole ChatGPT/Claude products, an unrestricted medical-knowledge competition, or a claim that a small local model is generally more intelligent. The local component reuses production context/safety, trained ranking and concise source-note functions but has a comparison wrapper. The full application's database authorization, web fallback, case lifecycle and clinical usability are outside this pilot.

## Controls and six fixed task families

1. Direct definition with an important distinction.
2. Medicine side effects with a material serious-risk qualification.
3. Follow-up retaining the earlier medicine.
4. Explicit topic switch after a different medicine.
5. Requested fact absent from the supplied evidence.
6. Ambiguous medicine reference requiring clarification.

Only fixed, bundled public reference text and synthetic user-history questions are sent. No real patient records, private cases, identifiers, live chats or hidden application state. These tasks are visible development families, not held-out data. The two APIs receive **identical evidence, question/history, instructions, output schema and word limit**. Expected actions and scoring patterns stay local and are never included in the requests. The local reader receives that same source pack, without extra medical facts or network tools.

Every API request is capped at 1,024 output tokens and 8,000 characters for the entire serialized body, uses fixed official HTTPS destinations, disables tools, rejects redirects and has a bounded timeout/response body. Provider order alternates across tasks. There are no retries, model substitutions, hidden extra probes, embeddings, answer repair calls, or “keep trying until we win.” Reasoning/sampling defaults may differ and must remain disclosed. Account/model access is verified only by actual responses, not credential presence.

Source, prompt, ranking and runner hashes are recorded before/after execution. A changed candidate stops remaining calls. A durable ledger reserves each attempt before sending; interrupted/failed calls count. Incremental private result files preserve completed observations. Unavailable providers remain `NOT_RUN` with null scores, not a fabricated zero or defeat. API/format failures are retained separately from completed-answer quality.

## Metrics and grading

Automated diagnostics: format validity, developer-labeled action agreement, answer length, known source IDs and exact quotation presence, and limited required/forbidden pattern coverage. Citation checks on non-answer actions are **not applicable**, not automatic successes. A quotation can be real while its associated claim is wrong: none of these checks establishes semantic entailment or clinical correctness.

The generated blinded packet includes question, bounded history, evidence/version and random answer IDs. It does not include system/model names or prefilled human ratings. A separate private mapping enables later unblinding. Reviewers grade context relevance, factual support, completeness and uncertainty handling from 0–2, and flag unsafe claims. Medical labels require a qualified pharmacist; record reviewer identity/qualification, independence, disagreement resolution and conflicts. Do not invent reviewers or use this assistant's judgment as independent validation. Writing style can still weaken blinding.

Record model IDs, date, returned model versions, prompt/source hashes, failures, token usage and latency. Do not infer dollar cost without verified model-specific prices, or claim equal compute from equal token caps. Do not pool failed, unavailable, extractive and generated answers under an unexplained “accuracy” percentage.

## What would justify a stronger conclusion?

This six-case pilot can reveal implementation defects and help design the next experiment; it cannot establish broad or clinical superiority. The runner deliberately reports `superiorityEstablished:false`, even when diagnostic scores look favorable. It does not turn a development score into a paper claim.

Before a paper claim, freeze the candidate and primary metric, obtain independently authored family-disjoint examples and qualified source/medical labels, define sample size and meaningful effect in advance, lock blinded ratings, then calculate paired differences and uncertainty intervals with an appropriate statistical analysis. Include failures and non-inferiority/safety checks. Report ties or losses. Keep any later changes on development data and evaluate a new candidate on genuinely new test families.

Possible defensible wording after a suitably designed study: “On the specified evidence-verification task and tested model snapshots, the system improved [reviewed metric] by [measured amount and uncertainty].” Never replace this with an unsupported percentage of novelty, “better than all GPT/Claude,” or “clinically validated.”
