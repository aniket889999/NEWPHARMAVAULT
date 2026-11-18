#!/usr/bin/env bash
# Restore a backup made by ops/backup.sh into a TARGET database (never the live one by accident).
#   TARGET_MONGO_URI=... BACKUP_PASSPHRASE_FILE=... ./ops/restore.sh /backups/20261118T020000Z [documents_target_dir]
set -euo pipefail
: "${TARGET_MONGO_URI:?TARGET_MONGO_URI is required}"
: "${BACKUP_PASSPHRASE_FILE:?BACKUP_PASSPHRASE_FILE is required}"
PREFIX="${1:?usage: restore.sh <backup prefix> [documents_target_dir]}"
DIR="$(dirname "$PREFIX")"; BASE="$(basename "$PREFIX")"
(cd "$DIR" && sha256sum -c "$BASE.sha256")

if [ "${CONFIRM_RESTORE:-}" != "yes" ]; then
  echo "Dry check passed. Set CONFIRM_RESTORE=yes to restore into $(echo "$TARGET_MONGO_URI" | sed -E 's#//[^@]*@#//***@#')."
  exit 0
fi

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$BACKUP_PASSPHRASE_FILE" -in "$PREFIX.mongo.archive.gz.enc" \
  | mongorestore --uri="$TARGET_MONGO_URI" --archive --gzip --drop

if [ -n "${2:-}" ] && [ -f "$PREFIX.documents.tar.gz.enc" ]; then
  mkdir -p "$2"
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$BACKUP_PASSPHRASE_FILE" -in "$PREFIX.documents.tar.gz.enc" | tar -C "$2" -xzf -
fi
echo "Restore finished. Next: npm --prefix backend run indexes:sync -- --apply && npm --prefix backend run audit:verify"
