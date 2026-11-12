# Session 2 — reconciliation workstream contract

Date: 12 November 2026. Status: standalone implementation independently accepted after correction. `SESSION_2_ACCEPTED_CONTRACT.md` and `SESSION_2_CONTRACT_FREEZE.json` record the accepted scope/fingerprints. No public API/model integration is implied by this checkpoint.

## 1. Boundary and ownership

Project: `/Users/aniket/Downloads/PBL 5 TH SEM`. Check `docs/foundation-v2/SESSION_1_CONTRACT_FREEZE.json` before building: the Session 1 item adapter/schema and dataset lock remain unchanged.

**GPT owns** the new `contracts/schemas/medicine-reconciliation.schema.json`, all `src/modules/verification/reconciliation/**`, `tests/reconciliation-v2/**`, and this directory except Gemini's report. This explicitly assigns the one new result schema to GPT to prevent concurrent schema/consumer changes. Propose a contract delta by handoff; do not edit another owner's files.

**Gemini may create only**:
- `backend/services/trustRag/medicineReconciliationService.js`
- `backend/services/trustRag/medicineQuantityService.js`
- `backend/tests/medicineReconciliation.test.js`
- `backend/tests/medicineQuantity.test.js`
- `backend/tests/fixtures/reconciliation-v2-development.json`
- `docs/reconciliation-v2/GEMINI_SESSION_2_REPORT.md`

No route/controller/model/orchestrator, OpenAPI, existing UI/types, package/lockfile, environment, frozen Foundation contract or locked benchmark edit. No network, database writes, new dependencies, commit/push/deployment. The standalone component is not wired into the case page until integration is verified in a later checkpoint.

## 2. Builder interfaces

```js
reconcileMedicineDocuments({ caseId, prescription, invoice, catalogue })
normalizeItemQuantity(item)
```

`prescription` and `invoice` are the frozen Session 1 envelopes or null for a missing document. Use the local academic catalogue by default; a supplied catalogue is a trusted test/server dependency, never a client API field. Do not call MongoDB or an LLM. Do not trust the envelopes' optional cached `resolution` as fresh identity proof.

Reject malformed or cross-case/document envelopes with a controlled error having code `INVALID_RECONCILIATION_INPUT` and a generic message; do not echo patient values, paths or foreign IDs. Missing documents are normal insufficient-evidence results, not exceptions. Validate item/field case and document context, item/reference uniqueness and the input contract. Groups/identities remain server-loaded, not browser assertions.

Both functions return synchronously. `normalizeItemQuantity` returns `{ status: 'NORMALIZED' | 'INSUFFICIENT_EVIDENCE', baseQuantity, baseUnit, reasonCodes, fieldIds }`. Base quantity/unit are null on unsupported/unresolved input. Its reasons use the result schema's enumerations. It is a helper, not a new HTTP endpoint.

Each assigned backend file exposes its named function through a CommonJS exports object, following the frozen Foundation module pattern. Keep helpers internal unless a declared test/consumer needs them.

## 3. Required matching behaviour

1. Resolve name families using exact normalised generic names, brand names and aliases in the existing academic catalogue. Case/whitespace differences are allowed; no fuzzy edit distance or guessed web matches. Ambiguous alias mappings remain unknown. Never fill missing document strength/form/release from a catalogue.
2. Keep name-family eligibility separate from product validity, clinical suitability and substitution. Explicit strength/form/release differences can be document mismatches without claiming that an invoiced product is legitimate. A brand alias whose encoded catalogue attributes contradict its own extracted fields needs clarification (`IDENTITY_ATTRIBUTE_CONFLICT`).
3. Use one-to-one matching, independent of row order. Prefer mutually unique full-attribute candidates; then allow a mutually unique same-generic candidate for explicit difference checks. Do not greedily pick the first candidate. Duplicate/competing candidates remain ambiguous. Up to three items per document; no split fills, multiple invoices or forced quantity-based assignment.
4. Unknown medicine identities are not assigned a resolved pair simply because spellings agree. Preserve each unresolved item for review. Every observed item appears once across result rows; rows may have only one side. At most six rows. Do not lose unmatched items.
5. Strength: support conservative formatting normalisation (case/whitespace) and exact comparable numeric/unit labels. Same-unit explicit values can differ. Do not infer therapeutic equivalence or convert concentration expressions. Unsupported format/unit relationships stay insufficient evidence. Keep dosage-form/release distinctions. Both release fields absent => release check NOT_APPLICABLE; only one absent => insufficient evidence.
6. Corrected effective values come from current server fields; correction-required/low-confidence essential evidence must not support an unqualified consistent check. Preserve a confirmed difference on another field rather than suppressing it with a single uncertainty flag.
7. A missing/extra item is a confirmed document difference only when both relevant documents are completely inspected and grouping is adequate. Missing pages, a missing document or unresolved grouping make unobserved items unknown, not proven omitted.

