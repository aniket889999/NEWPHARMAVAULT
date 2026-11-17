# V2-01: provider readiness and browser acceptance

This checkpoint separates server configuration from evidence of a recent public model response. It does not turn a provider badge into medical confidence or private-case verification.

## Readiness states

| State | Meaning |
|---|---|
| LOCAL_ONLY | Public generation or public export permission is intentionally disabled. |
| MISCONFIGURED | Public generation was requested but a usable credential/model configuration is missing. |
| CONFIGURED_UNVERIFIED | Configuration is eligible, but no recent successful public response is established. |
| VERIFIED_RECENTLY | The current server observed a public generated response pass its format/source-citation checks within five minutes. This is not semantic or clinical correctness. |
| DEGRADED | A recent public generation fell back after rate limiting, provider failure, timeout or answer-validation failure. |

`GET /api/v1/chat/status` remains authenticated, returns private/no-store metadata and makes no provider request. It never returns credential values, raw questions/replies, private case IDs, upstream bodies or internal configuration fingerprints. Legacy enabled fields describe configuration only. Embeddings are still reported by actual per-answer retrieval method, not proven merely by a setting.

Private scope always displays a local-only label. Private case requests, greetings, refusals and ordinary local answers cannot establish public-provider verification. Configuration changes invalidate stored observations; expiration/clock rollback cannot revive old proof after it is observed as expired. State is process-local; a restart returns to unverified. Durable history belongs to a later checkpoint.

The page refreshes status after request activity and periodically while visible. This is an observation, not continuous upstream monitoring. Existing per-answer fallback/source labels remain authoritative for that answer.

## Safe configuration check

```sh
npm run check:chat-provider
```

This makes zero network requests and does not load `.env` implicitly. An explicit `--env-file` imports only the provider-related keys needed by the diagnostic, without printing them or changing the file.

## Optional bounded live check

After explicit authorization for a public provider call:

```sh
RAG_CHAT_LLM_ENABLED=true RAG_CHAT_PUBLIC_EXPORT_ALLOWED=true npm run check:chat-provider -- --env-file /absolute/path/to/backend/.env --allow-provider-call
```

This is a separate child process. It permits at most one Google generation request, no retries, no embeddings and no private case data. Its only question/source are the packaged human-review workflow. Output is capped at 1024 tokens. Redirects are rejected; the response goes through the existing production paragraph/citation validator. Raw responses, credentials and exception text are not printed.

The resulting sanitized JSON is an adapter diagnostic, not proof of the full authenticated HTTP/browser workflow, clinical accuracy, embeddings or long-term availability. A successful CLI probe is not imported into a different running server's in-memory badge. The normal `dev:all` launcher remains local-only and does not silently enable public exports.

The retained live observation is in LIVE_PUBLIC_PROBE_2026-11-16.json. It is historical evidence from a single approved call; it must not be displayed as evergreen current health.

## Verification

```sh
npm run test:readiness
npm run test:readiness:http
npm run build:frontend
npm run validate:schemas
npm run validate:contract
```

The HTTP tests use mocked upstream responses and a guarded loopback disposable database with scoped cleanup. Mocked provider success is labelled as such. Actual live adapter evidence is separate.

The GPT readiness browser fixture runs on 5176 and pharmavault_smoke_test, with external generation disabled. It is only a small header/navigation/privacy smoke check:

```sh
node tests/v2-01/readiness-browser-harness.cjs --synthetic-readiness-ui
```

Type `cleanup` in its persistent terminal when done. Do not run broad legacy collection-cleanup suites while another owner's fixture is active. Gemini owns full browser/OCR acceptance in tests/v2-01/browser/ against pharmavault_integration_v2_test. No such acceptance is inferred from the readiness UI smoke test.

## Sources and boundaries

This change uses the existing Google REST adapter and configured model, without migrating models or SDKs. Primary provider references checked during implementation: [text generation](https://ai.google.dev/gemini-api/docs/text-generation) and [provider troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting). The diagnostic deliberately uses no automatic retry because this checkpoint's authorization was limited to one request.

Frozen research implementations/data/results remain unchanged. A completed readiness sub-checkpoint does not close the full V2-01 browser gate or any later legacy feature.
