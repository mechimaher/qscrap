# QScrap Centralized Audit Log (Strict Output Format)

## Instructions
- Every finding must use this template:

---
### Problem
Clear and precise description (in English and Arabic if possible)

### Impact
Performance / UX / Business loss

### Root Cause
Code / design / architecture

### Fix
Concrete (code-level or system-level)

### Expected Gain
Quantified (e.g., “API latency reduced from 480ms → 90ms”)
---

## Example Entry

---
### Problem
RFQ API takes 620ms (بطء في واجهة طلب عرض السعر)

### Impact
High latency reduces conversion rate and user satisfaction

### Root Cause
7 sequential DB queries, missing index

### Fix
Add composite index, merge queries, introduce caching

### Expected Gain
API latency reduced from 620ms → 110ms
---

## Audit Log Entries

---
### Problem
XSS risk in dashboards (inline scripts, tokens in localStorage)

### Impact
Critical security risk: possible admin/ops account takeover, business loss

### Root Cause
CSP allows inline scripts/handlers; tokens stored in localStorage; unsafe innerHTML rendering

### Fix
Remove inline handlers/scripts, implement strict CSP, move tokens to httpOnly cookies, replace innerHTML with safe DOM APIs

### Expected Gain
Eliminate XSS risk, block account takeover, enable enterprise-readiness
---

---
### Problem
Manual job trigger endpoint exposed in production

### Impact
High risk: attacker can trigger payouts, renewals, or data cleanup, causing financial/integrity damage

### Root Cause
Endpoint exposed publicly, weak/missing auth, no IP allowlist

### Fix
Disable endpoint in production or require strict auth + IP allowlist; enforce ADMIN_API_KEY presence

### Expected Gain
Prevents unauthorized job execution, protects business operations
---

---
### Problem
Audit log middleware disabled (no compliance trail)

### Impact
No compliance/audit trail, regulatory and trust risk

### Root Cause
Middleware mount logic skips logging due to Express path handling

### Fix
Use req.originalUrl or consistent path checks; remove faulty guard

### Expected Gain
Restores audit trail, improves compliance and accountability
---

---
### Problem
Registration transaction can commit partial state (user created, refresh token insert fails)

### Impact
Inconsistent auth state, stuck accounts, failed registrations

### Root Cause
Refresh token insert outside transaction, commit before all inserts

### Fix
Keep all inserts in one transaction, commit only after success

### Expected Gain
Atomic registration, no stuck accounts, improved reliability
---

---
### Problem
Production logs and stack traces committed to repo

### Impact
Security, privacy, and compliance risk (leak of IPs, paths, operational data)

### Root Cause
Logs and traces tracked in version control

### Fix
Remove logs from repo, add to .gitignore, rotate credentials if needed

### Expected Gain
Reduced attack surface, improved compliance
---

---
### Problem
Unoptimized CSS, JS, and images increase load times

### Impact
Slower FCP/LCP, higher bounce rates, poor mobile experience

### Root Cause
No minification, duplicate/unused code, unoptimized images

### Fix
Minify CSS/JS, optimize images (WebP), extract critical CSS, enable service worker caching

### Expected Gain
CSS: ~40% smaller, JS: ~50% smaller, Images: ~30% smaller, 68% faster FCP, offline support
---

---
### Problem
Exposed Google Maps API keys in mobile app configs

### Impact
Potential for abuse, unexpected billing, and quota exhaustion

### Root Cause
API keys present in driver-mobile/app.json and mobile/app.config.js without restrictions

### Fix
Restrict keys by Android package/SHA-1, iOS bundle ID, and enabled API list; rotate keys if previously unrestricted

### Expected Gain
Prevents unauthorized usage, protects billing and service limits
---

---
### Problem
Swagger UI exposed in production with persistAuthorization enabled

### Impact
Increases attack surface, can store tokens in browser, advertises endpoints to attackers

### Root Cause
Swagger UI mounted in production with persistAuthorization: true

### Fix
Disable in production or require admin auth + internal IP allowlist; set persistAuthorization: false

### Expected Gain
Reduces attack surface, improves API security
---

---
### Problem
Sentry performance sampling at 100%

### Impact
High cost, potential PII leakage if request bodies/headers are captured

### Root Cause
tracesSampleRate set to 1.0 in production

### Fix
Reduce tracesSampleRate (e.g., 0.05–0.2), configure PII scrubbing

### Expected Gain
Lower cost, improved privacy compliance
---

---
### Problem
Request body limits too high (50MB), cache headers conflict, rate limiting is partial/in-memory

### Impact
Potential for DoS, cache inefficiency, and rate limit bypass in multi-node deployments

### Root Cause
Global body size limits, conflicting cache headers, in-memory rate limiter

### Fix
Reduce body size limits, align cache headers, implement Redis-backed/global rate limiting

