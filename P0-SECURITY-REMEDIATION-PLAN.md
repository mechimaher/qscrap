# 🔴 P0 SECURITY REMEDIATION PLAN
## Critical Security & Data Integrity Fixes

**Audit Date:** March 5, 2026  
**Priority:** P0 — Block Production Deployment  
**Estimated Effort:** 2-3 weeks  
**Risk Level:** CRITICAL — Must fix before any user acquisition

---

## 📋 EXECUTIVE SUMMARY

This document details 7 critical fixes required before QScrap can safely deploy to production. These fixes address:

1. **6 Security Vulnerabilities** — XSS, CSRF, authentication, and resource exhaustion risks
2. **1 Data Integrity Gap** — Missing ACID transactions for payment/escrow operations

**Total Effort:** 10-12 developer days  
**Testing Required:** Security audit, penetration testing, integration tests

---

## 🎯 REMEDIATION ITEMS

| # | Issue | Severity | Effort | Status |
|---|-------|----------|--------|--------|
| 1 | CSP `'unsafe-inline'` | 🔴 CRITICAL | 2 days | ⏳ Pending |
| 2 | Missing JWT payload validation | 🔴 CRITICAL | 1 day | ⏳ Pending |
| 3 | CSRF token not validated | 🔴 CRITICAL | 3 days | ⏳ Pending |
| 4 | No database circuit breaker | 🔴 CRITICAL | 2 days | ⏳ Pending |
| 5 | Missing ACID transactions | 🔴 CRITICAL | 5 days | ⏳ Pending |
| 6 | 50MB request size limit | 🟠 HIGH | 0.5 days | ⏳ Pending |
| 7 | Homepage missing Arabic i18n | 🟠 HIGH | 0.5 days | ⏳ Pending |

---

## 1. CSP `'unsafe-inline'` FIX

### Problem
**File:** `src/middleware/security.middleware.ts` (Lines 14-22)

Current CSP allows `'unsafe-inline'` for scripts and styles, enabling XSS attacks via injected inline scripts.

```typescript
// ❌ VULNERABLE
styleSrc: ["'self'", "'unsafe-inline'", ...]
scriptSrc: ["'self'", "'unsafe-inline'", ...]
scriptSrcAttr: ["'unsafe-inline'"]  // Allows onclick handlers
```

### Impact
- **Severity:** CRITICAL
- **Attack Vector:** XSS via injected `<script>` tags or `onclick` handlers
- **Affected Pages:** All vanilla HTML dashboards with inline scripts

### Solution: Nonce-Based CSP

**Step 1: Add nonce generation middleware**

```typescript
// src/middleware/csp-nonce.middleware.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
    namespace Express {
        interface Locals {
            cspNonce?: string;
        }
    }
}

export const cspNonceMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Generate cryptographically secure nonce for each request
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
};
```

**Step 2: Update CSP configuration**

```typescript
// src/middleware/security.middleware.ts
import { cspNonceMiddleware } from './csp-nonce.middleware';

export const securityMiddleware = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
                "'self'",
                (req) => `'nonce-${(req as any).res.locals.cspNonce}'`,
                "https://fonts.googleapis.com",
                "https://cdn.jsdelivr.net",
                "https://unpkg.com"
            ],
            scriptSrc: [
                "'self'",
                (req) => `'nonce-${(req as any).res.locals.cspNonce}'`,
                "https://unpkg.com",
                "https://cdn.jsdelivr.net",
                "https://cdn.socket.io",
                "https://static.cloudflareinsights.com",
                "https://maps.googleapis.com",
                "https://js.stripe.com",
                "https://browser.sentry-cdn.com"
            ],
            scriptSrcAttr: ["'none'"],  // Block all inline event handlers
            // ... rest of directives
        }
    }
});
```

**Step 3: Add nonce to HTML templates**

```typescript
// src/app.ts - After security middleware
app.use(cspNonceMiddleware);

// For static HTML files served by Express, inject nonce via template engine
// OR add nonce to inline scripts in HTML files:
// <script nonce="<%= locals.cspNonce %>">...</script>
```

**Step 4: Dashboard inline script migration**

For vanilla dashboards, either:
- **Option A:** Extract inline scripts to external `.js` files (recommended)
- **Option B:** Use build process to inject nonce into HTML files

```html
<!-- ❌ Before -->
<script>
    function handleClick() { ... }
</script>

<!-- ✅ After -->
<script src="/js/dashboard.js"></script>

<!-- Or with nonce (if build process injects it) -->
<script nonce="REPLACE_WITH_NONCE">
    function handleClick() { ... }
</script>
```

### Testing
```bash
# 1. Run security scan
npm run security:scan

# 2. Test all dashboard functionality
# 3. Verify CSP headers
curl -I https://api.qscrap.qa/health
# Check: Content-Security-Policy header should NOT contain 'unsafe-inline'

# 4. Test XSS protection
# Attempt to inject <script>alert('xss')</script> in forms
```

