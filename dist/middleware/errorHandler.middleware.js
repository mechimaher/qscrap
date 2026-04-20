"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.asyncHandler = exports.errorHandler = exports.ApiError = exports.ErrorCode = void 0;
// Error codes for consistent error handling
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["AUTHENTICATION_ERROR"] = "AUTHENTICATION_ERROR";
    ErrorCode["AUTHORIZATION_ERROR"] = "AUTHORIZATION_ERROR";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["CONFLICT"] = "CONFLICT";
    ErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["BAD_REQUEST"] = "BAD_REQUEST";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
// Custom API Error class
class ApiError extends Error {
    statusCode;
    code;
    details;
    isOperational;
    constructor(statusCode, code, message, details, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = isOperational;
        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }
    // Factory methods for common errors
    static badRequest(message, details) {
        return new ApiError(400, ErrorCode.BAD_REQUEST, message, details);
    }
    static validation(message, details) {
        return new ApiError(400, ErrorCode.VALIDATION_ERROR, message, details);
    }
    static unauthorized(message = 'Authentication required') {
        return new ApiError(401, ErrorCode.AUTHENTICATION_ERROR, message);
    }
    static forbidden(message = 'Access denied') {
        return new ApiError(403, ErrorCode.AUTHORIZATION_ERROR, message);
    }
    static notFound(message = 'Resource not found') {
        return new ApiError(404, ErrorCode.NOT_FOUND, message);
    }
    static conflict(message, details) {
        return new ApiError(409, ErrorCode.CONFLICT, message, details);
    }
    static rateLimit(message = 'Too many requests') {
        return new ApiError(429, ErrorCode.RATE_LIMIT_EXCEEDED, message);
    }
    static internal(message = 'Internal server error') {
        return new ApiError(500, ErrorCode.INTERNAL_ERROR, message, undefined, false);
    }
    static database(message = 'Database error') {
        return new ApiError(500, ErrorCode.DATABASE_ERROR, message, undefined, false);
    }
}
exports.ApiError = ApiError;
/**
 * Global Error Handler Middleware
 * Catches all errors and returns standardized JSON responses
 */
const errorHandler = (err, req, res, _next) => {
    const requestId = req.requestId || 'unknown';
    const isProduction = process.env.NODE_ENV === 'production';
    // Default values
    let statusCode = 500;
    let code = ErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';
    let details = undefined;
    // Handle known ApiError
    if (err instanceof ApiError) {
        statusCode = err.statusCode;
        code = err.code;
        message = err.message;
        details = err.details;
    }
    // Handle Zod validation errors
    else if (err.name === 'ZodError') {
        statusCode = 400;
        code = ErrorCode.VALIDATION_ERROR;
        message = 'Validation failed';
        details = err.errors?.map((e) => ({
            field: e.path?.join('.'),
            message: e.message
        }));
    }
    // Handle JWT errors
    else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        statusCode = 401;
        code = ErrorCode.AUTHENTICATION_ERROR;
        message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    }
    // Handle database errors
    else if (err.code?.startsWith?.('23') || err.message?.includes('duplicate key')) {
        statusCode = 409;
        code = ErrorCode.CONFLICT;
        message = 'Resource already exists or constraint violation';
    }
    // For unknown errors in production, hide details
    else if (isProduction) {
        statusCode = 500;
        code = ErrorCode.INTERNAL_ERROR;
        message = 'An unexpected error occurred';
        details = undefined;
    }
    // In development, include original error message
    else {
        message = err.message || message;
    }
    // Log error (console only per user requirement)
    const logMessage = `[${new Date().toISOString()}] [${requestId}] ERROR: ${err.message}`;
    console.error(logMessage);
    // In development, log stack trace to console (hidden in production per user requirement)
    if (!isProduction && err.stack) {
        console.error(err.stack);
    }
    // Build standardized error response
    const errorResponse = {
        success: false,
        error: {
            code,
            message,
            requestId
        }
    };
    // Add details only if present and not in production for sensitive errors
    if (details && (statusCode < 500 || !isProduction)) {
        errorResponse.error.details = details;
    }
    res.status(statusCode).json(errorResponse);
};
exports.errorHandler = errorHandler;
/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors automatically
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
/**
 * Not Found Handler
 * Catches 404 errors for undefined routes
 */
const notFoundHandler = (req, res, _next) => {
    const errorResponse = {
        success: false,
        error: {
            code: ErrorCode.NOT_FOUND,
            message: `Route ${req.method} ${req.path} not found`,
            requestId: req.requestId
        }
    };
    res.status(404).json(errorResponse);
};
exports.notFoundHandler = notFoundHandler;
