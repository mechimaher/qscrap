"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContext = void 0;
const uuid_1 = require("uuid");
/**
 * Request Context Middleware
 * Adds unique request ID and timing for request tracking
 */
const requestContext = (req, res, next) => {
    // Generate unique request ID
    req.requestId = (0, uuid_1.v4)();
    req.requestStartTime = Date.now();
    // Add request ID to response headers for client-side debugging
    res.setHeader('X-Request-ID', req.requestId || '');
    // Log request start (console only per user requirement)
    console.log(`[${new Date().toISOString()}] [${req.requestId}] ${req.method} ${req.path} - Started`);
    // Log response on finish
    res.on('finish', () => {
        const duration = Date.now() - (req.requestStartTime || Date.now());
        const logLevel = res.statusCode >= 400 ? 'WARN' : 'INFO';
        console.log(`[${new Date().toISOString()}] [${req.requestId}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms) [${logLevel}]`);
    });
    next();
};
exports.requestContext = requestContext;
