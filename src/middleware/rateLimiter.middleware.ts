import rateLimit from 'express-rate-limit';

// Rate limiter for login attempts
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 attempts per window (increased for development)
    message: 'Too many login attempts. Please try again in 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    // Trust X-Forwarded-For from Cloudflare/Nginx
    validate: { xForwardedForHeader: false }
});

// Rate limiter for registration
export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour per IP
    message: 'Too many registration attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }
});

// General API rate limiter (for other endpoints)
export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests. Please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }
});

// Driver location update rate limiter
// 1 request per 5 seconds per driver (based on user ID from JWT)
// Using simple key generator without IP fallback to avoid IPv6 validation issues
export const driverLocationLimiter = rateLimit({
    windowMs: 5 * 1000, // 5 seconds
    max: 1, // 1 request per 5 seconds
    keyGenerator: (req: any) => {
        // Only use userId - require authentication, don't fall back to IP
        if (!req.user?.userId) {
            return 'anonymous'; // This will be rate limited as a single user
        }
        return req.user.userId;
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Location updates are rate limited to once per 5 seconds',
        retryAfter: 5
    }
});

