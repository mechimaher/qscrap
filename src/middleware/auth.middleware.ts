import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/security';

interface AuthPayload {
    userId: string;
    userType: string;
}

export interface AuthRequest extends Request {
    user?: AuthPayload;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.token;

    let token: string | undefined;

    if (authHeader) {
        token = authHeader.split(' ')[1];
    } else if (cookieToken) {
        token = cookieToken;
    }

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const payload = jwt.verify(token, getJwtSecret()) as AuthPayload;
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
