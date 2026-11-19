# G4 — Public Test-Data Discovery Pack (`NOT_CLINICALLY_APPROVED`)

**Status**: `DISCOVERY_METADATA_ONLY` — Zero bytes downloaded. Actual archive and sample byte sizes are `UNKNOWN` until fetched; any byte figures below are `ESTIMATED` planning ceilings only.
**Policy Separation**: **Publisher licensing terms** (statutory/contractual reuse conditions stated by FDA, NLM, NHS, or dataset authors) are distinct from **PharmaVault project governance policy** (`NOT_CLINICALLY_APPROVED` gate, human pharmacist review, SPL-family deduplication, and strict separation between knowledge sources and evaluation inputs).

## 1. Candidate Primary Resources (6)

### 1. openFDA Human Drug Labeling (`/drug/label`)
- **Exact URL & Policy URL**: `https://open.fda.gov/apis/drug/label/download/` | Terms: `https://open.fda.gov/terms/`
- **Publisher & Jurisdiction**: U.S. Food and Drug Administration (FDA) | `US`
- **Available Format**: Zipped JSON partitions and REST API JSON.
- **Publisher Licence / Terms**: Creative Commons CC0 1.0 Universal (`https://creativecommons.org/publicdomain/zero/1.0/`); attribution requested (`"Data provided by openFDA"`).
- **Listing vs. Approval Warning**: Per `https://open.fda.gov/terms/`, openFDA relies on manufacturer-submitted labeling; inclusion in `/drug/label` does **not** mean a product is FDA-approved or clinically verified (unapproved drugs, OTC monograph products, and homeopathic listings can appear).
- **Access Restrictions & Size**: Public HTTP/API (rate-limited without key) | Actual Size: `UNKNOWN`.
- **What It Can / Cannot Test**:
  - *Can test*: Section-scoped retrieval, citation grounding, effective-date comparison, and dosing refusal.
  - *Cannot test*: FDA approval verification by listing presence alone, Indian CDSCO status, or prescription OCR.

### 2. NLM DailyMed Structured Product Labeling (SPL)
- **Exact URL & Policy URLs**: `https://dailymed.nlm.nih.gov/dailymed/spl-resources-all-drug-labels.cfm` | Policies: `https://www.nlm.nih.gov/copyright.html`, `https://dailymed.nlm.nih.gov/dailymed/about-dailymed.cfm`
- **Publisher & Jurisdiction**: U.S. National Library of Medicine (NLM / NIH) | `US`
- **Available Format**: HL7 SPL XML (bulk ZIP archives and REST v2 XML/JSON).
- **Publisher Licence / Terms (Qualified)**: While NLM-authored site metadata is U.S. Government work (`https://www.nlm.nih.gov/copyright.html`), **government hosting does not place every manufacturer-submitted SPL contribution, trademark, or third-party insert into the public domain**.
- **Listing vs. Approval Warning**: Per `https://dailymed.nlm.nih.gov/dailymed/about-dailymed.cfm`, DailyMed contains FDA-submitted labeling in use, including **unapproved drugs** and products not evaluated by FDA for safety/efficacy; listing in DailyMed is **not** proof of FDA approval.
- **Access Restrictions & Size**: Public HTTP download and REST v2 API | Actual Size: `UNKNOWN`.
- **What It Can / Cannot Test**:
  - *Can test*: SPL `Set ID` vs `Version Number` supersession/freshness checks and section citation links.
  - *Cannot test*: Regulatory approval status from listing presence alone, consumer reading level, or clinical advice.

### 3. NLM MedlinePlus Health Topic XML Files & Web Service
- **Exact URL & Policy URL**: `https://medlineplus.gov/xml.html` | Policy: `https://medlineplus.gov/copyright.html`
- **Publisher & Jurisdiction**: U.S. National Library of Medicine (NLM / NIH) | `US`
- **Available Format**: XML snapshots and REST XML Web Service.
- **Publisher Licence / Terms**: NLM-authored health topic summaries are U.S. Government public domain (`https://medlineplus.gov/copyright.html`) with mandatory `MedlinePlus.gov` attribution and no NLM logo/endorsement. **Exclusion**: MedlinePlus Drug/Supplement monographs (copyrighted by ASHP/AHFS) and A.D.A.M. encyclopedia pages are third-party copyrighted and excluded from XML downloads.
- **Access Restrictions & Size**: Public HTTP; Web Service limited to 85 req/min per IP | Actual Size: `UNKNOWN`.
- **What It Can / Cannot Test**:
  - *Can test*: General medication-safety/stewardship topic retrieval and third-party copyright boundary compliance.
  - *Cannot test*: Product-specific drug monograph redistribution (ASHP excluded) or clinical diagnosis.

