# PharmaVault operations runbook (staging / production)

Nothing here is deployed yet. This is what an operator needs once a server exists.

## 1. Deploy checklist
1. Secrets from a secret manager (never in git): `JWT_SECRET`, `MFA_ENCRYPTION_KEY`, `DOCUMENT_ENCRYPTION_KEY`, `AUDIT_CHAIN_KEY`, `METRICS_TOKEN` (32+ chars each), backup passphrase.
2. Production flags: `NODE_ENV=production`, `MFA_REQUIRED_FOR_STAFF=true`, `REVIEW_CREDENTIAL_REQUIRED=true`, `CASE_LOCK_BACKEND=mongo`, `RATE_LIMIT_STORE=mongo`, `RETENTION_JOB_ENABLED=true`, `LOG_FORMAT=json`.
3. After every deploy: `npm --prefix backend run indexes:sync` (dry run) then `-- --apply`. Production has `autoIndex` off, so unique constraints (claims, audit chain, data requests) only exist after this step.
4. Smoke: `GET /api/health` 200, `GET /api/ready` 200, sign in as a synthetic staff account, open the review queue.

## 2. Monitoring and alerts
`GET /api/metrics` (Prometheus text) with `Authorization: Bearer $METRICS_TOKEN`. Returns 404 when the token is not set.

| Alert | Rule (suggested) |
| --- | --- |
| API down | `/api/ready` not 200 for 2 min |
| Error rate | `rate(pharmavault_http_requests_total{status="5xx"}[5m]) / rate(pharmavault_http_requests_total[5m]) > 2%` for 10 min |
| Latency | p95 of `pharmavault_http_request_duration_ms` > 2500 ms for 10 min |
| Review backlog | `pharmavault_review_queue_cases` above agreed level for 24 h |
| Claims backlog | `pharmavault_open_claims` growing for 72 h |
| Audit integrity | daily `npm --prefix backend run audit:verify` exits non-zero |
| Backups | no new `*.sha256` in the backup bucket for 26 h |

Logs: one JSON line per request (`reqId`, method, route pattern, status, ms, role). No bodies, query strings or identifiers. A 5xx response includes `requestId`; search logs for it.

## 3. Daily jobs (cron on one host)
```
15 1 * * *  cd /srv/pharmavault && MONGO_URI=... BACKUP_DIR=/backups BACKUP_PASSPHRASE_FILE=/run/secrets/backup_pass DOCUMENT_STORAGE_DIR=/data/documents ./ops/backup.sh
30 1 * * *  cd /srv/pharmavault && npm --prefix backend run audit:export -- --out /audit-exports
45 1 * * *  cd /srv/pharmavault && npm --prefix backend run audit:verify
```
Copy `/backups` and `/audit-exports` to off-site object storage with object lock / versioning.

## 4. Restore (practise monthly)
1. `TARGET_MONGO_URI=<scratch db> BACKUP_PASSPHRASE_FILE=... ./ops/restore.sh /backups/<stamp>` — checksum check only.
2. Add `CONFIRM_RESTORE=yes` and a documents directory to restore.
3. `indexes:sync -- --apply`, then `audit:verify` must report `ok: true`.
4. Record the time taken (RTO) and the backup age (RPO).

## 5. Incidents
- **Suspected account compromise:** Team & Access → *Sign out everywhere* / *Deactivate*; check audit events for that actor.
- **Audit chain broken:** do not "fix" events. Preserve the database, compare with the latest daily export (`fileSha256` in the manifest), escalate.
- **Lost `DOCUMENT_ENCRYPTION_KEY`:** encrypted documents cannot be recovered; restore the key from the secret-manager backup.
- **Personal-data breach:** follow the notification duties of the DPDP Act / Rules (legal decides timing and content).
