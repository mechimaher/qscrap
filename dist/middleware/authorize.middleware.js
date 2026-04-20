"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeAdmin = exports.authorizeOperations = void 0;
/**
 * Middleware to authorize operations/admin users only
 * Must be used after authenticate middleware
 */
const authorizeOperations = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    // Allow admin, operations, and staff user types
    const allowedRoles = ['admin', 'operations', 'staff'];
    if (!allowedRoles.includes(req.user.userType)) {
        return res.status(403).json({ error: 'Access denied. Operations staff only.' });
    }
    next();
};
exports.authorizeOperations = authorizeOperations;
/**
 * Middleware to authorize admin users only
 */
const authorizeAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.userType !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
};
exports.authorizeAdmin = authorizeAdmin;
