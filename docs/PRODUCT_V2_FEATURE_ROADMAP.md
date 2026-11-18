# PharmaVault V2 — feature expansion and differentiation roadmap

Status: approved implementation backlog; V2-01 public-readiness sub-checkpoint implemented, full browser acceptance pending. All other unaccepted items remain planned, not completed features.
Prepared: 16 November 2026, following the request to include remaining features and improved competitor-inspired capabilities.
Baseline: reviewed main-project integration at a9ffca1. Existing MVP contracts, frozen paper implementation, data and published results are not retroactively changed by this roadmap.

## Product focus

An evidence-grounded pharmacy and document-review workspace: identify what a document says, compare the same medicine across records, explain uncertainty, and support an accountable human decision.

Consumer features can surround that workflow. A working marketplace, insurer connection or clinical service cannot be obtained merely by adding screens. External partner services remain gated until their data, credentials, workflows and authorizations are available. Demonstrations must stay explicitly synthetic.

## 1. Finish the engineering foundation

| ID | Deliverable | Acceptance boundary |
|---|---|---|
| F01 | Automated full-browser acceptance | Synthetic submitter/staff actors complete intake, OCR, correction, grouping, reconciliation, scoped chat, exact source viewing and review; stale snapshot, forbidden tenant and interrupted upload paths are also tested. Screen rendering alone is not a functional pass. |
| F02 | Live public-reference Gemini acceptance | Confirm actual server-side provider operation, citations, bounded failures, safety boundaries and cost limits. Private documents stay local by default; no export flag is silently enabled. Provider unavailable is reported, not replaced with a false live-model badge. |
| F03 | OCR/document quality expansion | First measure current printed-English extraction on a newly authored dataset. Expand rows/pages and layouts with bounded memory/timeout controls; add quality warnings, duplicate-page and missing-page checks. Handwriting/regional languages remain experimental until separately evaluated. |
| F04 | Curated medicine catalogue expansion | Record provenance, version, permitted use and coverage. Preserve ingredient, strength, dosage form and release distinctions; ambiguous and combination products require explicit handling. No unreviewed equivalence or substitution advice. |
| F05 | Durable answer/review snapshots | Persist necessary evidence dependencies and receipts with access/retention controls; test restart, expiry, authorized access, correction and replay. Store only what is needed. Preserve historical answers rather than silently rewriting them. |
| F06 | Multi-process reliability | Introduce appropriate transactional/version controls and restart-safe processing. Test simultaneous corrections/reviews, idempotency, replayed requests and process failure. The current single-process lock is not a distributed guarantee. |
| F07 | Operational privacy/security | Test storage access, configuration, secret rotation, retention/deletion, backup/restore, logs, upload abuse and legacy authorization. External deployment requires its own review; do not claim legal certification from test counts. |
| F08 | Performance and maintainability | Split large frontend bundles, fix owned lint debt, improve error/loading states, and address OpenAPI warnings without weakening rules or rewriting frozen research evidence. |
| F09 | iPhone scanner acceptance | Device-tested scan/preview/retry/authenticated upload; secure session handling, logout cleanup and accessible error recovery. Signing and device acceptance are separate from source-code existence. |
| F10 | FHIR/claims interoperability | Validate the draft against selected published profiles; test an authorized sandbox connection separately. An exported JSON bundle is not certified NHCX or payer integration. |

## 2. Complete selected existing product modules

All these items remain on the backlog; the order below does not imply that a real service is available.

| ID | Module | Work needed | External gate |
|---|---|---|---|
| L01 | Health record vault | Real search, filters, authenticated downloads, source links, version history and explicit reviewed/unreviewed state | Approved data-retention and sharing design |
| L02 | Reminders | Reliable scheduling, timezone/retry controls, delivery status and user acknowledgements | Notification/email provider configuration; never infer a medicine was taken from notification delivery |
| L03 | Inventory/cart/orders | End-to-end authorized CRUD, correct line items/prices, stock reservations, cancellation/release and order transitions | Real payment/fulfilment requires providers and separate acceptance; no real dispensing from an academic demo |
| L04 | Nearby pharmacy availability | Genuine provider inventory, timestamps and verification state; distinguish an inquiry from a confirmed reservation | Partner inventory and permissioned location use; no fabricated live stock or SMS success |
| L05 | Consultation | Booking lifecycle, consent, availability and referral/context packet | Verified clinical service/video provider, responsible professionals and appropriate approvals; no pretend appointment |
| L06 | Regulatory/insurance panels | Replace mock responses only with documented, authorized data/connectors; show source/version and unresolved states | Official/partner access; no authenticity, coverage or approval claim without evidence |
| L07 | Organization/branch administration | Staff provisioning, branch forms, role tests and operational settings | Billing/subscription provider and isolated payment test environment before any real financial action |
| L08 | Health tracking/accessibility | Label data origin; implement working contrast, text size, navigation, language/voice controls and consent for any device data | Clinical validation if adding clinical interpretations; device/provider permission for live measurements |

