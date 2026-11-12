# Session 2 — independent backend review

**Historical initial review. Superseded after correction re-inspection on 12 November 2026:** the two failures are fixed; the final independent suite passes 56/56, including an additional non-suppression check. Current decision: scoped Session 2 PASS. See `SESSION_2_ACCEPTED_CONTRACT.md`. Findings below are retained for traceability.

Date: 12 November 2026. Decision: **CHANGES REQUIRED; Session 2 remains PARTIAL.** There is one additional inference defect with two reproductions. The original reported checks were reproduced successfully.

## 1. Observed checks

| Check | Result |
|---|---|
| Builder quantity + reconciliation suites | 40/40 pass (8 + 32), exit 0 |
| Original GPT backend acceptance suite | 52/52 pass before additions |
| Expanded GPT backend acceptance suite | 53/55 pass, two fail, exit 1 |
| GPT consumer/rendering suite | 39/39 pass |
| Foundation regression | 125/125 pass (35 builder + 31 independent adapter + 59 dataset checks) |
| Schema compilation | 11/11 valid |
| Both new backend service syntax checks | Exit 0 |
| Frozen Session 1 fingerprints | All unchanged |
| Actual engine-to-UI development bridge | All 24 development results pass the consumer's case/item/reference guard |

These are engineering checks, not clinical accuracy or a held-out research score. No API/UI wiring, production acceptance or real-patient claim is made. The standalone services are not deployed through a new route.

## 2. Additional root cause: uncertain counterpart names are treated as resolved for omission/extra inference

Relevant source: `backend/services/trustRag/medicineReconciliationService.js`:

- `resolveItemIdentity` records `nameNeedsCorrection` but can still return `resolved: true` for an exact catalogue lookup (around lines 599–604 and 754–761).
- `rxHasUnresolvedIdentity` / `invHasUnresolvedIdentity` check only `!identity.resolved` (around lines 1377–1378).
- `buildSingleSidedRow` can therefore label a different item MISSING_INVOICE_ITEM or EXTRA_INVOICE_ITEM even though a counterpart name remains unreviewed (around lines 1206–1218).

The paired row correctly shows identity uncertainty, but the uncertain name still influences the certainty of a separate row. That is not a confirmed per-medicine omission/extra finding.

### Reproduction A — uncertain invoice name

Use the development F02-03 request (prescription Metformin + Cetirizine; invoice contains one observed item). Set that invoice medicine-name confidence to 0.3, `needsCorrection: true`, no completed correction markers. Keep provenance intact and derive the input through the frozen Foundation adapter.

Actual: a provisional Metformin pair is marked insufficient, while Cetirizine is labelled definitely MISSING_INVOICE_ITEM and the result is MISMATCH.

Required: preserve the uncertain observation for human correction, but do not declare which prescribed medicine is absent using that unconfirmed label. In this bounded test there is no separate established field mismatch, so the result remains INSUFFICIENT_EVIDENCE.

### Reproduction B — uncertain prescription name

Use development F02-04 (two prescribed rows; three invoice rows), and mark the first prescription medicine name uncertain in the same way.

Actual: Azithromycin is labelled EXTRA_INVOICE_ITEM even though the uncertain prescribed name could correspond to a different invoice medicine.

Required: do not identify a particular medicine as definitely extra on the strength of an unconfirmed counterpart label. The scoped result remains insufficient pending clarification. Raw observed row counts can remain visible; they do not establish which medicine is unmatched.

## 3. Required bounded correction

Make primary-name uncertainty participate in identity eligibility / counterpart-resolution checks before classifying a specific unmatched medicine as missing or extra. Do not erase warning text or post-process away all mismatches. Correct the inference gate and retain all source items, references and review requirements.

Do not suppress separately established differences on reliable paired evidence merely because another row is uncertain. Existing tests for confirmed strength mismatch alongside quantity uncertainty must continue to pass. Candidate rows, if retained, must remain explicitly insufficient and must not establish another line's definite absence.

No schema/DTO change is needed. No reason-code expansion, Foundation adapter change, package change or route/API work is authorised by this review.

## 4. Independent tests added by GPT

`tests/reconciliation-v2/backend.acceptance.test.cjs` now includes:

1. Uncertain invoice name cannot prove which prescription item is missing — **fails**.
2. Uncertain prescription name cannot prove which billed item is extra — **fails**.
3. All 24 actual development engine results satisfy the UI reference/context guard — **passes**.

The original 52 checks remain intact. No locked gold, held-out label, Foundation source or Gemini-owned implementation was changed by GPT.

## 5. Handoff

Next owner: Gemini, bounded Session 2 correction pass using its original six-file ownership. Then GPT repeats the independent acceptance gate. Session 3 is not started. Commit/push/deployment: none.
