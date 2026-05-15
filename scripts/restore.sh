#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# PostgreSQL Restore Script
#
# Usage:
#   ./scripts/restore.sh /path/to/backup.sql.gz
#   ./scripts/restore.sh s3://bucket/prefix/backup-2024-01-01T00-00-00Z.sql.gz
#
# ⚠ WARNING: This DESTROYS the existing database. Always test on staging first.
#
# Required env vars:
#   DATABASE_URL     postgres://user:pass@host:5432/db
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_PATH="${1:?Usage: restore.sh <backup-file-or-s3-path>}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " PG MANAGEMENT SYSTEM — DATABASE RESTORE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Target: ${DATABASE_URL%%@*}@[host redacted]"
echo " Backup: ${BACKUP_PATH}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠  This will REPLACE all data in the target database."
read -rp "Type 'RESTORE' to confirm: " CONFIRM

if [[ "$CONFIRM" != "RESTORE" ]]; then
  echo "Aborted."
  exit 1
fi

LOCAL_FILE="$BACKUP_PATH"

# ── Download from S3 if path starts with s3:// ──────────────────────────────
if [[ "$BACKUP_PATH" == s3://* ]]; then
  TMP_FILE="/tmp/pg-restore-$(date +%s).sql.gz"
  echo "[$(date -u)] Downloading backup from S3..."
  aws s3 cp "$BACKUP_PATH" "$TMP_FILE"
  LOCAL_FILE="$TMP_FILE"
fi

echo "[$(date -u)] Restoring from ${LOCAL_FILE}..."

# Decompress and pipe to psql
gunzip -c "$LOCAL_FILE" | psql "$DATABASE_URL"

echo "[$(date -u)] ✓ Restore complete."

# Clean up temp file
[[ "$BACKUP_PATH" == s3://* ]] && rm -f "$TMP_FILE"

echo ""
echo "Next steps:"
echo "  1. Run health check: curl http://localhost:3001/api/v1/health"
echo "  2. Verify tenant count: SELECT COUNT(*) FROM \"Tenant\";"
echo "  3. Verify payment history is intact"
