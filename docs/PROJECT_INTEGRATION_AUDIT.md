# Main-project integration and feature audit

Date: 16 November 2026. Academic prototype, not a clinical release.

## What was integrated

Session 6 was fast-forwarded into GitHub main at `1a3f09f`. This follow-up connects the same Evidence Chat and Verification Cases to both patient and pharmacy portals; it is not a second, disconnected application. Private chat uses the protected prioritized-answer endpoint, medicine-specific scope, exact document/field/page links and source-content freshness checks. Earlier messages remain history.

Corrections in this checkpoint:

- Pharmacy dashboard, graph and authenticity panels now use the shared authenticated client. The old dashboard read a different storage key and sent an empty token.
- Patient dashboard and both sidebars expose Evidence Chat prominently. Staff sign-in selects the actual provisioned role; public staff signup is not offered. Home routing no longer sends every non-patient into an unauthorized pharmacy redirect loop.
- Admin/research screens have explicit role gates. Backend authorization remains authoritative; client gates alone are not security proof.
- Broken nearby lookup `/pharmacies/nearby` now uses the mounted `/pharmacy/nearby`. This remains simulated. Location is requested only after an explicit user action; a demo reservation no longer falsely reports an SMS.
- Organization Settings no longer crashes when the organization has no subscription. Unwired creation/billing buttons are labelled and disabled.
- Corrupt cached user JSON cannot crash session restore. Failed login is handled by the form instead of an expired-session modal; credential-bearing errors are not printed there.
- Initial chat creation avoids duplicate blank chats during StrictMode effect replay. Medicine clarification now resends the relevant original question with the explicitly selected item, retaining earlier messages.
- Research Dashboard now displays a checksum-checked projection of the published synthetic study, not the old illustrative benchmark/accuracy numbers. Admin compliance/usage placeholders no longer masquerade as measured data.
- `npm run dev:all` starts the backend and frontend as one local project, checks readiness, refuses occupied ports and stops both with Ctrl+C. It explicitly disables external AI/document export for this safe local mode.

## Verification and its limits

| Check actually executed | Result | Boundary |
|---|---|---|
| Full backend regression with real local MongoDB, Tesseract and synthetic PDF golden workflow | 286/286 pass; zero skipped | Guarded disposable databases; no real patients, external LLM or clinical accuracy measurement |
| Foundation / reconciliation / report / integration offline groups | 125 / 138 / 7 / 60 pass | Separate overlapping engineering scopes, not an overall score |
| Existing RAG/chat client and evaluation-integrity regression | 107/107 pass | Includes preserved freeze and published result validation; no held-out re-scoring |
| Citation source-panel regression | 3/3 pass | Exact protected links and full additional-source retention |
| New project-integration regression | 11/11 pass | Portal/session policies, authenticated transport wiring, clarification scope, missing subscription, research data checksum |
| Strict TypeScript and production frontend build | Pass | Large-bundle and outdated Browserslist warnings remain |
| Backend syntax and new frontend-helper targeted lint | Pass | Does not erase the older repository-wide lint debt |
| JSON schemas / OpenAPI | 13 valid / valid with 11 existing warnings | Academic contract, not FHIR/NHCX certification |
| Authenticated legacy/core read smoke | 34/34 HTTP 200 | Empty synthetic tenant; HTTP availability is not business correctness or live provider integration |

Live browser checks used an explicitly isolated, synthetic fixture on port 5175. Patient and pharmacy module pages were navigated; the missing-subscription crash was reproduced, fixed and rechecked. Public reference chat produced local source-backed notes. Private chat requested medicine clarification, compared the selected prescription/invoice strengths, reported MISMATCH, retained all ten sources and placed both exact strength sources first. Research sign-in reached the recorded 16-scenario dashboard, and a research account was redirected away from admin. The graph query used the authenticated client. Further browser results are recorded in the local checkpoint output, not assumed from typechecking.

The image fixture deliberately seeds a 500 mg extracted prescription field while its watermarked image shows 650 mg. This is a controlled extraction-error demo, **not** evidence of actual OCR error rates or professional attestation. The backend golden suite separately runs real OCR.

## Feature-by-feature conclusion

