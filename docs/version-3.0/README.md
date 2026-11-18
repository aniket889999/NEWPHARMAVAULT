# PharmaVault version-3.0

`version-3.0` = **version-2.0 UI** (final design) + **feature/v2-01-readiness backend** (TrustRAG chat, cookie sessions, security) + **Teammate B work** (claims module, insurer portal, notifications, MFA, multi-instance safety, FHIR validation, E2E, staging).

## 1. Run it locally

```bash
# 1. Install (needs internet)
npm install
npm --prefix backend install

# 2. Environment
cp backend/.env.example backend/.env
#   set at least: MONGO_URI, JWT_SECRET (32+ chars), GEMINI_API_KEY (any value for local),
#   MFA_ENCRYPTION_KEY (32+ random chars, needed only for MFA)

# 3. MongoDB: use your own, or a throwaway in-memory one in a second terminal
npm --prefix backend run mongo:local

# 4. Synthetic demo data (refuses to run when NODE_ENV=production)
npm --prefix backend run seed:demo

# 5. Start API + web together
npm run dev:all        # http://127.0.0.1:5173
```

### Demo accounts (synthetic, password `password123`)

| Portal | Login page tab | Email |
| --- | --- | --- |
| Patient / claimant | Patient | patient@test.com |
| Pharmacy hub | Pharmacy | pharmacy@test.com |
| Claims reviewer | Reviewer → Staff Role "Claims reviewer" | reviewer@test.com |
| Pharmacist | Reviewer → "Pharmacist" | pharmacist@test.com |
| Org admin | Reviewer → "Organization administrator" | orgadmin@test.com |
| Insurer reviewer | **Insurer Portal** card (or Reviewer → "Insurer claims reviewer") | insurer@test.com |
| Insurer admin | Reviewer → "Insurer administrator" | insureradmin@test.com |

The 1-click demo button is shown only in development builds.

## 2. Verify before you push

```bash
npm run check:ts
npm run build:frontend
npm run check:backend:syntax
node --test backend/tests/claimsPlatformPure.test.js backend/tests/platformLocksPure.test.js
NODE_ENV=test node --test backend/tests/claimsWorkflowIntegration.test.js   # needs MongoDB on 127.0.0.1:27017
npm --prefix backend test                                                  # full backend suite
```

E2E (Playwright):

```bash
cd e2e && npm install && npx playwright install chromium
# backend must run with E2E_SETUP_ENABLED=true and E2E_SETUP_KEY=<12+ chars> (never in production)
E2E_SETUP_KEY=local-e2e-only-key npx playwright test
```

CI: `.github/workflows/claims-platform.yml` runs the claims tests and the strict frontend build on every push. `e2e.yml` is manual (Actions → Run workflow).

## 3. How the merge was resolved

| Conflict | Kept from version-2.0 (UI) | Ported from v2-01 (logic) |
| --- | --- | --- |
| AuthPage | Full v2.0 card, tabs, 1-click demo | Cookie session login, `portalHome` routing, patient-only sign-up, staff-role picker, OTP step |
| RoleSelection | 3 v2.0 cards | + Insurer Portal card (same style) |
| Patient / Pharmacy layouts | v2.0 sidebar + header | + Evidence Chat (pharmacy), Insurance Claims, Security & MFA, notification bell |
| Patient dashboard | v2.0 | — |
| Pharmacy dashboard, AuthenticityChecker | v2.0 | `apiClient` (cookie) instead of `localStorage` token; real `/blockchain/verify` endpoint; no fake "verified" on errors |
| OrganizationSettings | v2.0 | No fake "branch created" on error; real brand names replaced with synthetic ones |
| backend/package-lock.json | `mongodb-memory-server` | `nodemailer` 10; nested versions fixed so `npm ci` stays consistent |

## 4. Teammate B work added

