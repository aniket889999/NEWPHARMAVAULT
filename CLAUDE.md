# CLAUDE.md — PharmaVault TrustRAG (version-3.0)

Read this before changing anything. Details: `docs/version-3.0/README.md`.

## What this is
Final-year major project and research prototype. A claimant uploads a prescription, a pharmacy invoice and an optional claim form. Local OCR (Tesseract.js; PDFs rendered to images, max 3 pages) extracts fields. Users correct low-confidence fields. Medicines are resolved against an academic catalogue and reconciled item by item (strength, form, release type, quantity/pack). Risk signals flag mismatches and missing evidence. A case-bound TrustRAG Evidence Chat answers with citations (BM25 + local reranker + structured case retrieval; MedlinePlus approved-web fallback for public questions). A pharmacist reviews with Verify / Return for Correction / Escalate, bound to a `snapshotToken`.
version-3.0 adds the **claims module**: the claimant submits a VERIFIED case to an **insurer** (separate `payer` tenant) with explicit, revocable consent; the insurer reviews, raises queries and records a human decision.

## Stack
React 18 + TypeScript + Vite + Tailwind + Zustand · Node 22 + Express · MongoDB/Mongoose · cookie sessions (`__Host-pv_session`) + RBAC + tenant scoping + rate limiting · Gemini 2.5 Flash server-side, off by default · OpenAPI 3.1 + JSON Schemas in `contracts/` · `node:test` + Supertest · Playwright in `e2e/` · Docker.

## Ownership
- **Person A (Aniket):** chatbot/RAG (`backend/services/trustRag/*` chat parts, `backend/data`, `backend/benchmark`, `src/features/chat*`, Health Assistant), OCR/catalogue, legacy patient/pharmacy modules, `ios/`.
- **Person B:** claims (`backend/services/claims`, `controllers/claimsController.js`, `routes/claimsRoutes.js`, `src/pages/payer`, `src/pages/patient/PatientClaims.tsx`), platform (`backend/services/platform`, middleware, auth/MFA, Docker, CI, staging), admin UI.
- **Shared, change only with the other person's review:** `contracts/`, `docs/DOMAIN_MODEL.md`, `src/App.tsx`, `src/features/navigation/portalPolicy.ts`.

## Roles and portals
| Role | Home |
| --- | --- |
| patient (claimant) | `/patient/dashboard` |
| pharmacy | `/pharmacy/dashboard` |
| pharmacist, claims_reviewer, org_admin | `/review-queue` |
| payer_reviewer, payer_admin (Organization.kind = 'payer') | `/payer/dashboard` |
| super_admin | `/admin/saas` |
| research_evaluator | `/research/dashboard` |

## Commands (all must pass before a PR)
```bash
npm run check:ts
npm run build:frontend
npm run check:backend:syntax
npm run validate:contract && npm run validate:schemas
node --test backend/tests/claimsPlatformPure.test.js backend/tests/platformLocksPure.test.js backend/tests/claimsContractParity.test.js backend/tests/storageEncryptionRetentionPure.test.js backend/tests/reviewPolicyPure.test.js backend/tests/accountSecurityPure.test.js backend/tests/auditChainPure.test.js backend/tests/opsPure.test.js backend/tests/textMessagingPure.test.js
NODE_ENV=test node --test --test-concurrency=1 backend/tests/claimsWorkflowIntegration.test.js backend/tests/reviewWorkflowIntegration.test.js backend/tests/accountSecurityIntegration.test.js backend/tests/auditChainIntegration.test.js backend/tests/dataRightsIntegration.test.js   # MongoDB
npm --prefix backend test            # needs MongoDB; tests only use *_test databases (testDatabaseGuard)
npm run test:integration-ui
```
Local run: `npm --prefix backend run mongo:local` (separate terminal) → `npm --prefix backend run seed:demo` → `npm run dev:all`. Demo password `password123` (synthetic accounts only).

## Non-negotiable rules
- The UI design of version-2.0 is final. Keep its layout and styling; add features in the same style.
- AI never diagnoses, prescribes, substitutes medicine, or approves/rejects a claim. Humans decide; every decision needs a note and is audited.
- Risk signals are review prompts, not fraud proof.
- Insurers access a case only through an active `CaseShareGrant`. Never add a payer shortcut into `/cases/*`.
- Never weaken tenant scoping, role checks, `snapshotToken` checks, consent checks or CSRF/session checks to make a test pass.
- Private case data never goes to web search or an external LLM.
- Never commit `.env`, keys, real patient data, `node_modules`, `dist`, bundles or uploads. Synthetic data only.
- Contracts first: change `contracts/` together with any API change (`claimsContractParity.test.js` enforces this for claims).
- No overclaiming in UI or docs: "draft FHIR R4, NHCX-aligned", "simulated settlement", no accuracy number without a measured denominator.
- Security-relevant env: `JWT_SECRET`, `MFA_ENCRYPTION_KEY`, `DOCUMENT_ENCRYPTION_KEY` (32+ chars each). Never print their values.

## Work style
One task per branch (`feat/B-<topic>`), small commits, report each checkpoint in under 150 words: changed files, exact test counts, contract changes, blockers.
