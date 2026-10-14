# Production deployment and privacy hardening

PharmaVault TrustRAG is an academic verification MVP. The hardening in this repository makes local and single-node demonstrations safer; it does **not** certify the system for clinical use, NHCX conformance, claims adjudication, HIPAA compliance, or handling real patient data.

## What is implemented

- The API disables the Express fingerprint header and applies anti-framing, no-sniff, no-referrer, no-store, permissions-policy and production HSTS headers.
- Browser CORS is an explicit allow-list. In production it must be HTTPS; native iOS requests without an `Origin` header remain supported.
- Request logs contain only timestamp, HTTP method, response status and duration—never document URLs, filenames, OCR text, request bodies or authorization data.
- Production startup rejects a short JWT secret, missing HTTPS CORS allow-list, or a missing/non-absolute document storage path.
- HTTP body/query objects reject MongoDB selector and prototype keys. Trusted server queries retain their operators; automatic index creation is disabled in production.
- Errors do not disclose routes/identifiers for missing resources, development stacks are disabled in production, and unexpected server errors are generic.
- The SwiftUI app accepts only HTTPS API endpoints, keeps the JWT in Keychain, revalidates it at launch, keeps camera scans in memory until upload, and contains no Gemini key or backend secret.
- The deployment image uses Node 22 on Debian and includes the required academic medicine catalogue. Environment files, uploads and OCR language data are excluded from the image.
- Normal server startup waits for MongoDB before listening. `/api/health` is liveness; `/api/ready` reports database readiness without host/credential details. The container health check uses readiness.
- Legacy external-AI routes (chat/vision, prescription analysis, agents, GraphRAG, language and related prototype workflows) return 404 in production. Local development retains them. TrustRAG remains available under `/api/v1`.
- Optional TrustRAG Gemini summaries require both `TRUSTRAG_LLM_ENABLED=true` and `TRUSTRAG_LLM_EXPORT_ALLOWED=true`. They receive only allow-listed check/signal enums and temporary evidence aliases, not raw values, document text, filenames, persistent IDs or free-form messages. Both flags remain false in the compose example.

## Shared document storage configuration

`backend/config/documentStorage.js` exports `getDocumentStorageRoot()` and `ensureDocumentStorageRoot(root)`. Original uploads use this configuration, owner-only file permissions and collision-resistant names. Configuration/storage errors do not expose paths.

The PDF-preview service is Gemini-owned. In U3, replace its hardcoded storage root with `getDocumentStorageRoot()` from this shared module. Until that consumer is integrated, original uploads and PDF previews are not yet guaranteed to share the persistent production volume.

## Required production controls before any real deployment

1. Rotate every previously used Gemini and JWT secret. Set a new random `JWT_SECRET` of at least 32 characters in a managed secret store.
2. Put the API behind a TLS gateway. Set `TRUST_PROXY=1` only when that gateway is the direct trusted proxy. Do not expose port 5001 publicly.
3. Set `CORS_ALLOWED_ORIGINS` to the exact HTTPS web origins. Do not use wildcard origins.
4. Use a private MongoDB deployment with TLS, access controls, encrypted backups, a retention policy and separate credentials per environment.
5. Set `DOCUMENT_STORAGE_ROOT` to a persistent, access-controlled encrypted volume for a single-node demo. For genuine sensitive documents, replace local storage with managed encrypted object storage, key management, deletion workflows and access audit controls. This repository has not implemented that migration yet.
6. Provide local Tesseract language data via `TRUSTRAG_TESSDATA_PATH`; do not enable runtime downloads or send raw OCR/document data to an external LLM.
7. Run one API instance only. The current rate limiter is in-memory. A horizontally scaled service requires a shared Redis-backed limiter before scale-out.
8. Use synthetic or formally de-identified data for all academic demonstrations. Obtain institutional approval and a data-processing policy before collecting any personal health information.

## Deploying the single-node academic demo

1. Copy `backend/.env.example` to an ignored `backend/.env.production` and fill it from a secret manager—not from Git or a chat.
2. Set `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `CORS_ALLOWED_ORIGINS`, `DOCUMENT_STORAGE_ROOT`, and `TRUSTRAG_TESSDATA_PATH`.
3. Provision the `backend/tessdata` folder locally and mount it read-only as shown in `docker-compose.production.example.yml`.
4. Start the API from the repository root with the compose example. Bind it to loopback only, then configure a TLS reverse proxy or managed API gateway in front of it.
5. Verify `/api/health`, authenticated document upload, cross-tenant denial, audit records, secure document-content headers and the iPhone app over HTTPS.

## U2 verification

Run focused checks from the project root:

```sh
node --test backend/tests/productionHardening.test.js backend/tests/productionHardening.u2.test.js
npm run check:backend:syntax
node deploy/smoke-container.mjs
```

The container smoke runner builds a uniquely named local image and runs it with networking disabled, a read-only root filesystem and temporary storage. It checks catalogue availability, API headers/authentication/input rejection and the real PDF rendering dependency. It uses only synthetic configuration, makes no MongoDB/LLM call, and measures no OCR accuracy. It removes only its own smoke image/container; it does not start the production compose stack.

Docker Desktop must be running for the container check. A stopped engine leaves that gate pending; passing host checks does not establish container compatibility. U2 remains partial until this check passes and the U3 PDF-preview storage consumer uses the shared configuration.

## Operations and incident response

- Do not log, copy into tickets, or paste prescriptions, invoices, claims, JWTs, base64 files, OCR text or database URIs.
- Restrict production log access and retain only operational metadata for the shortest approved duration.
- Back up database and document storage separately, encrypt both, and test restoration with synthetic data.
- On suspected credential exposure: revoke the key/token signing secret, rotate database credentials, invalidate affected sessions, preserve a minimal incident record and inform the faculty/authorized owner.
- Before any public release, complete a threat model, dependency review, mobile privacy review, data-retention/deletion design and an independent security assessment.
