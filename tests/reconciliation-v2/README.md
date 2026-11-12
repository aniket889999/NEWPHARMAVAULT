# Session 2 independent checks

GPT owns this directory. No held-out labels are loaded by the Session 2 tests here.

- `consumer.test.cjs` tests the new result schema, response-context/reference guards and static React rendering. It uses authored `synthetic-response-examples.cjs`, not matcher outputs. These tests are not evidence that the backend comparison algorithm works.
- `backend.acceptance.test.cjs` independently tests Gemini's actual services. The initial uncertain-name defects were corrected. All original 55 checks and one additional non-suppression/source-reference control pass: **56/56**. The actual-output UI bridge covers 24 development scenarios. See `docs/reconciliation-v2/SESSION_2_ACCEPTED_CONTRACT.md`; no held-out score is claimed.
- `tsconfig.json` applies the existing strict application compiler rules to the new isolated reconciliation files. It does not replace or weaken the app-wide check or remove the known wider type debt.

```sh
node --test tests/reconciliation-v2/consumer.test.cjs
./node_modules/.bin/tsc --project tests/reconciliation-v2/tsconfig.json --noEmit
# After Gemini's services are implemented:
node --test tests/reconciliation-v2/backend.acceptance.test.cjs
```

The result schema and ownership agreement are in `docs/reconciliation-v2/SESSION_2_CONTRACT.md`. Do not change an assertion or locked Foundation gold simply to accommodate a failed implementation. Propose and document any legitimate contract revision first.

Current component: `src/modules/verification/reconciliation/MedicineComparisonPanel.tsx`. It is standalone, read-only and not mounted in the live case page. A parent later supplies the already-authorised Foundation envelopes, verified comparison result, expected selected case ID, loading state and optional evidence-view callback. No request, provider call, browser storage or case mutation is performed by the component. Keep the synthetic-preview label on fixture-driven demonstrations.

Rendering checks are server-rendered markup tests, not full browser interaction/accessibility acceptance. End-to-end source opening, responsive visual checks, API integration and staff review wiring remain later work.
