# U2 handoff — 13 October 2026

Owner: Codex. Status: PARTIAL; implementation checks pass, container/preview integration gates remain open.

## Changes

- Node 22 Debian deployment image; academic catalogue included; secrets/uploads/traineddata excluded.
- Request-side selector rejection preserves trusted review-queue operators without global sanitizeFilter wrapping them.
- Production errors/logs avoid raw values. Legacy external-AI routes are disabled in production; TrustRAG `/api/v1` remains mounted.
- Optional Gemini summary exports only enums and temporary evidence aliases. Both opt-in environment flags default false.
- Shared storage configuration, owner-only file permissions and unique non-overwriting upload names.
- Focused HTTP/privacy/storage/query checks and repeatable synthetic container smoke tooling.
- Server startup waits for MongoDB; a separate readiness endpoint supplies container health status.

## Verified on the host

- `node --test backend/tests/productionHardening.test.js backend/tests/productionHardening.u2.test.js`: 12/12 passed. Includes actual local HTTP requests; Gemini SDK is mocked for outbound-prompt checks. No database connection or external LLM request occurs.
- `npm run check:backend:syntax`, `node --check deploy/smoke-container.mjs`, `git diff --check`: passed.
- Synthetic `backend/scripts/productionSmoke.js` run: passed on Node v22.15.0 with 17 catalogue records, real PDF rendering, HTTP authentication and input rejection. This is a host smoke test, not a Linux container or OCR-accuracy result.
- `docker compose --env-file /dev/null -f docker-compose.production.example.yml config --no-env-resolution --no-interpolate --quiet`: passed without resolving or displaying local secrets.
- `node deploy/smoke-container.mjs`: exit 2 (Docker engine unavailable). `docker desktop start` reported denied access to its log directory; container validation has not run.

## Interface for Gemini U3

In `backend/services/trustRag/pdfRenderingService.js`:

```js
const { getDocumentStorageRoot } = require('../../config/documentStorage');
// In constructor, replacing the hardcoded path:
this.storageRoot = getDocumentStorageRoot();
```

Keep paths server-only. Ensure preview writes use private permissions, controlled storage errors and U3's cache/resource limits. The helper rejects a missing production root or a relative configured root. Codex did not edit this Gemini-owned file.

New checks/signals intended for external summaries must be added to the fixed allow-list in `backend/config/llmExportPolicy.js` by Codex. Do not forward their free-text messages as a shortcut.

## Pending gates

1. Start Docker Desktop and run `node deploy/smoke-container.mjs`; currently the Docker engine socket is absent.
2. Gemini wires PDF-preview storage to the shared helper and verifies persistence/permissions in U3.

No Git commit or production deployment was created.
