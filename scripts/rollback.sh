#!/bin/bash
# QScrap Production Rollback Script
# Usage: ./rollback.sh
# Rolls back to the last known good deployment

set -e

echo "🔄 QScrap Rollback Script"
echo "========================="

cd /opt/qscrap

# Check if stable tag exists
if docker images qscrap-backend:stable --format "{{.ID}}" | head -1 > /dev/null 2>&1; then
    echo "Found stable deployment tag"
    
    # Restore from stable tag
    docker tag qscrap-backend:stable qscrap-backend:latest
    docker compose up -d backend
    
    # Wait for health
    sleep 10
    
    if curl -sf http://localhost:3000/health > /dev/null; then
        echo "✅ Rollback successful! Backend is healthy."
    else
        echo "⚠️ Backend started but health check failed"
    fi
else
    echo "❌ No stable tag found. Attempting git-based rollback..."
    
    if [ -f /opt/qscrap/.last_good_deploy ]; then
        LAST_GOOD=$(cat /opt/qscrap/.last_good_deploy)
        echo "Rolling back to commit: $LAST_GOOD"
        
        git fetch origin main
        git reset --hard $LAST_GOOD
        
        docker compose build backend
        docker compose up -d backend
        
        sleep 15
        
        if curl -sf http://localhost:3000/health > /dev/null; then
            echo "✅ Git rollback successful!"
        else
            echo "❌ Rollback failed. Manual intervention required."
            exit 1
        fi
    else
        echo "❌ No rollback point available. Manual intervention required."
        exit 1
    fi
fi

echo ""
echo "Current container status:"
docker ps --filter name=qscrap
