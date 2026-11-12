# Foundation V2 — accepted Session 1 internal contract

Decision: **PASS for the standalone medicine-item contract, pure adapter and Foundation test-data package.** Independently reviewed on 12 November 2026 (Asia/Calcutta).

This supersedes the initial changes-required decision in `SESSION_1_INDEPENDENT_REVIEW.md`. Its historical failures remain documented. It does not approve a production release or publish a new API. Session 2 has not started.

## 1. Verification observed by GPT

| Command / gate | Result |
|---|---|
| `node --test backend/tests/foundationMedicineItems.test.js` | 35/35 pass, exit 0 |
| `node --test tests/foundation-v2/adapter.acceptance.test.cjs` | 31/31 pass, exit 0 |
| `node --test tests/foundation-v2/manifest.test.cjs` | 59/59 pass, exit 0 |
| `npm run validate:schemas` | Ten schemas compile, exit 0 |
| `npm run validate:contract` | Valid existing OpenAPI; 12 existing warnings, exit 0 |
| `node --check backend/services/trustRag/medicineItemContract.js` | Exit 0 |

The independent adapter suite's original 28 checks passed unchanged before GPT added three further regression checks: an explicit correction flag cannot be cleared by correction metadata; all eight linked slots fit the reference/schema cap; and cleared envelopes cannot hide missing essentials, a correction-required field or unreviewed low confidence. All three new checks pass.

The 35 builder tests, 31 independent tests and 59 dataset tests are distinct test scopes, not a combined accuracy percentage. No live model or database was needed. No held-out reconciliation score is claimed.

## 2. Reviewed source identity

- Project: `/Users/aniket/Downloads/PBL 5 TH SEM`.
- HEAD at review: `dc41e1d`; new work remains uncommitted in the dirty checkout.
- Authoritative schema: `contracts/schemas/medicine-item.schema.json`.
- Internal schema version: `2.0.0-session1`. This is not an HTTP `/api/v2` release.
- Source/schema/dataset-lock SHA-256 fingerprints and exact enumerations are saved in `SESSION_1_CONTRACT_FREEZE.json`.

This is a reviewed baseline, not a filesystem lock. Recheck the fingerprints before the next integration. Changes to the adapter/schema meaning require an explicit handoff, regression review and documented contract revision; do not silently change the consumer interpretation.

## 3. Input contract and trust boundary

```js
buildDocumentMedicineItems({ document, extractedFields, groups })
```

- `document` and `extractedFields` are server-loaded records from an already authorised case/document context. Both plain objects and supported Mongoose-style records are read without calling serialization transforms that fabricate coverage defaults.
- Canonical group shape: `{ anchorFieldId, fieldIds }`. Groups are trusted server-produced membership references, not an accepted client upload payload. The adapter also has compatibility aliases; new producers should use the canonical shape.
- Omitting `groups` or passing `null` selects conservative legacy single-item handling. An explicit empty group array is unresolved, not permission to guess.
- At most three prescription/invoice items. Claim forms are not assigned invented medicine lines.
- IDs are server-derived opaque references, not secrets, authorisation tokens or proof of medicine identity. Upstream routes must still enforce user/case/tenant access before loading and returning records.
- No network, database write, OCR, model request, correction mutation or case-lifecycle transition is performed by this adapter.

## 4. Envelope contract

Required top-level fields:

```text
schemaVersion, caseId, documentId, documentType,
groupingStatus, detectedGroupCount, maxAllowedItems,
reviewRequired, coverage, medicineItems, issues, issueCodes
```

Grouping states:

- `GROUPED`: one to three explicitly linked items.
- `LEGACY_SINGLE_ITEM`: exactly one unambiguous legacy-derived item.
- `UNRESOLVED`: no published items; review required with machine-readable reasons.
- `NOT_APPLICABLE`: no medicine items, used for claim-form grouping.

Coverage has `status`, `isComplete`, `total`, `processed`, `omitted`, `reportedStatus`. Status is `COMPLETE`, `INCOMPLETE`, `UNKNOWN` or `CONTRADICTORY`. Unknown numbers stay null. Count arithmetic and field page bounds are checked in code. Schema enforces representable review/coverage implications, not every cross-field arithmetic relationship.

Issues contain `code`, `severity`, `message`, `fieldIds`; there are 24 frozen codes. Do not branch UI behaviour on English message substrings. The schema disallows additional arbitrary properties.

## 5. Item and linked-field contract

Each item contains `itemId`, `caseId`, `documentId`, `documentType`, `groupingMode`, `anchorFieldId`, `fieldIds`, `pageNumbers`, `needsCorrection`, `fields`.

`itemId` has format `mi_<24 hexadecimal characters>`. Its derivation uses case/document/anchor identities, not medicine wording or group order, so correcting a value on the same field preserves the item ID. Replacing the actual anchor field can change the item ID; consumers must not assume persistence across arbitrary OCR reprocessing that creates new fields.

The fixed eight-slot map is:

```text
medicine_name, dosage_strength, dosage_form, release_type,
quantity, quantity_unit, pack_size, pack_unit
```

`medicine_name` is non-null; the other slots are linked fields or null. At most eight unique field references are published per item. Each linked field retains source IDs, field type, raw value, normalised value, actual page, supplied bounding box or null, extraction method, server `extractionConfidence`, derived correction flag, correction markers and a sanitised optional resolution summary. No fake coordinates, clinical confidence scores or storage identifiers are added.

The four essential slots for this adapter's readiness flag are name, strength, form and quantity. Unit/pack/release fields are preserved when supplied, but their mathematical comparability and identity eligibility are not established here. Session 2 must check those separately.

## 6. Review semantics

- Explicit `needsCorrection: true` always requires review, even with both correction markers present.
- Incoherent partial correction metadata requires review.
- Confidence below 0.75 requires review unless a coherent correction marker pair clears that condition and no explicit true flag remains. The cutoff is a prototype engineering rule, not calibrated clinical certainty.
- Missing essential fields remain null; useful unambiguous partial items may remain grouped, but the envelope requires review.
- Unresolved grouping, noncomplete coverage, issues or correction-required items cannot advertise `reviewRequired: false` under the schema.
- Unclaimed medicine attributes are not silently dropped. Competing fields, foreign scope, duplicated membership and over-limit groups fail conservatively.
- The unsafe combination-partner keyword exemption is removed. The remaining flat-list detector is a conservative heuristic, not a complete medicine parser or a product-identity verifier.

Crucially, `GROUPED` and `reviewRequired: false` only describe adapter-level structure/readiness. They do not mean the medicines are equivalent, quantities agree, a case is verified, a claim is approved or a human review may be bypassed.

## 7. Still open for later checkpoints

Cross-document item matching; conservative medicine eligibility; quantity/pack arithmetic; robust OCR line grouping; grouping persistence/correction endpoints; case results/API integration; reviewer UI integration; item-aware RAG and answer freshness; held-out evaluation; production/mobile/privacy acceptance.

The wider application type debt recorded on 9 November was not repaired or re-certified by this backend-only checkpoint. Standalone adapter acceptance is not a full application build or security certification.

## 8. Handoff

Foundation Session 1 is closed for its bounded scope. On the student's next `2`, Gemini owns the bounded backend reconciliation implementation and GPT owns the consumer comparison interface/independent acceptance work after the Session 2 contract is agreed. Preserve one-owner-per-file coordination. Do not auto-start it or mutate the frozen item contract to add matcher semantics without review.

GPT changed only its acceptance tests and checkpoint documentation in this re-inspection. Gemini's implementation, existing app code, secrets, local data and the frozen dataset remain unchanged by GPT. Commit/push/deployment: none.
