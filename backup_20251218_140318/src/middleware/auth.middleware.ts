import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthPayload {
    userId: string;
    userType: string;
}

export interface AuthRequest extends Request {
    user?: AuthPayload;
}

// Get JWT secret with security check
const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET environment variable is required in production');
    }
    return secret || 'dev-secret-not-for-production';
};

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, getJwtSecret()) as AuthPayload;
        req.user = payload;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
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
    if (!req.user || (req.user.userType !== 'operations' && req.user.userType !== 'admin')) {
        return res.status(403).json({ error: 'Operations access required' });
    }
    next();
};
