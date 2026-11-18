# Production settings that implement the privacy notice

| Setting | Production value | Effect |
| --- | --- | --- |
| `DOCUMENT_ENCRYPTION_KEY` | 32+ random chars from a secret manager; backed up separately | Documents and previews encrypted at rest. Losing it makes documents unreadable. Run `npm --prefix backend run documents:encrypt -- --apply` once after setting it. |
| `RETENTION_JOB_ENABLED` | `true` | Daily retention pass (one instance, MongoDB lease) |
| `RETENTION_CASE_DAYS` | value from the privacy notice (default 365, min 30) | Document content of finished cases without open claims is removed |
| `RETENTION_NOTIFICATION_DAYS` | 180 | Old notifications deleted |
| `MFA_REQUIRED_FOR_STAFF` | `true` | Staff and insurer accounts must use two-factor authentication |
| `REVIEW_CREDENTIAL_REQUIRED` | `true` | VERIFY needs an admin-confirmed registration |
| `AUDIT_CHAIN_KEY` | 32+ random chars, not stored in the database host | HMAC audit chain |
| MongoDB | encrypted storage volume, TLS, backups encrypted | Encryption at rest of the database itself |

Erasure requests are processed by a super_admin through `POST /api/v1/privacy/data-requests/{id}/complete` within 30 days (`dueBy`).
