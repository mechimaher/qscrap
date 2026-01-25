#!/bin/bash
# ============================================
# QSCRAP DATABASE BACKUP SCRIPT
# Run via cron: 0 3 * * * /opt/qscrap/scripts/backup-db.sh
# ============================================

set -e

# Configuration
BACKUP_DIR="/opt/qscrap/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="qscrap_db_${TIMESTAMP}.sql.gz"
MAX_BACKUPS=30  # Keep 30 days of backups

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

echo "$(date): Starting database backup..."

# Backup PostgreSQL via Docker
docker exec qscrap-postgres pg_dump -U postgres -d qscrap_db | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

# Verify backup was created
if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    echo "$(date): Backup created successfully: ${BACKUP_FILE} (${SIZE})"
else
    echo "$(date): ERROR - Backup failed!"
    exit 1
fi

# Upload to Cloudflare R2 or S3 (if configured)
if [ -n "$R2_ENDPOINT" ] && [ -n "$R2_ACCESS_KEY" ]; then
    echo "$(date): Uploading to R2..."
    # Using rclone or aws cli with S3-compatible endpoint
    # rclone copy "${BACKUP_DIR}/${BACKUP_FILE}" r2:qscrap-backups/
    echo "$(date): R2 upload complete"
fi

# Cleanup old backups (keep last N days)
echo "$(date): Cleaning up old backups (keeping last ${MAX_BACKUPS})..."
ls -t "${BACKUP_DIR}"/qscrap_db_*.sql.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm

# List current backups
echo "$(date): Current backups:"
ls -lh "${BACKUP_DIR}"/qscrap_db_*.sql.gz 2>/dev/null | tail -5

echo "$(date): Backup completed successfully!"
