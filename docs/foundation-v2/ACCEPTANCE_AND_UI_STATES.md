# Foundation V2 — independent acceptance specification and UI states

Owner: GPT. Prepared 9 November 2026. This is a specification, not a claim these new application behaviours are implemented.

## 1. Boundary and comparison vocabulary

Compare supported fields between a prescription and pharmacy invoice. Preserve the original document, OCR value, corrected normalised value, source field ID and actual page. The reviewer sees uncertainty, not a fabricated certainty percentage.

- `CONSISTENT`: the declared checked fields agree under supported administrative rules. Not clinical suitability, authenticity or claim eligibility.
- `MISMATCH`: an evidenced difference, not a fraud finding or a decision to reject a claim.
- `INSUFFICIENT_EVIDENCE`: a required check cannot be completed. Ask for a specific missing field/document or human clarification.

Do not collapse these labels into the existing case lifecycle. A consistent comparison does not authorise a patient or the AI to mark a case verified.

If a case has both a confirmed mismatch and incomplete evidence, show both. Preserve the mismatch and the completeness warning. Do not make either disappear through a single aggregate label. An unqualified consistent outcome requires all required checks to have sufficient evidence.

## 2. Session 1 adapter acceptance (inspect actual Gemini output)

| ID | Input/perturbation | Required observation |
|---|---|---|
| A01 | One unambiguous legacy medicine with referenced fields | At most one item; original source refs and uncertainty preserved. No database writes. |
| A02 | Three explicit trusted groups | Three distinct server-derived IDs and correct membership. |
| A03 | Reorder those groups | Each group's item ID and its field membership stay stable. |
| A04 | Correct only an existing strength field's value | That item ID remains stable; raw and corrected values remain distinguishable. |
| A05 | Two ungrouped medicine-name fields | Unresolved, not the first field selected and not copied across invented rows. |
| A06 | One flat field containing a multi-medicine list | No guessed row grouping. Clear unresolved reason. |
| A07 | Repeated competing strength/quantity fields for one group | Unresolved/conflict, not arbitrary precedence. |
| A08 | A group references another document or case | Safe rejection/unresolved result; no referenced foreign content in output. |
| A09 | A field belongs to two groups or an anchor is reused | Safe rejection/unresolved result; no duplicated evidence attribution. |
| A10 | More than three explicit groups | Honest limit issue/count; no silent successful truncation. |
| A11 | Missing strength/form/quantity/confidence | Missing stays unknown; no defaults of 500 mg, tablet, one pack or confidence 1. |
| A12 | Incomplete/unknown/contradictory coverage | Not an unqualified complete result. Preserve enough detail to explain the limitation. |
| A13 | Claim has metadata but no medicine lines | No invented medicine item; not-applicable grouping. |
| A14 | Input contains storage keys, paths, arbitrary metadata or fake client role | None leaks through explicit DTO fields. Does not grant authority. |
| A15 | Reuse input object after adapter call | Deep equality with original; no mutation, correction or lifecycle change. |
| A16 | Representative success and failure outputs | Validate against the standalone JSON Schema using Draft 2020-12, not merely JSON parsing or schema compilation. |

Before the interface freeze, inspect the export, exact field names, issue codes and schema together. GPT must not guess a frontend response from the prose brief. No new route is published in Session 1.

## 3. Later-session acceptance carried by the synthetic specification

- Reordered invoice lines do not alter their medicine relationships.
- Known 500/650 strength conflict remains a conflict; no normalisation erases it.
- Tablet, capsule and liquid units are not interchangeable.
- Preserve explicitly stated IR/SR labels; matching text does not establish a clinically valid product or therapeutic equivalence.
- An explicit pack count permits arithmetic; an unknown count does not.
- Complete-document missing/extra lines are comparison differences for review, not automatic fraud or claim decisions.
- An omitted page or absent invoice makes its unobserved medicine information unknown, not proven absent.
- Unknown catalogue identity does not become known because the same spelling appears twice.
- Low-confidence or correction-required essential fields remain visible and block an unqualified verification.
- A selected case/item question cannot use another item's passage merely because it has a real citation.
- A dependent correction invalidates the old answer; an unrelated administrative edit does not.
- Source deletion/reprocessing invalidates dependent answers when F8 is integrated. These cases are required engineering tests even though the initial 40-case pilot contains only correction/unrelated-edit freshness pairs.
- Patients cannot finalise a staff review or inject grouping/identity/version metadata through a request.

## 4. Planned reviewer interface states

| State | Display | Permitted next step |
|---|---|---|
| Loading | Loading document comparison; no result badge yet | Cancel/back; do not show a cached all-clear for a different case. |
| Extraction pending/failed | Actual processing status and a specific next action | Retry within existing permissions, replace upload, or inspect original. |
| No explicit grouping | “Medicine rows need confirmation” | Staff groups/corrects fields through the later authorised interface. |
| Legacy single item | One medicine row labelled as legacy-derived | Inspect source; do not suggest multi-item coverage. |
| Matched fields | Side-by-side name, strength, form/release and explicit quantity | Open the linked evidence; inspect unverified fields separately. |
| Confirmed difference | Exact differing values, source links and mismatch reason | Return for correction or escalate; no automatic rejection. |
| Insufficient evidence | Missing field/page/unit/group named explicitly | Request that information; retain other confirmed findings. |
| Unsupported limit | Detected item/page count and inspected scope | Human inspection or supported replacement; no silent truncation. |
| Human review pending | Visible reviewer actions only for authorised staff | Verify, Return for Correction or Escalate with reason/audit. |
| Case chat needs context | “Select a case and medicine item” | Select authorised context; no guessed personal answer. |
| Chat evidence unavailable | Clear local fallback/refusal and explanation | Inspect sources or provide missing evidence. |
| Answer outdated (F8) | Previous answer visibly marked outdated; source change described | Explicitly refresh; preserve prior response and review history. |

Do not implement these UI states against an invented endpoint in Session 1. Existing frontend confidence/status/type discrepancies are recorded in the baseline and require deliberate contract alignment later.

## 5. Human interpretation boundary

The synthetic oracle is an engineering answer key, not a clinician's judgment. The cases contain no patient-specific treatment directions. Final review remains a human document-verification action, not an autonomous medical or reimbursement decision.