## 4. Administrative quantity rules

- Use explicitly stated quantity and quantity-unit fields, not dose-frequency/duration arithmetic. No implicit "one strip = ten".
- Allow bounded positive decimal text, finite and <=1,000,000 after normalisation. Counts of tablets/capsules and pack sizes must be whole numbers. mL can be a positive decimal. Reject signs/ranges, zero, negatives, exponent notation, NaN/Infinity and overflow as unsupported/invalid evidence; do not coerce them into plausible numbers.
- Supported base units: tablet, capsule, mL; transparent case/plural abbreviations only (tablet/tablets/tab, capsule/capsules/cap, ml). Never equate tablets with capsules or liquid volume with counts.
- Strip/pack quantities require explicit positive integer pack size and supported contained pack unit. Compute quantity × pack size only when the source fields permit it. Unknown count/unit requires clarification.
- If the two sides normalise to incompatible base units, the comparison quantity object has null base quantities/unit; original values remain inspectable in input evidence. A partially known quantity may be retained with a known common base unit, but is never labelled equal.
- Required source fields with `needsCorrection` or missing essential quantity/unit evidence cannot yield a clear quantity consistency result.

## 5. Exact result DTO

The authoritative standalone Draft 2020-12 schema is `contracts/schemas/medicine-reconciliation.schema.json` (GPT-owned). It is self-contained so the existing schema compilation command can validate it without changing package scripts.

Top level:

```text
schemaVersion: '2.0.0-session2'
rulesetVersion: 'academic-reconciliation/1.0.0'
caseId
documentIds: { prescription: id | null, invoice: id | null }
status: CONSISTENT | MISMATCH | INSUFFICIENT_EVIDENCE
reviewRequired: boolean
humanDecisionRequired: true
coverage: { prescription, invoice } // frozen coverage statuses plus MISSING
hasInsufficientEvidence: boolean
reasonCodes: unique allowed reason codes (include all row reasons plus global reasons)
rows: 0..6 comparison rows
summary: { consistent, mismatch, insufficientEvidence } // exact row-status counts
```

Each row:

```text
rowId: mr_<24 lowercase hex>, deterministic from scoped item identities
prescriptionItemId: mi_<24 lowercase hex> | null
invoiceItemId: mi_<24 lowercase hex> | null
genericName: string | null
status: same three comparison outcomes
checks: { identity, strength, form, release, quantity }
  // each check uses those three outcomes or NOT_APPLICABLE
quantity: { prescriptionBaseQuantity, invoiceBaseQuantity, baseUnit }
reasonCodes
evidenceReferences: [{ documentId, fieldId, pageNumber }]
```

At least one item side must exist. Evidence references must belong to that row's actual input item(s), never a different item/case/document; include the actual fields supporting the finding and at least an anchor for unmatched rows. No raw patient text, arbitrary metadata or storage identifiers are copied into this result. The UI joins source values from the already-authorised input envelopes, not invented labels.

Aggregate semantics: any confirmed row difference yields overall MISMATCH, even if `hasInsufficientEvidence` is also true. Otherwise uncertainty/global incompleteness yields INSUFFICIENT_EVIDENCE. CONSISTENT needs nonempty fully checked rows, complete documents and no relevant unknowns. `reviewRequired` is true for mismatch or uncertainty. `humanDecisionRequired` is always true; no state mutation or claim/payment decision follows from a consistent comparison.

The quantity object uses base units for display only; never place mL and tablets under the same unit. No percentage "trust score". Counters and references are validated by the consumer; a malformed/cross-context response must show an unavailable state, not plausible output.

## 6. Evaluation and session gate

Use only the Foundation development split (24 scenarios) and independently authored development edge cases. The frozen manifest contains candidate expected relationships; unknown/ambiguous identities must not be forced into those candidate links. Do not tune on held-out labels or change locked gold to suit an implementation. This session is engineering acceptance, not the held-out paper experiment.

Required cases: shuffled rows; known 500/650 mismatch; missing/extra item with complete vs incomplete pages; repeated same-generic candidates; same-family strength-specific unambiguous pairs; unknown names; known vs unknown pack count; incompatible units; correction-required source; genuine mismatch plus incomplete evidence; alias/field contradiction; cross-case and forged field references; output immutability and no egress.

Gemini validates real outputs against the schema with existing Ajv dependencies and returns a <=150-word checkpoint. GPT's independently authored backend tests run after the module exists. GPT's UI/consumer checks can run before the backend handoff using clearly labelled schema-valid synthetic response examples. These examples are not backend results and do not establish matching accuracy. Combined Session 2 remains partial until the actual implementation passes independent inspection.
