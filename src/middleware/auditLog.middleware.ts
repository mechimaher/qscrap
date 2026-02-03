import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import pool from '../config/db';
import logger from '../utils/logger';

/**
 * Audit Logging Middleware
 * 
 * Logs all state-changing operations (POST, PUT, PATCH, DELETE)
 * to an audit_logs table for compliance and debugging.
 */

interface AuditLogEntry {
    user_id: string | null;
    user_type: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    method: string;
    path: string;
    ip_address: string;
    user_agent: string;
    request_body: any;
    response_status: number | null;
    duration_ms: number | null;
}

// Extract resource type and ID from path
const parseResourceFromPath = (path: string): { type: string; id: string | null } => {
    // /api/orders/123 -> { type: 'orders', id: '123' }
    const parts = path.replace(/^\/api\//, '').split('/');
    const type = parts[0] || 'unknown';
    const id = parts[1] && !parts[1].includes('?') ? parts[1] : null;
    return { type, id };
};

// Store audit log in database
export const logAuditEntry = async (entry: AuditLogEntry): Promise<void> => {
    try {
        await pool.query(`
            INSERT INTO audit_logs (
                user_id, user_type, action, resource_type, resource_id,
                method, path, ip_address, user_agent, request_body,
                response_status, duration_ms, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        `, [
            entry.user_id,
            entry.user_type,
            entry.action,
            entry.resource_type,
            entry.resource_id,
            entry.method,
            entry.path,
            entry.ip_address,
            entry.user_agent?.substring(0, 500),
            JSON.stringify(sanitizeRequestBody(entry.request_body)),
            entry.response_status,
            entry.duration_ms
        ]);
    } catch (err: any) {
        // Don't let audit logging failures break the request
        if (err.code !== '42P01') { // Ignore "table doesn't exist" error
            logger.error('Audit log failed', { error: err.message });
        }
    }
};

// Remove sensitive fields from request body before logging
const sanitizeRequestBody = (body: any): any => {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = ['password', 'password_hash', 'token', 'secret', 'credit_card'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
        if (field in sanitized) {
            sanitized[field] = '[REDACTED]';
        }
    }

    return sanitized;
};

// Determine action from method and path
const determineAction = (method: string, path: string): string => {
    const resource = parseResourceFromPath(path);

    switch (method) {
        case 'POST':
            if (path.includes('/login')) return 'user_login';
            if (path.includes('/register')) return 'user_register';
            if (path.includes('/cancel')) return 'cancel';
            if (path.includes('/accept')) return 'accept';
            if (path.includes('/reject')) return 'reject';
            return `create_${resource.type}`;
        case 'PUT':
        case 'PATCH':
            return `update_${resource.type}`;
        case 'DELETE':
            return `delete_${resource.type}`;
        default:
            return `${method.toLowerCase()}_${resource.type}`;
    }
};

/**
 * Audit Logging Middleware
 * 
 * Captures request details and logs after response is sent.
 * Only logs state-changing operations (POST, PUT, PATCH, DELETE).
 */
export const auditLog = (req: AuthRequest, res: Response, next: NextFunction) => {
    // Skip logging for GET and OPTIONS requests
    const stateMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!stateMethods.includes(req.method)) {
        return next();
    }

    // Skip logging for static files
    if (!req.path.startsWith('/api')) {
        return next();
    }

    const startTime = Date.now();
    const resource = parseResourceFromPath(req.path);

    // Capture response status after response is sent
    res.on('finish', () => {
        const entry: AuditLogEntry = {
            user_id: req.user?.userId || null,
            user_type: req.user?.userType || null,
            action: determineAction(req.method, req.path),
            resource_type: resource.type,
            resource_id: resource.id,
            method: req.method,
            path: req.path,
            ip_address: req.ip || req.connection.remoteAddress || 'unknown',
            user_agent: req.headers['user-agent'] || 'unknown',
            request_body: req.body,
            response_status: res.statusCode,
            duration_ms: Date.now() - startTime
        };

        // Log asynchronously to not block the response
        logAuditEntry(entry).catch(() => { });
    });

    next();
};

/**
 * SQL to create audit_logs table (run once):
 * 
 * CREATE TABLE IF NOT EXISTS audit_logs (
 *     log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id UUID,
 *     user_type VARCHAR(50),
 *     action VARCHAR(100) NOT NULL,
 *     resource_type VARCHAR(100),
 *     resource_id VARCHAR(100),
 *     method VARCHAR(10),
 *     path VARCHAR(500),
 *     ip_address VARCHAR(45),
 *     user_agent TEXT,
 *     request_body JSONB,
 *     response_status INTEGER,
 *     duration_ms INTEGER,
 *     created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
 * CREATE INDEX idx_audit_logs_action ON audit_logs(action);
 * CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
 */
