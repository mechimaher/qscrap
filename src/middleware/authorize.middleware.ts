import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

/**
 * Middleware to authorize operations/admin users only
 * Must be used after authenticate middleware
 */
export const authorizeOperations = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // Allow admin, operations, staff, and support user types
    const allowedRoles = ['admin', 'operations', 'staff', 'support'];

    if (!allowedRoles.includes(req.user.userType)) {
        return res.status(403).json({ error: 'Access denied. Operations staff only.' });
    }

    next();
};

/**
 * Middleware to authorize admin users only
 */
export const authorizeAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.userType !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    next();
};
