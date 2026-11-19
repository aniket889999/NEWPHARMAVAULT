## What and why

<!-- One or two sentences. Link the issue / task. -->

## Checks (CLAUDE.md non-negotiables)

- [ ] Contracts first: `contracts/` updated with any API change (`claimsContractParity` passes)
- [ ] No weaker tenant scoping, role, `snapshotToken`, consent or CSRF/session check
- [ ] Insurers reach case data only through an active `CaseShareGrant`
- [ ] AI does not diagnose, prescribe, substitute medicine or approve/reject a claim
- [ ] No private case data to web search or an external LLM
- [ ] No `.env`, keys, real patient data, `node_modules`, `dist` or uploads; synthetic data only
- [ ] No overclaiming in UI or docs (no accuracy number without a measured denominator)
- [ ] Shared files (`contracts/`, `docs/DOMAIN_MODEL.md`, `src/App.tsx`, `portalPolicy.ts`) reviewed by the other owner

## Tests

<!-- Exact counts from CI, e.g. "E2E 35 passed, claims integration 35/35". -->
