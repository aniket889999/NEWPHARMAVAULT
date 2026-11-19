# Remaining chatbot work — final-year completion scope

Target: a complete, industry-style educational major-project prototype, not a public medical launch. Baseline: Academic Reference Standard v1, scorer 1.0.2, **92/100 mechanical item checks, 44/50 complete authored families**. Human review is pending. No application changes were made for this baseline.

## P0 — Six observed fixes (eight scenarios)

| Fix | Failed items | Observed problem | Required change / owner |
|---|---|---|---|
| Explicit fact intent | F07-02 | A question about antibiotics and viral colds returns clinician-advice caveats but omits the requested distinction. | Codex: preserve the requested fact during question planning and sentence selection. Do not merely add more generic caveats. |
| Complete OCR explanation | F10-01, F10-02 | It describes uploads/Tesseract/bounds but omits human correction/confirmation. | Codex: include extraction plus correction when explaining the process. |
| Project identity explanation | F11-01, F11-02 | “Medicine identity resolution” is mistaken for a request to identify an unspecified product. | Codex: distinguish explaining the project workflow from identifying an actual medicine, after access/safety checks. |
| Useful freshness explanation | F12-01 | It gives a clinical-validity disclaimer without explaining cited corrections/stale historical answers. | Codex: select the mechanism and consequence, not only a definition/caveat. |
| Topic switch versus treatment switch | F16-02 | “Switch to Metformin” in a conversational topic change is treated as a substitution request. | Codex: preserve explicit topic-switch intent without allowing genuine personal substitution advice. |
| Clarify ambiguous known names | F17-01 | A negated switch containing two known medicines is called unsupported coverage. | Codex: clarify the referent instead of mislabelling known names. This is a quality miss, not an observed harmful recommendation. |

The reviewer-action false failures from the initial scorer were caused by escaped Markdown, not absent application actions. They are corrected in the scorer and must **not** become unnecessary product work.

## P1 — Finish the intended chatbot features

| Order | Deliverable | Exit condition | Ownership |
|---|---|---|---|
| 1 | Small evidence coverage expansion | Support the 10 existing generic-name routes with section-specific, attributed/versioned references; show explicit gaps. Only four medicine topics currently have local precise references. Correct G4 rights/size assumptions before bounded acquisition; no 1 GB requirement. | Gemini: isolated source metadata/preparation. Codex: ingestion adapter and retrieval wiring. |
| 2 | Demonstrated public LLM-backed RAG | Exact configured model ID; public retrieval → generation → citations; natural concise answers where supported; honest extractive fallback. The running demo currently has generation and embeddings off. The present generation guard selects source sentences; free-form ChatGPT-like synthesis is not already demonstrated. | Codex. No private case text/history exports or unbounded paid tests. |
| 3 | Better multi-detail conversation | Answer common uses/side-effects questions in separate sourced sections, retain follow-up context, and ask only when scope truly is ambiguous. Version the current v1 clarification policy when changing behaviour. | Codex; Gemini can prepare bounded phrasing fixtures. |
| 4 | Opt-in persistent public chat history | User-scoped save/reopen/delete/clear; server authorization; no cross-user history. Keep public memory distinct from private case scope and do not silently persist patient data to browser storage. The current chats are in-memory only. | Codex. |
| 5 | One complete synthetic case demonstration | Prescription + invoice, optional claim form; upload/OCR → correction → mismatch explanation with both document citations → human review → stale answer after cited correction. The preview patient currently has no prepared case. Pure case/freshness passes here are not the real HTTP/browser walkthrough. | Codex integration; Gemini may prepare clearly synthetic input documents. |
| 6 | Human academic review and new evaluation | Mentor/peer verifies source/document facts using the supplied rubric and CSV. Freeze additional independently authored families before scoring generalization. Record full denominators and actual model/API latency separately from offline timings. | Mentor/teammate review; Codex runner/integration. AI audits are supporting evidence only. |
| 7 | Final reproducible handoff | Clean-clone setup, secret-free examples, versioned evidence pack/results, supported-topic list, mentor demo guide, and an explicit Git checkpoint/push after review. Do one bounded full-path acceptance run, not repeated broad suite cycles. | Codex / project owner. |

## Not required to complete this academic milestone

Clinical certification, three-clinician adjudication, real-patient trials, public deployment approval, nationwide brand/regulatory coverage, a trained-from-scratch LLM, an arbitrary 1 GB corpus, paid GPT/Claude superiority tests, enterprise SLAs, multi-region scaling, multilingual/voice support or SwiftUI scanning. Keep those as honest future work.

## Concrete next batch and stopping point

Fix the six P0 quality issues together under a new candidate snapshot, without changing v1 labels or results. In parallel, Gemini can do a short source/fact audit or the separately approved G4 data task; it must not edit the chatbot files. Then finish public generation/history and the synthetic case demo. Close the milestone after source-grounded/contextual answers, memory controls, the correction/freshness demonstration, reviewed academic evaluation and reproducible setup all work. Do not continue adding unrelated features indefinitely.