### 4. UK NHS Website Medicines A–Z (`nhs.uk`)
- **Exact URL & Policy URL**: `https://www.nhs.uk/medicines/` | Policy: `https://www.nhs.uk/our-policies/terms-and-conditions/`
- **Publisher & Jurisdiction**: NHS England / UK Department of Health and Social Care | `UK`
- **Available Format**: HTML pages / NHS Website Content API JSON.
- **Publisher Licence / Terms**: Open Government Licence (OGL) v3.0 (`https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/`) for text content with required attribution and date stamp; excludes NHS logos, third-party multimedia, and BNF/MedicinesComplete databases.
- **Access Restrictions & Size**: Public web pages; API requires developer registration | Actual Size: `UNKNOWN`.
- **What It Can / Cannot Test**:
  - *Can test*: Plain-English medicine overview/side-effect retrieval, urgent warning escalation, and review-date freshness.
  - *Cannot test*: Indian brand/formulary equivalence, prescribing decisions, or insurance claim eligibility.

### 5. Medication QA (`Medication_QA_MedInfo2019`)
- **Exact URL & Policy URL**: `https://github.com/abachaa/Medication_QA_MedInfo2019` | Licence: `https://creativecommons.org/licenses/by/4.0/`
- **Publisher & Jurisdiction**: Asma Ben Abacha et al. (Lister Hill National Center, NLM / NIH) | `US`
- **Available Format**: Excel (`.xlsx`) / tabular text (consumer medication questions paired with publisher annotations and reference URLs).
- **Publisher Licence / Terms**: Creative Commons Attribution 4.0 International (`CC BY 4.0`); requires academic citation (*Ben Abacha et al., MedInfo 2019*).
- **Access Restrictions & Size**: Public GitHub repository | Actual Size: `UNKNOWN` (no unverified privacy/anonymization guarantee is asserted prior to human inspection).
- **What It Can / Cannot Test**:
  - *Can test*: External evaluation-question phrasing and intent/refusal routing when held strictly separate from ingested sources.
  - *Cannot test*: Live 2026 label accuracy (static 2019 research corpus, not a clinical gold standard).

### 6. MedQuAD (`Medical Question Answering Dataset`)
- **Exact URL & Policy URL**: `https://github.com/abachaa/MedQuAD` | Licence: `https://creativecommons.org/licenses/by/4.0/`
- **Publisher & Jurisdiction**: Asma Ben Abacha & Dina Demner-Fushman (NLM / NIH) | `US`
- **Available Format**: Structured XML files across 12 NIH subsets.
- **Publisher Licence / Terms**: Creative Commons Attribution 4.0 International (`CC BY 4.0`); answer bodies in `11_MPlusDrugs_QA`, `12_MPlusHerbsSupplements_QA`, and `10_MPlus_ADAM_QA` are omitted by the authors for third-party copyright compliance (`https://medlineplus.gov/copyright.html`).
- **Access Restrictions & Size**: Public GitHub repository; drug subset has questions/URLs only | Actual Size: `UNKNOWN`.
- **What It Can / Cannot Test**:
  - *Can test*: Question-focus/type parsing and missing-answer abstention when source text is absent.
  - *Cannot test*: Grounded drug-answer grading on `11_MPlusDrugs_QA` without separately licensed source text and clinician review.

---

## 2. Proposed First Sample Plan (Capped at <= 25 MB `ESTIMATED` / <= 100 Total Items — Zero Downloaded)
Actual byte sizes are `UNKNOWN` until downloaded; MB caps below are `ESTIMATED` upper bounds:

### A. Candidate Knowledge Source Records (60 Source Records, `ESTIMATED` <= 7 MB, Actual `UNKNOWN`)
1. **openFDA `/drug/label` JSON**: **25 source records** (`ESTIMATED` <= 2 MB, actual `UNKNOWN`).
2. **NLM DailyMed REST v2 SPL XML**: **20 source records** — 10 SPL families x 2 versions for supersession/freshness tests (`ESTIMATED` <= 4 MB, actual `UNKNOWN`).
3. **NLM MedlinePlus Health Topics XML**: **15 source records** (`ESTIMATED` <= 1 MB, actual `UNKNOWN`).
- **Mandatory SPL-Family & Version Deduplication Rule**: Because openFDA `/drug/label` is derived from DailyMed SPL submissions, ingested source records must be deduplicated by **SPL `Set ID` and active moiety/product family** so identical or overlapping label families are not double-counted across openFDA and DailyMed, and historical SPL versions are isolated from current active records.

### B. Separated Unlabelled Evaluation Questions (40 Questions, `ESTIMATED` <= 1 MB, Actual `UNKNOWN`)
4. **Medication QA (`CC BY 4.0`)**: **40 unlabelled evaluation questions** (`ESTIMATED` <= 1 MB, actual `UNKNOWN`).
- **Mandatory Separation & Hygiene Rules**:
  - Evaluation questions must be stored in a **separate evaluation-input dataset** and never indexed into the retrieval knowledge corpus.
  - Publisher annotations are not treated as project ground-truth; category distribution and PII/PHI scrubbing must be verified by a human reviewer after download rather than assumed in advance.
