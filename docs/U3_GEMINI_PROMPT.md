# Gemini assignment: U3

Implement U3 in `/Users/aniket/Downloads/PBL 5 TH SEM` on the existing `feature/work-order-3-domain-contract` branch.

Read `docs/UPGRADE_CHECKPOINTS.md`, `docs/U2_HANDOFF.md` and `docs/U4_U5_HANDOFF.md`. Preserve all existing edits. Codex owns `ios/`, deployment/privacy configuration, the verification UI and `backend/tests/u5GoldenWorkflow.test.js`; do not edit those files. No commits, deployment, secret disclosure, database-wide cleanup or unrelated refactoring.

1. Confirm U1.1's strict disposable-database guard and focused U1 authorization tests. Use guarded local test databases and fixture-scoped cleanup only; never development data. Do not run conflicting database cleanup concurrently with U5.
2. Fix the **real OCR blocker first**. Tesseract 7 defaults to text-only output; production calls `worker.recognize(imageBuffer)` but reads `data.blocks`. The U5 probe got 54 text characters, zero default blocks and one explicitly enabled block. Request `{ text: true, blocks: true }` in the third recognize argument. Add a real-provider synthetic regression proving actual text, non-empty lines/words and valid source coordinates. Do not fabricate fields or weaken U5 assertions.
3. Validate PDF viewport dimensions/pixel limits BEFORE allocation. Bound render time, global concurrency, queue length, cache bytes/page count and retention. Timeout must terminate/cancel the work, not merely reject a Promise while it continues allocating.
4. Apply protections to both case processing and authenticated on-demand previews. Keep PDF execution/rendering local; disable scripts and external resource retrieval.
5. Use `backend/config/documentStorage.js` `getDocumentStorageRoot()` for previews. Keep storage private, errors sanitized and internal paths/keys out of public responses. Eviction must never delete original documents.
6. Record total, processed and omitted page coverage. More than the supported processing limit remains explicitly incomplete and human-review-required. Publish exact API/schema changes for Codex; do not claim full analysis of omitted pages.
7. All `RiskSignal.evidenceItemIds` must reference actual same-case EvidenceItem records, never ExtractedField IDs. Missing-information evidence must describe inspected coverage and the missing requirement without invented text/boxes.
8. Resolve stale document correction flags after successful legitimate correction/reprocessing, preserve original extraction/correction history, and avoid stale/duplicate retry findings.
9. Test real synthetic OCR/PDF providers plus labelled edge-case mocks: dimensions, cancellation, concurrency/cache bounds, partial coverage, safe errors, shared storage, retries and evidence-reference validity. No external AI calls or identifiable patient data. Run focused U3 tests, syntax and changed contract/schema validation. Leave the Codex-owned U5 file unchanged; return control for its final rerun.

Report only changed paths, exact real versus mocked results, coverage API changes, blockers and `Commit: none`. U3 is PASS only when the acceptance gates pass. Ordinary safe local work is authorized; honor platform permission controls.
