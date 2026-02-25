import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/security';

interface AuthPayload {
    userId: string;
    userType: string;
    staffRole?: string;
}

export interface AuthRequest extends Request {
    user?: AuthPayload;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // SECURITY: Token must be provided via Authorization header only
    // Query string tokens are insecure (appear in logs, browser history, referrer headers)
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Invalid authorization header format' });
    }

    try {
        const payload = jwt.verify(token, getJwtSecret()) as AuthPayload;

        // Validate required claims exist and are strings
        if (
            !payload.userId || typeof payload.userId !== 'string' ||
            !payload.userType || typeof payload.userType !== 'string'
        ) {
            return res.status(401).json({
                error: 'invalid_token_claims',
                message: 'Token is missing required claims'
            });
        }

        if (payload.staffRole !== undefined && typeof payload.staffRole !== 'string') {
            return res.status(401).json({
                error: 'invalid_token_claims',
                message: 'Token has invalid staffRole claim'
            });
        }

        req.user = payload;
        next();
    } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'token_expired', message: 'Access token has expired. Use /auth/refresh to get a new one.' });
        }
        res.status(401).json({ error: 'invalid_token', message: 'Invalid or malformed token' });
    }
};

export const requireRole = (role: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || req.user.userType !== role) {
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    };
};
export const authorizeOperations = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || (req.user.userType !== 'operations' && req.user.userType !== 'admin' && req.user.userType !== 'staff')) {
        return res.status(403).json({ error: 'Operations access required' });
    }
    next();
};
