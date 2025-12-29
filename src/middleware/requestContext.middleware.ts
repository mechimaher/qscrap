import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extended request with context
export interface RequestWithContext extends Request {
    requestId?: string;
    requestStartTime?: number;
    user?: {
        userId: string;
        userType: string;
    };
}

/**
 * Request Context Middleware
 * Adds unique request ID and timing for request tracking
 */
export const requestContext = (req: RequestWithContext, res: Response, next: NextFunction) => {
    // Generate unique request ID
    req.requestId = uuidv4();
    req.requestStartTime = Date.now();

    // Add request ID to response headers for client-side debugging
    res.setHeader('X-Request-ID', req.requestId || '');

    // Log request start (console only per user requirement)
    console.log(`[${new Date().toISOString()}] [${req.requestId}] ${req.method} ${req.path} - Started`);

    // Log response on finish
    res.on('finish', () => {
        const duration = Date.now() - (req.requestStartTime || Date.now());
        const logLevel = res.statusCode >= 400 ? 'WARN' : 'INFO';
        console.log(
            `[${new Date().toISOString()}] [${req.requestId}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms) [${logLevel}]`
        );
    });

    next();
};
