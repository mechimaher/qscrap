# QScrap Full Website Audit (Delta + Current State)

**Audit date:** 2026-02-24  
**Repo:** `/home/user/qscrap.qa`  
**Scope:** Express API + static web dashboards (`public/`) + deployment workflows + (light) mobile app config review  

## Executive Summary

The platform is a solid monolithic SaaS foundation (Express + PostgreSQL + Redis + Socket.IO) with good building blocks: structured logging, CI/security workflows, migrations, and layered services/controllers.

However, there are **two production-grade security risks that are severe enough to block “enterprise-ready” claims**:

1) **High-likelihood XSS → token theft → admin/ops account takeover** (CSP allows inline scripts/handlers; dashboards build DOM with `innerHTML`; tokens stored in `localStorage`).  
2) **Manual job trigger endpoints can become publicly usable in production if `ADMIN_API_KEY` is not set** (and even when set, it’s a shared static key with no network controls).

If you fix only two things this week, fix those.

---

## Architecture Snapshot

- **Backend:** Node.js (TypeScript) Express monolith (`src/app.ts`, `src/server.ts`)  
- **DB:** PostgreSQL with SQL migrations (`src/config/migrations/*.sql`) + base schema dump (`src/config/database.sql`)  
- **Cache/queues:** Redis + BullMQ + Socket.IO Redis adapter (multi-node support exists)  
- **Frontend:** static HTML/CSS/JS dashboards in `public/` (admin/ops/garage/support/finance + marketing pages)  
- **Mobile:** Expo apps in `mobile/` and `driver-mobile/`  
- **Infra:** Dockerfile + `docker-compose.yml`; GitHub Actions CI/CD + security scans; VPS deployment via SSH action

---

## Critical Findings (Must Fix)

### C1) XSS risk + token storage = account takeover (admin/ops/garage dashboards)

**Why it matters:** If any user-controlled string is rendered unsafely, an attacker can inject JS, steal dashboard tokens from `localStorage`, then perform privileged API actions (approvals, payouts, refunds, etc.).

**Evidence:**
- CSP explicitly allows inline scripts and inline event handlers: `src/middleware/security.middleware.ts:13` and `src/middleware/security.middleware.ts:16`.
- Admin dashboard persists JWT in `localStorage`: `public/js/admin-dashboard.js:7` and `public/js/admin-dashboard.js:51`.
- Inline scripts/handlers exist in dashboards (forces `'unsafe-inline'`/`script-src-attr`): `public/admin-dashboard.html:15`.
- Widespread `innerHTML` rendering across dashboards (needs consistent escaping + avoid inline JS contexts): `public/js/admin-dashboard.js:237`, `public/js/operations-dashboard.js:884`.

**Required remediation (recommended order):**
1) Remove inline handlers (`onclick=...`) and inline scripts from dashboard HTML; bind events via JS modules.  
2) Implement strict CSP: remove `'unsafe-inline'` and `script-src-attr` entirely; migrate JSON-LD to external files or use hashes/nonces.  
3) Stop storing privileged tokens in `localStorage` for admin/ops; move to **httpOnly secure cookies** (or short-lived session tokens + re-auth).  
4) Replace string templating + `innerHTML` with DOM APIs or a safe templating layer; where unavoidable, use context-correct escaping (HTML vs attribute vs URL vs JS string).

---

### C2) Manual job trigger endpoint can become public in production

**Why it matters:** Jobs include payouts/subscription renewals/data cleanup. An attacker triggering them can cause financial and integrity damage.

**Evidence:**
- Route is exposed publicly (outside `/api`) in `src/app.ts:155`.
- Auth check is conditional and can silently allow access when `ADMIN_API_KEY` is missing in production: `src/controllers/health.controller.ts:221`.
- Triggered functions include payouts/subscription processing: `src/config/jobs.ts:33`.

**Required remediation:**
- In production: **disable the endpoint entirely** or require `authenticate` + `admin` role **and** an IP allowlist.  
- Enforce startup validation: if endpoint exists, require `ADMIN_API_KEY` be set; otherwise fail fast.

---

### C3) Audit log middleware is effectively disabled (no compliance trail)

**Why it matters:** You believe you have an audit trail but the middleware skips logging due to Express mount behavior.

**Evidence:**
- Mounted at `/api`: `src/app.ts:89`.
- Middleware checks `req.path.startsWith('/api')` and returns early, but when mounted on `/api`, `req.path` is typically `/auth/login`, `/v1/...`, etc: `src/middleware/auditLog.middleware.ts:119`.

