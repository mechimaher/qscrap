import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import logger from '../utils/logger';

/**
 * Middleware to authorize operations-supporting roles.
 * Must be used after authenticate middleware.
 * 
 * Allows: admin, operations, support, staff, and finance
 * Finance needs access for payout processing workflows
 * Also allows staff with finance role
 */
export const authorizeOperations = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const allowedUserTypes = ['admin', 'operations', 'support', 'staff', 'finance'];
    
    // Allow finance users directly or staff with finance role
    const isFinance = req.user.userType === 'finance' || 
                      (req.user.userType === 'staff' && req.user.staffRole === 'finance');
    
    if (!allowedUserTypes.includes(req.user.userType) && !isFinance) {
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
 * - finance (userType or staff with finance role)
 */
export const authorizeOperationsDashboard = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const isAdmin = req.user.userType === 'admin';
    const isOperations = req.user.userType === 'operations';
    const isOperationsStaff = req.user.userType === 'staff' && req.user.staffRole === 'operations';
    const isFinance = req.user.userType === 'finance' || (req.user.userType === 'staff' && req.user.staffRole === 'finance');

    if (!isAdmin && !isOperations && !isOperationsStaff && !isFinance) {
        logger.warn('Unauthorized operations dashboard access attempt', {
            userId: req.user.userId,
            userType: req.user.userType,
            staffRole: req.user.staffRole || null,
            path: req.path
        });

        return res.status(403).json({
            error: 'Access denied. Operations dashboard is restricted to admin, operations, operations staff, or finance.'
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
