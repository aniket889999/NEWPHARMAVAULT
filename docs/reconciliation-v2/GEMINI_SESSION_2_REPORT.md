# PharmaVault Session 2 — Backend Medicine Matching & Quantity Checks Report (Gemini)

**Date**: 12 November 2026  
**Workstream**: Session 2 — Medicine Matching & Administrative Quantity Checks (Offline Pure Backend Services)  
**Owner**: Gemini (Backend Quantity & Reconciliation Services, Builder Tests, Development Fixtures, Report)  
**Next Owner**: GPT (Independent Acceptance Review)  
**Commit / Push / Deployment**: None

---

## 1. Scope & File Boundary Compliance

Only the six files assigned to Gemini in `docs/reconciliation-v2/SESSION_2_CONTRACT.md` were created:

1. `backend/services/trustRag/medicineQuantityService.js`
2. `backend/services/trustRag/medicineReconciliationService.js`
3. `backend/tests/medicineQuantity.test.js`
4. `backend/tests/medicineReconciliation.test.js`
5. `backend/tests/fixtures/reconciliation-v2-development.json`
6. `docs/reconciliation-v2/GEMINI_SESSION_2_REPORT.md`

### Frozen Session 1 Contract Integrity
All frozen Session 1 files remain untouched and match `docs/foundation-v2/SESSION_1_CONTRACT_FREEZE.json` byte-for-byte:
- `backend/services/trustRag/medicineItemContract.js`: `b43d5feb2f00c70c8c826731b9455122e69c36efd8d278474cd3e49d370109e5`
- `contracts/schemas/medicine-item.schema.json`: `3c2a78e8767a575fa786963b3e2b4f03e0d26c2445745fb0dd0f4dc08808f057`
- `tests/foundation-v2/dataset-lock.json`: `dd25343c7961c26b9d76dc427c1b17d919d0593b84b398237c8bdb60681febb0`

No GPT-owned files (`contracts/schemas/medicine-reconciliation.schema.json`, `src/modules/verification/reconciliation/**`, `tests/reconciliation-v2/**`), routes, controllers, models, orchestrator, OpenAPI, existing frontend, dependencies, or held-out fixtures (`tests/foundation-v2/heldout.manifest.json`) were modified or tuned against.

---

## 2. Exported Interfaces

### 2.1 `backend/services/trustRag/medicineQuantityService.js`
- **`normalizeItemQuantity(item)`**
  - Returns `{ status: 'NORMALIZED' | 'INSUFFICIENT_EVIDENCE', baseQuantity, baseUnit, reasonCodes, fieldIds }`.
  - Validates item and slot context (`caseId`, `documentId`, `fieldType`); throws an Error with `code = 'INVALID_RECONCILIATION_INPUT'` and a generic message on malformed or cross-context input.
  - Supports direct base units (`tablet`, `capsule`, `mL`, plus case/plural/abbreviation forms `tablets/tab/tabs`, `capsules/cap/caps`, `ml`) and explicit container multiplication (`strip/strips`, `pack/packs`) when both positive whole-number `pack_size` and a supported direct `pack_unit` are present.
  - Enforces whole positive integers (`1..1,000,000`) for discrete counts and pack sizes, and bounded positive decimals (`(0, 1,000,000]`) for `mL`. Rejects `0`, negatives, explicit signs (`+`/`-`), ranges, hex, scientific notation, `NaN`/`Infinity`, and product overflow (`> 1,000,000`) with `INVALID_QUANTITY`.
  - Never infers a default pack size (`UNKNOWN_PACK_SIZE`) or calculates quantities from dosage instructions (`MISSING_QUANTITY`).
  - Any quantity slot requiring human review (`needsCorrection`, partial correction metadata, or unreviewed `extractionConfidence < 0.75`) yields `INSUFFICIENT_EVIDENCE` with `FIELD_NEEDS_CORRECTION` and `baseQuantity: null, baseUnit: null`.

