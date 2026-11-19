# Academic evidence expansion — 18 November 2026

Gemini prepared 21 candidate summaries in `gemini/medicine-evidence.json`. These are preparation inputs, not an approval mechanism or runtime knowledge directory. Codex checked the six previously uncovered medicine routes against current primary NHS pages and created a separate, smaller checked-in derivative. Gemini-owned files and the frozen v1 reference data/results were not edited.

## Runtime addition

`backend/data/chatMedicineEvidence.v1.json` has 12 short original summaries: uses and possible side effects for ibuprofen, atorvastatin, losartan, omeprazole, pantoprazole and azithromycin. Together with the existing four medicine topics, the precise-reference registry now covers all ten registered generic medicines. This does not mean complete monographs, brand/product coverage or every question about those medicines.

| Topic | Primary sources checked on 2026-11-18 |
|---|---|
| Ibuprofen, adult information | [NHS](https://www.nhs.uk/medicines/ibuprofen-for-adults/) |
| Atorvastatin | [NHS](https://www.nhs.uk/medicines/atorvastatin/) |
| Losartan | [NHS](https://www.nhs.uk/medicines/losartan/) |
| Omeprazole | [NHS](https://www.nhs.uk/medicines/omeprazole/) |
| Pantoprazole | [About](https://www.nhs.uk/medicines/pantoprazole/about-pantoprazole/), [side effects](https://www.nhs.uk/medicines/pantoprazole/side-effects-of-pantoprazole/) |
| Azithromycin | [About](https://www.nhs.uk/medicines/azithromycin/about-azithromycin/), [side effects](https://www.nhs.uk/medicines/azithromycin/side-effects-of-azithromycin/) |

Some older NHS about/side-effect paths now redirect to combined medicine pages. Runtime citations use the directly checked current URL. The derivative deliberately omits broader treatment/suitability statements and several uncommon-risk assertions not directly established by the selected page sections. Pantoprazole effects are labelled *uncommon*, not common. The eight candidate summaries for already-covered medicines were not silently substituted into the historical source pack. The CDC general-storage candidate duplicates existing scope and is not product-specific storage evidence, so it was not added.

Each runtime record has a stable content/source/version-bound ID, fixed topic and supported attribute, original source URL, publisher, UK jurisdiction, checked date and reuse note. API source cards show this provenance. No remote fetch or model decides the pack contents at startup. Schema/bounds checks reject duplicated slots, off-domain/mismatched URLs, unexpected attributes and oversized records.

## Retrieval and model integrity

Corpus expansion invalidates the historical local ranker's exact corpus hash. The old trained artifact is preserved and **inactive** for the current corpus; the system must not call it newly trained. Current answers use topic/focus/request filtering plus BM25 or a single-topic/section lookup. The unscoped BM25 floor remains unchanged. A corpus-relative score floor is not reused inside an already constrained tiny pool after sentence-support checks. Scores are ranking values, not medical confidence.

The historical training test reproduces its original weights from its original 24-source corpus. The current development comparison is versioned v2 and calls the current route `currentContext`, not `trainedContext`.

## Honest evaluation

- New pack acceptance: 16/16 tests, including 12 direct medicine/attribute answers, invalid-pack rejection, reviewed-only exclusion, and dose/urgent/storage boundaries.
- Focused context, precision, boundaries, web-policy and history-client run: 106/106 passed. These overlap the 16 pack tests; do not add the counts as independent evidence.
- Existing v1 exposed reference replay: 98/100. The only differences are F34-01 and F34-02: old expectations required abstention for atorvastatin/losartan because no local evidence existed. Those questions now receive attributed evidence. Original expectations are preserved, not rewritten to raise a score.
- Current 16-question exposed top-source challenge: bare BM25 11/16; strong rule-scoped baseline 16/16; current context-scoped route 16/16. No superiority claim, and no clinical answer-accuracy measurement.
- The earlier `CODEX_QUALITY_RESULTS.json` 100/100 result is a historical pre-expansion candidate, not the score of this expanded corpus.

## Boundaries

Academic/source-checked only, not clinical approval or NHS endorsement. UK references do not establish Indian approval or brand equivalence. No dose, therapeutic substitution, product-specific storage temperature or automated claim decision was added. Production/reviewed-only policy still excludes these unapproved academic records. Qualified human review remains pending; it is not required to fabricate a launch approval for this final-year demo.