### Files to Modify
- `src/middleware/security.middleware.ts`
- `src/middleware/csp-nonce.middleware.ts` (NEW)
- `src/app.ts`
- All HTML dashboards (extract inline scripts)

---

## 2. JWT PAYLOAD VALIDATION

### Problem
**File:** `src/middleware/auth.middleware.ts` (Lines 18-35)

Current JWT validation doesn't verify all required claims, risking runtime errors from malformed tokens.

### Impact
- **Severity:** CRITICAL
- **Risk:** Runtime crashes from missing `userId` or `userType`
- **Attack Vector:** Malformed token claims

### Solution: Comprehensive Claim Validation

```typescript
// src/middleware/auth.middleware.ts
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Invalid authorization header format' });
    }

    try {
        const payload = jwt.verify(token, getJwtSecret()) as AuthPayload;

        // ✅ VALIDATE REQUIRED CLAIMS
        if (!payload.userId) {
            logger.warn('JWT missing userId claim', { tokenPrefix: token.substring(0, 10) });
            return res.status(401).json({
                error: 'invalid_token',
                message: 'Token missing required userId claim'
            });
        }

        if (!payload.userType) {
            logger.warn('JWT missing userType claim', { tokenPrefix: token.substring(0, 10) });
            return res.status(401).json({
                error: 'invalid_token',
                message: 'Token missing required userType claim'
            });
        }

        // ✅ VALIDATE CLAIM TYPES
        if (typeof payload.userId !== 'string') {
            return res.status(401).json({
                error: 'invalid_token',
                message: 'userId claim must be a string'
            });
        }

        if (typeof payload.userType !== 'string') {
            return res.status(401).json({
                error: 'invalid_token',
                message: 'userType claim must be a string'
            });
        }

        // ✅ VALIDATE USER TYPE ENUM
        const validUserTypes = ['customer', 'garage', 'driver', 'admin', 'operations', 'support', 'finance', 'staff'];
        if (!validUserTypes.includes(payload.userType.toLowerCase())) {
            logger.warn('JWT invalid userType', { userType: payload.userType });
            return res.status(401).json({
                error: 'invalid_token',
                message: 'Token has invalid userType claim'
            });
        }

        // ✅ VALIDATE STAFF ROLE (IF PRESENT)
        if (payload.staffRole !== undefined) {
            if (typeof payload.staffRole !== 'string') {
                return res.status(401).json({
                    error: 'invalid_token',
                    message: 'staffRole claim must be a string'
                });
            }

            const validStaffRoles = ['admin', 'superadmin', 'operations', 'support', 'cs_admin'];
            if (!validStaffRoles.includes(payload.staffRole.toLowerCase())) {
                return res.status(401).json({
                    error: 'invalid_token',
                    message: 'Token has invalid staffRole claim'
                });
            }
        }

        req.user = payload;
        next();
    } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'token_expired',
                message: 'Access token has expired. Use /auth/refresh to get a new one.'
            });
        }

        logger.error('JWT verification failed', { error: err.message });
        res.status(401).json({
            error: 'invalid_token',
            message: 'Invalid or malformed token'
        });
    }
};
```

### Testing
```bash
# 1. Unit tests for auth middleware
npm test -- src/middleware/__tests__/auth.middleware.test.ts

# 2. Test with malformed tokens
# 3. Test with expired tokens
# 4. Test with missing claims
```

### Files to Modify
- `src/middleware/auth.middleware.ts`

---

## 3. CSRF TOKEN VALIDATION

### Problem
**File:** `src/middleware/csrf.middleware.ts`

Current implementation only validates origin header, not actual CSRF tokens. This is insufficient protection against sophisticated CSRF attacks.

### Impact
- **Severity:** CRITICAL
- **Risk:** Cross-site request forgery on state-changing operations
- **Affected Endpoints:** All POST/PUT/PATCH/DELETE without proper token validation

### Solution: Double-Submit Cookie Pattern (Enhanced)

The current implementation is mostly correct but needs enhancement:

```typescript
// src/middleware/csrf.middleware.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate CSRF token
 */
const generateCsrfToken = (): string => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Middleware to ensure CSRF token exists in cookie
 */
export const ensureCsrfToken = (req: Request, res: Response, next: NextFunction) => {
    if (!req.cookies[CSRF_COOKIE_NAME]) {
        const token = generateCsrfToken();
        const isProduction = process.env.NODE_ENV === 'production';

        res.cookie(CSRF_COOKIE_NAME, token, {
            httpOnly: false,  // Must be readable by JS to send in header
            secure: isProduction,
            sameSite: 'strict',  // Changed from 'lax' for better protection
            path: '/',
            maxAge: 24 * 60 * 60 * 1000  // 24 hours
        });

        req.cookies[CSRF_COOKIE_NAME] = token;
    }
    next();
};

/**
 * Validates CSRF token with enhanced security
 */
export const validateCsrfToken = (req: Request, res: Response, next: NextFunction) => {
    // Skip for safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    // Skip for API routes with Bearer token (JWT auth)
    // CSRF primarily affects cookie-based sessions
    const hasAuthHeader = req.headers.authorization?.startsWith('Bearer ');
    if (hasAuthHeader) {
        // Still validate origin for defense-in-depth
        return validateOrigin(req, res, next);
    }

    const cookieToken = req.cookies[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME];

    // Skip for public routes
    const publicRoutes = [
        '/auth/login',
        '/auth/register',
        '/auth/register/garage',
        '/auth/refresh',
        '/config/public'
    ];

    if (publicRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }

    // ✅ ENHANCED VALIDATION
    if (!cookieToken) {
        logger.warn('CSRF validation failed: Missing cookie token', {
            path: req.path,
            method: req.method,
            ip: req.ip
        });
        return res.status(403).json({
            error: 'csrf_missing',
            message: 'CSRF token missing from cookie'
        });
    }

    if (!headerToken) {
        logger.warn('CSRF validation failed: Missing header token', {
            path: req.path,
            method: req.method,
            ip: req.ip
        });
        return res.status(403).json({
            error: 'csrf_missing',
            message: 'CSRF token missing from request header'
        });
    }

    // ✅ CONSTANT-TIME COMPARISON (prevent timing attacks)
    const cookieBuffer = Buffer.from(cookieToken, 'hex');
    const headerBuffer = Buffer.from(headerToken, 'hex');

    if (cookieBuffer.length !== headerBuffer.length || !crypto.timingSafeEqual(cookieBuffer, headerBuffer)) {
        logger.warn('CSRF validation failed: Token mismatch', {
            path: req.path,
            method: req.method,
            ip: req.ip
        });
        return res.status(403).json({
            error: 'csrf_invalid',
            message: 'CSRF token validation failed'
        });
    }

    next();
};

/**
 * Origin validation (defense-in-depth)
 */
const getAllowedOrigins = (): string[] => {
    const defaults = ['https://qscrap.qa', 'https://www.qscrap.qa'];
    return process.env.CORS_ORIGINS
        ? [...process.env.CORS_ORIGINS.split(',').map(o => o.trim()), ...defaults]
        : defaults;
};

export const validateOrigin = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin as string | undefined;
    const allowed = getAllowedOrigins();

    const publicRoutes = ['/auth/login', '/auth/register', '/config/public'];
    if (publicRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }

    if (origin && !allowed.includes(origin) && process.env.NODE_ENV === 'production') {
        logger.warn('Origin validation failed', { origin, path: req.path });
        return res.status(403).json({ error: 'invalid_origin' });
    }

    next();
};
```

### Frontend Integration

```javascript
// public/js/csrf-setup.js
// Get CSRF token from cookie
function getCsrfToken() {
    const name = 'XSRF-TOKEN' + '=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const parts = decodedCookie.split(';');
    for (let part of parts) {
        if (part.trim().startsWith(name)) {
            return part.trim().substring(name.length);
        }
    }
    return null;
}

// Add to all fetch requests
const originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
    const csrfToken = getCsrfToken();
    if (csrfToken && options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method)) {
        options.headers = {
            ...options.headers,
            'x-csrf-token': csrfToken
        };
    }
    return originalFetch(url, options);
};
```

### Testing
```bash
# 1. Test CSRF protection
# Attempt POST without token - should fail with 403
curl -X POST https://api.qscrap.qa/api/orders \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# 2. Test with valid token - should succeed
# 3. Test with invalid token - should fail
```

### Files to Modify
- `src/middleware/csrf.middleware.ts`
- `public/js/csrf-setup.js` (NEW)
- All dashboard JS files (add CSRF token to requests)

---

## 4. DATABASE CIRCUIT BREAKER

### Problem
**File:** `src/config/db.ts`

Current implementation has basic error handling but no proper circuit breaker pattern to prevent cascade failures during database outages.

### Impact
- **Severity:** CRITICAL
- **Risk:** Pool exhaustion crashes entire platform
- **Scenario:** DB slowdown → connections pile up → all requests hang → cascade failure

### Solution: Circuit Breaker Pattern

