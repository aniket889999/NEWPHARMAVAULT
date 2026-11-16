# Session 6 checkpoint — PASS within prototype scope
Date: 16 November 2026. Branch: feature/session-6-citation-priority.

## Implemented
Added attribute-first, document-balanced ordering over the existing authorized source set. For a strength comparison, both prescription and invoice strength sources come first, then both medicine-name sources. Quantity, form, release, pack-size and generic comparison queries have explicit priority rules. This is deterministic citation ordering, not a new retriever or a proven semantic relevance model.

The new protected `POST /api/v1/cases/:caseId/assistant/prioritized-answers` delegates authorization, input validation, snapshot reading and signing to the unchanged Session 4 service. Only citation labels/order are changed, with simultaneous remapping in the reply. No factual prose, sources, source bindings, warnings, choices, dependencies or receipt content is dropped or rewritten. Unsupported/safety/clarification/status responses remain unchanged; unknown controlled metadata keeps the original order; malformed citation topology fails closed.

The current chat client uses the explicit new endpoint without silent fallback. Its private source panel shows four priority cards, with a native expandable section for all remaining cited evidence. It explicitly warns that priority is not verification and that the full answer can also rely on the additional fields. Public chat sources are unchanged. Existing legacy answer and freshness endpoints remain available.

## Verification actually executed
- New policy suite: 9/9 PASS.
- New real HTTP/disposable-MongoDB suite: 7/7 TAP entries PASS (six behavioural subtests plus parent). Covers unauthenticated/private-no-store, patient/tenant scope, request bounds/role override rejection, unchanged legacy endpoint, real unrelated/dependent PATCH controls, receipt binding/forgery, case busy 409, actual AI limiter 429, and zero instrumented private fetch/non-loopback HTTP/HTTPS egress with public-generation flags enabled.
- New static React source-panel tests: 3/3 PASS; exact protected links, escaped text and every additional citation retained.
- Full backend regression including real local OCR/PDF golden workflow: 286/286 PASS, zero failed/cancelled/skipped/TODO. Serial guarded disposable database runs; English OCR data locally provisioned.
- Existing RAG/chat client plus new source-panel command: 110/110 PASS, zero skips.
- Existing offline checkpoint runner: Foundation 125 + matching/quantities 138 + report integrity 7 + Session 3 client 60, all PASS; frozen fingerprints PASS. These are separate overlapping engineering scopes, not a combined clinical accuracy score.
- Strict application/tooling checks and production frontend build PASS. Existing bundle-size/Browserslist warnings remain visible.
- New/changed frontend targeted lint PASS, zero warnings. Backend syntax PASS. All 13 schemas valid; OpenAPI valid with the same 11 historical warnings.
- Pre-heldout paper implementation/protocol/data fingerprint validation remains PASS. No exposed held-out scoring was rerun or relabelled as a new experiment.

## Live browser proof
Used the existing opt-in isolated synthetic browser harness, not the user's normal 5173 server. Documents are watermarked and a controlled extraction error is deliberately seeded; this does not measure an actual OCR mistake or professional attestation.

Authenticated as the synthetic pharmacist and selected Rx Paracetamol. A real comparison returned MISMATCH with prescription 500 mg and invoice 650 mg intact. The first two source cards were their exact strength fields; the next two were medicine identities. Expanding the additional section exposed all ten protected source links. The second strength link selected the exact invoice field/page in the protected viewer; missing coordinates stayed unavailable.

Local screenshot: workspace output/PharmaVault_S6_Citation_Priority_2026-11-16.png (outside Git). Temporary tabs were closed; server shutdown and scoped synthetic account/case/upload cleanup were acknowledged. No old Downloads files, real environment values or patient documents were edited.

## Research and release boundaries
The Session 5 paper baseline remains reproducible at its reviewed commits. This extension was designed after inspecting the old evaluation limitation and has engineering acceptance only. Do not replace the existing 16/30 recall figure or invent a new held-out improvement percentage. A new comparative research claim needs a newly frozen, independently designed evaluation set, stronger baselines and reviewer study as appropriate.

The policy cannot recover evidence absent from the underlying answer, exceed the old 12-source cap, resolve clinical uncertainty or remove human-validation requirements. Multiple document/item ordering and explicit slot heuristics are bounded, not universal semantic understanding. Receipts still describe source-content freshness, not signed prose truth or clinical approval. Production deployment, distributed locking, real iPhone acceptance and certified FHIR/NHCX conformance remain outside this checkpoint.

## Reproduce
```sh
node --test backend/tests/citationPriority.test.js backend/tests/citationPriorityIntegration.test.js tests/citation-priority/client.test.cjs
node --test tests/rag-v2/published-results.test.cjs
npm run build:frontend
```
Use the guarded disposable local MongoDB target for the HTTP suite. Run browserHarness.cjs with `--synthetic-browser-check` in a persistent terminal only, and type `cleanup` when finished. Older source copies need deliberate reconciliation; do not overwrite their dirty working trees.
