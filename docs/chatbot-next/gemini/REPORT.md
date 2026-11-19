# Gemini Handoff Report — `docs/chatbot-next/gemini/`

## 1. Files Created (7)
1. `docs/chatbot-next/gemini/medicine-evidence.json` — **21 records** (`<= 30` cap): `USES` and `SIDE_EFFECTS` for all 10 required medicines (`paracetamol`, `metformin`, `cetirizine`, `amoxicillin`, `ibuprofen`, `atorvastatin`, `losartan`, `omeprazole`, `pantoprazole`, `azithromycin`) from primary UK NHS (`nhs.uk`) pages, plus 1 `STORAGE` record from US CDC (`cdc.gov`) documenting the product-specific storage temperature gap. Every summary is original, `<= 72` words (`<= 90`-word limit), with `reviewStatus: "ACADEMIC_SOURCE_CHECKED_NOT_CLINICAL_APPROVAL"` and zero dosing/substitution/Indian-approval claims.
2. `docs/chatbot-next/gemini/prescription.html` — Synthetic HTML prescription (`CASE-DEMO-2026-0042` / `SYNTHETIC-SUBJECT-REF-0042`, `Paracetamol 500 mg`, `quantity 10`, `SYNTHETIC ACADEMIC DEMO — NOT FOR CLINICAL USE`).
3. `docs/chatbot-next/gemini/invoice.html` — Synthetic HTML pharmacy invoice (`CASE-DEMO-2026-0042` / `SYNTHETIC-SUBJECT-REF-0042`, `Paracetamol 650 mg`, `quantity 10`, `SYNTHETIC ACADEMIC DEMO — NOT FOR CLINICAL USE`).
4. `docs/chatbot-next/gemini/claim-form.html` — Optional synthetic HTML claim form (`CASE-DEMO-2026-0042` / `SYNTHETIC-SUBJECT-REF-0042`, document-level date/amount only, zero medicine items).
5. `docs/chatbot-next/gemini/demo-facts.json` — Structured expectation record (`comparisonStatus: "MISMATCH"`, `reasonCodes: ["STRENGTH_MISMATCH"]`, `500 mg` vs `650 mg`, `humanReviewRequired: true`, `canVerify: false`).
6. `docs/chatbot-next/gemini/SOURCE_AUDIT.md` — 21-line (`<= 40` limit) AI engineering audit of `docs/chatbot-reference-standard/v1/` (`README.md`, `source-catalog.json`, `ANSWER_KEY.md`).
7. `docs/chatbot-next/gemini/REPORT.md` — This report.

## 2. Actual Structure & Bounds Checks
- `medicine-evidence.json`: Valid JSON array of 21 objects; all 10 required `topicId` medicines covered; max word count per `text` is 72 words (`<= 90`); exact required keys (`key`, `topicId`, `attribute`, `title`, `text`, `sourceUrl`, `publisher`, `jurisdiction`, `checkedAt`, `licenceBasis`, `reviewStatus`) verified.
- `demo-facts.json`, `prescription.html`, `invoice.html`, `claim-form.html`: Valid JSON and well-formed HTML5 documents with prominent `SYNTHETIC ACADEMIC DEMO — NOT FOR CLINICAL USE` banner, consistent fictional `CASE-DEMO-2026-0042` / `SYNTHETIC-SUBJECT-REF-0042`, and `500 mg` vs `650 mg` mismatch.
- `SOURCE_AUDIT.md`: 21 lines (`<= 40` lines); frozen `v1` files untouched.

## 3. Blockers & Required Human Review
- **Clinical & Licensing Approval (`PENDING`)**: `medicine-evidence.json` and `SOURCE_AUDIT.md` are engineering/AI outputs (`ACADEMIC_SOURCE_CHECKED_NOT_CLINICAL_APPROVAL`), not qualified pharmacist or legal sign-off.
- **Jurisdiction Gap**: UK NHS and US CDC/MedlinePlus sources do not establish Indian CDSCO regulatory approval or brand equivalence.
- **Next Owner**: **Codex** (inspection and integration).