```typescript
// src/config/db.ts
import { Pool, PoolConfig } from 'pg';
import * as dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

// ============================================
// CIRCUIT BREAKER CONFIGURATION
// ============================================

interface CircuitBreakerState {
    failures: number;
    lastFailureTime: number | null;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    nextRetryTime: number | null;
}

const CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5,      // Open circuit after 5 failures
    successThreshold: 3,      // Close circuit after 3 successes
    timeout: 30000,           // 30s before retry (OPEN → HALF_OPEN)
    monitoringWindow: 60000,  // 1min window for failure counting
};

const circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: null,
    state: 'CLOSED',
    nextRetryTime: null,
};

// ============================================
// ENHANCED POOL CONFIGURATION
// ============================================

const isTestEnv = process.env.NODE_ENV === 'test';

const poolConfig: PoolConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'qscrap_db',
    port: parseInt(process.env.DB_PORT || '5432'),

    // Connection Pool Tuning
    max: parseInt(process.env.DB_POOL_MAX || (isTestEnv ? '5' : '20')),
    min: parseInt(process.env.DB_POOL_MIN || (isTestEnv ? '0' : '5')),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || (isTestEnv ? '1000' : '30000')),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000'),
    allowExitOnIdle: isTestEnv,

    // Query Timeouts
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),

    // SSL Configuration
    ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : (process.env.DB_SSL === 'false' ? false : undefined)
};

const pool = new Pool(poolConfig);

// ============================================
// CIRCUIT BREAKER LOGIC
// ============================================

const resetCircuitBreaker = () => {
    circuitBreaker.failures = 0;
    circuitBreaker.lastFailureTime = null;
    circuitBreaker.state = 'CLOSED';
    circuitBreaker.nextRetryTime = null;
};

const recordFailure = () => {
    const now = Date.now();

    // Reset failure count if outside monitoring window
    if (circuitBreaker.lastFailureTime &&
        now - circuitBreaker.lastFailureTime > CIRCUIT_BREAKER_CONFIG.monitoringWindow) {
        circuitBreaker.failures = 0;
    }

    circuitBreaker.failures++;
    circuitBreaker.lastFailureTime = now;

    logger.error('Database circuit breaker: Failure recorded', {
        failures: circuitBreaker.failures,
        threshold: CIRCUIT_BREAKER_CONFIG.failureThreshold,
        state: circuitBreaker.state
    });

    // Open circuit if threshold exceeded
    if (circuitBreaker.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
        circuitBreaker.state = 'OPEN';
        circuitBreaker.nextRetryTime = now + CIRCUIT_BREAKER_CONFIG.timeout;

        logger.error('🚨 CIRCUIT BREAKER OPENED - Database connections blocked', {
            nextRetryAt: new Date(circuitBreaker.nextRetryTime).toISOString()
        });

        // Emit alert (integrate with monitoring)
        emitCircuitBreakerAlert('OPEN');
    }
};

const recordSuccess = () => {
    if (circuitBreaker.state === 'HALF_OPEN') {
        circuitBreaker.failures = Math.max(0, circuitBreaker.failures - 1);

        if (circuitBreaker.failures === 0) {
            resetCircuitBreaker();
            logger.info('✅ CIRCUIT BREAKER CLOSED - Database connections restored');
            emitCircuitBreakerAlert('CLOSED');
        }
    }
};

const canAttemptConnection = (): boolean => {
    const now = Date.now();

    switch (circuitBreaker.state) {
        case 'CLOSED':
            return true;

        case 'OPEN':
            if (circuitBreaker.nextRetryTime && now >= circuitBreaker.nextRetryTime) {
                circuitBreaker.state = 'HALF_OPEN';
                logger.warn('⚠️ CIRCUIT BREAKER HALF-OPEN - Testing database connection');
                return true;
            }
            return false;

        case 'HALF_OPEN':
            return true;

        default:
            return false;
    }
};

const emitCircuitBreakerAlert = (state: string) => {
    // Integrate with monitoring (Sentry, DataDog, etc.)
    logger.error('Circuit breaker state change', {
        state,
        timestamp: new Date().toISOString()
    });

    // TODO: Send to monitoring service
    // Sentry.captureMessage(`Database circuit breaker ${state}`, { level: state === 'OPEN' ? 'error' : 'info' });
};

// ============================================
// ERROR HANDLING
// ============================================

pool.on('error', (err) => {
    recordFailure();

    logger.error('Database pool error', {
        error: err.message,
        circuitBreakerState: circuitBreaker.state,
        failures: circuitBreaker.failures
    });
});

pool.on('connect', () => {
    if (circuitBreaker.state !== 'CLOSED') {
        recordSuccess();
    }
});

// ============================================
// WRAPPED QUERY FUNCTION WITH CIRCUIT BREAKER
// ============================================

export const queryWithCircuitBreaker = async (text: string, params?: any[]) => {
    if (!canAttemptConnection()) {
        const waitTime = circuitBreaker.nextRetryTime
            ? Math.round((circuitBreaker.nextRetryTime - Date.now()) / 1000)
            : 0;

        throw new Error(
            `Database circuit breaker OPEN. Retry in ${waitTime}s. ` +
            `Contact ops if persistent.`
        );
    }

    const startTime = Date.now();

    try {
        const result = await pool.query(text, params);
        recordSuccess();

        // Log slow queries
        const duration = Date.now() - startTime;
        if (duration > 5000) {
            logger.warn('Slow database query', {
                duration,
                query: text.substring(0, 100)
            });
        }

        return result;
    } catch (error) {
        recordFailure();
        throw error;
    }
};

// ============================================
// HEALTH CHECK
// ============================================

export const getPoolHealth = () => {
    return {
        circuitBreaker: {
            state: circuitBreaker.state,
            failures: circuitBreaker.failures,
            threshold: CIRCUIT_BREAKER_CONFIG.failureThreshold,
            nextRetryTime: circuitBreaker.nextRetryTime
                ? new Date(circuitBreaker.nextRetryTime).toISOString()
                : null
        },
        pool: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount
        }
    };
};

// ... rest of existing code (closeAllPools, etc.)
```

