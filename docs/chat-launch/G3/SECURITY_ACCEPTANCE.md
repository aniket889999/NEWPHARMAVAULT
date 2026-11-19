# Security Acceptance Checklist & Open Gates (G3)

**Security Sign-Off Status**: `PENDING` — Evidence-based inspection of session, authentication, and TOTP modules only. Independent penetration testing, MFA recovery, and production security approval are **NOT** complete.

## 1. Code-Evidenced Controls Inspected
### Browser Session & CSRF (`backend/config/browserSession.js`)
- [x] **Cookie Naming & Scope**: Uses `__Host-pv_session` in `production` (`secure: true`, `httpOnly: true`, `path: '/'`, `sameSite: 'strict'`); `sameSite: 'lax'` is restricted to explicit `NODE_ENV === 'development'`.
- [x] **Cookie Parsing Hardening**: `readBrowserCookie` rejects `Cookie` headers `> 8192` bytes, rejects duplicate/ambiguous session cookies (`values.length !== 1`), and enforces strict 3-segment JWT format `< 4096` chars.
- [x] **Browser Mutation CSRF Gate**: `verifyBrowserMutation` requires `X-PharmaVault-Client: web`, validates `Origin` against `getAllowedOrigins()`, and enforces `application/json` when `Content-Type` is present (`415` otherwise).

### Authentication & Session Revocation (`backend/middleware/authMiddleware.js`)
- [x] **Transport Isolation**: `protect` never falls back to a browser cookie when an `Authorization` header is supplied (`const cookie = authorization ? null : readBrowserCookie(req)`).
- [x] **Bounded JWT Claims & TTLs**: Enforces `HS256`, `WEB_TTL_SECONDS` (`900s` / 15m) for cookie sessions with required `aud === 'pharmavault-web'`, integer `ver`, and `jti`; enforces `NATIVE_TTL_SECONDS` (`3600s` / 60m) for bearer tokens.
- [x] **Server-Side Session Version Check**: Compares token `decoded.ver` against `req.user.sessionVersion`, clearing the cookie and returning `401` on mismatch; returns `503` on database lookup failure rather than misclassifying downstream errors.

### TOTP & At-Rest Secret Encryption (`backend/utils/totp.js`)
- [x] **RFC 6238 TOTP & Replay Guard**: 6-digit, 30-second step (`STEP_SECONDS = 30`), constant-time `crypto.timingSafeEqual` comparison, and `counter <= lastUsedCounter` replay rejection.
- [x] **AES-256-GCM Secret Encryption**: `encryptSecret` / `decryptSecret` use a 12-byte random IV, auth tag, `v1` version prefix, and SHA-256 key derived from `MFA_ENCRYPTION_KEY` (failing with `503` if `< 32` characters).

## 2. Unresolved Security Questions & Launch Blockers (`PENDING`)
1. **MFA Recovery & Lifecycle (`UNRESOLVED`)**: Backup/recovery codes, lost-device reset workflows, and mandatory MFA enrollment enforcement by role are not certified here.
2. **Key Management & Rotation (`UNRESOLVED`)**: Key-rotation procedures for `JWT_SECRET` and `MFA_ENCRYPTION_KEY` (including re-encryption of stored `v1` TOTP secrets) require operational sign-off.
3. **Distributed Replay & Rate-Limit Store (`UNRESOLVED`)**: Multi-instance deployment requires shared atomic storage for `lastUsedCounter` / `jti` revocation and rate limiting.
4. **Independent Penetration Test (`NOT_RUN`)**: External security assessment, dependency vulnerability sign-off, and same-origin HTTPS staging verification remain open release gates.
