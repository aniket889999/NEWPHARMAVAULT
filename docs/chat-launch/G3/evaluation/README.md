# Chatbot Evaluation Protocol & Governance Structure

**Status**: `PROTOCOL_TEMPLATE_ONLY` — No held-out evaluation has been scored and no expert labels or superiority claims are asserted here.

## 1. Separation of Roles
- **Dataset & Scenario Author**: Designs synthetic question families and locks source snapshot checksums prior to system evaluation; does not tune system prompts or retrieval weights on held-out items.
- **System Builder / Integrator**: Implements retrieval, boundary routing, and generation pipelines using visible development fixtures only; has no write access to held-out reference standards or grading sheets.
- **Independent Clinical Reviewers (R1, R2)**: Qualified human pharmacists/clinicians who author gold reference criteria and grade blinded system outputs independently.
- **Adjudicator (R3)**: Senior clinical reviewer who resolves inter-rater disagreements between R1 and R2 without visibility into system branch/variant identity.

## 2. Family-Disjoint Split Policy
- Scenarios are grouped by **question family** (topic + clinical/document scenario root, including paraphrased, multi-turn follow-up, and counterfactual variants).
- Every variant of a family is assigned to the **same split** (`development` or `held_out`) so lexical or scenario overlap never leaks across splits.
- Held-out families are checksum-frozen before execution and never used for iterative prompt, threshold, or reranker tuning.

## 3. Blinded Grading Procedure
- System outputs are stripped of model/pipeline identifiers, internal route labels, and timestamps before presentation to R1 and R2.
- Reviewers receive the user prompt, prior conversation turns, frozen cited source passages, and the anonymized response text.

## 4. Required Evaluation Metrics
1. **Factual Support (Claim-Level Precision)**: Proportion of factual claims in the response that are fully supported by the cited governed source passage(s), with zero fabricated facts or unsupported extrapolations.
2. **Completeness (Required Caution & Key Fact Recall)**: Proportion of pre-specified essential source facts and mandatory safety caveats included without critical omission.
3. **Boundary & Refusal Accuracy**: Exact match rate on required refusals (`REFUSE`), coverage gaps (`COVERAGE_GAP`), personal clinical referrals (`CLINICAL_REFERRAL`), and urgent safety escalations (`URGENT`).
4. **Safety Harm / Contradiction Rate**: Incidence of source contradictions, invented doses, clinical recommendations, or missed emergency escalations (target: zero critical safety failures).
5. **Latency & Availability**: Measured p50 and p95 end-to-end response latency and fallback rate, reported separately for local deterministic vs provider-backed public modes.

## 5. Disagreement Resolution
- R1 and R2 score every item independently using `reviewer-rubric.md`.
- Any discrepancy on a binary safety/refusal gate or a >1 point difference on ordinal support/completeness scales is routed to Adjudicator R3 for a documented final consensus label, while preserving raw pre-adjudication agreement statistics (e.g. Cohen's kappa / raw percent agreement).
