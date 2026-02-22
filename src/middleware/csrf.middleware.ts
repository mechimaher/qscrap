import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';

/**
 * Double-Submit Cookie CSRF Protection
 * 
 * This middleware implements CSRF protection by:
 * 1. Setting a random CSRF token in a signed/secure cookie if not present.
 * 2. Checking that the 'X-CSRF-Token' header matches the value in the cookie
 *    for all state-changing requests (POST, PUT, PATCH, DELETE).
 */

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Middleware to ensure a CSRF token exists in a cookie
 */
export const ensureCsrfToken = (req: Request, res: Response, next: NextFunction) => {
    // Generate token if it doesn't exist in cookies
    if (!req.cookies[CSRF_COOKIE_NAME]) {
        const token = crypto.randomBytes(32).toString('hex');
        const isProduction = process.env.NODE_ENV === 'production';

        res.cookie(CSRF_COOKIE_NAME, token, {
            httpOnly: false, // Must be readable by frontend JS to send in header
            secure: isProduction,
            sameSite: 'lax',
            path: '/'
        });

        // Also attach to request object for use in this cycle if needed
        req.cookies[CSRF_COOKIE_NAME] = token;
    }
    next();
};

/**
 * Validates the CSRF token from header against the cookie
 */
export const validateCsrfToken = (req: Request, res: Response, next: NextFunction) => {
    // Skip for safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    // Skip for API calls with valid JWT (Bearer token)
    // CSRF is primarily a concern for cookie-based authentication.
    // However, for defense-in-depth, we can still enforce it for all web-originated requests.
    const hasAuthHeader = req.headers.authorization?.startsWith('Bearer ');
    if (hasAuthHeader) {
        return next();
    }

    const cookieToken = req.cookies[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME];

    // Skip for public routes (Login, Register, Public Config)
    // Note: req.path is the path AFTER the mount point (e.g., '/auth/login' not '/api/auth/login')
    const publicRoutes = ['/auth/login', '/auth/register', '/auth/register/garage', '/v1/config/public', '/config/public'];
    if (publicRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        logger.warn('CSRF validation failed', {
            hasCookie: !!cookieToken,
            hasHeader: !!headerToken,
            ip: req.ip,
            path: req.path
        });

        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid or missing CSRF token'
        });
    }

    next();
};

/**
 * Legacy Origin Validation (Defense-in-Depth)
 */
const getAllowedOrigins = (): string[] => {
    const defaults = [
        'https://qscrap.qa',
        'https://www.qscrap.qa'
    ];
    return process.env.ALLOWED_ORIGINS
        ? [...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()), ...defaults]
        : defaults;
};

export const validateOrigin = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin as string | undefined;
    const allowed = getAllowedOrigins();

    // Skip for public routes (Login, Register, Public Config)
    // Note: req.path is the path AFTER the mount point (e.g., '/auth/login' not '/api/auth/login')
    const publicRoutes = ['/auth/login', '/auth/register', '/auth/register/garage', '/v1/config/public', '/config/public'];
    if (publicRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }

    if (origin && !allowed.includes(origin) && process.env.NODE_ENV === 'production') {
        logger.warn('Origin validation failed', { origin });
        return res.status(403).json({ error: 'Invalid origin' });
    }

    next();
};
