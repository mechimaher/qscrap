#!/bin/bash
set -e

# Configuration
VPS_IP="147.93.89.153"
DB_PASS="QScrap@2026byMaher" 
JWT_SECURE="QScrap_JWT_$(openssl rand -hex 24)"
ARCHIVE_NAME="qscrap_deploy_$(date +%s).tar.gz"

echo "🚀 Starting QScrap SCP Deployment to $VPS_IP"

# 1. Archive Local Code
echo "[1/5] Archiving local code..."
tar -czf $ARCHIVE_NAME . \
    --exclude=.git \
    --exclude=node_modules \
    --exclude=uploads \
    --exclude=dist \
    --exclude=driver-mobile \
    --exclude=mobile \
    --exclude=docs \
    --exclude=*.apk

echo "Archive created: $ARCHIVE_NAME"

# 2. SCP to Remote (Requires Password)
echo "[2/5] Uploading code to VPS..."
echo "⚠️  PLEASE ENTER PASSWORD FOR SCP:"
scp -o StrictHostKeyChecking=no $ARCHIVE_NAME root@$VPS_IP:/opt/

# 3. Remote Execution Script
REMOTE_SCRIPT="
set -e
cd /opt

# Install Docker if needed
echo '[3/5] Checking System & Docker...'
apt-get update -qq >/dev/null
if ! command -v docker &> /dev/null; then
    echo 'Installing Docker...'
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh >/dev/null
    apt-get install -y docker-compose-plugin git >/dev/null
fi

# Extract
echo '[4/5] Extracting code...'
rm -rf qscrap
mkdir qscrap
tar -xzf $ARCHIVE_NAME -C qscrap
rm $ARCHIVE_NAME

# Setup Env
cd qscrap
cat > .env <<EOF
NODE_ENV=production
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=${DB_PASS}
DB_NAME=qscrap_db
JWT_SECRET=${JWT_SECURE}
DB_POOL_MAX=20
EOF

# Launch
echo '[5/5] Launching Containers...'
docker compose down --remove-orphans || true
docker compose up -d --build

echo '✅ Deployment SUCCESS! Visit http://${VPS_IP}'
"

# 4. SSH Execute (Requires Password again - will try to handle in prompt)
echo "[3/5] Configuring & Launching remote server..."
echo "⚠️  PLEASE ENTER PASSWORD FOR SSH:"
echo "$REMOTE_SCRIPT" | ssh -o StrictHostKeyChecking=no root@$VPS_IP "bash -s"

# Cleanup
rm $ARCHIVE_NAME
