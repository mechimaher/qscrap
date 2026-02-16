import express from 'express';
import cors from 'cors';
import path from 'path';

// Versioned API Routes
import v1Router from './routes/v1.routes';

// Swagger Documentation
import setupSwagger from './config/swagger';


// Middleware imports
import { requestContext } from './middleware/requestContext.middleware';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import { securityMiddleware, additionalSecurityHeaders, sanitizeRequest } from './middleware/security.middleware';
import { validateOrigin } from './middleware/csrf.middleware';

const app = express();

type JobRunner = () => Promise<unknown>;
type JobsModule = {
    default: Record<string, JobRunner>;
};

const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
        return err.message;
    }
    return 'Unknown error';
};

// ==========================================
// TRUST PROXY (Required behind Cloudflare/Nginx)
// ==========================================
// Fix for ERR_ERL_UNEXPECTED_X_FORWARDED_FOR rate limiter error
app.set('trust proxy', 1); // Trust first proxy (Nginx/Cloudflare)

// ==========================================
// SECURITY MIDDLEWARE (First in chain)
// ==========================================
app.use(securityMiddleware);
app.use(additionalSecurityHeaders);

// ==========================================
// REQUEST CONTEXT (Request ID + Timing)
// ==========================================
app.use(requestContext);

// ==========================================
// CORS CONFIGURATION
// ==========================================
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://qscrap.qa',
        'https://www.qscrap.qa'
    ];

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? allowedOrigins
        : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ==========================================
// STRIPE WEBHOOK (Must be BEFORE express.json)
// Webhook requires raw body for signature verification
// ==========================================
import stripeWebhookRoutes from './routes/stripe-webhook.routes';
app.use('/api/stripe', stripeWebhookRoutes);

// ==========================================
// BODY PARSING & SANITIZATION
// ==========================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(sanitizeRequest);

// ==========================================
// CSRF PROTECTION (Origin Validation)
// ==========================================
app.use('/api', validateOrigin);

// ==========================================
// AUDIT LOGGING (State-changing operations)
// ==========================================
import { auditLog } from './middleware/auditLog.middleware';
app.use('/api', auditLog);

// ==========================================
// STATIC FILES (CDN-Ready - Phase 1)
// ==========================================

// Cache control middleware for static assets
const cacheControl = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isStaticAsset = /\.(jpg|jpeg|png|webp|gif|svg|css|js|woff|woff2|ttf|eot|ico)$/.test(req.path);

    if (isStaticAsset) {
        if (isProduction) {
            // Aggressive caching for production (30 days for assets)
            res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
        } else {
            // No caching in development for easier debugging
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        // Add ETag support for conditional requests
        res.setHeader('Vary', 'Accept-Encoding');
    } else {
        // HTML pages: short cache with revalidation
        res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    }
    next();
};

app.use(cacheControl);
app.use('/uploads', express.static('uploads'));
app.use(express.static(path.join(__dirname, '../public')));


// ==========================================
// API ROUTES (Versioned)
// ==========================================

// API v1 - Primary versioned routes
app.use('/api/v1', v1Router);

// Backward compatibility - /api/* routes to v1
// This ensures existing clients continue to work
app.use('/api', v1Router);

// ==========================================
// API DOCUMENTATION (Swagger UI)
// ==========================================
setupSwagger(app);


// ==========================================
// HEALTH CHECK (Enhanced for Phase 1/2)
// ==========================================
app.get('/health', async (req, res) => {
    try {
        // Import pool stats (dynamic to avoid circular dependency)
        const { getPoolStats } = await import('./config/db');


        const dbStats = getPoolStats();


        res.json({
            success: true,
            status: 'OK',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            database: {
                primary: {
                    connected: true,
                    ...dbStats.primary
                },
                replica: dbStats.replica ? {
                    connected: true,
                    ...dbStats.replica
                } : null
            },
            redis: process.env.REDIS_URL ? 'configured' : 'not_configured',
            storage: process.env.S3_BUCKET ? 'S3' :
                process.env.AZURE_STORAGE_ACCOUNT ? 'Azure' : 'Local'
        });
    } catch (err: unknown) {
        res.status(503).json({
            success: false,
            status: 'ERROR',
            error: getErrorMessage(err),
            timestamp: new Date().toISOString()
        });
    }
});

// ==========================================
// JOB HEALTH CHECK (Premium 2026)
// ==========================================
app.get('/health/jobs', (req, res) => {
    try {
        res.json({
            success: true,
            scheduler: 'active',
            interval: '1 hour',
            jobs: {
                expireOldRequests: { description: 'Expire requests past deadline', frequency: 'hourly' },
                expireCounterOffers: { description: 'Expire pending counter-offers after 24h', frequency: 'hourly' },
                checkSubscriptions: { description: 'Handle subscription renewals/expirations', frequency: 'hourly' },
                autoResolveDisputes: { description: 'Auto-approve disputes after 48h', frequency: 'hourly' },
                autoConfirmDeliveries: { description: 'Auto-complete orders after 24h delivery', frequency: 'hourly' },
                autoConfirmPayouts: { description: 'Auto-confirm payout receipt after 7 days', frequency: 'hourly' },
                // abandonStaleInspections removed - QC workflow cancelled (2026-02-01)
                schedulePendingPayouts: { description: 'Create payout records for completed orders', frequency: 'hourly' },
                autoProcessPayouts: { description: 'Process mature payouts, hold disputed ones', frequency: 'hourly' },
                cleanupOldData: { description: 'Remove old notifications and history', frequency: 'hourly' }
            },
            timestamp: new Date().toISOString()
        });
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
});

// Manual job trigger (admin only - for testing/emergency)
app.post('/health/jobs/:jobName/run', async (req, res) => {
    const { jobName } = req.params;
    const apiKey = req.headers['x-admin-key'];

    // Simple API key check (production should use proper auth)
    if (apiKey !== process.env.ADMIN_API_KEY && process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const jobsModule = await import('./config/jobs') as JobsModule;
        const jobFn = jobsModule.default[jobName];

        if (!jobFn || typeof jobFn !== 'function') {
            return res.status(404).json({ error: `Job not found: ${jobName}` });
        }

        const result = await jobFn();
        res.json({
            success: true,
            job: jobName,
            result,
            timestamp: new Date().toISOString()
        });
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(err) });
    }
});

// ==========================================
// DOCUMENT VERIFICATION PAGE (Premium 2026)
// ==========================================
// Serve verify.html for any /verify/* URL (QR code scanning)
app.get('/verify/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/verify.html'));
});

// ==========================================
// ERROR HANDLING (Last in chain)
// ==========================================

// 404 Handler - Catches undefined routes
app.use(notFoundHandler);

import * as Sentry from '@sentry/node';
// Sentry error handler (Must be before any other error middleware)
Sentry.setupExpressErrorHandler(app);

// Global Error Handler - Catches all errors
app.use(errorHandler);

export default app;