### Testing
```bash
# 1. Simulate database failure
# 2. Verify circuit opens after 5 failures
# 3. Verify requests are rejected while OPEN
# 4. Verify HALF_OPEN state after timeout
# 5. Verify CLOSED state after successful connection
```

### Files to Modify
- `src/config/db.ts`
- Update all service files to use `queryWithCircuitBreaker` instead of `pool.query`

---

## 5. ACID TRANSACTIONS FOR PAYMENT/ESCROW

### Problem
**Files:**
- `src/services/payment/payment.service.ts`
- `src/services/escrow.service.ts`
- `src/services/finance/payout.service.ts`

Critical payment operations are not wrapped in proper database transactions, risking data corruption from partial failures.

### Impact
- **Severity:** CRITICAL
- **Risk:** Stripe charge succeeds but DB write fails = financial desync
- **Scenario:** Customer charged, order not updated = support nightmare + revenue loss

### Solution: Transaction Wrapping

The payment service already has some transaction handling. Let's enhance it:

```typescript
// src/services/payment/payment.service.ts
// ✅ ALREADY HAS TRANSACTIONS - Verify all methods use them

async createDeliveryFeeDeposit(
    orderId: string,
    customerId: string,
    deliveryFee: number,
    currency: string = 'QAR'
): Promise<DepositResult> {
    const client = await this.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Create payment intent
        const intent = await this.provider.createPaymentIntent({
            amount: deliveryFee,
            currency,
            customerId,
            orderId,
            description: `QScrap Delivery Fee - Order ${orderId}`,
            metadata: { type: 'delivery_fee_deposit', orderId, customerId }
        });

        // 2. Store in database
        await client.query(`
            INSERT INTO payment_intents
            (intent_id, order_id, customer_id, amount, currency, intent_type, provider, provider_intent_id, provider_client_secret, status)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, 'deposit', $5, $6, $7, $8)
        `, [orderId, customerId, deliveryFee, currency, this.provider.providerName, intent.id, intent.clientSecret, intent.status]);

        // 3. Update order
        await client.query(`
            UPDATE orders
            SET deposit_amount = $2, deposit_status = 'pending', payment_method = 'card'
            WHERE order_id = $1
        `, [orderId, deliveryFee]);

        await client.query('COMMIT');
        return { intentId: intent.id, clientSecret: intent.clientSecret, amount: deliveryFee, currency, status: intent.status };

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Payment transaction failed', { orderId, error });
        throw error;
    } finally {
        client.release();
    }
}
```

**Verify these methods also use transactions:**

```typescript
// src/services/escrow.service.ts
async createEscrow(params: {...})  // ✅ Uses transaction
async buyerConfirm(escrowId: string, userId: string)  // ✅ Uses transaction
async raiseDispute(escrowId: string, userId: string, reason: string)  // ✅ Uses transaction
async resolveDispute(...)  // ✅ Uses transaction

// src/services/finance/payout-lifecycle.service.ts
async sendPayment(payoutId: string, details: SendPaymentDto)  // ⚠️ VERIFY
async confirmPayment(payoutId: string, garageId: string, details: ConfirmPaymentDto)  // ⚠️ VERIFY
```

**Add transaction wrapper to payout service if missing:**

```typescript
// src/services/finance/payout-lifecycle.service.ts
async sendPayment(payoutId: string, details: SendPaymentDto): Promise<PayoutResult> {
    const client = await this.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Get payout details
        const payoutResult = await client.query(`
            SELECT * FROM garage_payouts WHERE payout_id = $1 FOR UPDATE
        `, [payoutId]);

        if (payoutResult.rows.length === 0) {
            throw new Error('Payout not found');
        }

        const payout = payoutResult.rows[0];

        if (payout.status !== 'pending') {
            throw new Error(`Payout already ${payout.status}`);
        }

        // 2. Process payment
        const paymentResult = await this.processPaymentInternal(client, payout, details);

        // 3. Update payout status
        await client.query(`
            UPDATE garage_payouts
            SET status = 'sent', sent_at = NOW(), payment_reference = $2
            WHERE payout_id = $1
        `, [payoutId, paymentResult.reference]);

        // 4. Create audit log
        await client.query(`
            INSERT INTO audit_logs (entity_type, entity_id, action, details, created_at)
            VALUES ('payout', $1, 'send', $2, NOW())
        `, [payoutId, JSON.stringify({ sentBy: details.sentBy, amount: payout.amount })]);

        await client.query('COMMIT');

        return { success: true, payoutId, reference: paymentResult.reference };

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Payout transaction failed', { payoutId, error });
        throw error;
    } finally {
        client.release();
    }
}
```

