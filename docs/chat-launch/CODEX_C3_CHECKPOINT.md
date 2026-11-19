# C3 — six coding work packages

18 November 2026. Local `version-3.0` continuation. Engineering progress, not a
public medical release. No paid generation, real patient data or deployment.

| Assigned area | Implemented now | Remaining acceptance / limit |
|---|---|---|
| Retrieval coverage | Bounded spelling suggestions ask the user to retype/confirm an exact generic name; no silent identity selection, source retrieval or web export for a typo | Not comprehensive medicine/entity recognition; no new clinical content or arbitrary brand mapping |
| Provider readiness | Bounded concurrent tool operations, per-minute operation budgets, failure circuits/cooldowns; local rejection reasons produce degraded readiness, not false provider success | Per-process limits, not global spend accounting; actual configured paid provider still needs separately authorized acceptance |
| Approved web fallback | Same-topic in-flight requests coalesce, 12h cache/trust expiry, fixed endpoint/terms, independent caller cancellation and 6s shared transport cap | Official text is not clinical approval; no live network/source accuracy claim from mock transport tests |
| Durable chatbot state | Public feedback receipts in MongoDB, hashes/reference metadata only; owner-bound lookup, logical 1h expiry, duplicate-feedback upsert, private cases excluded; failed writes do not mint receipts | Frozen case-answer receipts remain process-local and need a versioned migration; no durable patient memory added |
| Staging and observability | Super-admin-only aggregate operations API, no content/identity/source IDs; tool counters, latency buckets, JSON/SSE 30s deadlines; staging source/receipt flags explicit | Metrics/tool budgets are process-local; no alert destination, infrastructure, restore drill or public HTTPS deployment chosen |
| Release integration | Offline readiness inventory; strict mode refuses clinical launch approval; one real HTTP/DB release slice tests JSON/SSE, ownership, expiry and a separate-process feedback submission | Not browser-wide, clinical or full deployment acceptance; professional sign-offs stay pending |

## Actual verification, kept bounded

```sh
node --test tests/chat-launch/operations.test.cjs tests/chat-launch/operations.http.test.cjs
npm run build:frontend
node backend/scripts/checkChatLaunchReadiness.js
node backend/scripts/provisionChatReceiptIndexes.js
```

- **22/22** targeted operations/HTTP checks pass, including the parent HTTP entry.
- One additional targeted embedding-budget fallback check passes after ensuring
  external-tool saturation retains local keyword evidence instead of failing chat.
- Separate OS process successfully consumes a Mongo-persisted feedback receipt;
  another patient's request is denied and expired receipts fail before TTL cleanup.
- Strict TypeScript/production build pass; existing large-bundle/Browserslist
  warnings remain. Only changed JavaScript/schema paths are checked, not the old
  244-test selection. No broad-suite pass is claimed for this batch.
- Provider/web calls in tests use injected synthetic transports. Real HTTP/Mongo
  tests use the guard-approved disposable database and run-owned cleanup.
- Gemini's G3 report, line bounds, blank-reference JSON and 13-row CSV register
  were checked once. All approval fields remain blank/unapproved. This accepts
  the preparation artifacts, not professional clinical/privacy/security sign-off.

## Operations handoff

- New protected endpoint: `GET /api/v1/chat/operations`, super-admin only.
  `/api/v1/chat/status` also reports the receipt store; it does not probe a model.
- Production always persists public feedback receipts to MongoDB. In test mode,
  memory remains the default unless `CHAT_RECEIPT_STORE=mongo` is explicitly set.
  No raw prompt/answer/history is stored in the new receipt collection.
- Production disables automatic index creation. The receipt index script is a
  **dry-run by default**. Only after retention approval and private configuration,
  run with `CHAT_RECEIPT_INDEX_MIGRATION_APPROVED=true` and `--apply`. It creates
  named user/TTL indexes, never drops indexes or collections. It was not applied
  to an application/production database by this checkpoint.
- Staging stays at **one API replica** until frozen case-answer receipt durability
  is migrated. Shared Mongo locks/ingress counters are configuration, not proof
  that every stateful feature already supports scale-out.
- The offline launch inventory reports configuration checks and **always leaves
  publicMedicalLaunchApproved=false**. `--strict` exits 2 until an external release
  approval mechanism is designed; it must not be advertised as a passed gate.
- Aggregate counters can feed an operator's monitoring system. External alerts,
  restore tests, credential rollout, legal/clinical acceptance and provider budget
  authorization still require real choices and evidence.

Gemini owns only the six G3 review/preparation outputs listed in `G3_PROMPT.md`.
They cannot replace real source review, independent medical labels, privacy advice,
penetration testing or pilot sign-off. Existing research code/data remain frozen.