| Area | What exists now | Where |
| --- | --- | --- |
| Claims module | Claim lifecycle SUBMITTED → UNDER_PAYER_REVIEW → QUERY_RAISED → APPROVED / PARTIALLY_APPROVED / REJECTED → SETTLED (demo), WITHDRAWN. Atomic transitions, audit events, human note + reason codes required | `backend/services/claims/*`, `controllers/claimsController.js`, `routes/claimsRoutes.js`, `models/claimModel.js` |
| Separate insurer tenant + consent | `Organization.kind = 'payer'`; roles `payer_reviewer`, `payer_admin`; `CaseShareGrant` (scope, 90-day expiry, revocable). Insurer sees a case only through an active grant; withdraw revokes it | `models/caseShareGrantModel.js`, `models/organizationModel.js` |
| Claimant portal | `/patient/claims`: submit with consent, answer queries, timeline, withdraw | `src/pages/patient/PatientClaims.tsx` |
| Insurer portal | `/payer/dashboard`, `/payer/claims` queue (filters, 72 h SLA marker), claim workspace (documents, checks, signals, fields, pharmacist decisions, queries, decision panel, FHIR download) | `src/layouts/PayerLayout.tsx`, `src/pages/payer/*` |
| Pharmacy side | `/pharmacy/claims` read-only status of claims on own cases | `src/pages/pharmacy/PharmacyClaims.tsx` |
| Notifications | In-app bell on every portal; optional email with 3 retries (`NOTIFY_EMAIL_ENABLED=true` + SMTP) | `models/notificationModel.js`, `services/claims/notificationService.js`, `NotificationBell.tsx` |
| MFA | TOTP (RFC 6238, node:crypto only), secrets AES-256-GCM encrypted, replay-protected; enable/disable from Security & MFA page; login asks for code | `utils/totp.js`, `userController.js`, `src/pages/account/SecuritySettings.tsx` |
| Multi-instance safety | `CASE_LOCK_BACKEND=mongo` MongoDB lease locks for case mutations; `RATE_LIMIT_STORE=mongo` shared rate-limit counters | `services/platform/*` |
| FHIR validation | Bundle builder (Task, Patient, Organization, DocumentReference, Claim, Coverage, ClaimResponse) + structural R4 validator; case export fixed (Task status codes were invalid) | `services/fhir/*` |
| E2E | Playwright golden flow claimant ↔ insurer + isolation check | `e2e/` |
| Staging | 2 API replicas, MongoDB replica set, Caddy HTTPS | `docker-compose.staging.yml` |
| Contracts | Claims, insurer, notification and MFA endpoints in OpenAPI; `claim`, `case-share-grant`, `notification` schemas; route ↔ contract parity test | `contracts/`, `backend/tests/claimsContractParity.test.js` |
| Encryption at rest | Documents and page previews AES-256-GCM encrypted when `DOCUMENT_ENCRYPTION_KEY` is set; old plaintext files stay readable; `npm --prefix backend run documents:encrypt -- --apply` migrates them | `services/platform/documentCrypto.js`, `scripts/encryptStoredDocuments.js` |
| Retention | Removes document content + derived evidence of finished cases with no open/recent claims after `RETENTION_CASE_DAYS` (default 365); deletes notifications after 180 days; keeps audit, reviews and claims; dry run by default | `services/platform/retentionService.js`, `npm --prefix backend run retention:run` |
| Admin UI | Team & Access: list staff (with MFA status), add staff with roles limited to the organization type. `/team` (pharmacy org admin), `/payer/team` (insurer admin) | `src/pages/account/TeamAccess.tsx` |
| Reviewer polish | Review queue filters, search, oldest-first, waiting time with 24 h target; staff Claims Status page `/staff/claims`; bell + Security in the staff nav | `ReviewQueuePage.tsx`, `VerificationNav.tsx` |
| AI context | Repo rules for any coding assistant | `CLAUDE.md` |

## 5. What is NOT set yet (honest list)

**Not verified in the merge session** (no internet there, so no `npm install`): strict `tsc`, `vite build`, the MongoDB integration test, Playwright and Docker were **not run**. Run section 2 first; CI will also run them on push. What *was* checked: TS/TSX syntax of all 123 frontend files, every relative import resolves, `node --check` on all backend files, 20/20 database-free tests pass, both lockfiles resolve consistently.

**Small UI additions to version-2.0** (needed for new features, same styling): staff-role dropdown on the Reviewer login tab, 4th "Insurer Portal" card, OTP field, new sidebar items, notification bell, "NABH Certified (demo value)" label.

