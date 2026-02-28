import { Response, NextFunction } from 'express';
import { RequestWithContext } from './requestContext.middleware';
import logger from '../utils/logger';

// Error codes for consistent error handling
export enum ErrorCode {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
    NOT_FOUND = 'NOT_FOUND',
    CONFLICT = 'CONFLICT',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    BAD_REQUEST = 'BAD_REQUEST'
}

// Custom API Error class
export class ApiError extends Error {
    public statusCode: number;
    public code: ErrorCode;
    public details?: any;
    public isOperational: boolean;

    constructor(
        statusCode: number,
        code: ErrorCode,
        message: string,
        details?: any,
        isOperational = true
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = isOperational;

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }

    // Factory methods for common errors
    static badRequest(message: string, details?: any) {
        return new ApiError(400, ErrorCode.BAD_REQUEST, message, details);
    }

    static validation(message: string, details?: any) {
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

    static conflict(message: string, details?: any) {
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

// Standard error response interface
interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: any;
        requestId?: string;
    };
}

/**
 * Global Error Handler Middleware
 * Catches all errors and returns standardized JSON responses
 */
export const errorHandler = (
    err: Error | ApiError,
    req: RequestWithContext,
    res: Response,
    _next: NextFunction
) => {
    const requestId = req.requestId || 'unknown';
    const isProduction = process.env.NODE_ENV === 'production';

    // Default values
    let statusCode = 500;
    let code = ErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';
    let details: any = undefined;

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
        details = (err as any).errors?.map((e: any) => ({
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
    else if ((err as any).code?.startsWith?.('23') || err.message?.includes('duplicate key')) {
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

    // Log error with structured logger
    logger.error(err.message, { requestId, statusCode, code, stack: !isProduction ? err.stack : undefined });

    // Build standardized error response
    const errorResponse: ErrorResponse = {
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

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors automatically
 */
export const asyncHandler = (
    fn: (req: RequestWithContext, res: Response, next: NextFunction) => Promise<any>
) => {
    return (req: RequestWithContext, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Not Found Handler
 * Catches 404 errors for undefined routes
 */
export const notFoundHandler = (req: RequestWithContext, res: Response, _next: NextFunction) => {
    const errorResponse: ErrorResponse = {
        success: false,
        error: {
            code: ErrorCode.NOT_FOUND,
            message: `Route ${req.method} ${req.path} not found`,
            requestId: req.requestId
        }
    };
    
    // Check if this is an API request (expects JSON) or a page request (expects HTML)
    const acceptsHtml = req.accepts('html');
    const isApiRequest = req.path.startsWith('/api/') || req.xhr;
    
    if (isApiRequest || !acceptsHtml) {
        // API request - return JSON
        res.status(404).json(errorResponse);
    } else {
        // Browser request - serve 404.html page
        const path = require('path');
        res.status(404).sendFile(path.join(__dirname, '../../public/404.html'));
    }
};
