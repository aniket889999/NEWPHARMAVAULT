# G4 Public Test-Data Discovery Report (Corrected)

## Files Updated in `docs/chat-launch/G4/` (3)
- `DATASET_CANDIDATES.md` — 6 primary resources with primary policy URLs (`open.fda.gov/terms/`, `nlm.nih.gov/copyright.html`, `dailymed.nlm.nih.gov/dailymed/about-dailymed.cfm`, `medlineplus.gov/copyright.html`, `nhs.uk/our-policies/terms-and-conditions/`, `creativecommons.org/licenses/by/4.0/`).
- `source-manifest.csv` — 16-column CSV distinguishing `publisher_licence_stated` from `project_review_status` (`NOT_CLINICALLY_APPROVED`), with `verified_size: UNKNOWN` and `ESTIMATED` sample caps.
- `REPORT.md` — This summary report (`<= 20` lines).

## Key Corrections Applied
- **DailyMed & FDA Warnings**: Qualified that government hosting does not make manufacturer/third-party SPL content public domain, and that DailyMed/openFDA listing does not mean a drug is FDA-approved.
- **Separated Sample (`60 + 40`, Actual Sizes `UNKNOWN`, Caps `ESTIMATED` <= 8 MB)**: Split into **60 source records** (`25` openFDA + `20` DailyMed SPL + `15` MedlinePlus XML, requiring SPL `Set ID`/family deduplication) and **40 separated unlabelled evaluation questions** (`Medication QA`), removing unverified category quotas and anonymization claims.
- **Human Review Required (`PENDING`)**: Zero bytes downloaded; human clinical, legal, and privacy review is required before any download or use.