**Legacy version-2.0 behaviour left as is** (UI kept as requested, but these show sample data, not real data):
- `PatientCasesPage` shows sample cases and creates a fake local case when the API fails. Fake cases cannot be claimed.
- Patient dashboard numbers are hard-coded (Dolo 650, "100% batch integrity", "Dr. Sharma tomorrow").
- Pharmacy dashboard falls back to demo metrics (now labelled "Demo values shown").
- Blockchain verify backend still says "100% verified… safe to use" — overclaims; should be softened.
- Teleconsult, nearby pharmacies, payments: simulated. `MedicineAvailability.tsx` / `enhancedMedicines.ts` still contain real brand names.

**Claims / platform limits:**
- Only pharmacist-**VERIFIED** cases can be claimed (escalated cases cannot).
- Redis is **not** used; MongoDB provides the same lock/limit guarantees without new infrastructure. A Redis adapter can implement the same interface later.
- MFA is enforced for staff/insurer roles only when `MFA_REQUIRED_FOR_STAFF=true` (off by default for the local demo). 8 one-time recovery codes are issued on enable. Setup uses a key + `otpauth://` link (no QR image library installed).
- Document encryption is off until `DOCUMENT_ENCRYPTION_KEY` is set; losing that key makes encrypted documents unreadable — store it like a database password and back it up.
- Retention removes content only; there is no patient-initiated "delete my data" request flow yet, and purged cases do not show a special message in the case page.
- Reviewer queue SLA target (24 h) and insurer SLA (72 h) are fixed constants, not configurable.
- No OCR job queue (BullMQ); OCR still runs in the API process.
- Claim submission uses a MongoDB transaction only on a replica set; on a standalone dev MongoDB it falls back to two sequential writes.
- FHIR check is structural only — not the official HL7 validator and not NHCX sandbox certification.
- Settlement is simulated; no payment provider.
- Insurer document preview shows the original file; OCR highlight boxes are only in the pharmacist case view.
- Staging compose file is ready but nothing is deployed (needs a VM + domain).

## 6. Reviewer launch hardening (branch `feature/B-reviewer-launch`)

| Blocker | What exists now | Switch / where |
| --- | --- | --- |
| Multi-instance case lock | Case mutations use a MongoDB lease when `CASE_LOCK_BACKEND=mongo` | `services/platform/caseGuard.js` |
| Four-eyes | Creator or document uploader of a case cannot VERIFY it (can still escalate / return) | `services/review/reviewPolicy.js` |
| Assignment lease | Take / extend / release a case (30 min default, `REVIEW_ASSIGNMENT_MINUTES`); admins reassign; others cannot decide while it is held | `/api/v1/review/cases/:id/assignment` |
| Reopen | Org admin reopens a VERIFIED/REJECTED case with a reason (blocked while a claim is open) | `/api/v1/review/cases/:id/reopen` |
| Paged queues | Review queue and insurer queue page on the server (`X-Total-Count`) | `ReviewQueuePage.tsx`, `PayerClaimsQueue.tsx` |
| Claim appeal | Claimant can appeal a rejected / partly approved decision once; a different insurer reviewer must decide | `POST /api/v1/claims/:id/appeal` |
| Enforced MFA + recovery codes | `MFA_REQUIRED_FOR_STAFF=true` → staff without MFA only reach profile / MFA setup (403 `MFA_SETUP_REQUIRED`, UI redirects to Security). 8 hashed one-time recovery codes | `services/platform/accountSecurity.js` |
| Login lockout | `LOGIN_MAX_FAILURES` (5) failures lock for `LOGIN_LOCK_MINUTES` (15); same generic error; admin unlock | `userController.authUser` |
| Staff administration | Deactivate / reactivate, change role, sign out everywhere, unlock — same-organization only, never self, audited; role change and deactivation revoke sessions | Team & Access, `/api/users/staff/:id/*` |
| Reviewer credential | `REVIEW_CREDENTIAL_REQUIRED=true` → VERIFY needs a registration number confirmed by an org admin | Team & Access → Registration |

The admin confirms the registration manually; there is no live lookup against a pharmacy council register.
