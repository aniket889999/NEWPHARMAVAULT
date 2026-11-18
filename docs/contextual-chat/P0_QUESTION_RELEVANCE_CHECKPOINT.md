# P0 — Question relevance and evidence boundaries

Date: 17 November 2026. Status: implemented as the first launch-readiness checkpoint, **not** approval for public clinical use. Scope is the Health Assistant chatbot; unrelated mentor-demo modules remain separate.

## User-visible corrections

| Request | Previous failure | Current behavior |
|---|---|---|
| “Can Metformin affect vitamin B12?” | A general medicine overview could displace the relevant passage. | Selects the existing B12 passage and its qualification, with its original source. |
| “How should I store Paracetamol?” | A topic match could yield unrelated cautions or side effects. | Checks the requested attribute; tries the approved-source fallback when enabled, then abstains if no supporting passage is found. No invented storage temperature. |
| “Earlier: Paracetamol. Now explain Metformin.” | Both medicine mentions could trigger ambiguity or retain the old focus. | Explicit switches select the new topic and intent. Negated or genuinely ambiguous switches do not silently choose one. |
| “Explain Paracetamol in Marathi.” | An English answer could appear to satisfy an unsupported language request. | Explicitly discloses English-only support and offers an English answer, without calling web or model tools. |

The UI distinguishes a missing supporting passage from a text match. The latter explicitly asks the user to verify the source; it is **not** a clinical-confidence score. Multiple medicine details are clarified rather than silently answering only one. Project “risk signals” remain project knowledge, not medicine side effects.

## Implementation and privacy boundaries

- A local question plan separates the requested attribute from topic and presentation style. Specific anchors must occur together in a complete candidate sentence before that passage is eligible for ranking. Small spelling/symptom equivalences are explicit, not a general medical ontology.
- Relevance filtering precedes the trained reranker and reviewed source preferences. Composition repeats the support check; an unrelated caveat cannot become the answer when the supporting sentence does not fit the answer limit.
- Official-source results must also identify the selected topic. A page being on an approved site is insufficient by itself. No unrestricted browser/search agent was introduced.
- Raw query anchors, history and private identifiers remain local. Public response metadata contains only fixed request/status labels. The existing approved web tool receives a registered topic ID, not the raw question. Private-case routing and safety rules remain ahead of presentation rules.
- Newly supported detailed answers remain **extractive**, even when optional public model generation is configured. The existing fixed-topic synthesis contract is not treated as sufficient to preserve a fine-grained question. Its future replacement needs separate evaluation.
- No clinical source text, source-review dates, training examples or trained model weights were changed. No claim is made to have fine-tuned Gemini/GPT/Claude. Historical evaluation artifacts and their frozen implementations were not rewritten.

## Verification

- New question-relevance suite: **36/36** tests, including specific facts, follow-ups, switches, ambiguity, missing evidence, language boundaries, safety/private precedence, web relevance, export minimization, UI labels and local-only detailed answers.
- Combined contextual/precision/curation/comparison/relevance suites: **103/103**. Frozen historical research integrity: **3/3**; combined **106/106**.
- Existing chat regression: **53/53**. Provider-readiness checks: **33/33**; protected readiness HTTP checks: **7/7**.
- Strict TypeScript, frontend production build, backend syntax and owned chat UI lint: pass. OpenAPI: valid with **11 existing warnings**. JSON schemas: **14/14** valid.
- The exact staged candidate was also exported without unrelated uncommitted mentor changes and passed the frontend build, all 103 contextual checks, 3 frozen-result checks and 53 existing chat checks. Installed dependencies were reused; no credentials were copied.
- Browser walkthrough on the updated application with isolated synthetic accounts: B12-specific answer plus expanded source; missing storage evidence after an approved public-source lookup; explicit topic switch; unsupported-language disclosure. Proof images are saved outside the repository under the workspace `output/contextual-chat/` directory.
- **No paid model requests** were made for this checkpoint. One approved, public-topic MedlinePlus lookup was observed in the browser; insufficient results correctly produced abstention. HTTP tests use guarded disposable databases/run-owned synthetic records.

The existing 16 developer-authored retrieval challenges still yield 11/16 for bare BM25 and 16/16 for both the strong rule baseline and trained reranker. This remains a development result, not held-out clinical evidence, and does not demonstrate a learned-model advantage or GPT/Claude superiority. Earlier live-generation failures remain disclosed in the historical report.

## Known limitations and next launch gates

1. This is a conservative English lexical guard, **not semantic entailment, contradiction detection, comprehensive language understanding or clinical validation**. Paraphrases and unlisted vocabulary can cause abstention; overlapping words can still be misleading. Source-qualified text matching must not be advertised as proof of correctness.
2. The small, general educational reference library is not a comprehensive licensed Indian medicine/product catalogue. Storage, mechanisms, formulation-specific details and uncommon questions often lack coverage. Do not fill these gaps with fabricated content or arbitrary web snippets.
3. Unsupported-language detection is bounded, not a complete language classifier. Verified multilingual support requires reviewed translations, safety tests and qualified reviewers.
4. An independent pharmacist-reviewed evaluation set, provenance/licensing/freshness governance, blinded ratings and failure analysis are required before quality claims. Direct GPT/Claude comparison remains gated on private credential/model configuration and the user's bounded approval; no comparison was run here.
5. Optional general-answer generation still needs its own semantic-support evaluation. New detailed answers deliberately do not use it yet. Feedback remains review-gated source-ranking policy, not automatic training on patient conversations.
6. Public deployment still needs the separate session/security review, durable shared state and multi-instance behavior, privacy/retention/deletion procedures, monitoring, load/failure testing, backup restoration and incident-response checks. These were not completed by this P0 checkpoint.

## Reproduce without paid providers

```sh
node --test tests/contextual-chat/*.test.cjs
node --test tests/rag-v2/published-results.test.cjs
npm run test:chat
npm run test:readiness
npm run test:readiness:http
npm run build:frontend
npm run check:backend:syntax
npm run validate:contract
npm run validate:schemas
npx eslint src/components/chat/ChatMessage.tsx
```

Do not run HTTP suites against a normal application database. Do not overwrite historical evaluation output to represent a new candidate; generate a separately named result if new evaluation is needed. This checkpoint does not accept every legacy feature, certify NHCX conformity or authorize clinical/claim decisions.