### Testing
```bash
# 1. Integration tests for payment flows
npm test -- tests/integration/payment-flows.test.ts

# 2. Simulate failures at each step
# 3. Verify rollback occurs correctly
# 4. Verify no orphaned records
```

### Files to Verify/Modify
- `src/services/payment/payment.service.ts` ✅ Already has transactions
- `src/services/escrow.service.ts` ✅ Already has transactions
- `src/services/finance/payout-lifecycle.service.ts` ⚠️ Verify
- `src/services/finance/payout-admin.service.ts` ⚠️ Verify

---

## 6. REQUEST SIZE LIMIT REDUCTION

### Problem
**File:** `src/app.ts` (Line 73)

```typescript
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
```

50MB is excessive and creates a resource exhaustion vector.

### Impact
- **Severity:** HIGH
- **Risk:** DoS via large payload attacks
- **Standard:** 5MB for general APIs, 10MB for file uploads

### Solution

```typescript
// src/app.ts

// General API routes: 5MB limit
app.use('/api', express.json({ limit: '5mb' }));
app.use('/api', express.urlencoded({ extended: true, limit: '5mb' }));

// File upload routes: 10MB limit (configured in upload middleware)
// See: src/middleware/upload.middleware.ts
```

### Files to Modify
- `src/app.ts`

---

## 7. HOMEPAGE ARABIC I18N

### Problem
**File:** `public/js/homepage.js`

Homepage has language toggle UI but no translation logic, excluding 60% of Qatar market.

### Impact
- **Severity:** HIGH
- **Risk:** 60% market exclusion (Arabic speakers)
- **Effort:** 4 hours

### Solution

