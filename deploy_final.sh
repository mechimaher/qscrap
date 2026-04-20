#!/bin/bash
set -e

echo "🚀 Starting Final Production Pulse..."

# 1. Staging changes
echo "Staging changes..."
echo "rootroot" | sudo -S git add .

# 2. Committing changes
echo "Committing Enterprise Gold certification..."
echo "rootroot" | sudo -S git commit -m "feat(enterprise): surgical audit & hardening v3.0 - GOLD CERTIFIED" || echo "Nothing to commit"

# 3. Pushing to GitHub
echo "Pushing to GitHub..."
echo "rootroot" | sudo -S git push origin main

# 4. Triggering VPS Master Sync
echo "Triggering VPS Sync..."
export VPS_HOST="147.93.89.153"
export VPS_USER="root"
export VPS_PASSWORD="rootroot"
python3 scripts/sync_vps.py

echo "✅ Final Production Pulse Complete!"
