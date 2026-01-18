import rateLimit from 'express-rate-limit';
import logger from '../utils/logger';

/**
 * Rate limiter for authentication endpoints
 * Prevents brute force attacks on login/password operations
 */
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    skipSuccessfulRequests: true, // Don't count successful logins
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skip: () => process.env.NODE_ENV === 'test', // Skip rate limiting in tests
    handler: (req, res) => {
        logger.warn('Auth rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            userAgent: req.get('user-agent')
        });

        res.status(429).json({
            error: 'Too many authentication attempts. Please try again in 15 minutes.',
            retry_after: 900, // seconds
            type: 'rate_limit_exceeded'
        });
    }
});

/**
 * Rate limiter for password verification operations
 * Used for sensitive operations like bulk payouts
 */
export const passwordRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3, // Only 3 password attempts
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test', // Skip rate limiting in tests
    handler: (req, res) => {
        logger.warn('Password verification rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            userId: (req as any).user?.userId
        });

        res.status(429).json({
            error: 'Too many password attempts. Please try again in 10 minutes.',
            retry_after: 600,
            type: 'password_rate_limit_exceeded'
        });
    }
});

/**
 * General API rate limiter
 * Protects against general API abuse
 */
export const apiRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test', // Skip rate limiting in tests
    handler: (req, res) => {
        logger.warn('API rate limit exceeded', {
            ip: req.ip,
            path: req.path
        });

        res.status(429).json({
            error: 'Too many requests. Please slow down.',
            retry_after: 60,
            type: 'api_rate_limit_exceeded'
        });
    }
});