The local hash-chain demonstration is not a medicine-authenticity guarantee. Its useful next step is trustworthy event provenance; a blockchain expansion is not a priority unless a specific multi-party trust requirement is established.

## 3. Competitor-informed improvements

Reviewed public product pages on 16 November 2026. These sources establish advertised functionality, not independently verified performance. Not finding a feature in public documentation does not prove a competitor lacks it. The right column is our proposed implementation target, not a proven competitor weakness.

| Product/source | Advertised capability relevant to us | Proposed PharmaVault improvement |
|---|---|---|
| [Tata 1mg](https://www.1mg.com/) | Medicine purchasing, prescription submission, reminders, records, consultations and tests | Trace each extracted medicine/order/reminder field back to the prescription version, and require confirmation before applying a changed instruction. |
| [PharmEasy order process](https://pharmeasy.in/order-process-guide) | Prescription checks by pharmacists, ordering, repeat purchases and tracking | A pre-order prescription/invoice comparison with explicit strength/form/release/quantity differences and a recorded clarification path. |
| [Apollo 24/7 FAQ](https://www.apollo247.com/faq) | Consultations, prescriptions, records and follow-up booking | A user-approved follow-up evidence packet containing the relevant records and unresolved discrepancies, not an automatic diagnosis or treatment plan. |
| [Eka Care patient records](https://www.eka.care/eka-for-patients) and [record search](https://www.eka.care/services/eka-smart-report) | Structured health records, search, sharing and connected care | Document/page/field-linked answers plus correction history and visible answer freshness when the underlying record changes. |
| [Vitraya claims offering](https://www.vitraya.com/solutions/claims) | AI-based document understanding, policy checking and reasoned claims decisions | A bounded, human-controlled evidence-review workbench whose correction impact and uncertainty handling can be independently replayed and evaluated. Not another claim of automated adjudication. |

Therefore, OCR, RAG, chat, citations, HITL, record search and explainable claims processing are not by themselves defensible first-ever claims.

## 4. Differentiator candidates

These are proposed integrated research/product features, not verified world-first inventions.

### N01 — Correction Impact Map

Extend existing freshness checks into a visible dependency view: corrected field -> affected medicine comparisons -> affected answers -> reviews that need another look. Show which unrelated answers remain unchanged. Preserve the original source and prior decisions; authorized workflow controls determine whether a case can be reopened.

Example: an authorized reviewer corrects an OCR strength using the source image. Show exactly which old answers are now stale, rather than merely invalidating every answer in the case.

Acceptance: seeded dependent/unrelated corrections produce the expected affected set; no silent factual rewrite; unauthorized and stale-token edits fail; change history is preserved. Research measures both missed impacts and unnecessary invalidations, plus reviewer task time if a suitable study is conducted.

### N02 — Evidence Gap Navigator

Explain the next document/page/field needed to answer a question or progress a review. Distinguish missing evidence from an actual mismatch. A claim form is optional for the base prescription/invoice workflow; ask for it only when the requested claim-specific evidence requires it.

Example: "Invoice page 2 is missing; quantity comparison is incomplete. Upload that page or escalate." Do not infer the missing contents.

Acceptance: every request names an actual blocker and supporting rule; complete cases do not receive unnecessary requests; low-confidence extraction triggers source confirmation rather than invented facts. Measure correct blocker identification and unnecessary upload requests.

### N03 — Replayable Review Snapshot

Capture the authorized evidence versions, extraction/correction state, relevant rules and answer dependencies used at review time. Allow an authorized user to inspect why the earlier result was produced after the current case has changed.

Acceptance: a stored review can be reconstructed after restart; current evidence is not substituted into historical views; roles, retention and tenant isolation remain enforced. This supports auditability, not proof that a historical medical decision was correct.

### N04 — Minimum-Disclosure Evidence Packet

Preview a purpose-specific export, let the authorized user review selected fields/redactions and record exactly what was shared. An expiring/revocable portal link can stop future portal access; it cannot retract copies already downloaded by a recipient. Redaction needs verification, including document images and metadata.

Acceptance: excluded fields are absent from the delivered artifact, not merely hidden in the screen; sharing access and expiry are tested; no private material goes to a model or third party without the required authority and explicit destination.

### N05 — Prescription-Version-Aware Reminders

Tie a reminder to its confirmed source prescription/version. If that source changes, present a review task and a proposed reminder update. Do not automatically prescribe, switch, discontinue or infer a dose from an LLM response.

Acceptance: confirmed schedule/source version is visible; notifications, user acknowledgements and inferred adherence are separate states; source changes never silently overwrite the schedule.

### N06 — Evidence Coverage and Uncertainty Panel

Display separate indicators for scan/extraction quality, medicine identity ambiguity and inspected document coverage. Do not combine OCR confidence into a misleading clinical/fraud probability. Show the reason for abstaining and how the user can resolve it.

Acceptance: partially processed cases cannot appear fully inspected; confidence labels identify what they actually measure; accessibility and comprehension are tested. This extends the existing coverage gate rather than pretending it is wholly new.

## 5. Implementation checkpoints

Each checkpoint must finish with inspected changes, focused regression tests, honest limitations and a meaningful commit. Shared contracts are agreed before parallel implementation; no simultaneous ownership of the same files. Checkpoints do not automatically enable paid APIs or private-data exports.

| Checkpoint | Deliverables | Suggested GPT/Gemini split |
|---|---|---|
| V2-01 | F01 + F02: reliable browser acceptance and explicit provider readiness | GPT: independent test design/privacy checks; Gemini: scoped fixtures/browser automation and provider diagnostics |
| V2-02 | F03 + F04: document quality and medicine coverage | Gemini: bounded extraction/catalogue adapters; GPT: schemas, adversarial acceptance and uncertainty UI |
| V2-03 | F05 + F06 + N03: durable evidence and replay | Gemini: persistence/concurrency services and migrations; GPT: dependency contracts, access/retention tests and historical views |
| V2-04 | N01 + N02 + N06: impact map, gap guidance and uncertainty | Gemini: deterministic dependency/blocker services; GPT: reviewer UX, independent counterexamples and acceptance |
| V2-05 | L01 + L02 + N04 + N05: records, reminders and controlled sharing | Gemini: search/scheduler/provider adapters; GPT: source-version, disclosure and notification state tests |
| V2-06 | L03 + L04 + L07: pharmacy and organization workflows | Gemini: backend inventory/order/branch transactions; GPT: exact-line-item UI, role/concurrency acceptance and truthful provider states |
| V2-07 | F09 + L08: device and accessibility acceptance | GPT: iPhone/user-flow work; Gemini: supporting API regressions and localization checks |
| V2-08 | F07 + F08 + F10 + L05 + L06: release and partner gates | Deployment, performance, profile validation and partner-specific contracts; owners depend on available access |
| V2-09 | New evaluation and publication package | Freeze the new candidate first; use an independent new evaluation set, stronger baselines and approved reviewer tasks; do not relabel old held-out data as unseen |

Not every line fits a two-hour session. Subdivide large checkpoints into passing increments after inspecting dependencies. All legacy modules stay labelled until their own acceptance gates pass.

## 6. Research discipline and release definition

- Keep the published Session 5 counts and limitations unchanged.
- Research hypothesis: dependency-aware correction impact and explicit evidence-gap guidance can reduce stale-answer reliance and unnecessary re-review on bounded document tasks. It is a hypothesis until tested.
- Separate source retrieval, OCR/extraction, medicine matching, freshness, privacy and usability measurements. A passing unit test is not clinical accuracy.
- Independently assess prior art before claiming novelty; do not promise an arbitrary novelty percentage or superiority to commercial platforms.
- A final-year demonstration can use disclosed synthetic cases and test adapters. A real clinical, payment or insurance service requires its own acceptance and appropriate external arrangements.
- Final handoff needs a reproducible setup, frozen evaluation package, demo recording, known-limitations list and clearly named core versus partner-dependent features.
