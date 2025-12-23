import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';

// ============================================================================
// ADMIN CONTROLLER - Garage Approval & Platform Management
// QScrap Premium Admin Module
// ============================================================================

// Demo period duration in days
const DEMO_PERIOD_DAYS = 30;

// ============================================================================
// GARAGE APPROVAL WORKFLOW
// ============================================================================

/**
 * Get pending garage approvals queue
 */
export const getPendingGarages = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT 
                g.*,
                u.phone_number,
                u.email,
                u.full_name,
                u.created_at as registration_date,
                u.is_active,
                u.is_suspended
            FROM garages g
            JOIN users u ON g.garage_id = u.user_id
            WHERE g.approval_status = 'pending' OR g.approval_status IS NULL
            ORDER BY g.created_at ASC
        `);

        res.json({
            pending_count: result.rows.length,
            garages: result.rows
        });
    } catch (err: any) {
        console.error('[ADMIN] getPendingGarages error:', err);
        res.status(500).json({ error: 'Failed to fetch pending garages' });
    }
};

/**
 * Get all garages with filters for admin view
 */
export const getAllGaragesAdmin = async (req: AuthRequest, res: Response) => {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            whereClause += ` AND g.approval_status = $${paramIndex++}`;
            params.push(status);
        }

        if (search) {
            whereClause += ` AND (g.garage_name ILIKE $${paramIndex} OR u.phone_number ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Get total count
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM garages g JOIN users u ON g.garage_id = u.user_id ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Get paginated results
        const result = await pool.query(`
            SELECT 
                g.*,
                u.phone_number,
                u.email,
                u.full_name,
                u.is_active,
                u.is_suspended,
                u.created_at as registration_date,
                (SELECT COUNT(*) FROM orders WHERE garage_id = g.garage_id) as total_orders,
                (SELECT COUNT(*) FROM bids WHERE garage_id = g.garage_id) as total_bids,
                gs.status as subscription_status,
                sp.plan_name
            FROM garages g
            JOIN users u ON g.garage_id = u.user_id
            LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status IN ('active', 'trial')
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            ${whereClause}
            ORDER BY 
                CASE g.approval_status 
                    WHEN 'pending' THEN 1 
                    WHEN 'demo' THEN 2 
                    WHEN 'approved' THEN 3 
                    ELSE 4 
                END,
                g.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...params, limit, offset]);

        res.json({
            garages: result.rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (err: any) {
        console.error('[ADMIN] getAllGaragesAdmin error:', err);
        res.status(500).json({ error: 'Failed to fetch garages' });
    }
};

/**
 * Approve a garage
 */
export const approveGarage = async (req: AuthRequest, res: Response) => {
    const { garage_id } = req.params;
    const { notes } = req.body;
    const adminId = req.user?.userId;

    try {
        // Start transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update garage approval status
            const garageResult = await client.query(`
                UPDATE garages SET
                    approval_status = 'approved',
                    approval_date = NOW(),
                    approved_by = $1,
                    admin_notes = $2,
                    updated_at = NOW()
                WHERE garage_id = $3
                RETURNING *
            `, [adminId, notes || 'Approved by admin', garage_id]);

            if (garageResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Garage not found' });
            }

            // Activate the user account
            await client.query(`
                UPDATE users SET
                    is_active = true,
                    updated_at = NOW()
                WHERE user_id = $1
            `, [garage_id]);

            // Log admin action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, new_value)
                VALUES ($1, 'approve_garage', 'garage', $2, $3)
            `, [adminId, garage_id, JSON.stringify({ status: 'approved', notes })]);

            await client.query('COMMIT');

            res.json({
                message: 'Garage approved successfully',
                garage: garageResult.rows[0]
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('[ADMIN] approveGarage error:', err);
        res.status(500).json({ error: 'Failed to approve garage' });
    }
};

/**
 * Reject a garage
 */
export const rejectGarage = async (req: AuthRequest, res: Response) => {
    const { garage_id } = req.params;
    const { reason } = req.body;
    const adminId = req.user?.userId;

    if (!reason) {
        return res.status(400).json({ error: 'Rejection reason is required' });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE garages SET
                    approval_status = 'rejected',
                    rejection_reason = $1,
                    updated_at = NOW()
                WHERE garage_id = $2
                RETURNING *
            `, [reason, garage_id]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Garage not found' });
            }

            // Deactivate user account
            await client.query(`
                UPDATE users SET
                    is_active = false,
                    updated_at = NOW()
                WHERE user_id = $1
            `, [garage_id]);

            // Log admin action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, new_value)
                VALUES ($1, 'reject_garage', 'garage', $2, $3)
            `, [adminId, garage_id, JSON.stringify({ status: 'rejected', reason })]);

            await client.query('COMMIT');

            res.json({
                message: 'Garage rejected',
                garage: result.rows[0]
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('[ADMIN] rejectGarage error:', err);
        res.status(500).json({ error: 'Failed to reject garage' });
    }
};

/**
 * Grant demo access to a garage (30 days trial)
 */
export const grantDemoAccess = async (req: AuthRequest, res: Response) => {
    const { garage_id } = req.params;
    const { days = DEMO_PERIOD_DAYS, notes } = req.body;
    const adminId = req.user?.userId;

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + Number(days));

            // Update garage to demo mode
            const result = await client.query(`
                UPDATE garages SET
                    approval_status = 'demo',
                    demo_expires_at = $1,
                    approved_by = $2,
                    admin_notes = $3,
                    updated_at = NOW()
                WHERE garage_id = $4
                RETURNING *
            `, [expiryDate, adminId, notes || `Demo access for ${days} days`, garage_id]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Garage not found' });
            }

            // Activate user account
            await client.query(`
                UPDATE users SET
                    is_active = true,
                    updated_at = NOW()
                WHERE user_id = $1
            `, [garage_id]);

            // Log admin action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, new_value)
                VALUES ($1, 'grant_demo', 'garage', $2, $3)
            `, [adminId, garage_id, JSON.stringify({ days, expires_at: expiryDate, notes })]);

            await client.query('COMMIT');

            res.json({
                message: `Demo access granted for ${days} days`,
                expires_at: expiryDate,
                garage: result.rows[0]
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('[ADMIN] grantDemoAccess error:', err);
        res.status(500).json({ error: 'Failed to grant demo access' });
    }
};

/**
 * Revoke garage access (suspend approved/demo garage)
 */
export const revokeGarageAccess = async (req: AuthRequest, res: Response) => {
    const { garage_id } = req.params;
    const { reason } = req.body;
    const adminId = req.user?.userId;

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get current status for audit
            const currentStatus = await client.query(
                `SELECT approval_status FROM garages WHERE garage_id = $1`,
                [garage_id]
            );

            // Update garage
            const result = await client.query(`
                UPDATE garages SET
                    approval_status = 'pending',
                    rejection_reason = $1,
                    updated_at = NOW()
                WHERE garage_id = $2
                RETURNING *
            `, [reason || 'Access revoked by admin', garage_id]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Garage not found' });
            }

            // Suspend user
            await client.query(`
                UPDATE users SET
                    is_suspended = true,
                    suspension_reason = $1,
                    updated_at = NOW()
                WHERE user_id = $2
            `, [reason || 'Access revoked', garage_id]);

            // Log admin action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, old_value, new_value)
                VALUES ($1, 'revoke_access', 'garage', $2, $3, $4)
            `, [
                adminId,
                garage_id,
                JSON.stringify({ status: currentStatus.rows[0]?.approval_status }),
                JSON.stringify({ status: 'pending', reason })
            ]);

            await client.query('COMMIT');

            res.json({
                message: 'Garage access revoked',
                garage: result.rows[0]
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('[ADMIN] revokeGarageAccess error:', err);
        res.status(500).json({ error: 'Failed to revoke access' });
    }
};

// ============================================================================
// ADMIN DASHBOARD STATS
// ============================================================================

/**
 * Get admin dashboard overview statistics
 */
export const getAdminDashboardStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM garages WHERE approval_status = 'pending' OR approval_status IS NULL) as pending_approvals,
                (SELECT COUNT(*) FROM garages WHERE approval_status = 'approved') as approved_garages,
                (SELECT COUNT(*) FROM garages WHERE approval_status = 'demo' AND demo_expires_at > NOW()) as active_demos,
                (SELECT COUNT(*) FROM garages WHERE approval_status = 'demo' AND demo_expires_at <= NOW()) as expired_demos,
                (SELECT COUNT(*) FROM users WHERE user_type = 'customer') as total_customers,
                (SELECT COUNT(*) FROM users WHERE user_type = 'driver') as total_drivers,
                (SELECT COUNT(*) FROM orders WHERE order_status IN ('confirmed', 'preparing', 'in_transit')) as active_orders,
                (SELECT COUNT(*) FROM disputes WHERE dispute_status = 'open') as open_disputes,
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE order_status = 'completed' AND created_at > NOW() - INTERVAL '30 days') as monthly_revenue
        `);

        res.json({
            stats: stats.rows[0]
        });
    } catch (err: any) {
        console.error('[ADMIN] getAdminDashboardStats error:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};

/**
 * Get admin audit log
 */
export const getAuditLog = async (req: AuthRequest, res: Response) => {
    const { page = 1, limit = 50, action_type, target_type } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (action_type) {
            whereClause += ` AND action_type = $${paramIndex++}`;
            params.push(action_type);
        }

        if (target_type) {
            whereClause += ` AND target_type = $${paramIndex++}`;
            params.push(target_type);
        }

        const result = await pool.query(`
            SELECT 
                al.*,
                u.full_name as admin_name,
                u.email as admin_email
            FROM admin_audit_log al
            LEFT JOIN users u ON al.admin_id = u.user_id
            ${whereClause}
            ORDER BY al.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...params, limit, offset]);

        res.json({ logs: result.rows });
    } catch (err: any) {
        console.error('[ADMIN] getAuditLog error:', err);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
};