```javascript
// public/js/homepage.js

// ===== 2026 BILINGUAL I18N SYSTEM =====
const translations = {
    en: {
        // Navigation
        'nav.howItWorks': 'How It Works',
        'nav.gallery': 'Gallery',
        'nav.forBusiness': 'For Businesses',
        'nav.about': 'About',
        'nav.download': 'Download App',
        'nav.requestPart': 'Request a Part',

        // Hero
        'hero.badge': "Qatar's #1 Auto Parts Platform",
        'hero.title1': "Qatar's Premium",
        'hero.title2': 'Automotive Parts',
        'hero.title3': 'Marketplace',
        'hero.subtitle': 'New • Used • Genuine OEM — Delivered Same Day',
        'hero.cta1': 'Request a Part Now',
        'hero.cta2': 'Download App',

        // Stats
        'hero.stat1.value': '5,000+',
        'hero.stat1.label': 'Parts Delivered',
        'hero.stat2.value': '50+',
        'hero.stat2.label': 'Verified Garages',
        'hero.stat3.value': '4.8★',
        'hero.stat3.label': 'Customer Rating',

        // Steps
        'steps.badge': 'How It Works',
        'steps.title': 'Simple. Fast. Reliable.',
        'steps.subtitle': 'Get the parts you need in 4 easy steps',
        'step1.title': 'Request',
        'step1.desc': 'Describe the part you need with photos and car details.',
        'step2.title': 'Compare Bids',
        'step2.desc': 'Receive competitive quotes from verified garages.',
        'step3.title': 'Pay Securely',
        'step3.desc': 'Card payment or Cash on Delivery. Money protected.',
        'step4.title': 'Receive at Door',
        'step4.desc': 'Track your order and receive it at your doorstep.',

        // Value Props
        'values.badge': 'Why QScrap?',
        'values.title': 'The Premium Choice',
        'value1.title': 'Verified Garages',
        'value1.desc': 'All partners are MOCI-certified and background-checked.',
        'value2.title': 'Best Prices',
        'value2.desc': 'Competitive bidding ensures you get the best deal.',
        'value3.title': 'Same-Day Delivery',
        'value3.desc': 'Fast delivery across Qatar with real-time tracking.',
        'value4.title': 'Buyer Protection',
        'value4.desc': '7-day warranty and secure escrow payments.',
        'value5.title': '24/7 Support',
        'value5.desc': 'Dedicated support team always ready to help.',
        'value6.title': 'Loyalty Rewards',
        'value6.desc': 'Earn points on every order and redeem for discounts.',

        // App CTA
        'app.badge': 'Mobile App',
        'app.title': 'Download the QScrap App',
        'app.subtitle': 'Get the best experience with our mobile app',
        'app.ios': 'Download on iOS',
        'app.android': 'Get it on Android',

        // Footer
        'footer.about': 'About',
        'footer.careers': 'Careers',
        'footer.privacy': 'Privacy Policy',
        'footer.terms': 'Terms of Service',
        'footer.contact': 'Contact Us',
        'footer.email': 'support@qscrap.qa',
        'footer.phone': '+974 7040 3396',
        'footer.copyright': '© 2026 QScrap. All rights reserved.',
        'footer.company': 'Spark Tech and Services L.L.C'
    },

    ar: {
        // Navigation
        'nav.howItWorks': 'كيف يعمل',
        'nav.gallery': 'المعرض',
        'nav.forBusiness': 'للشركات',
        'nav.about': 'من نحن',
        'nav.download': 'حمّل التطبيق',
        'nav.requestPart': 'اطلب قطعة',

        // Hero
        'hero.badge': 'منصة قطع غيار السيارات الأولى في قطر',
        'hero.title1': 'سوق قطر المتميز',
        'hero.title2': 'لقطع غيار',
        'hero.title3': 'السيارات',
        'hero.subtitle': 'جديد • مستعمل • أصلي — توصيل في نفس اليوم',
        'hero.cta1': 'اطلب قطعة الآن',
        'hero.cta2': 'حمّل التطبيق',

        // Stats
        'hero.stat1.value': '+5,000',
        'hero.stat1.label': 'قطعة تم توصيلها',
        'hero.stat2.value': '+50',
        'hero.stat2.label': 'كراج معتمد',
        'hero.stat3.value': '4.8★',
        'hero.stat3.label': 'تقييم العملاء',

        // Steps
        'steps.badge': 'كيف يعمل',
        'steps.title': 'بسيط. سريع. موثوق.',
        'steps.subtitle': 'احصل على القطع التي تحتاجها في 4 خطوات سهلة',
        'step1.title': 'اطلب',
        'step1.desc': 'صِف القطعة التي تحتاجها مع الصور وتفاصيل سيارتك.',
        'step2.title': 'قارن العروض',
        'step2.desc': 'احصل على عروض تنافسية من الكراجات المعتمدة.',
        'step3.title': 'ادفع بأمان',
        'step3.desc': 'دفع بالبطاقة أو عند الاستلام. أموالك محمية.',
        'step4.title': 'استلم عند الباب',
        'step4.desc': 'تتبع طلبك واستلمه عند بابك.',

        // Value Props
        'values.badge': 'لماذا QScrap؟',
        'values.title': 'الخيار المتميز',
        'value1.title': 'كراجات معتمدة',
        'value1.desc': 'جميع الشركاء معتمدون من التجارة وخضعوا لفحص.',
        'value2.title': 'أفضل الأسعار',
        'value2.desc': 'العروض التنافسية تضمن لك أفضل سعر.',
        'value3.title': 'توصيل في نفس اليوم',
        'value3.desc': 'توصيل سريع في جميع أنحاء قطر مع التتبع.',
        'value4.title': 'حماية المشتري',
        'value4.desc': 'ضمان 7 أيام ودفع آمن عبر الضمان.',
        'value5.title': 'دعم 24/7',
        'value5.desc': 'فريق دعم مخصص جاهز دائمًا للمساعدة.',
        'value6.title': 'مكافآت الولاء',
        'value6.desc': 'اكسب نقاطًا على كل طلب واستبدلها بخصومات.',

        // App CTA
        'app.badge': 'التطبيق',
        'app.title': 'حمّل تطبيق QScrap',
        'app.subtitle': 'احصل على أفضل تجربة مع تطبيقنا',
        'app.ios': 'تحميل على iOS',
        'app.android': 'متاح على Android',

        // Footer
        'footer.about': 'من نحن',
        'footer.careers': 'وظائف',
        'footer.privacy': 'سياسة الخصوصية',
        'footer.terms': 'شروط الخدمة',
        'footer.contact': 'اتصل بنا',
        'footer.email': 'support@qscrap.qa',
        'footer.phone': '+974 7040 3396',
        'footer.copyright': '© 2026 QScrap. جميع الحقوق محفوظة.',
        'footer.company': 'سبارك تك للخدمات ذ.م.م'
    }
};

const i18n = {
    currentLang: localStorage.getItem('qscrap-lang') || 'en',

    init() {
        this.setLanguage(this.currentLang, false);
        this.attachLanguageToggleListeners();
    },

    attachLanguageToggleListeners() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                if (lang && lang !== this.currentLang) {
                    this.setLanguage(lang, true);
                }
            });
        });
    },

    setLanguage(lang, animate = true) {
        this.currentLang = lang;
        localStorage.setItem('qscrap-lang', lang);

        // RTL/LTR toggle
        const html = document.documentElement;
        if (lang === 'ar') {
            html.setAttribute('dir', 'rtl');
            html.setAttribute('lang', 'ar');
            document.body.style.fontFamily = "'Inter', 'Noto Sans Arabic', sans-serif";
        } else {
            html.setAttribute('dir', 'ltr');
            html.setAttribute('lang', 'en');
            document.body.style.fontFamily = "'Inter', -apple-system, sans-serif";
        }

        // Logo swap
        const logoSrc = lang === 'ar'
            ? '/assets/images/qscrap-logo-ar.png?v=2026opt'
            : '/assets/images/qscrap-logo.png?v=2026final';
        document.querySelectorAll('.nav-logo img, .footer-brand img').forEach(img => {
            img.src = logoSrc;
        });

        // Translate all [data-i18n] elements
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const translation = translations[lang][key];
            if (translation) {
                if (animate) {
                    el.style.opacity = '0';
                    setTimeout(() => {
                        el.innerHTML = translation;
                        el.style.opacity = '1';
                    }, 150);
                } else {
                    el.innerHTML = translation;
                }
            }
        });

        // Update button states
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        logger.info(`Language switched to ${lang}`);
    },

    t(key) {
        return translations[this.currentLang][key] || key;
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => i18n.init());
```

