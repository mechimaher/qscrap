import { Request, Response, NextFunction } from 'express';

/**
 * Origin Validation Middleware
 * 
 * Validates that state-changing requests (POST, PUT, PATCH, DELETE)
 * come from allowed origins. This provides defense-in-depth
 * protection against CSRF attacks even with JWT auth.
 */

// Get allowed origins from environment or use defaults
const getAllowedOrigins = (): string[] => {
    const defaults = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'https://qscrap.qa',
        'https://www.qscrap.qa'
    ];

    const origins = process.env.ALLOWED_ORIGINS
        ? [...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()), ...defaults]
        : defaults;

    console.log(`[CSRF-DEBUG] NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[CSRF-DEBUG] Allowed Origins: ${JSON.stringify(origins)}`);

    return origins;
};

// Check if origin is valid
const isValidOrigin = (origin: string | undefined, referer: string | undefined): boolean => {
    const allowedOrigins = getAllowedOrigins();

    // In development, allow same-origin requests without Origin header
    if (process.env.NODE_ENV !== 'production' && !origin && !referer) {
        return true;
    }

    // Check Origin header
    if (origin) {
        return allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed));
    }

    // Fall back to Referer header
    if (referer) {
        try {
            const refererUrl = new URL(referer);
            const refererOrigin = refererUrl.origin;
            return allowedOrigins.some(allowed => refererOrigin === allowed);
        } catch {
            return false;
        }
    }

    // No origin information - Allow for Mobile Apps (which often don't send Origin)
    return true;
};

/**
 * CSRF Protection via Origin Validation
 * 
 * Only applies to state-changing methods (POST, PUT, PATCH, DELETE).
 * Safe methods (GET, HEAD, OPTIONS) are allowed without validation.
 */
export const validateOrigin = (req: Request, res: Response, next: NextFunction) => {
    // Skip validation for safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    // Skip validation for API calls with valid JWT (already authenticated)
    // This is an additional layer, not a replacement for JWT auth
    const hasAuthHeader = req.headers.authorization?.startsWith('Bearer ');

    // If authenticated with Token, skip CSRF (it's stateless)
    if (hasAuthHeader) {
        return next();
    }

    const origin = req.headers.origin as string | undefined;
    const referer = req.headers.referer as string | undefined;

    // Validate origin
    if (!isValidOrigin(origin, referer)) {
        console.warn(`[CSRF] Blocked request from invalid origin: ${origin || referer || 'none'}`);

        // In production, block the request
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                error: 'Invalid origin',
                message: 'Request blocked due to CSRF protection'
            });
        }

        // In development, log a warning but allow the request
        console.warn('[CSRF] Request allowed in development mode despite invalid origin');
    }

    next();
};

/**
 * Strict Origin Validation
 * 
 * Use this for highly sensitive endpoints (e.g., password change, delete account).
 * Always blocks requests from invalid origins, even in development.
 */
export const strictValidateOrigin = (req: Request, res: Response, next: NextFunction) => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    const origin = req.headers.origin as string | undefined;
    const referer = req.headers.referer as string | undefined;

    // For strict validation, always require valid origin
    if (!origin && !referer) {
        console.warn('[CSRF-STRICT] Blocked request with no origin');
        return res.status(403).json({
            error: 'Origin required',
            message: 'Requests to this endpoint must include Origin header'
        });
    }

    if (!isValidOrigin(origin, referer)) {
        console.warn(`[CSRF-STRICT] Blocked request from: ${origin || referer}`);
        return res.status(403).json({
            error: 'Invalid origin',
            message: 'Request blocked due to CSRF protection'
        });
    }

    next();
};
