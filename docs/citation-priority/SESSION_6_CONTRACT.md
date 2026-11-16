# Session 6 — Attribute-first, document-balanced citation priority
Date: 16 November 2026. Status: implementation contract, not a measured improvement claim.

## Scope
The accepted source-order limitation is that a strength comparison may put prescription name/strength/form/quantity before the invoice strength. Add a deterministic priority policy over the already-authorized, already-selected source set. It is citation ordering, not a new retriever, clinical reasoning model or evidence sufficiency guarantee.

Keep Session 4 candidate files, response schemas, recorded protocol, freeze and Session 5 results byte-identical. Preserve the legacy `/assistant/answers` and `/assistant/freshness` endpoints. Add a separate protected `POST /api/v1/cases/:caseId/assistant/prioritized-answers`; it accepts exactly the legacy answer input and returns the identical frozen wire shape. The current client may use this explicit endpoint; no silent fallback to a different evidence mode.

## Policy
- Invoke the existing authorized answer service first. Do not accept a caller-provided answer, sources, scope or dependency list.
- For sourced medicine answers only, rank controlled field metadata by requested attribute, then interleave source documents within an attribute. Strength queries prioritize dosage_strength in both documents, followed by medicine_name in both.
- Use server-generated source titles/IDs only; never rank by arbitrary source excerpts or patient text.
- Preserve every source and its exact document/field/page/item/fingerprint binding. Renumber citations simultaneously in source objects and the existing reply; preserve all factual prose, warnings, choices, IDs, receipts and dependencies.
- Unsupported, clinical, safety, clarification and case-status answers are not reprioritized. Unrecognized metadata leaves the original order intact. Invalid citation topology fails closed.
- No truncation into a false all-clear. The UI shows the first four priority cards and keeps all additional cited sources explicitly expandable. Four cards are a display budget, not a claim that the full answer is supported by only four sources.
- The original receipt continues to check the original content dependencies. Ordering does not expand the meaning of FRESH or authenticate the rendered prose.

## Acceptance gates
1. Real frozen builder outputs and client decoder remain compatible; genuine mismatches/uncertainty remain unchanged.
2. Strength fields across Rx and invoice occur before unrelated fields when available; missing counterparts are not invented.
3. Citation replacement handles S1/S10/S12 without collisions, preserves escaped source text, and keeps all references bound to their original field.
4. Forged, foreign, expired and stale receipts remain rejected/unverifiable/stale under the existing endpoint.
5. Real HTTP auth, patient/tenant isolation, input bounds, rate limiter, no-store and private egress controls remain in place.
6. UI keeps every source available and uses exact protected links; source priority never implies clinical approval.
7. All historical source hashes and results remain valid. Old held-out data is exposed regression material, not new unseen evaluation. Do not rerun/tune it into a new claimed research result.

Use development examples and newly authored adversarial regression cases for implementation. A future comparative research study needs a new independently frozen evaluation set and stronger baselines.

## Working copies and publication
Implement in the clean NEWPHARMAVAULT feature/session-6-citation-priority branch. The older Downloads checkout contains pre-existing dirty work and is not edited or overwritten. Publish only inspected, tested checkpoint files; no automatic deployment or main merge.
