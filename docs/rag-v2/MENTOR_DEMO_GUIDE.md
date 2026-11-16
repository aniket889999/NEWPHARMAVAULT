# Mentor demo — correction-aware PharmaVault chat
Date: 16 November 2026. Use synthetic documents only.

## One-minute explanation
“PharmaVault helps a pharmacist or claims reviewer check whether prescription and invoice records agree. It extracts fields locally, keeps medicine identities separate, retrieves exact document evidence, and leaves the final validation to a human. The new chat can answer a bounded question about one medicine. If someone corrects the evidence later, the old answer is not silently rewritten: it is marked outdated only when its supporting content changed. An unrelated edit should not invalidate an unaffected answer.”

Public reference chat and private case evidence are different modes. Private case responses in this release are deterministic local evidence summaries, not an external LLM viewing patient records. The public RAG path can optionally use Gemini for approved public passages; no live provider quality score is claimed here.

## Start the isolated, disposable demo
From the repository root, after installing locked root/backend dependencies and starting local MongoDB:
```sh
node tests/rag-v2/browserHarness.cjs --synthetic-browser-check
```
Keep this terminal open. It prints the temporary frontend URL, case URL and synthetic accounts. The frontend uses port 5175 and a random loopback backend port. It does not load .env, replace the normal 5173 server, disable authentication or use real patient data. If a port is occupied, resolve that specific test server rather than killing an unrelated process.

Open http://127.0.0.1:5175/login?role=pharmacist and use the printed pharmacist account. The pharmacy role and pharmacist role are distinct; do not use the legacy pharmacy login for this provisioned reviewer. After sign-in, open the exact printed case URL.

## Five-minute live sequence
1. State the fixture boundary first: both watermarked source images show 650 mg. The prescription extraction is deliberately seeded as 500 mg for a controlled correction demonstration. It is NOT evidence that real OCR made this mistake; fixture confidence and grouping are synthetic.
2. In chat, select Rx Paracetamol. Ask: “Show the recorded prescription strength.” Expect the recorded 500 mg value with exact name/strength citations and a source-version freshness label.
3. Expand Sources and open the dosage-strength citation. The protected viewer should select the exact field/page. The image says 650 mg; coordinates are unavailable, so no invented highlight should appear.
4. In Extracted Fields & HITL, change only the invoice total 100 -> 120. Return to the existing chat and click Check current evidence. The strength answer stays current because its supporting medicine evidence did not change.
5. Correct the prescription strength 500 -> 650 mg using the source image. Recheck the existing answer: it becomes Outdated and still displays its historical 500 mg text.
6. Click Ask again using current evidence. A new 650 mg answer is appended; the old answer remains. A stale-grouping warning may remain and must not be described as human approval.
7. Show the medicine comparison/human-validation screen. A genuine document mismatch must be corrected only by checking the source—not by making the system pass. Reviewer actions and current grouping/coverage rules remain mandatory. This does not approve an insurance claim.

## End cleanly
In the same demo terminal, type:
```text
cleanup
```
Wait for the stopped/cleanup acknowledgement. It removes only this run's synthetic records and temporary assets. These disposable demo records are intentionally not retained or recoverable as user records. Do not reuse the demo login in production.

## Research talking points
- Strength: exact item/source attribution plus selective correction-aware invalidation and retained history.
- Honest result: in 16 held-out structured scenarios, wrong-source selections dropped from 9/16 to 0/16, but reference recall@4 remained 16/30 for both lexical and scoped retrieval.
- Temporal mechanism: 16/16 cited corrections invalidated; 0/16 unrelated edits falsely invalidated under signed dependencies.
- Boundaries: no clinical accuracy or market-novelty percentage, no auto-prescribing or claim adjudication, and no measured clinician-efficiency gain. See SESSION_5_RESEARCH_RESULTS.md for denominators and limitations.
