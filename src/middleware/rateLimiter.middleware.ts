import rateLimit from 'express-rate-limit';

// Rate limiter for login attempts
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 attempts per window (increased for development)
    message: 'Too many login attempts. Please try again in 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skip: () => process.env.NODE_ENV === 'test', // Skip in test environment
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
    skip: () => process.env.NODE_ENV === 'test', // Skip in test environment
    validate: { xForwardedForHeader: false }
});

// General API rate limiter (for other endpoints)
export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests. Please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test', // Skip in test environment
    validate: { xForwardedForHeader: false }
});

// Password reset rate limiter
// Enterprise Policy: Max 5 requests per hour per email/IP
export const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 attempts per window
    message: 'Too many password reset attempts. Please try again in an hour.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test', // Skip in test environment
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
    }
});

// ============================================
// WRITE OPERATION RATE LIMITERS
// For high-value mutating endpoints
// ============================================

// Order creation/acceptance rate limiter
// Prevents order spam and marketplace manipulation
export const orderWriteLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 order actions per minute
    keyGenerator: (req: any) => req.user?.userId || 'anonymous',
    message: 'Order rate limit exceeded. Please wait before placing more orders.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Bid submission rate limiter
// Prevents bid spam from garages
export const bidWriteLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 bids per minute (garages may bid on multiple requests)
    keyGenerator: (req: any) => req.user?.userId || 'anonymous',
    message: 'Bid rate limit exceeded. Please wait before submitting more bids.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Request creation rate limiter
// Prevents spam part requests
export const requestWriteLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 requests per 5 minutes
    keyGenerator: (req: any) => req.user?.userId || 'anonymous',
    message: 'Request rate limit exceeded. Please wait before creating more requests.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Admin action rate limiter
// Prevents mass admin operations
export const adminWriteLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 admin actions per minute
    keyGenerator: (req: any) => req.user?.userId || 'anonymous',
    message: 'Admin action rate limit exceeded.',
    standardHeaders: true,
    legacyHeaders: false,
});