### Expected Gain
Improved security, cache efficiency, and rate limiting reliability
---

---
### Problem
Unused dependencies and accessibility gaps (missing alt/ARIA)

### Impact
Larger attack surface, increased bundle size, reduced accessibility (WCAG compliance risk)

### Root Cause
Unused packages in dependencies, missing alt attributes and inconsistent ARIA in HTML

### Fix
Remove unused dependencies, add alt attributes, and standardize ARIA usage

### Expected Gain
Smaller, safer codebase, improved accessibility compliance
---

---
### Problem
Performance Benchmarks (pre/post optimization):
- FCP: 2.5s → 0.8s (68% faster)
- LCP: 3.5s → 1.2s (66% faster)
- TTI: 4.0s → 1.5s (62% faster)
- CLS: 0.15 → 0.05 (67% better)
- TBT: 450ms → 150ms (67% faster)
- Total Size: 500 KB → 150 KB (70% smaller)

### Impact
Significantly improved user experience, lower bounce rates, better SEO, and mobile performance

### Root Cause
Comprehensive asset optimization (CSS/JS minification, image WebP, critical CSS, service worker caching)

### Fix
Maintain and enforce optimization pipeline for all deployments

### Expected Gain
Consistently fast, modern, mobile-optimized user experience

---
### Problem
Database schema coverage only 82% (phantom and unused tables)

### Impact
Increased maintenance burden, risk of data drift, wasted storage, and possible confusion for developers

### Root Cause
Legacy/unused tables not cleaned up, phantom tables referenced but not present in production

### Fix
Audit and remove unused/phantom tables, update schema and migration scripts, document all active tables

### Expected Gain
Cleaner schema, reduced risk, easier onboarding and maintenance
---

---
### Problem
Operations Dashboard: No offline mode, missing bulk operations, no search history, no audit trail visibility, modal overload, mouse-dependent workflows

### Impact
Operational inefficiency, increased risk during outages, slower workflows, reduced accountability

### Root Cause
Feature gaps in dashboard implementation, lack of resilience and workflow optimization

### Fix
Implement offline/degraded mode, add bulk operations, search history, audit trail UI, keyboard-first workflows, reduce modal nesting

### Expected Gain
Faster, more resilient, and auditable operations; improved operator satisfaction
---

---
### Problem
Contract tests failing (404 on /api/health); health/job handlers not consolidated

### Impact
API contract not guaranteed, risk of undetected regressions, certification blocked

### Root Cause
Health routes not properly mounted, duplicate/inline handler logic

### Fix
Consolidate health/job handlers in controller, mount routes correctly, ensure contract tests pass

### Expected Gain
API contract compliance, improved reliability, certification readiness

---
### Critical & High-Risk Areas (Initial Prioritization)

1. **Security:**
   - XSS risk in dashboards (inline scripts, tokens in localStorage)
   - Manual job trigger endpoint exposed in production
   - Exposed Google Maps API keys in mobile configs
   - Swagger UI exposed in production
   - Sentry tracesSampleRate at 100% (PII risk)
   - Production logs/stack traces in repo
2. **Logic/Correctness:**
   - Registration transaction can commit partial state
   - Contract tests failing (API health route)
   - Audit log middleware disabled
   - Database schema: phantom/unused tables
3. **Performance:**
   - Unoptimized assets (CSS/JS/images)
   - High request body limits, cache header conflicts
   - In-memory/partial rate limiting
   - Large bundle sizes pre-optimization
4. **Business Flow/UX:**
   - Operations dashboard: no offline mode, missing bulk ops, no audit trail UI, modal overload
   - Mouse-dependent workflows, no keyboard-first navigation
   - No search history/saved filters
5. **Resilience/Infra:**
   - No offline/degraded mode for ops
   - Critical env vars must be set correctly (JWT_SECRET, DB_PASSWORD, etc.)
   - Docker/infra config must match production best practices

---

**See above log for actionable fixes and expected gains for each area.**

---
### Dependencies & Data Flows

- **Backend:** Node.js + TypeScript (Express), PostgreSQL 14, Redis, Socket.IO, BullMQ, Stripe, Sentry, Puppeteer
- **Infrastructure:** Docker containers (backend, DB, cache, Nginx), routed via Cloudflare
- **Critical Env Vars:** JWT_SECRET, DB_PASSWORD, STRIPE_SECRET_KEY, REDIS_PASSWORD, NODE_ENV
- **Payment Flow:** Delivery fee (Stripe, escrow), part price (COD), payout (bank transfer), with state transitions and cancellation scenarios
- **Real-time Flows:** Socket.IO events for requests, bids, orders, QC, disputes, payouts—mapped to user, garage, operations, and support rooms
- **Docs:** See BRAIN.MD, ESCROW-FLOW.md, socket-events.md for diagrams and details