**Required remediation:**
- Use `req.originalUrl` or `req.baseUrl + req.path` consistently, or remove the `req.path.startsWith('/api')` guard.

---

### C4) Registration transaction can commit partial state (user created, refresh token insert fails)

**Why it matters:** Reliability + security posture (stuck accounts / inconsistent auth state). If refresh token insert fails, the user exists but registration fails; retry becomes impossible without admin intervention.

**Evidence:** `src/services/auth/auth.service.ts:58`–`src/services/auth/auth.service.ts:105` commits before refresh token insert, and the catch block always attempts `ROLLBACK`.

**Required remediation:**
- Keep the refresh token insert inside the same transaction; only `COMMIT` after all inserts succeed.  
- Guard rollback attempts (or restructure so errors after commit don’t call rollback).

---

## High Priority Findings (Fix Next)

### H1) Production logs & stack traces are committed to the repo

**Why it matters:** This is a security + privacy + compliance risk (IPs, internal paths, request identifiers, operational behavior). Even if it doesn’t currently include secrets, it sets a dangerous precedent.

**Evidence (tracked files):**
- `vps_raw_logs.txt`, `vps_raw_logs_v2.txt`, `vps_stack_trace.txt`, `vps_logs_report.txt`
- `test_output.txt`, `test_output_webhook_fixed_4.txt`

**Remediation:**
- Remove these files from git history (or at minimum from current tree) and add patterns to `.gitignore`.  
- Store operational logs in your logging/monitoring system (Sentry/ELK/CloudWatch/etc.), not in source control.

---

### H2) Exposed Google Maps API key in mobile app configs (restrict + rotate)

**Why it matters:** Google API keys are “public” on mobile but must be locked down. If unrestricted, they can be abused and run up bills.

**Evidence:**
- `driver-mobile/app.json:55` contains a Maps key.
- `mobile/app.config.js:79` has a fallback key.

**Remediation:**
- Restrict by Android package + SHA-1, iOS bundle ID, and enabled API list; rotate if restrictions were not previously applied.

---

### H3) Swagger UI exposed in production with `persistAuthorization`

**Why it matters:** Increases attack surface and can store tokens in the browser. Also advertises endpoints to attackers.

**Evidence:** `src/config/swagger.ts:503`–`src/config/swagger.ts:520` mounts `/api/docs` and enables `persistAuthorization`.

**Remediation:**
- Disable in production or require admin auth + internal IP allowlist; set `persistAuthorization: false`.

---

### H4) Sentry performance sampling at 100%

**Why it matters:** Cost + potential PII leakage if request bodies/headers are captured.

**Evidence:** `src/config/sentry.ts:15`–`src/config/sentry.ts:20`.

**Remediation:** Reduce `tracesSampleRate` (e.g., 0.05–0.2) and configure PII scrubbing.

---

## Medium Priority Improvements

- **Request body limits too high:** `src/app.ts:72` and `src/app.ts:73` allow 50MB JSON/urlencoded; reduce and use per-route limits for uploads.
- **Cache headers conflict:** global `no-store` headers (`src/middleware/security.middleware.ts:54`) vs asset caching (`src/app.ts:103`) — align strategy.
- **Rate limiting is in-memory and partial:** add a global limiter and Redis-backed store for multi-node safety.
- **Dependencies:** `npm audit --omit=dev` currently reports High issues (notably `minimatch` transitive); upgrade dependencies and re-run CI security gates.
- **Remove unused deps:** `compression`, `express-validator`, `connect-redis`, `express-session`, `handlebars`, `kysely` config (`src/config/kysely.ts`) appears unused — trim attack surface.
- **Accessibility:** missing `alt` attributes and inconsistent ARIA (e.g., `public/index.html:842`, `public/partners.html:2973`) — work toward WCAG 2.1 AA.

---

## Suggested 7-Day Remediation Plan (Practical)

Day 1–2:
- Lock down or remove manual job trigger endpoints (C2).
- Fix audit logging mount bug (C3).
- Remove tracked VPS logs from repo (H1).

Day 3–5:
- Remove inline handlers/scripts from dashboards; centralize event binding (C1).
- Add strict CSP in “report-only” mode first; iterate until no violations; then enforce.

Day 6–7:
- Move admin/ops auth to httpOnly cookies (or equivalent hardening).
- Reduce body size limits; align cache headers.

---

## Notes

- Compared to `COMPREHENSIVE-AUDIT-REPORT-2026.md` (2026-02-20), some items appear improved (e.g., order creation uses explicit DB transactions). This document focuses on **current, high-impact risk** as of 2026-02-24.

