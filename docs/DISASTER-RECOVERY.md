# QSCRAP Disaster Recovery Runbook

> **Last Updated:** 2026-01-25 | **Owner:** DevOps Team

---

## Critical Contact Info
- **Server IP:** $VPS_HOST
- **SSH:** `ssh root@$VPS_HOST`
- **Backups:** /opt/qscrap/backups/

---

## 🔴 SCENARIO 1: Complete Server Down

### Symptoms
- API returns 502/504
- Mobile apps show "Connection Error"
- All dashboards inaccessible

### Resolution (ETA: 15min)
```bash
# 1. SSH to server
ssh root@$VPS_HOST

# 2. Check Docker status
docker ps -a

# 3. Restart all containers
cd /opt/qscrap
docker compose down
docker compose up -d

# 4. Verify services
docker logs qscrap-backend --tail 50
docker logs qscrap-postgres --tail 50

# 5. Test health endpoint
curl http://localhost:3000/health
```

---

## 🔴 SCENARIO 2: Database Corrupted/Lost

### Symptoms
- API returns 500 errors
- "Database connection failed" in logs
- Data missing from dashboards

### Resolution (ETA: 30min)
```bash
# 1. Stop backend
docker stop qscrap-backend

# 2. List available backups
ls -lh /opt/qscrap/backups/

# 3. Restore latest backup
./scripts/restore-db.sh /opt/qscrap/backups/qscrap_db_YYYYMMDD_HHMMSS.sql.gz

# 4. Verify data
docker exec -it qscrap-postgres psql -U postgres -d qscrap_db -c "SELECT COUNT(*) FROM orders;"

# 5. Restart backend
docker start qscrap-backend
```

---

## 🔴 SCENARIO 3: Backend Won't Start

### Symptoms
- Container exits immediately
- "qscrap-backend Exited (1)" in docker ps

### Resolution
```bash
# 1. Check logs
docker logs qscrap-backend --tail 100

# 2. Common fixes:
# - Environment variables missing:
cat /opt/qscrap/.env

# - Port conflict:
netstat -tlnp | grep 3000

# - Rebuild container:
docker compose up -d --build backend

# 3. If DB connection fails:
docker exec -it qscrap-postgres psql -U postgres -d qscrap_db -c "SELECT 1;"
```

---

## 🔴 SCENARIO 4: High Memory/CPU

### Symptoms
- Slow responses
- Timeouts
- Server unresponsive

### Resolution
```bash
# 1. Check resources
htop
docker stats

# 2. Identify heavy container
docker stats --no-stream

# 3. Restart heavy container
docker restart qscrap-backend

# 4. Clear Redis cache if needed
docker exec qscrap-redis redis-cli FLUSHALL
```

---

## 🔴 SCENARIO 5: Stripe Payments Failing

### Symptoms
- Payments stuck at "pending"
- Stripe webhook errors in logs

### Resolution
```bash
# 1. Check webhook logs
docker logs qscrap-backend 2>&1 | grep -i stripe | tail -50

# 2. Verify Stripe keys in .env
grep STRIPE /opt/qscrap/.env

# 3. Check Stripe dashboard
# https://dashboard.stripe.com/webhooks

# 4. Resend failed webhooks from Stripe dashboard
```

---

## 📋 Daily Health Checks

```bash
# Run daily at 9:00 AM
curl -s http://api.qscrap.qa/health | jq .
docker stats --no-stream
df -h
```

---

## 🔐 Backup Schedule

| Time | Action |
|------|--------|
| 03:00 | Automated PostgreSQL backup |
| Weekly | Manual backup verification |
| Monthly | Restore test on staging |

---

## Emergency Contacts
- **Hosting:** Contabo support
- **Domain:** Registrar support
- **Stripe:** dashboard.stripe.com
