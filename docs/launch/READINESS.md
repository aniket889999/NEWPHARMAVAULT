# Launch-readiness checkpoint P1

17 November 2026. **Engineering hardening implemented; public healthcare launch is NOT approved.** This report supersedes old 30-day browser-token/setup guidance. It does not accept unrelated mentor-demo work or certify clinical accuracy, privacy compliance or NHCX conformity.

## Completed in this checkpoint

- Browser sign-in uses a 15-minute HttpOnly cookie, with Secure and the `__Host-` prefix in production, SameSite=Strict, no Domain and Path=/. A browser must send `X-PharmaVault-Client: web`; the login response contains identity, not an access token. API/stream requests include cookies. Old local-storage credentials are removed, never read or migrated into a request. Reload validates the identity with the server, not cached roles.
- Cookie-authenticated mutations require the custom header and an exact allowed Origin; non-JSON payload types are denied. Native iOS retains its explicit bearer client without cookies. Browser and native token audiences cannot be interchanged. Invalid explicit authorization never falls back to a different credential.
- Newly issued native tokens last one hour; verification also imposes a maximum age on older long-lived tokens. HS256, token expiration and current database membership are checked. JWT signing keys still need rotation at rollout; shorter expiration is not a substitute for secret rotation.
- `POST /api/users/logout` atomically increments a durable per-account session version and clears the browser cookie, invalidating earlier web/native sessions on every API process. Logout is intentionally **all devices**, not one-device revocation. Password saves also increment the durable version; ordinary profile saves no longer accidentally rehash an unchanged password. The iOS sign-out action calls revocation before removing its Keychain token and discloses unconfirmed server logout.
- Public registration requires a password of at least 15 characters and at most 72 UTF-8 bytes. Login input is bounded; failures do not reveal an account's role. Staff provisioning stays administrator/organization-bound, rejects another organization's branch and does not mint an impersonation token.
- The backend image now includes the actual local RAG source registry and reranker, previously excluded by its data allow-list. Its build and runtime smoke import/run the chatbot, rather than only checking the old catalogue. Production local-only startup no longer requires an unused Gemini key. Demo-bootstrap endpoints are explicitly blocked in production.
- A same-origin web image and Nginx API/SSE proxy were added. The compose example binds only loopback ports, uses unprivileged/read-only processes, drops capabilities and keeps model/export flags off. Tested Node/Nginx base manifests are digest-pinned; this is not an OS-image vulnerability assessment. It still requires an authorized HTTPS gateway and private database/storage. There was no public deployment.
- The web server has a restrictive CSP, no URL access/error logging, no external font dependency and non-buffered chat streaming. API status/duration logging and health checks remain the metadata-only operational channel. These are initial controls, not a completed monitoring/incident platform.
- Compatible locked dependency updates plus reviewed Nodemailer 10 / React Router 7 upgrades remediate the observed production advisories. Current production audits (`--omit=dev`) are **zero findings for both root and backend**; this is a dated package-advisory result, not proof of application security or a review of build-only dependencies. Mail adapter compatibility is checked in memory, with TLS required and file/URL access disabled; no email was sent.
- CI now tests cookie authentication, CSRF, durable revocation and deployment configuration, and rejects published production advisories at moderate severity or above.

## Verified evidence

The reviewed candidate was exported from the Git index without unrelated mentor/Gemini working-tree edits. Installed dependencies were reused; private environment files were not copied.

| Check | Actual result |
|---|---|
| Session/security/contextual/relevance/curation/comparison/deployment/frozen-result checks | 151/151 pass |
| Independent protected case integration checks | 8/8 pass |
| Existing chat regression | 53/53 pass |
| Provider-readiness offline + protected HTTP checks | 33/33 + 7/7 pass |
| Project integration UI contracts | 11/11 pass |
| Existing U1 authorization/lifecycle suite | 6/6 pass |
| Strict TypeScript and production frontend build | Pass; large-bundle/outdated Browserslist warnings remain |
| Backend syntax | Pass |
| Owned authentication/UI lint | No errors; existing Fast Refresh export warning remains |
| OpenAPI / JSON schemas | Valid; 11 existing OpenAPI warnings; 14/14 schemas valid |
| Host production smoke | Pass: local RAG + real PDF rendering, no database/provider connection |
| Swift syntax / pure client policy smoke | Pass; 9/9 policy groups. No device/camera/Keychain runtime was exercised |
| Browser walkthrough | Synthetic login → protected RAG answer → reload/profile validation → portal navigation → server-confirmed logout; revoked session does not restore after reload |
| Production dependency audit | Root 0 / backend 0, at this checkpoint |
| Linux API image runtime | Pass on Node v22.23.5: real local RAG/PDF, HTTP boundaries, read-only non-root runtime, network disabled, no database/provider connection |
| Linux web image runtime | Pass: real SPA route and security headers, read-only non-root runtime, network disabled, no published ports. Full HTTPS/API integration not tested |

