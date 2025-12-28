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
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
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
    } catch (err: any) {
        res.status(503).json({
            success: false,
            status: 'ERROR',
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ==========================================
// ERROR HANDLING (Last in chain)
// ==========================================

// 404 Handler - Catches undefined routes
app.use(notFoundHandler);

// Global Error Handler - Catches all errors
app.use(errorHandler);

export default app;
