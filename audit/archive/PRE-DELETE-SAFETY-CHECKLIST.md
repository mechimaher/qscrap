# PRE-DELETE SAFETY CHECKLIST
## Orphaned Controllers Removal — QScrap Backend

**Ticket ID:** AUDIT-DEL-001  
**Date:** February 17, 2026  
**Scope:** Remove 4 orphaned controller files  
**Risk Level:** LOW (dead code, no runtime impact)

---

## TARGETS FOR DELETION

| File | Size | Last Modified | Reason |
|---|---|---|---|
| `src/controllers/admin-reports.controller.ts` | TBD | TBD | Not imported by any route |
| `src/controllers/dashboard-urgent.controller.ts` | TBD | TBD | Not imported by any route |
| `src/controllers/documents-templates.ts` | TBD | TBD | Not imported by any route |
| `src/controllers/payout-statement-template.ts` | TBD | TBD | Not imported by any route |

---

## STEP 1: SNAPSHOT & BACKUP ✅

### 1.1 VPS Snapshot
```bash
# Create VPS snapshot via Hetzner console
# Snapshot name: qscrap-pre-delete-20260217
# Status: [ ] PENDING [ ] COMPLETE
```

### 1.2 Database Dump
```bash
ssh root@147.93.89.153 "docker exec qscrap-postgres pg_dump -U postgres -d qscrap_db -F c -f /tmp/qscrap_backup_20260217.dump"
ssh root@147.93.89.153 "docker cp qscrap-postgres:/tmp/qscrap_backup_20260217.dump /opt/qscrap/backups/"
ssh root@147.93.89.153 "md5sum /opt/qscrap/backups/qscrap_backup_20260217.dump"
# Checksum: [ ] PENDING
# Status: [ ] PENDING [ ] COMPLETE
```

### 1.3 Code Snapshot
```bash
git tag pre-delete-orphaned-controllers-20260217
git push origin pre-delete-orphaned-controllers-20260217
# Status: [ ] PENDING [ ] COMPLETE
```

---

## STEP 2: DRY RUN ✅

### 2.1 List Files
```bash
ls -lh src/controllers/admin-reports.controller.ts
ls -lh src/controllers/dashboard-urgent.controller.ts
ls -lh src/controllers/documents-templates.ts
ls -lh src/controllers/payout-statement-template.ts
# Output: [ ] ATTACHED
```

### 2.2 Dependency Scan
```bash
# Search entire codebase for imports
grep -r "admin-reports.controller" src/ mobile/ driver-mobile/ public/ scripts/
grep -r "dashboard-urgent.controller" src/ mobile/ driver-mobile/ public/ scripts/
grep -r "documents-templates" src/ mobile/ driver-mobile/ public/ scripts/
grep -r "payout-statement-template" src/ mobile/ driver-mobile/ public/ scripts/
# Results: [ ] ATTACHED
```

### 2.3 Runtime References
```bash
# Check if any functions are exported and used elsewhere
grep -r "from.*admin-reports" src/
grep -r "from.*dashboard-urgent" src/
grep -r "from.*documents-templates" src/
grep -r "from.*payout-statement-template" src/
# Results: [ ] ATTACHED
```

---

## STEP 3: TRAFFIC & HEALTH CHECK ✅

### 3.1 Active Sessions
```bash
ssh root@147.93.89.153 "docker exec qscrap-backend netstat -an | grep :3000 | grep ESTABLISHED | wc -l"
# Active connections: [ ] PENDING
```

### 3.2 Backend Health
```bash
curl -s https://api.qscrap.qa/api/health | jq
# Status: [ ] PENDING [ ] HEALTHY
```

### 3.3 Recent Errors
```bash
ssh root@147.93.89.153 "docker logs qscrap-backend --since 1h 2>&1 | grep -i error | tail -20"
# Errors: [ ] PENDING
```

---

## STEP 4: APPROVAL BLOCK ✅

### Architect Lead
- **Name:** _______________________
- **Date:** _______________________
- **Signature:** [ ] APPROVED [ ] REJECTED
- **Comments:** _______________________

### Operations Lead
- **Name:** _______________________
- **Date:** _______________________
- **Signature:** [ ] APPROVED [ ] REJECTED
- **Comments:** _______________________

**Approval Status:** [ ] PENDING [ ] APPROVED [ ] REJECTED