### 2.2 `backend/services/trustRag/medicineReconciliationService.js`
- **`reconcileMedicineDocuments({ caseId, prescription, invoice, catalogue })`**
  - Validates input envelopes against Session 1 structural, coverage, provenance, item-ID derivation, and review-state invariants; rejects cross-case, cross-document, duplicate-document, forged-ID, or storage-key-contaminated inputs with `code = 'INVALID_RECONCILIATION_INPUT'` and a generic message.
  - Performs fresh exact normalized generic/brand/alias lookup against `catalogue` (defaulting to `ACADEMIC_MEDICINE_CATALOGUE`), ignoring cached `field.resolution`.
  - Detects brand/alias attribute conflicts (`IDENTITY_ATTRIBUTE_CONFLICT`), ambiguous alias mappings (`AMBIGUOUS_MEDICINE`), unknown identities (`UNKNOWN_MEDICINE`), and out-of-scope combination/product types (`UNSUPPORTED_PRODUCT_TYPE`).
  - **Uncertain-Identity Omission/Extra Inference Guard (Correction Pass)**:
    - In `resolveItemIdentity`, a `medicine_name` that still requires human correction (`nameNeedsCorrection === true`, including unreviewed low confidence `< 0.75` or partial correction metadata) or has an attribute conflict (`hasAttributeConflict === true`) sets `resolved: false` (retaining its provisional `genericName`/`genericKey` for candidate inspection only, not as a confirmed identity).
    - `rxHasUnresolvedIdentity` and `invHasUnresolvedIdentity` treat any item with `!identity.resolved`, `nameNeedsCorrection`, `hasAttributeConflict`, or `ambiguousMatch` as having an unconfirmed identity on that document.
    - Consequently, `buildSingleSidedRow` never emits `MISSING_INVOICE_ITEM` or `EXTRA_INVOICE_ITEM` when any counterpart item has an uncertain or unconfirmed `medicine_name`, while still preserving confirmed field mismatches (`STRENGTH_MISMATCH`, `DOSAGE_FORM_MISMATCH`, `RELEASE_TYPE_MISMATCH`, `QUANTITY_MISMATCH`) on independently reliable paired items.
  - Executes order-independent, three-tier 1-to-1 matching within each resolved generic family:
    1. Mutually unique full-attribute match (`strength + form + release`).
    2. Mutually unique same-strength match among remaining non-competing items.
    3. Mutually unique same-generic candidate for explicit difference checks.
    Competing/duplicate candidates are never paired by array order or quantity (`AMBIGUOUS_MATCH`). Unknown/ambiguous medicines are never paired even when spellings agree.
  - Evaluates `identity`, `strength`, `form`, `release`, and `quantity` independently per row so uncertainty on one field (`FIELD_NEEDS_CORRECTION`) never suppresses a confirmed difference (`MISMATCH`) on another checked field.
  - Emits `MISSING_INVOICE_ITEM` / `EXTRA_INVOICE_ITEM` only when both documents are present, have `COMPLETE` page coverage, have resolved grouping, and all counterpart identities are confirmed without pending `medicine_name` correction.
  - Produces outputs conforming to `contracts/schemas/medicine-reconciliation.schema.json` (`schemaVersion: '2.0.0-session2'`, `rulesetVersion: 'academic-reconciliation/1.0.0'`, `humanDecisionRequired: true`).

---

## 3. Verification Results

| Check / Suite | Command | Result |
|---|---|---|
| Syntax checks | `node --check backend/services/trustRag/medicineQuantityService.js && node --check backend/services/trustRag/medicineReconciliationService.js` | **Pass (exit 0)** |
| Builder quantity + reconciliation suites | `node --test backend/tests/medicineQuantity.test.js backend/tests/medicineReconciliation.test.js` | **43 / 43 passing (8 + 35)** |
| GPT expanded backend acceptance suite | `node --test tests/reconciliation-v2/backend.acceptance.test.cjs` | **55 / 55 passing** |
| GPT consumer UI/view-model suite | `node --test tests/reconciliation-v2/consumer.test.cjs` | **39 / 39 passing** |
| Foundation regression + lock suites | `node --test backend/tests/foundationMedicineItems.test.js tests/foundation-v2/adapter.acceptance.test.cjs tests/foundation-v2/manifest.test.cjs` | **125 / 125 passing (35 + 31 + 59)** |
| Contract JSON Schema compilation | `npm run validate:schemas` | **11 / 11 schemas valid** |

---

## 4. Remaining Limitations & Deferred Work

- **Offline Pure Services Only**: `reconcileMedicineDocuments` and `normalizeItemQuantity` are pure in-memory functions; HTTP route/controller/orchestrator integration and live case-page wiring remain deferred to a subsequent session.
- **Bounded Pilot Ruleset**: Supports up to 3 grouped items per document, single-ingredient academic catalogue families, exact same-unit strength comparisons, and explicit `tablet`/`capsule`/`mL` (plus `strip`/`pack` with explicit `pack_size` and `pack_unit`). Concentration unit conversions, dose-schedule arithmetic, split-invoice fills, and therapeutic substitution remain intentionally unsupported (`INSUFFICIENT_EVIDENCE`).
