import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import logger from '../utils/logger';

/**
 * Middleware to authorize operations-supporting roles.
 * Must be used after authenticate middleware.
 */
export const authorizeOperations = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const allowedUserTypes = ['admin', 'operations', 'support', 'staff'];
    if (!allowedUserTypes.includes(req.user.userType)) {
        return res.status(403).json({ error: 'Access denied. Operations role required.' });
    }

    next();
};

/**
 * Strict middleware for Operations Dashboard endpoints only.
 * Allows:
 * - admin
 * - operations
 * - staff with operations role
 */
export const authorizeOperationsDashboard = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const isAdmin = req.user.userType === 'admin';
    const isOperations = req.user.userType === 'operations';
    const isOperationsStaff = req.user.userType === 'staff' && req.user.staffRole === 'operations';

    if (!isAdmin && !isOperations && !isOperationsStaff) {
        logger.warn('Unauthorized operations dashboard access attempt', {
            userId: req.user.userId,
            userType: req.user.userType,
            staffRole: req.user.staffRole || null,
            path: req.path
        });

        return res.status(403).json({
            error: 'Access denied. Operations dashboard is restricted to admin, operations, or operations staff.'
        });
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