| Feature | Current status | What must not be claimed |
|---|---|---|
| Secure case intake, local image/PDF OCR, correction and medicine reconciliation | Working bounded prototype; backend golden workflow verified | Universal handwriting/language support, unlimited rows/pages or clinical accuracy |
| Private case Evidence Chat, citations and freshness | Integrated and verified | Fresh evidence means clinically correct; a mismatch proves fraud |
| Public pharmacy-domain RAG | Local retrieval path verified; optional provider generation not exercised here | Live Gemini/embedding availability or general-purpose medical advice |
| Human-in-the-loop review and audit | Protected workflow/regression verified | Automated claim approval, real pharmacist evaluation or insurance adjudication |
| Research dashboard | Published synthetic counts with provenance | Live product analytics, new held-out gains or a novelty percentage |
| Medicine inventory, cart and orders | Legacy pages/read endpoints load; full business lifecycle not certified by this audit | Real payment, verified pricing, fulfilment or production tenant safety across all legacy modules |
| Nearby medicine availability | Simulated directory; endpoint repaired | Live stock, actual reservation/SMS or genuine certification badges |
| Smart reminders | Record-management implementation; read smoke verified | Background scheduling (not implemented) or configured email delivery (not tested) |
| Health tracker / patient intelligence | Sample displays and heuristic/legacy data | Measured vitals, clinical prediction or validated adherence |
| Doctor consultation | Explicit booking/video simulation | Real doctor appointment, payment or live secure telemedicine |
| CDSCO/NABH/insurance / “blockchain” panels | Mock regulatory responses and academic local hash-chain demonstrations | Official approval, authenticity certification, insurer connection or immutable distributed ledger |
| Organization / SaaS administration | Protected read UI; missing subscription handled | Connected billing, subscriptions, branch-management form or compliance certification |
| Health records / accessibility | Legacy record reads; some controls remain incomplete | Working record download/search, all-language/voice support without further tests |
| SwiftUI iPhone client | Separate client work exists; no device run in this audit | Tested scanner, signing, App Store release or full iOS acceptance |

**Conclusion: the core TrustRAG prototype works within its tested limits; not every legacy feature is complete or production-ready.** Next high-value work is an explicit legacy-module decision (finish, remove or keep as labelled demo), real provider/device acceptance and a separate broader security/privacy review before deployment. The single-process case lock and memory-only receipts remain release limitations.

## Use one local project

From the intended project folder, install its existing locked dependencies if needed, configure `backend/.env` locally, and start MongoDB. Never commit or share real `.env` values.

```sh
npm run dev:all
```

Open `http://127.0.0.1:5173`, sign in through the correct portal, then choose **Evidence Chat · TrustRAG** or **Verification Cases**. In chat, choose an authorized case; choose a medicine when asked. Sources opens the priority cards and all remaining citations. Staff accounts must be provisioned; do not weaken registration rules for a demo.

This launcher is deliberately evidence-only. It does not enable paid/public model calls or private-document export. Gemini generation needs a separately reviewed provider configuration; do not set export flags merely to make a demo badge change.

The original Downloads working tree must be reconciled selectively with a source-only backup, not reset or force-pushed. Existing environment values, private storage, user data, unrelated work and its old Git history are to be preserved. Publication belongs to the clean NEWPHARMAVAULT checkout.

## Original workspace reconciliation

The reviewed runtime/client/contract additions and their focused tests were selectively reconciled into the original Downloads project. Every overwritten file matched the accepted pre-extension base; unrelated differing fixtures, documentation and environment templates were preserved. A source-only backup was created outside both repositories. The backend environment checksum and original Git HEAD remained unchanged.

Original-copy strict TypeScript, the 11 new integration checks, 15 focused citation/published-provenance checks and a production build passed. The original folder's build used the same React configuration with generated assets redirected to the working output folder because this session cannot write Vite's normal root-level temporary config. The one-command launcher uses a private temporary cache, avoiding that issue. The original frontend on 5173 and backend readiness on 5001 both returned HTTP 200.

Browser coverage included 13 patient module screens and 10 pharmacy module screens, plus both dashboards, public/private chat, portal selection and multiple staff sign-ins, case-list/new-case/review entry screens, research/graph, admin and legacy safety panels. Route rendering is recorded separately from functional acceptance; it does not certify every button or legacy mutation. Selecting a clarification choice was exercised live and produced a new item-scoped answer without erasing history.