**Update `index.html` with `data-i18n` attributes:**

```html
<!-- Example -->
<nav>
    <a href="/about" data-i18n="nav.about">About</a>
    <a href="/request" data-i18n="nav.requestPart">Request a Part</a>
</nav>

<section class="hero">
    <h1 data-i18n="hero.title1">Qatar's Premium</h1>
    <h2 data-i18n="hero.subtitle">New • Used • Genuine OEM</h2>
</section>
```

### Files to Modify
- `public/js/homepage.js` (add i18n system)
- `public/index.html` (add `data-i18n` attributes)

---

## 📅 IMPLEMENTATION TIMELINE

### Week 1: Security Critical
| Day | Task | Owner |
|-----|------|-------|
| Mon-Tue | CSP `'unsafe-inline'` fix | Backend Dev |
| Wed | JWT payload validation | Backend Dev |
| Thu-Fri | CSRF token validation | Backend Dev |

### Week 2: Data Integrity
| Day | Task | Owner |
|-----|------|-------|
| Mon-Tue | Database circuit breaker | Backend Dev |
| Wed-Fri | ACID transaction verification | Backend Dev + QA |

### Week 3: Final Fixes + Testing
| Day | Task | Owner |
|-----|------|-------|
| Mon | Request size limit + Homepage i18n | Backend + Frontend Dev |
| Tue-Thu | Integration testing | QA |
| Fri | Security audit sign-off | Security Team |

---

## ✅ ACCEPTANCE CRITERIA

### Security Fixes
- [ ] CSP rating A+ on securityheaders.com
- [ ] No `'unsafe-inline'` in CSP headers
- [ ] JWT validation rejects malformed tokens
- [ ] CSRF protection blocks requests without valid token
- [ ] Circuit breaker opens after 5 DB failures
- [ ] Request limit reduced to 5MB

### Data Integrity
- [ ] All payment operations wrapped in transactions
- [ ] Rollback verified in failure scenarios
- [ ] No orphaned records in integration tests

### Homepage i18n
- [ ] All text translates to Arabic
- [ ] RTL layout works correctly
- [ ] Language preference persists
- [ ] Logo swaps correctly

---

## 🧪 TESTING REQUIREMENTS

### Unit Tests
```bash
npm test -- src/middleware/__tests__/auth.middleware.test.ts
npm test -- src/middleware/__tests__/csrf.middleware.test.ts
npm test -- src/config/__tests__/db.circuit-breaker.test.ts
```

### Integration Tests
```bash
npm test -- tests/integration/payment-flows.test.ts
npm test -- tests/integration/escrow-flows.test.ts
npm test -- tests/integration/payout-flows.test.ts
```

### Security Tests
```bash
# CSP validation
curl -I https://api.qscrap.qa/health | grep Content-Security-Policy

# CSRF validation
curl -X POST https://api.qscrap.qa/api/orders \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'  # Should return 403

# JWT validation
curl https://api.qscrap.qa/api/protected \
  -H "Authorization: Bearer invalid_token"  # Should return 401
```

---

## 📞 SIGN-OFF

| Role | Name | Date | Status |
|------|------|------|--------|
| **Technical Lead** | | | ⏳ Pending |
| **Security Auditor** | | | ⏳ Pending |
| **QA Lead** | | | ⏳ Pending |
| **DevOps** | | | ⏳ Pending |

---

*Document Version: 1.0*  
*Last Updated: March 5, 2026*  
*Next Review: After P0 implementation complete*
