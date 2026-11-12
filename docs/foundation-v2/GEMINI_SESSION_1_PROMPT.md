# Copy into Gemini — Foundation V2, Session 1 only

Work in `/Users/aniket/Downloads/PBL 5 TH SEM`, not the older NEWPHARMAVAULT copy.

Read `docs/foundation-v2/SESSION_1_CONTRACT_BRIEF.md` fully. It is the bounded specification and file-ownership agreement. Inspect the dirty worktree and preserve every existing change, secret, local document and database.

Your task is Foundation only: add a standalone medicine-item JSON Schema and a pure adapter over server-loaded extracted fields. Support explicit trusted groups for up to three prescription/invoice items and a conservative legacy one-item adapter. Preserve field provenance, uncertainty and document coverage. Stable opaque server-derived IDs must survive group reordering and field-value correction. Ambiguous flat records, invalid group membership and over-limit groups must not become successful fabricated items. Claim forms must not gain invented medicine lines. No database/network/model calls in this adapter.

Create only these files:
- `backend/services/trustRag/medicineItemContract.js`
- `backend/tests/foundationMedicineItems.test.js`
- `contracts/schemas/medicine-item.schema.json`
- `backend/tests/fixtures/foundation-v2-development.json`
- `docs/foundation-v2/GEMINI_SESSION_1_REPORT.md`

GPT owns `tests/foundation-v2/**` and the other `docs/foundation-v2/**` files. Do not edit them. Use development fixtures only; do not inspect held-out labels for tuning. Do not touch models, controllers, routes, OpenAPI, frontend, packages or lockfiles. If another file is necessary, report the proposed delta rather than editing it.

This is not the matching engine, OCR rewrite, case API integration, RAG freshness feature or UI task. Those are later checkpoints. Do not mutate case state or trust client-supplied medicine grouping, identity, role or confidence. Do not expose storage identifiers, export private information, weaken permissions, install dependencies, change .env, commit, push or deploy. Normal permitted local read/write/test work may proceed; platform approval requirements still apply.

Test the exact negative cases in the brief. Run `node --test backend/tests/foundationMedicineItems.test.js`, `node --check backend/services/trustRag/medicineItemContract.js` and `npm run validate:schemas`. Use existing dependencies and database-free tests. Schema compilation alone is not proof output matches the schema: validate representative valid/invalid adapter outputs against the new schema in tests.

End with a handoff of at most 150 words: checkpoint PASS/PARTIAL/FAIL, exact changed files, exported signature and DTO/issue-code summary, exact verification counts, remaining gaps, next owner GPT, commit none. Save more detailed results to your report. Do not claim the full Foundation or API is complete until GPT's independent inspection.
