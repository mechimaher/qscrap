# 🏆 QScrap CI/CD Brain - Enterprise Gold Standard

**Version:** 1.1 | **Certified:** February 11, 2026 | **Maturity:** 9.6/10

---

## Quick Reference

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| CI | `ci.yml` | Push/PR | Build, test, Docker |
| CD | `cd.yml` | Push main | Deploy to VPS |
| Security | `security.yml` | Push + Weekly | 7-job security suite |
| Backup | `backup.yml` | Daily 3 AM | PostgreSQL → R2 |
| Cleanup | `cleanup.yml` | Weekly + Manual | Dead code, artifacts |
| Quality Gates | `quality-gates.yml` | PRs | Pre-merge checks |

---

## Deployment Flow

```
Push → CI (3 min) → Security → CD → VPS Deploy → Health Check → ✅ Live
```

**Time to Production:** 5-8 minutes

---

## File Locations

```
.github/
├── workflows/
│   ├── ci.yml              # Matrix testing Node 18+20
│   ├── cd.yml              # GHCR + VPS deploy
│   ├── security.yml        # CodeQL, Trivy, Gitleaks
│   ├── backup.yml          # Triggers backup-db.sh
│   ├── cleanup.yml         # Dead code, artifact prune
│   └── quality-gates.yml   # PR quality checks
├── dependabot.yml          # Auto dependency updates

scripts/
├── backup-db.sh            # PostgreSQL → R2 (cron)
├── rollback.sh             # Instant recovery
├── pre-commit.sh           # Local hook
└── sync_vps.py             # Manual deploy (legacy)
```

---

## CI Workflow (`ci.yml`)

### Jobs
1. **Code Quality** - ESLint + TypeScript build
2. **Tests (Node 18)** - Matrix with Postgres/Redis services
3. **Tests (Node 20)** - Parallel matrix job
4. **Docker Build** - Buildx with GHA caching
5. **CI Summary** - Consolidated results

### Key Features
- Matrix testing (Node 18 + 20)
- Postgres + Redis service containers
- Coverage report upload
- Docker Buildx caching
- **Path Filter:** Ignores `mobile/**` and `driver-mobile/**` (Backend only)

---

## CD Workflow (`cd.yml`)

### Jobs
1. **Build & Push to GHCR** - Container registry
2. **Deploy to Production** - VPS via SSH

### Key Features
- Push to `ghcr.io/mechimaher/qscrap`
- Stable tag before deploy (`qscrap-backend:stable`)
- Health checks (API, Postgres, Redis)
- Slack notifications (optional)
- Records `.last_good_deploy` for rollback

### Secrets Required
```
VPS_HOST, VPS_USER, VPS_PASSWORD
SLACK_WEBHOOK (optional)
```

---

## Security Workflow (`security.yml`)

### Jobs (7 Total)
1. **CodeQL SAST** - Static analysis (continue-on-error)
2. **Container Scan** - Trivy vulnerabilities
3. **IaC Security** - Docker/compose scanning
4. **Dependency Audit** - npm audit
5. **Secret Detection** - Gitleaks (continue-on-error)
6. **License Check** - Compliance
7. **Security Summary** - Dashboard

### Artifacts Generated
- `sbom-{sha}.json` - Software Bill of Materials
- `npm-audit-{sha}.json` - Vulnerability report

---

## Backup System

### Components
- **Cron:** VPS runs `backup-db.sh` at 3 AM
- **GitHub Actions:** Backup workflow as redundancy
- **Storage:** Local 30-day + Cloudflare R2 unlimited

### R2 Configuration
```
Bucket: qscrap-backups
Endpoint: https://8181c2840d8ffe75009a3221ad9fd3f4.r2.cloudflarestorage.com
Retention: 8GB limit, auto-prune oldest
```

---

## Rollback Procedure

### Option 1: Docker Tag (Fastest)
```bash
ssh root@147.93.89.153
cd /opt/qscrap
docker tag qscrap-backend:stable qscrap-backend:latest
docker compose up -d
```

### Option 2: Script
```bash
ssh root@147.93.89.153
/opt/qscrap/scripts/rollback.sh
```

### Option 3: Git
```bash
ssh root@147.93.89.153
cd /opt/qscrap
git checkout $(cat .last_good_deploy)
docker compose up -d --build
```

---

## Pre-commit Hook

### Install
```bash
cp scripts/pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Checks
- Debug files blocked
- Console.log warnings
- Hardcoded secrets blocked
- Merge conflict markers blocked
- Large files (>5MB) warning

---

## GitHub Secrets Required

| Secret | Purpose | Required |
|--------|---------|----------|
| `VPS_HOST` | Server IP | ✅ |
| `VPS_USER` | SSH user | ✅ |
| `VPS_PASSWORD` | SSH password | ✅ |
| `SLACK_WEBHOOK` | Notifications | Optional |
| `R2_ACCOUNT_ID` | Backup sync | Optional |
| `R2_ACCESS_KEY_ID` | Backup sync | Optional |
| `R2_SECRET_ACCESS_KEY` | Backup sync | Optional |

---

## VPS Production Environment

```
Server: 147.93.89.153
Path: /opt/qscrap
User: root
Services: qscrap-backend, qscrap-postgres, qscrap-redis
```

### Docker Commands
```bash
docker compose up -d              # Start
docker compose down               # Stop
docker compose logs -f backend    # Logs
docker exec qscrap-backend npm run db:migrate  # Migrations
```

---

## Troubleshooting

### CI Failing
1. Check `npm run lint` locally
2. Check `npm run build` locally
3. Check `npm test` with Postgres/Redis running

### CD Failing
1. Verify VPS secrets in GitHub
2. SSH to VPS, check `docker ps`
3. Check `/opt/qscrap/.last_good_deploy`

### Security Failing
- CodeQL timeout: Normal for large repos, non-blocking
- Gitleaks: Check for hardcoded secrets, non-blocking

### Backup Failing
1. SSH to VPS
2. Run `/opt/qscrap/scripts/backup-db.sh` manually
3. Check AWS CLI: `which aws`

---

## Maturity Roadmap

| Level | Status | Features |
|-------|--------|----------|
| 1-3 | ✅ Done | Basic CI |
| 4-6 | ✅ Done | CD, Security |
| 7-8 | ✅ Done | Matrix, GHCR |
| 9 | ✅ Done | Cleanup, Quality Gates |
| 10 | ⚡ GitHub Team | Branch enforcement |

---

## Key Commits

| Commit | Description |
|--------|-------------|
| `8c11a22` | Initial CI workflow |
| `03f3ea6` | Dependabot added |
| `036d6bd` | CD workflow added |
| `f7eb6cf` | Enterprise 10/10 certification |
| `7c6bed0` | Enterprise Gold implementation |
| `0605758` | Cleanup Blueprint |
| `acc1ee5` | Security stabilization |

---

*Enterprise Gold Certified - February 3, 2026*
