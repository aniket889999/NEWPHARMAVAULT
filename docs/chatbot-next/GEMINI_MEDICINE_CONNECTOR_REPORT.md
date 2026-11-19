# Gemini Bounded NHS Medicine-Source Connector Report

- **Workspace**: `/Users/aniket/Documents/Codex/2026-07-26/y/NEWPHARMAVAULT-v3`
- **Created Files**:
  1. `backend/services/approvedMedicineSearchService.js`
  2. `backend/tests/approvedMedicineSearch.test.js`
  3. `docs/chatbot-next/GEMINI_MEDICINE_CONNECTOR_REPORT.md`
- **Exported Interface**:
  - `createApprovedMedicineSearch({ fetcher, now, enabled, maxCacheEntries })` returning `async search(topicId, { attribute = 'GENERAL', signal } = {})` (with `search.search = search` attached for both direct function and method invocation), plus `searchApprovedMedicine`, `parseNhsMedicineHtml`, `isDosePassage`, `FIXED_NHS_SOURCES`, and `ALLOWED_ATTRIBUTES`.
  - Returns `{ status, candidates: [{ topicId, attribute, title, sourceUrl, excerpt, fetchedAt, publisher: "NHS", jurisdiction: "UK", reviewStatus: "NOT_CLINICALLY_APPROVED" }] }`.
- **Fixed Topic & Attribute URL Mapping**:
  - `paracetamol` (`GENERAL`, `USES`, `SIDE_EFFECTS`): `https://www.nhs.uk/medicines/paracetamol-for-adults/`
  - `metformin` (`GENERAL`, `USES`, `SIDE_EFFECTS`): `https://www.nhs.uk/medicines/metformin/`
  - `azithromycin` (`GENERAL`, `USES`): `https://www.nhs.uk/medicines/azithromycin/about-azithromycin/`; (`SIDE_EFFECTS`): `https://www.nhs.uk/medicines/azithromycin/side-effects-of-azithromycin/`
  - `cetirizine` (`GENERAL`, `USES`): `https://www.nhs.uk/medicines/cetirizine/about-cetirizine/`; (`SIDE_EFFECTS`): `https://www.nhs.uk/medicines/cetirizine/side-effects-of-cetirizine/`
- **Guardrails Implemented**:
  - Zero network egress when disabled or when `topicId`, `attribute`, or extra option keys (arbitrary URLs, raw questions, history, patient/case IDs) are outside the fixed allowlist.
  - Rejects HTTP redirects (`redirect: 'error'`, 3xx status, `redirected === true`, `Location` header, or mismatched `response.url`), enforces a `256 KiB` streaming byte ceiling and `6,000 ms` total work bound with zero retries, and propagates caller `AbortSignal` cancellation.
  - Extracts `<main>`/`<article>` content only (excluding `<nav>`, `<header>`, `<footer>`, `<script>`, `<style>`, `<aside>`, and trailing link sections), preserves complete sentences and negations, excludes numeric doses and dosing/administration sections, caps excerpts at `<= 1,400` characters (`<= 3` candidates), and caches results for `12 hours` (`<= 32` entries).
  - Candidates remain untrusted (`reviewStatus: "NOT_CLINICALLY_APPROVED"`) and are not registered in `isApprovedWebPassage` or wired into routes/generation.
- **Verification & Live Checks Performed**:
  - Unit/fixture suite: `node --test backend/tests/approvedMedicineSearch.test.js` — `8/8` tests passed (`0` failures).
  - Live public-page verification fetches performed (`4` total, within the 4-fetch cap): HTTP `200` structure and subpage link verification against `https://www.nhs.uk/medicines/paracetamol-for-adults/` (`43,766` B), `https://www.nhs.uk/medicines/metformin/` (`44,644` B), `https://www.nhs.uk/medicines/cetirizine/` (`34,408` B), and `https://www.nhs.uk/medicines/azithromycin/about-azithromycin/` (`25,488` B).
- **Limitations**:
  - Fixture tests validate connector invariants only and are not a live integration or clinical validation.
  - Standalone service only; routing, governance registration, and answer-generation integration remain owned by GPT.
- **Commit**: `none`