The focused counts include parent tests where Node reports them. They do not mean every product module was accepted, independent medical labels were supplied, or model superiority was demonstrated. Frozen historical research artifacts remain unchanged. No paid generation, comparator requests, real-patient upload, real mail or public deployment occurred.

Docker was initially unavailable, then became reachable after startup. The first web runtime check exposed Nginx's default FastCGI cache path attempting a write on the read-only filesystem. All Nginx temporary paths now use the bounded `/tmp` mount; the final image check passed. Failed attempts were not counted as passes. Only each test's own disposable images/containers were removed; no user volumes, normal databases or unrelated containers were deleted.

## Launch gates still OPEN

1. **Clinical knowledge and evaluation:** independently authored, pharmacist-reviewed labels and source/translation review; adequate coverage and licenses for the intended Indian medicine/product scope; controlled source freshness and withdrawal procedures. A small educational corpus, text matching and developer fixtures are not a clinical gold standard.
2. **Generative answer validation:** detailed answers remain extractive. Optional public generation has not passed independent semantic-support/safety grading. Earlier generation fallback failures remain disclosed; no GPT/Claude superiority is claimed. Enabling a key is not a quality validation.
3. **Identity assurance:** verified email/account recovery, staff MFA/SSO, credential-breach handling and audited administrator lifecycle are not implemented. Existing password authentication alone is not sufficient for a sensitive production staff service.
4. **Real-data privacy and rights:** approved data-processing/consent policy, applicable legal/regulatory assessment, retention and deletion/export workflows, encrypted managed storage/KMS, malware scanning and reviewed third-party processor contracts. Local private file permissions are not encryption or legal approval.
5. **Operational release:** image smokes now pass, but real HTTPS same-origin integration with the chosen host/domain, secret rotation, private MongoDB/TLS configuration, load/fault testing, encrypted backup and tested restoration, monitoring/alerts, incident response and independent security/OS-image assessment remain open. The supplied compose file is an example, not a deployed service.
6. **Shared/distributed state:** rate limits, case mutation locks and several answer/feedback receipts remain process-local. Run one instance for the current prototype. Shared limits, durable receipts and transaction/concurrency design are prerequisites for reliable scale-out.
7. **Full product/module acceptance:** shopping/dispensing, consultation, insurance/regulatory authenticity and several health widgets remain prototypes or separate uncommitted work. They cannot be advertised as real services. Mobile camera/Keychain behavior and accessibility/performance need device testing. The frontend bundle still needs a performance review.

These gates require qualified reviewers, real infrastructure choices and external evidence. Do not replace missing evidence with checkboxes, invented expert approvals, novelty percentages or an inflated launch score.

## Rollout and checks

1. Preserve the old environment; deploy to a separate synthetic-data staging environment first. Rotate signing/provider secrets privately. All users must sign in again at rollout. Do not copy the original development Git history/environment into a release image.
2. Serve the SPA and `/api` on the **same HTTPS origin** (or a deliberately reviewed same-site arrangement). Set `CORS_ALLOWED_ORIGINS` to the exact browser origin. Do not use wildcard CORS, cross-site cookies or the Vite development server for public hosting.
3. Keep a single API instance. The example exposes only loopback ports 8080/5001; an authorized TLS gateway forwards to the web service. `TRUST_PROXY=1` is appropriate only when that fixed proxy is the API's direct network peer. Do not publish the API port or enable public model/data export as a workaround.
4. Provision private MongoDB, encrypted persistent storage and local Tesseract data, with separate staging credentials. Production local-only mode can leave `GEMINI_API_KEY` blank when all provider flags are false. Do not enable other prototype outbound routes.
5. Run these checks; a blocked command is not a pass:

```sh
node --test backend/tests/browserSession.test.js tests/contextual-chat/browser-session-client.test.cjs tests/contextual-chat/deployment.test.cjs
node --test tests/contextual-chat/*.test.cjs tests/rag-v2/published-results.test.cjs
npm run test:chat
npm run test:readiness
npm run test:readiness:http
npm run build:frontend
npm run validate:contract
npm run validate:schemas
npm audit --omit=dev --audit-level=moderate
npm audit --prefix backend --omit=dev --audit-level=moderate
node deploy/smoke-container.mjs
node deploy/smoke-web-container.mjs
```

The image checks create/remove only their uniquely named disposable images/containers, publish no ports and do not connect to real databases or providers. The web check validates static SPA routing/headers; it does **not** validate the full HTTPS API path. Container startup is bounded, but image pulls/builds can take several minutes.

Security design references: [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP browser storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html), [Express production security](https://expressjs.com/en/advanced/best-practice-security/). These references guided engineering choices; they are not external certification of this project.
