#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# PostgreSQL Backup Script
# Dumps the PG Management System database and optionally uploads to S3/R2.
#
# Usage:
#   ./scripts/backup.sh                # manual run
#   ./scripts/backup.sh --upload       # dump + upload to S3
#
# Required env vars:
#   DATABASE_URL                       postgres://user:pass@host:5432/db
#   BACKUP_DIR                         /var/backups/pg-system  (default)
#   BACKUP_S3_BUCKET                   s3://your-backup-bucket (optional, for --upload)
#   BACKUP_S3_PREFIX                   pg-system/db            (optional)
#   AWS_ACCESS_KEY_ID                  (for S3 upload)
#   AWS_SECRET_ACCESS_KEY              (for S3 upload)
#   AWS_DEFAULT_REGION                 ap-south-1
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
BACKUP_DIR="${BACKUP_DIR:-/var/backups/pg-system}"
BACKUP_FILE="${BACKUP_DIR}/backup-${TIMESTAMP}.sql.gz"
UPLOAD="${1:-}"

mkdir -p "$BACKUP_DIR"

echo "[$(date -u)] Starting backup → ${BACKUP_FILE}"

# Dump the database in compressed plain SQL format
pg_dump \
  --no-owner \
  --no-acl \
  --format=plain \
  "$DATABASE_URL" \
  | gzip -9 > "$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date -u)] Backup complete. Size: ${BACKUP_SIZE}"

# ── Upload to S3/R2 ──────────────────────────────────────────────────────────
if [[ "$UPLOAD" == "--upload" ]]; then
  S3_BUCKET="${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET must be set for --upload}"
  S3_PREFIX="${BACKUP_S3_PREFIX:-pg-system/db}"
  S3_KEY="${S3_PREFIX}/backup-${TIMESTAMP}.sql.gz"

  echo "[$(date -u)] Uploading to ${S3_BUCKET}/${S3_KEY}"
  aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/${S3_KEY}" \
    --storage-class STANDARD_IA \
    --sse AES256

  echo "[$(date -u)] Upload complete."

  # Remove local file after successful upload (save disk space)
  rm -f "$BACKUP_FILE"
fi

# ── Retention: keep only last 7 local backups ────────────────────────────────
if [[ "$UPLOAD" != "--upload" ]]; then
  ls -t "${BACKUP_DIR}"/backup-*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
  echo "[$(date -u)] Local retention enforced (kept last 7 backups)."
fi

echo "[$(date -u)] Backup job finished."
