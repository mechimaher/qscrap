"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.driverLocationLimiter = exports.apiLimiter = exports.registerLimiter = exports.loginLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Rate limiter for login attempts
exports.loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 attempts per window (increased for development)
    message: 'Too many login attempts. Please try again in 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});
// Rate limiter for registration
exports.registerLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour per IP
    message: 'Too many registration attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});
// General API rate limiter (for other endpoints)
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests. Please slow down.',
    standardHeaders: true,
    legacyHeaders: false
});
// Driver location update rate limiter
// 1 request per 5 seconds per driver (based on user ID from JWT)
// Using simple key generator without IP fallback to avoid IPv6 validation issues
exports.driverLocationLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 1000, // 5 seconds
    max: 1, // 1 request per 5 seconds
    keyGenerator: (req) => {
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
