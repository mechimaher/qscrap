"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
// Versioned API Routes
const v1_routes_1 = __importDefault(require("./routes/v1.routes"));
// Swagger Documentation
const swagger_1 = __importDefault(require("./config/swagger"));
// Middleware imports
const requestContext_middleware_1 = require("./middleware/requestContext.middleware");
const errorHandler_middleware_1 = require("./middleware/errorHandler.middleware");
const security_middleware_1 = require("./middleware/security.middleware");
const csrf_middleware_1 = require("./middleware/csrf.middleware");
const app = (0, express_1.default)();
// ==========================================
// SECURITY MIDDLEWARE (First in chain)
// ==========================================
app.use(security_middleware_1.securityMiddleware);
app.use(security_middleware_1.additionalSecurityHeaders);
// ==========================================
// REQUEST CONTEXT (Request ID + Timing)
// ==========================================
app.use(requestContext_middleware_1.requestContext);
// ==========================================
// CORS CONFIGURATION
// ==========================================
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? allowedOrigins
        : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// ==========================================
// BODY PARSING & SANITIZATION
// ==========================================
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use(security_middleware_1.sanitizeRequest);
// ==========================================
// CSRF PROTECTION (Origin Validation)
// ==========================================
app.use('/api', csrf_middleware_1.validateOrigin);
// ==========================================
// AUDIT LOGGING (State-changing operations)
// ==========================================
const auditLog_middleware_1 = require("./middleware/auditLog.middleware");
app.use('/api', auditLog_middleware_1.auditLog);
// ==========================================
// STATIC FILES (CDN-Ready - Phase 1)
// ==========================================
// Cache control middleware for static assets
const cacheControl = (req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isStaticAsset = /\.(jpg|jpeg|png|webp|gif|svg|css|js|woff|woff2|ttf|eot|ico)$/.test(req.path);
    if (isStaticAsset) {
        if (isProduction) {
            // Aggressive caching for production (30 days for assets)
            res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
        }
        else {
            // No caching in development for easier debugging
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        // Add ETag support for conditional requests
        res.setHeader('Vary', 'Accept-Encoding');
    }
    else {
        // HTML pages: short cache with revalidation
        res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    }
    next();
};
app.use(cacheControl);
app.use('/uploads', express_1.default.static('uploads'));
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// ==========================================
// API ROUTES (Versioned)
// ==========================================
// API v1 - Primary versioned routes
app.use('/api/v1', v1_routes_1.default);
// Backward compatibility - /api/* routes to v1
// This ensures existing clients continue to work
app.use('/api', v1_routes_1.default);
// ==========================================
// API DOCUMENTATION (Swagger UI)
// ==========================================
(0, swagger_1.default)(app);
// ==========================================
// HEALTH CHECK (Enhanced for Phase 1/2)
// ==========================================
app.get('/health', async (req, res) => {
    try {
        // Import pool stats (dynamic to avoid circular dependency)
        const { getPoolStats } = await Promise.resolve().then(() => __importStar(require('./config/db')));
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
    }
    catch (err) {
        res.status(503).json({
            success: false,
            status: 'ERROR',
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});
// ==========================================
// JOB HEALTH CHECK (Premium 2026)
// ==========================================
app.get('/health/jobs', async (req, res) => {
    try {
        const jobs = await Promise.resolve().then(() => __importStar(require('./config/jobs')));
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
                abandonStaleInspections: { description: 'Release QC inspections stuck > 4 hours', frequency: 'hourly' },
                schedulePendingPayouts: { description: 'Create payout records for completed orders', frequency: 'hourly' },
                autoProcessPayouts: { description: 'Process mature payouts, hold disputed ones', frequency: 'hourly' },
                cleanupOldData: { description: 'Remove old notifications and history', frequency: 'hourly' }
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
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
        const jobs = await Promise.resolve().then(() => __importStar(require('./config/jobs')));
        const jobFn = jobs.default[jobName];
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ==========================================
// ERROR HANDLING (Last in chain)
// ==========================================
// 404 Handler - Catches undefined routes
app.use(errorHandler_middleware_1.notFoundHandler);
// Global Error Handler - Catches all errors
app.use(errorHandler_middleware_1.errorHandler);
exports.default = app;
