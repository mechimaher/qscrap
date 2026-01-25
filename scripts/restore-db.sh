#!/bin/bash
# ============================================
# QSCRAP DATABASE RESTORE SCRIPT
# Usage: ./restore-db.sh /path/to/backup.sql.gz
# ============================================

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh /opt/qscrap/backups/qscrap_db_*.sql.gz 2>/dev/null | tail -10
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will REPLACE the current database!"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "$(date): Stopping backend..."
docker stop qscrap-backend 2>/dev/null || true

echo "$(date): Restoring database from $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | docker exec -i qscrap-postgres psql -U postgres -d qscrap_db

echo "$(date): Starting backend..."
docker start qscrap-backend

echo "$(date): ✅ Database restored successfully!"
echo "$(date): Run 'docker logs qscrap-backend' to verify startup"
