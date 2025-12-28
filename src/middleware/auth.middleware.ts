import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
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
    let token: string | undefined;

    if (authHeader) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token as string;
    }

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

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
