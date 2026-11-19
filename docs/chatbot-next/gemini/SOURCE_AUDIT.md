# AI Audit of `docs/chatbot-reference-standard/v1/`

**Audit Status**: `AI_ENGINEERING_AUDIT_ONLY` — Not human, clinical, or independent gold-standard approval. Frozen `v1` files were read only and left untouched.

## 1. Unsupported Facts & Coverage Gaps in `v1`
- **Narrow 4-Medicine Coverage**: `source-catalog.json` includes `HEALTH_REFERENCE` passages for only 4 medicines (`paracetamol`, `metformin`, `cetirizine`, `amoxicillin`). Queries for other registered medicines (`F34-01` Atorvastatin, `F34-02` Losartan) and product-specific storage temperatures (`F33-01`/`F33-02`) are unsupported and must abstain.
- **Missing Paracetamol Side-Effects Source in `source-catalog.json`**: `source-catalog.json` includes `nhs-paracetamol-overview` (`PARA_USE`) but omits a Paracetamol side-effects passage (`nhs-paracetamol-effects`), whereas Metformin has both overview and effects entries.
- **Exposed Development Status**: As stated in `README.md`, all 100 scenarios (50 families x 2 variants) are exposed development/reference material authored by `CODEX_ENGINEERING_AUTHOR_NOT_CLINICAL_REVIEWER` (`clinicalApproval: "NOT_ESTABLISHED"`), not an unseen held-out clinical study.

## 2. Missing Cautions & Mechanical Scorer Limits
- **Penicillin Allergy Omitted in `nhs-amoxicillin` Excerpt**: `nhs-amoxicillin` (`source-catalog.json` lines 203–211) mentions nausea and diarrhoea but omits penicillin-allergy / anaphylaxis contraindications.
- **Lexical Regex Patterns Do Not Enforce Safety Caveats**: Fact regexes (`PARA_USE`, `MET_USE`, `CET_SLEEP`, `AMOX_USE`) verify core phrases (e.g., `"sleep\\w*|drows\\w*"`) without requiring that accompanying cautions (such as not driving when drowsy in `F05-01`/`F05-02`, or kidney/liver precautions in `F01`/`F02`) appear in the generated reply.
- **Aged Source Review Date**: `nhs-antibiotics` records `NHS page reviewed 2022-11-11; snapshot checked 2026-10-15`, requiring human clinical review for current stewardship alignment.

## 3. Licensing Uncertainty
- **UK OGL v3.0 Conditions**: NHS summaries rely on Open Government Licence v3.0 (`https://www.nhs.uk/our-policies/terms-and-conditions/`), which requires explicit attribution/snapshot dates and excludes NHS logos, third-party media, and BNF/MedicinesComplete content.
- **MedlinePlus Third-Party Copyright Boundary**: `reference-antibiotic-resistance-*` uses public-domain NLM health-topic text (`https://medlineplus.gov/about/using/usingcontent/`), but MedlinePlus drug monographs (ASHP/AHFS) are third-party copyrighted and cannot be added under public-domain terms.

## 4. US/UK Reference Scope vs. India Limitations
- **Zero Indian Regulatory Coverage**: Every medical source in `source-catalog.json` is UK (`nhs.uk`) or US (`medlineplus.gov`); none establish Central Drugs Standard Control Organization (CDSCO) approval, Indian National List of Essential Medicines (NLEM) status, or local prescribing schedules.
- **Brand-Family & Substitution Risk**: UK/US generic summaries do not verify Indian multi-ingredient brand extensions or therapeutic interchangeability (`IDENTITY` fact); qualified human pharmacist review remains mandatory (`PENDING`).
