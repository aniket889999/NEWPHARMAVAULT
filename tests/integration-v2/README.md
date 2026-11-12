# Session 3 independent client acceptance

All test responses are authored synthetic development examples. The local loader substitutes an injected transport without reading browser tokens or contacting any backend. Static React rendering is not a browser interaction test. The request-generation guard test is a pure cancellation/race control, not evidence of distributed atomicity.

Run from the project root:

```sh
node --test tests/integration-v2/consumer.acceptance.test.cjs
node node_modules/typescript/bin/tsc --noEmit -p tests/integration-v2/tsconfig.json
node tests/integration-v2/typecheck-owned.cjs
node node_modules/eslint/bin/eslint.js src/modules/verification/integration --ext .ts,.tsx
```

The owned-file diagnostic check reports the full-app strict error count and fails on any error in the Session 3 integration or explicitly owned frontend files. Its success does **not** waive errors elsewhere or mean the full app builds. No permissive compiler switches were added.

For the accepted offline regression, add these test files to `node --test`:

```text
backend/tests/foundationMedicineItems.test.js
tests/foundation-v2/adapter.acceptance.test.cjs
tests/foundation-v2/manifest.test.cjs
backend/tests/medicineQuantity.test.js
backend/tests/medicineReconciliation.test.js
tests/reconciliation-v2/backend.acceptance.test.cjs
tests/reconciliation-v2/consumer.test.cjs
```

Real API/database and browser acceptance remains open until Gemini's Session 3 implementation is independently inspected. Follow `docs/integration-v2/SESSION_3_CONTRACT.md`; never clean or seed a development database to make an integration test pass. Held-out product evaluation is deferred to Session 5.
