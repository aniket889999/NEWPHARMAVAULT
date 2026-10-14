# Source checkpoint validation — 14 October 2026

This publication is a clean academic source snapshot, not a release or a claim that the full workflow passes.

| Check | Observed result |
|---|---|
| TypeScript | `npm run check:ts` — PASS |
| Backend syntax | `npm run check:backend:syntax` — PASS |
| Frontend production build | `npm run build:frontend` — PASS; existing large-bundle/outdated-browser-data warnings |
| OpenAPI | `npm run validate:contract` — PASS with 12 documentation warnings |
| JSON Schemas | `npm run validate:schemas` — 9 schemas valid |
| Focused backend checks | security + productionHardening + productionHardening.u2 + testDatabaseGuard — 26/26 PASS (including parent tests); no real database or external AI used |
| Frontend lint | ESLint `src` — FAIL: 200 errors, 8 warnings across 56 files; debt preserved, not suppressed |
| Initial full-source whitespace check | New root diff reports pre-existing trailing whitespace in legacy files. Source text was preserved rather than applying a risky cross-project formatting rewrite; this is not a formatting-clean codebase. |
| U4 | Production Swift parse/project lint and 9/9 pure policy groups pass; iOS build/device/camera/Keychain/upload unrun |
| U5 real local integration | Earlier run: 1 child pass, 2 OCR failures, 1 PDF-storage skip; see U4_U5_HANDOFF.md |
| Secret screening | No common Google/GitHub/AWS key, embedded JWT, private-key or database-credential matches in candidate source files; ignored environment/storage files excluded. Pattern screening is not an exhaustive security audit. |

Do not infer clinical safety, OCR accuracy, FHIR conformance or production readiness from these results. The full database-dependent suite was not rerun during publication; no development database cleanup or paid AI call was performed.

GitHub upload is blocked by the integration's HTTP 403 write restriction. The local checkpoint is not a remote deployment/publication.