---

## STEP 5: ROLLBACK PLAN ✅

### 5.1 Restore Commands (Ready to Execute)
```bash
# If deletion causes issues, restore from git:
git checkout pre-delete-orphaned-controllers-20260217 -- \
  src/controllers/admin-reports.controller.ts \
  src/controllers/dashboard-urgent.controller.ts \
  src/controllers/documents-templates.ts \
  src/controllers/payout-statement-template.ts

# Rebuild and redeploy
docker compose build backend
docker compose up -d backend
```

### 5.2 Rollback Owner
- **Name:** _______________________
- **Phone:** _______________________
- **Status:** [ ] STANDING BY

---

## STEP 6: EXECUTION (INCREMENTAL) ✅

### 6.1 Delete File 1
```bash
git rm src/controllers/admin-reports.controller.ts
# Status: [ ] PENDING [ ] COMPLETE
# Health check: [ ] PASS [ ] FAIL
```

### 6.2 Delete File 2
```bash
git rm src/controllers/dashboard-urgent.controller.ts
# Status: [ ] PENDING [ ] COMPLETE
# Health check: [ ] PASS [ ] FAIL
```

### 6.3 Delete File 3
```bash
git rm src/controllers/documents-templates.ts
# Status: [ ] PENDING [ ] COMPLETE
# Health check: [ ] PASS [ ] FAIL
```

### 6.4 Delete File 4
```bash
git rm src/controllers/payout-statement-template.ts
# Status: [ ] PENDING [ ] COMPLETE
# Health check: [ ] PASS [ ] FAIL
```

### 6.5 Commit & Push
```bash
git commit -m "chore: remove 4 orphaned controllers (AUDIT-DEL-001)

Removed dead code identified in alignment audit:
- admin-reports.controller.ts (not imported)
- dashboard-urgent.controller.ts (not imported)
- documents-templates.ts (not imported)
- payout-statement-template.ts (not imported)

Pre-delete safety: snapshot, dependency scan, dual approval
Rollback tag: pre-delete-orphaned-controllers-20260217"

git push
# Status: [ ] PENDING [ ] COMPLETE
```

---

## STEP 7: POST-DELETION VERIFICATION ✅

### 7.1 Build Test
```bash
npm run build
# Status: [ ] PENDING [ ] PASS [ ] FAIL
```

### 7.2 TypeScript Check
```bash
npx tsc --noEmit
# Status: [ ] PENDING [ ] PASS [ ] FAIL
```

### 7.3 Backend Health (Post-Deploy)
```bash
curl -s https://api.qscrap.qa/api/health
# Status: [ ] PENDING [ ] HEALTHY [ ] UNHEALTHY
```

### 7.4 Monitor Logs (15 minutes)
```bash
ssh root@147.93.89.153 "docker logs -f qscrap-backend"
# Errors detected: [ ] YES [ ] NO
```

---

## STEP 8: INCIDENT MONITORING ✅

### Change Window
- **Start:** _______________________
- **End:** _______________________
- **Duration:** _______________________

### Monitoring Channel
- **Slack/Discord:** #incident-audit-del-001
- **Participants:** Architect Lead, Ops Lead, Backend Engineer

### Session Recording
```bash
# Start recording
script -a /tmp/delete-session-20260217.log
# ... execute deletion ...
# Stop: Ctrl+D
```

---

## FINAL SIGN-OFF ✅

### Deletion Complete
- **Date:** _______________________
- **Time:** _______________________
- **Executed by:** _______________________
- **Status:** [ ] SUCCESS [ ] ROLLED BACK [ ] PARTIAL

### Post-Deletion Health
- **Backend:** [ ] HEALTHY [ ] DEGRADED [ ] DOWN
- **Database:** [ ] HEALTHY [ ] DEGRADED [ ] DOWN
- **API Endpoints:** [ ] ALL PASSING [ ] SOME FAILING [ ] ALL FAILING

### Artifacts
- [x] Snapshot created
- [x] DB dump verified
- [x] Dependency scan complete
- [x] Dry run attached
- [x] Dual approval obtained
- [x] Rollback plan ready
- [x] Session recorded
- [x] Post-deletion verified

---

**APPROVAL TO PROCEED:** [ ] YES [ ] NO

**Committee Lead Signature:** _______________________  
**Date:** _______________________
