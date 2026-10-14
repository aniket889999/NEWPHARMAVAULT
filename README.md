# PharmaVault TrustRAG

## Project Description
An academic final-year engineering prototype for evidence-grounded prescription, pharmacy-invoice and health-claim verification with human review.

Core workflow: **Create case → secure upload → local OCR → human correction → medicine identity resolution → controlled evidence retrieval → consistency/risk checks → authorized human review → explainable result → draft structured export.**

Older inventory, shopping, chatbot and research-dashboard modules remain preserved but are outside the current TrustRAG MVP. They are not evidence that the core workflow has passed acceptance.

**DISCLAIMER**: This system is a research prototype and is **NOT** intended for clinical decision-making, real patient data handling, or medical use.

## Current Architecture
- **Frontend**: React-based SPA built with Vite, TypeScript, and TailwindCSS. Uses Zustand for state management and React Router for navigation.
- **Backend**: Node.js and Express.js server providing RESTful APIs. It integrates with MongoDB (via Mongoose) and includes various services like prescription parsing and language detection.
- **Document intelligence**: Local Tesseract English OCR; local PDF rendering. The current domain resolves one medicine per case against a small academic catalogue, not a national medicine registry.
- **Evidence and explanations**: Deterministic checks and controlled local sources. Optional server-side Gemini summaries require two explicit opt-in flags and are disabled by default. No browser/mobile Gemini key. This is not unrestricted live web retrieval.
- **iPhone App**: A native SwiftUI + VisionKit scanner lives in [`ios/PharmaVault`](ios/PharmaVault). It uses HTTPS-only configuration, Keychain token storage and in-memory document scans.

## Prerequisites
- Node.js 22.15+ (the installed PDF rendering dependencies are not compatible with the old Node 18/20 setup)
- MongoDB instance (local or Atlas)
- Git

## Frontend Setup
1. Navigate to the project root: `cd /path/to/pharmavault`
2. Install locked dependencies: `npm ci`
3. Copy `.env.example` to a local `.env` and verify `VITE_API_URL` points to the backend.
4. Start the development server: `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`

## Backend Setup
1. Navigate to the backend directory: `cd backend`
2. Install locked dependencies: `npm ci`.
3. Copy `.env.example` to a local `.env`; configure MongoDB and fresh server-only secrets. Never use previously exposed keys. Startup currently requires `GEMINI_API_KEY` even when TrustRAG's explanation flags are false; keep legacy AI screens out of an offline demo.
4. Ensure MongoDB is running. Provision English `eng.traineddata` locally in `backend/tessdata/` or the configured local OCR folder; language data is not committed and must not be fetched at request time.
5. Explicitly seed the academic catalogue, if needed, with `npm run seed:catalogue` from the root. This writes reference records; do not use the destructive legacy `data:import` command for a mentor demo.
6. Start with `npm start` (default example port 5001). Verify `/api/health` and `/api/ready` before opening `http://localhost:5173/cases`.

Use only synthetic/de-identified demonstration documents. Staff/reviewer accounts require authorized provisioning and organization membership; public signup cannot grant staff privileges.

## Required Environment Variables
Create a `.env` file in the root directory for frontend variables and `backend/.env` for backend variables containing:

**Frontend**
- `VITE_API_URL`

**Backend**
- `MONGO_URI`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `PORT` (Optional)
- `FRONTEND_URL` (Optional)

See `.env.example` and `backend/.env.example` for reference. **Never commit actual `.env` files.**

## Deployment and privacy boundary

Production-oriented safeguards and a single-node academic deployment example are documented in [`docs/PRODUCTION_PRIVACY.md`](docs/PRODUCTION_PRIVACY.md). This project remains an academic MVP: it is not approved for clinical use, real patient data, claim adjudication, or live NHCX/CDSCO integration.

## Development Commands
From the project root:
- `npm run dev` - Start frontend Vite server
- `npm run build:frontend` - Build frontend for production
- `npm run lint:frontend` - Run ESLint on frontend
- `npm run check:ts` - Run TypeScript type checking
- `npm run check:backend:syntax` - Check backend JS syntax

## Current Prototype Limitations
- **Real acceptance is not green:** U5's real local image workflows currently return zero extracted fields because the provider has not requested Tesseract 7 structured blocks. Gemini's U3 assignment covers this regression. Do not interpret passing mocked tests as OCR accuracy.
- PDF safety/coverage/cache controls and shared preview storage integration remain under U3; the current processing limit is three pages. Omitted pages must not be treated as analyzed.
- Native SwiftUI source and pure policy checks exist; full Xcode build, camera/Keychain and physical-device upload tests are pending.
- Container runtime validation, browser golden workflow, multiple-medicine reconciliation and formal FHIR validation are pending. Draft FHIR export is **not** certified NHCX integration.
- Legacy evaluation JSON is an illustrative fixture, not measured TrustRAG benchmark results.
- Existing keys (JWT, Gemini) must be rotated immediately if deploying, because they may have appeared in earlier Git history.
- AI requests are now securely managed server-side, with rate limiting and authentication required.
- No identifiable patient data should be used during development.
- Many features rely on mock data or lack robust error handling.
- The system is not production-ready or HIPAA-compliant.

See [upgrade checkpoints](docs/UPGRADE_CHECKPOINTS.md), [U4/U5 evidence](docs/U4_U5_HANDOFF.md), [Gemini U3 instructions](docs/U3_GEMINI_PROMPT.md) and [repository publication notes](docs/REPOSITORY_PUBLICATION.md).
