#!/bin/bash
# ============================================
# QSCRAP DATABASE BACKUP SCRIPT
# Backs up PostgreSQL to local + Cloudflare R2
# Run via cron: 0 3 * * * /opt/qscrap/scripts/backup-db.sh
# ============================================

set -e

# ============================================
# CONFIGURATION
# ============================================
BACKUP_DIR="/opt/qscrap/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="qscrap_db_${TIMESTAMP}.sql.gz"
MAX_BACKUPS=30  # Keep 30 days locally
MAX_R2_SIZE_GB=8  # Stay under 10GB limit (safety margin)

# Cloudflare R2 Configuration
R2_ENDPOINT="https://8181c2840d8ffe75009a3221ad9fd3f4.r2.cloudflarestorage.com"
R2_BUCKET="qscrap-backups"
R2_ACCESS_KEY="82b08fda60b61eccd3476d7844002a64"
R2_SECRET_KEY="80f4a6faf671e759a1bdec99477912f582fd511db845c6caf7e75a3e17f81872"

# ============================================
# CREATE BACKUP
# ============================================
mkdir -p "$BACKUP_DIR"
echo "$(date): Starting database backup..."

# Backup PostgreSQL via Docker
docker exec qscrap-postgres pg_dump -U postgres -d qscrap_db | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

# Verify backup was created
if [ ! -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    echo "$(date): ERROR - Backup failed!"
    exit 1
fi

SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
echo "$(date): Local backup created: ${BACKUP_FILE} (${SIZE})"

# ============================================
# UPLOAD TO CLOUDFLARE R2
# ============================================
echo "$(date): Uploading to Cloudflare R2..."

# Configure AWS CLI for R2
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_KEY"
export AWS_DEFAULT_REGION="auto"

# Check if aws cli is installed
if ! command -v aws &> /dev/null; then
    echo "$(date): Installing AWS CLI..."
    apt-get update && apt-get install -y awscli
fi

# Upload to R2
aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" "s3://${R2_BUCKET}/" \
    --endpoint-url "$R2_ENDPOINT" \
    --no-progress

if [ $? -eq 0 ]; then
    echo "$(date): ✅ R2 upload successful!"
else
    echo "$(date): ⚠️ R2 upload failed, backup still saved locally"
fi

# ============================================
# CLEANUP OLD BACKUPS (LOCAL)
# ============================================
echo "$(date): Cleaning up old local backups..."
ls -t "${BACKUP_DIR}"/qscrap_db_*.sql.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -f

# ============================================
# CLEANUP OLD BACKUPS (R2 - Keep under 8GB)
# ============================================
echo "$(date): Checking R2 storage..."

# Get total size in bytes
TOTAL_BYTES=$(aws s3 ls "s3://${R2_BUCKET}/" --endpoint-url "$R2_ENDPOINT" --recursive --summarize 2>/dev/null | grep "Total Size" | awk '{print $3}' || echo "0")
TOTAL_GB=$(echo "scale=2; ${TOTAL_BYTES:-0} / 1073741824" | bc 2>/dev/null || echo "0")

echo "$(date): R2 storage used: ${TOTAL_GB} GB"

# If over 8GB, delete oldest backups until under limit
if [ "$(echo "$TOTAL_GB > $MAX_R2_SIZE_GB" | bc 2>/dev/null)" = "1" ]; then
    echo "$(date): R2 storage > ${MAX_R2_SIZE_GB}GB, cleaning up oldest..."
    
    # Get oldest file and delete it
    OLDEST=$(aws s3 ls "s3://${R2_BUCKET}/" --endpoint-url "$R2_ENDPOINT" | sort | head -1 | awk '{print $4}')
    if [ -n "$OLDEST" ]; then
        aws s3 rm "s3://${R2_BUCKET}/${OLDEST}" --endpoint-url "$R2_ENDPOINT"
        echo "$(date): Deleted oldest backup: ${OLDEST}"
    fi
fi

# ============================================
# SUMMARY
# ============================================
echo "$(date): ========================================="
echo "$(date): Backup completed successfully!"
echo "$(date): Local: ${BACKUP_DIR}/${BACKUP_FILE}"
echo "$(date): R2: s3://${R2_BUCKET}/${BACKUP_FILE}"
echo "$(date): ========================================="
