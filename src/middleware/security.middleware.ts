import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

/**
 * Security Middleware Configuration
 * Uses Helmet.js for comprehensive security headers
 */
export const securityMiddleware = helmet({
    // Content Security Policy
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net", "https://unpkg.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://cdn.socket.io", "https://static.cloudflareinsights.com", "https://maps.googleapis.com", "https://js.stripe.com"],
            scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:", "https://cdn.socket.io", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://*.tile.openstreetmap.org", "https://*.basemaps.cartocdn.com", "https://maps.googleapis.com", "https://api.stripe.com"],
            frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
            objectSrc: ["'none'"],
            // Only enable upgrade-insecure-requests when HTTPS is configured
            upgradeInsecureRequests: process.env.HTTPS_ENABLED === 'true' ? [] : null
        }
    },
    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: false, // Disable for compatibility with external resources
    // Cross-Origin Opener Policy
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    // Cross-Origin Resource Policy
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // DNS Prefetch Control
    dnsPrefetchControl: { allow: true },
    // Frame Options - Prevent clickjacking
    frameguard: { action: "deny" },
    // Hide X-Powered-By header
    hidePoweredBy: true,
    // HTTP Strict Transport Security (production only)
    hsts: process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    // Prevent MIME type sniffing
    noSniff: true,
    // Referrer Policy
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // XSS Filter
    xssFilter: true
});

/**
 * Additional Security Headers
 */
export const additionalSecurityHeaders = (_req: Request, res: Response, next: NextFunction) => {
    // Prevent caching of sensitive data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Feature Policy (deprecated but still useful for older browsers)
    // Allow geolocation (for location picker), camera (for VIN scanner)
    res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(), camera=(self)');

    next();
};

/**
 * Request Sanitizer
 * Basic XSS prevention on request body
 */
export const sanitizeRequest = (req: Request, _res: Response, next: NextFunction) => {
    const sanitizeValue = (value: any): any => {
        if (typeof value === 'string') {
            // Remove potentially dangerous characters
            return value
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+=/gi, '');
        }
        if (Array.isArray(value)) {
            return value.map(sanitizeValue);
        }
        if (value && typeof value === 'object') {
            const sanitized: any = {};
            for (const key of Object.keys(value)) {
                sanitized[key] = sanitizeValue(value[key]);
            }
            return sanitized;
        }
        return value;
    };

    if (req.body) {
        req.body = sanitizeValue(req.body);
    }

    next();
};
