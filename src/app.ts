import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';

// Versioned API Routes
import v1Router from './routes/v1.routes';

// Swagger Documentation
import setupSwagger from './config/swagger';


// Middleware imports
import { requestContext } from './middleware/requestContext.middleware';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import { securityMiddleware, additionalSecurityHeaders, sanitizeRequest } from './middleware/security.middleware';
import { validateOrigin, ensureCsrfToken, validateCsrfToken } from './middleware/csrf.middleware';
import { getHealth, getJobHealth, triggerJob } from './controllers/health.controller';

const app = express();

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
app.use(cookieParser());

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
// CSRF PROTECTION (Double-Submit Cookie)
// ==========================================
// Set CSRF token cookie for all requests
app.use(ensureCsrfToken);
// Validate CSRF token for all API state-changing requests
app.use('/api', validateCsrfToken);
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
    } else if (req.method === 'GET' && req.path.startsWith('/api/')) {
        // Short cache for GET API responses (no sensitive data)
        // Vary by Authorization and Accept-Language for proper caching
        res.setHeader('Cache-Control', 'private, max-age=30, must-revalidate');
        res.setHeader('Vary', 'Authorization, Accept-Language');
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
app.get('/health', getHealth);

// ==========================================
// JOB HEALTH CHECK (Premium 2026)
// ==========================================
app.get('/health/jobs', getJobHealth);

// Manual job trigger (admin only - for testing/emergency)
app.post('/health/jobs/:jobName/run', triggerJob);

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
