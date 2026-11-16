# Session 4 independent integration review — PASS within prototype scope
Date: 16 November 2026. Owner: GPT after Gemini backend handoff.

## Accepted feature
The protected chat client now uses the real item-bound case assistant endpoints and signed, user/case-bound source receipts. Supported answers quote recorded medicine fields; they are deterministic local evidence summaries, not private external-LLM generation or clinical advice. Public conversational RAG is separate and unchanged.

## Independent corrections after handoff
The original backend/consumer tests passed but additional development probes exposed:
1. Comparison prose and its fingerprint used obsolete row properties. Both now use the frozen row.status, row.checks and quantity/evidence structures.
2. Selected-item comparison prose also states a whole-case outcome. Its receipt now includes the actual case:comparison content dependency, so a changed global assertion cannot retain a FRESH label.
3. An explicit invoice item could answer a prescription-only question. Conflicting document scope now asks for clarification.
4. A one-item selection could silently omit another named medicine. Conflicting multiple-name scope now asks for clarification.
5. The development evaluation found a unit-only/missing-quantity source added without a prose citation. The answer now explicitly states that the quantity is missing and cites the recorded unit.
Six new independent regression probes cover these cases. No assertion was relaxed, and frozen Session 1/2 contracts remain unchanged. No held-out result was used to change implementation.

## Verification actually executed
- Full backend suite: 270/270 PASS, zero skipped/cancelled/TODO, including real local OCR/PDF golden workflow. The suite runs serially against guarded disposable databases; local English OCR data is explicitly provisioned.
- Session 4 builder + independent backend/client/schema/history/race/UI/evaluation-helper + existing chat client command: 111/111 PASS, zero skips.
- Separate real HTTP case-assistant integration: 5/5 PASS; authentication, tenant/case/user scope, real unrelated/dependent PATCH controls, receipt scope, revocation and busy-lock responses.
- Existing offline checkpoint runner: Foundation 125, matching/quantities 138, report integrity 7, Session 3 client 60: all PASS; frozen hashes PASS.
- Strict application/tooling type checks and frontend build PASS. The existing bundle-size and Browserslist warnings remain visible.
- All 13 JSON schemas valid; OpenAPI valid with the same 11 historical warnings; backend syntax PASS.

## Actual live browser walkthrough
Used an isolated loopback server, guarded test database, disposable synthetic actors and watermarked documents. A controlled extraction error was deliberately seeded: source image 650 mg, extracted prescription value 500 mg. This is NOT a claim that OCR actually made that error or that a professional attested to the fixture grouping.
- Authenticated as the provisioned pharmacist; selected Rx Paracetamol and asked recorded prescription strength.
- Received a real local 500 mg answer with two exact field/page citations.
- Opened the dosage-strength link: exact case/document/field/page selected in the protected viewer. Missing coordinates remained unavailable; no false highlight.
- Corrected invoice total 100 -> 120 through the real UI. The strength receipt stayed FRESH.
- Corrected the cited prescription strength 500 -> 650 mg through the real UI. The old answer became STALE and retained its original 500 mg text.
- Ask-again appended a 650 mg answer without deleting history. It separately warned that grouping had become stale; source-version freshness is not reviewer approval.
- Copying the old answer included a historical/current-evidence-not-confirmed warning. The original empty clipboard was restored.
- Verification tabs and the active test server were closed; scoped synthetic cleanup was acknowledged. The user's normal development tab/server was not changed.
Local screenshots are saved outside Git in the workspace output folder.

## Research and release limits
Session 5 development-only feasibility runner completed on 24 authored structured scenarios. Its protocol explicitly records the development query amendment and equal four-source renderer budget. Held-out scoring is a separate frozen gate, not part of this Session 4 acceptance.
Receipts are stateless, browser history is bounded memory-only, expiry is 12 hours, and the case lock is single-process. No clinical validation, production deployment, real iPhone acceptance, certified FHIR/NHCX conformance, semantic generated-answer score, competitor superiority or novelty percentage is established.
