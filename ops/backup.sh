#!/usr/bin/env bash
# Encrypted MongoDB + document-storage backup.
#   MONGO_URI=... BACKUP_DIR=/backups BACKUP_PASSPHRASE_FILE=/run/secrets/backup_pass DOCUMENT_STORAGE_DIR=/data/documents ./ops/backup.sh
# Produces <stamp>.mongo.archive.gz.enc and <stamp>.documents.tar.gz.enc (AES-256, openssl pbkdf2)
# plus a .sha256 manifest. Copy them off-site; keep the passphrase in a secret manager, not next to the backups.
set -euo pipefail
: "${MONGO_URI:?MONGO_URI is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${BACKUP_PASSPHRASE_FILE:?BACKUP_PASSPHRASE_FILE is required}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
umask 077
mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

mongodump --uri="$MONGO_URI" --archive --gzip \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$BACKUP_PASSPHRASE_FILE" -out "$STAMP.mongo.archive.gz.enc"

if [ -n "${DOCUMENT_STORAGE_DIR:-}" ] && [ -d "$DOCUMENT_STORAGE_DIR" ]; then
  tar -C "$DOCUMENT_STORAGE_DIR" -czf - . \
    | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$BACKUP_PASSPHRASE_FILE" -out "$STAMP.documents.tar.gz.enc"
fi

sha256sum "$STAMP".*.enc > "$STAMP.sha256"
# Keep the newest BACKUP_KEEP (default 14) sets locally.
ls -1t ./*.sha256 2>/dev/null | tail -n +"$(( ${BACKUP_KEEP:-14} + 1 ))" | while read -r old; do
  base="${old%.sha256}"; rm -f "$base".*.enc "$old"
done
echo "Backup $STAMP written to $BACKUP_DIR"
