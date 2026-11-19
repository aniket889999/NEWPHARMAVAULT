# Gemini task: bounded official medicine-source connector

Workspace: `/Users/aniket/Documents/Codex/2026-07-26/y/NEWPHARMAVAULT-v3`

Our chatbot currently searches MedlinePlus health topics, which often lack medicine-specific details. Add a small standalone NHS medicine connector. GPT owns existing generation/routing files. Preserve all existing work.

## Read only

- `backend/services/approvedHealthSearchService.js`
- `backend/data/chatTopicRegistry.js`
- `backend/data/chatMedicineEvidence.v1.json`
- `backend/package.json`

Read other files only if a concrete import requires them. No whole-repo audit, dependency installs, `.env` inspection, builds, broad tests or Git changes.

## Create only

1. `backend/services/approvedMedicineSearchService.js`
2. `backend/tests/approvedMedicineSearch.test.js`
3. `docs/chatbot-next/GEMINI_MEDICINE_CONNECTOR_REPORT.md`

Export `createApprovedMedicineSearch({fetcher, now, enabled})`, returning async `search(topicId, {attribute, signal} = {})`.

Return `{status, candidates: [{topicId, attribute, title, sourceUrl, excerpt, fetchedAt, publisher: "NHS", jurisdiction: "UK", reviewStatus: "NOT_CLINICALLY_APPROVED"}]}`.

Candidates are NOT trusted passages. Do not register them as approved, change governance or wire routes. GPT reviews and integrates separately. Use explicit disabled/unsupported/unavailable statuses, never fabricated success.

## Strict scope

- At most four existing generic topics: paracetamol, metformin, azithromycin, cetirizine. Attributes: GENERAL, USES, SIDE_EFFECTS only.
- Fixed verified `https://www.nhs.uk/medicines/...` URLs only. Use existing source URLs where possible; verify other URLs on NHS. No arbitrary URL/query/history/person/case input.
- Disabled or unsupported inputs cause zero network requests. Reject redirects, non-HTML content, oversized bodies and unknown URLs. Bound response to 256 KiB and total work to six seconds; respect cancellation, no retries.
- Extract main article text, not navigation/footer/scripts. Preserve complete sentences, negations and qualifications. Never generate medical content. Exclude dosing instructions/numeric-dose passages, logos, media and BNF content.
- Excerpts at most 1,400 characters, at most three candidates. Cache at most 32 entries, 12-hour lifetime; deterministic injected clock/fetcher.
- No paid services, credentials, new dependencies or bulk downloads. At most FOUR public-page verification fetches total. Parser/site mismatch => unavailable.
- NHS attribution and UK jurisdiction are not Indian approval or clinical validation.

## Verify once

`node --test backend/tests/approvedMedicineSearch.test.js`

Use mocked fixtures for fixed URLs/attributes, disabled/unknown no-egress, redirects, byte/deadline bounds, cancellation, article extraction, dose exclusion, complete sentences and cache. No unrelated suites. If blocked, report the exact blocker; do not expand scope.

Final report at most 12 lines: files, interface, actual test count, public checks actually performed, limitations, commit none. Never call fixtures live or clinical validation.
