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
 * Get garage approvals with filters and pagination
 */
export const getPendingGarages = async (req: AuthRequest, res: Response) => {
    const { status = 'pending', search, page = 1, limit = 12 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    try {
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        // Status filter
        if (status && status !== 'all') {
            whereClause += ` AND g.approval_status = $${paramIndex++}`;
            params.push(status);
        }

        // Search filter
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

        const result = await pool.query(`
            SELECT 
                g.*,
                u.phone_number,
                u.email,
                u.full_name,
                u.created_at as registration_date,
                u.is_active,
                u.is_suspended,
                CASE 
                    WHEN g.demo_expires_at IS NOT NULL THEN 
                        EXTRACT(DAYS FROM (g.demo_expires_at - NOW()))::int
                    ELSE NULL 
                END as demo_days_left
            FROM garages g
            JOIN users u ON g.garage_id = u.user_id
            ${whereClause}
            ORDER BY g.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...params, limitNum, offset]);

        res.json({
            garages: result.rows,
            pagination: {
                current_page: pageNum,
                total_pages: Math.ceil(total / limitNum),
                total,
                limit: limitNum
            }
        });
    } catch (err: any) {
        console.error('[ADMIN] getPendingGarages error:', err);
        res.status(500).json({ error: 'Failed to fetch garages' });
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
                CASE 
                    WHEN sp.plan_name IS NOT NULL THEN sp.plan_name
                    WHEN g.approval_status = 'demo' THEN 'Demo'
                    ELSE NULL
                END as plan_name,
                g.demo_expires_at,
                CASE 
                    WHEN g.approval_status = 'demo' AND g.demo_expires_at IS NOT NULL 
                    THEN EXTRACT(DAYS FROM (g.demo_expires_at - NOW()))::int
                    ELSE NULL 
                END as demo_days_left
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

            // Cancel any active paid subscriptions (downgrade to demo)
            await client.query(`
                UPDATE garage_subscriptions 
                SET status = 'cancelled', 
                    cancelled_at = NOW(),
                    cancellation_reason = 'Downgraded to demo by admin',
                    updated_at = NOW()
                WHERE garage_id = $1 AND status IN ('active', 'trial')
            `, [garage_id]);

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
                -- Critical metrics
                (SELECT COUNT(*) FROM garages WHERE approval_status = 'pending' OR approval_status IS NULL) as pending_approvals,
                (SELECT COUNT(*) FROM orders WHERE order_status IN ('confirmed', 'preparing', 'ready_for_pickup', 'collected', 'in_transit')) as active_orders,
                (SELECT COUNT(*) FROM disputes WHERE status IN ('pending', 'contested')) as open_disputes,
                (SELECT COALESCE(SUM(platform_fee + delivery_fee), 0) FROM orders WHERE order_status = 'completed' AND created_at > NOW() - INTERVAL '30 days') as monthly_revenue,
                
                -- Garage metrics
                (SELECT COUNT(*) FROM garages WHERE approval_status = 'approved') as approved_garages,
                (SELECT COUNT(*) FROM garages WHERE approval_status = 'demo' AND demo_expires_at > NOW()) as active_demos,
                (SELECT COUNT(*) FROM garages WHERE approval_status = 'demo' AND demo_expires_at > NOW() AND demo_expires_at <= NOW() + INTERVAL '7 days') as expiring_soon,
                
                -- User metrics
                (SELECT COUNT(*) FROM users WHERE user_type = 'staff') as total_staff,
                (SELECT COUNT(*) FROM users WHERE user_type IN ('customer', 'garage', 'driver')) as total_users,
                (SELECT COUNT(*) FROM drivers d JOIN users u ON d.user_id = u.user_id WHERE d.status = 'available' AND u.is_suspended = false) as active_drivers,
                (SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURRENT_DATE) as today_signups
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
 * Get admin audit log with pagination
 */
export const getAuditLog = async (req: AuthRequest, res: Response) => {
    const { page = 1, limit = 20, action_type, target_type } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

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

        // Get total count
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM admin_audit_log al ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

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
        `, [...params, limitNum, offset]);

        res.json({
            logs: result.rows,
            pagination: {
                current_page: pageNum,
                total_pages: Math.ceil(total / limitNum),
                total,
                limit: limitNum
            }
        });
    } catch (err: any) {
        console.error('[ADMIN] getAuditLog error:', err);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
};

// ============================================================================
// PHASE 3: SUBSCRIPTION & PLAN MANAGEMENT
// ============================================================================

/**
 * Get all subscription plans
 */
export const getSubscriptionPlans = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT sp.*,
                   (SELECT COUNT(*) FROM garage_subscriptions gs WHERE gs.plan_id = sp.plan_id AND gs.status = 'active') as active_count
            FROM subscription_plans sp
            WHERE sp.is_active = true
            ORDER BY sp.display_order ASC
        `);
        res.json({ plans: result.rows });
    } catch (err: any) {
        console.error('[ADMIN] getSubscriptionPlans error:', err);
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
};

/**
 * Assign a plan to a garage (admin override)
 */
export const assignPlanToGarage = async (req: AuthRequest, res: Response) => {
    const { garage_id } = req.params;
    const { plan_id, months = 1, notes } = req.body;
    const adminId = req.user?.userId;

    if (!plan_id) {
        return res.status(400).json({ error: 'Plan ID is required' });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Verify plan exists
            const planCheck = await client.query(
                `SELECT * FROM subscription_plans WHERE plan_id = $1`,
                [plan_id]
            );
            if (planCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Plan not found' });
            }
            const plan = planCheck.rows[0];

            // Cancel existing active subscription
            await client.query(`
                UPDATE garage_subscriptions 
                SET status = 'cancelled', updated_at = NOW()
                WHERE garage_id = $1 AND status IN ('active', 'trial')
            `, [garage_id]);

            // Update garage approval status to 'approved' (promotion from demo)
            await client.query(`
                UPDATE garages SET
                    approval_status = 'approved',
                    demo_expires_at = NULL,
                    approved_by = $1,
                    approval_date = NOW(),
                    updated_at = NOW()
                WHERE garage_id = $2
            `, [adminId, garage_id]);

            // Activate the user account
            await client.query(`
                UPDATE users SET
                    is_active = true,
                    is_suspended = false,
                    updated_at = NOW()
                WHERE user_id = $1
            `, [garage_id]);

            // Create new subscription
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + Number(months));

            const subResult = await client.query(`
                INSERT INTO garage_subscriptions 
                (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end, is_admin_granted, admin_notes)
                VALUES ($1, $2, 'active', $3, $4, true, $5)
                RETURNING *
            `, [garage_id, plan_id, startDate, endDate, notes || 'Granted by admin']);

            // Log action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, new_value)
                VALUES ($1, 'assign_plan', 'garage', $2, $3)
            `, [adminId, garage_id, JSON.stringify({
                plan_id,
                plan_name: plan.plan_name,
                months,
                end_date: endDate
            })]);

            await client.query('COMMIT');

            res.json({
                message: `${plan.plan_name} plan assigned for ${months} month(s)`,
                subscription: subResult.rows[0]
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('[ADMIN] assignPlanToGarage error:', err);
        res.status(500).json({ error: 'Failed to assign plan' });
    }
};

/**
 * Revoke/cancel a garage's subscription
 */
export const revokeSubscription = async (req: AuthRequest, res: Response) => {
    const { garage_id } = req.params;
    const { reason } = req.body;
    const adminId = req.user?.userId;

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get current subscription
            const currentSub = await client.query(`
                SELECT gs.*, sp.plan_name 
                FROM garage_subscriptions gs
                JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
                WHERE gs.garage_id = $1 AND gs.status IN ('active', 'trial')
            `, [garage_id]);

            if (currentSub.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'No active subscription found' });
            }

            // Cancel subscription
            await client.query(`
                UPDATE garage_subscriptions 
                SET status = 'cancelled', 
                    admin_notes = $1,
                    updated_at = NOW()
                WHERE garage_id = $2 AND status IN ('active', 'trial')
            `, [reason || 'Revoked by admin', garage_id]);

            // Log action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, old_value, new_value)
                VALUES ($1, 'revoke_subscription', 'garage', $2, $3, $4)
            `, [
                adminId,
                garage_id,
                JSON.stringify({ plan: currentSub.rows[0].plan_name }),
                JSON.stringify({ status: 'cancelled', reason })
            ]);

            await client.query('COMMIT');

            res.json({ message: 'Subscription revoked' });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('[ADMIN] revokeSubscription error:', err);
        res.status(500).json({ error: 'Failed to revoke subscription' });
    }
};

/**
 * Extend a subscription
 */
export const extendSubscription = async (req: AuthRequest, res: Response) => {
    const { garage_id } = req.params;
    const { months = 1, notes } = req.body;
    const adminId = req.user?.userId;

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get current subscription
            const currentSub = await client.query(`
                SELECT * FROM garage_subscriptions 
                WHERE garage_id = $1 AND status IN ('active', 'trial')
            `, [garage_id]);

            if (currentSub.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'No active subscription found' });
            }

            const currentEnd = new Date(currentSub.rows[0].end_date);
            const newEnd = new Date(currentEnd);
            newEnd.setMonth(newEnd.getMonth() + Number(months));

            // Update subscription
            const result = await client.query(`
                UPDATE garage_subscriptions 
                SET end_date = $1, admin_notes = $2, updated_at = NOW()
                WHERE garage_id = $3 AND status IN ('active', 'trial')
                RETURNING *
            `, [newEnd, notes || `Extended by ${months} month(s)`, garage_id]);

            // Log action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, old_value, new_value)
                VALUES ($1, 'extend_subscription', 'garage', $2, $3, $4)
            `, [
                adminId,
                garage_id,
                JSON.stringify({ end_date: currentEnd }),
                JSON.stringify({ end_date: newEnd, months_added: months })
            ]);

            await client.query('COMMIT');

            res.json({
                message: `Subscription extended by ${months} month(s)`,
                new_end_date: newEnd,
                subscription: result.rows[0]
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('[ADMIN] extendSubscription error:', err);
        res.status(500).json({ error: 'Failed to extend subscription' });
    }
};

/**
 * Override commission rate for a garage
 */
export const overrideCommission = async (req: AuthRequest, res: Response) => {
    const { garage_id } = req.params;
    const { commission_rate, notes } = req.body;
    const adminId = req.user?.userId;

    if (commission_rate === undefined || commission_rate < 0 || commission_rate > 0.5) {
        return res.status(400).json({ error: 'Commission rate must be between 0 and 0.5 (50%)' });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get current subscription
            const currentSub = await client.query(`
                SELECT gs.*, sp.commission_rate as plan_rate
                FROM garage_subscriptions gs
                JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
                WHERE gs.garage_id = $1 AND gs.status IN ('active', 'trial')
            `, [garage_id]);

            if (currentSub.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'No active subscription found' });
            }

            // Add commission override column if not exists and update
            await client.query(`
                ALTER TABLE garage_subscriptions 
                ADD COLUMN IF NOT EXISTS commission_override DECIMAL(4,3)
            `);

            const result = await client.query(`
                UPDATE garage_subscriptions 
                SET commission_override = $1, admin_notes = $2, updated_at = NOW()
                WHERE garage_id = $3 AND status IN ('active', 'trial')
                RETURNING *
            `, [commission_rate, notes || `Commission override: ${(commission_rate * 100).toFixed(1)}%`, garage_id]);

            // Log action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, old_value, new_value)
                VALUES ($1, 'override_commission', 'garage', $2, $3, $4)
            `, [
                adminId,
                garage_id,
                JSON.stringify({ rate: currentSub.rows[0].plan_rate }),
                JSON.stringify({ rate: commission_rate, notes })
            ]);

            await client.query('COMMIT');

            res.json({
                message: `Commission rate set to ${(commission_rate * 100).toFixed(1)}%`,
                subscription: result.rows[0]
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('[ADMIN] overrideCommission error:', err);
        res.status(500).json({ error: 'Failed to override commission' });
    }
};

// ============================================================================
// PHASE 4: USER MANAGEMENT
// ============================================================================

/**
 * Get all users with filters and pagination
 */
export const getAllUsers = async (req: AuthRequest, res: Response) => {
    const { type, user_type, status, search, page = 1, limit = 20 } = req.query;
    const userTypeFilter = user_type || type; // Accept both parameter names
    const offset = (Number(page) - 1) * Number(limit);

    try {
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (userTypeFilter && userTypeFilter !== 'all') {
            whereClause += ` AND user_type = $${paramIndex++}`;
            params.push(userTypeFilter);
        }

        if (status === 'active') {
            whereClause += ` AND is_active = true AND is_suspended = false`;
        } else if (status === 'suspended') {
            whereClause += ` AND is_suspended = true`;
        } else if (status === 'inactive') {
            whereClause += ` AND is_active = false`;
        }

        if (search) {
            whereClause += ` AND (full_name ILIKE $${paramIndex} OR phone_number ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Count
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM users ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Get users
        const result = await pool.query(`
            SELECT 
                user_id, phone_number, email, full_name, user_type,
                is_active, is_suspended, suspension_reason,
                last_login_at, created_at
            FROM users
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...params, limit, offset]);

        res.json({
            users: result.rows,
            pagination: {
                current_page: Number(page),
                limit: Number(limit),
                total,
                total_pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (err: any) {
        console.error('[ADMIN] getAllUsers error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

/**
 * Get user details with activity
 */
export const getAdminUserDetails = async (req: AuthRequest, res: Response) => {
    const { user_id } = req.params;

    try {
        // Get user
        const userResult = await pool.query(`
            SELECT user_id, phone_number, email, full_name, user_type,
                   is_active, is_suspended, suspension_reason,
                   last_login_at, created_at
            FROM users WHERE user_id = $1
        `, [user_id]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];
        let additionalData: any = {};

        // Get type-specific data
        if (user.user_type === 'customer') {
            const orders = await pool.query(`
                SELECT COUNT(*) as total_orders,
                       SUM(CASE WHEN order_status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
                       COALESCE(SUM(total_amount), 0) as total_spent
                FROM orders WHERE customer_id = $1
            `, [user_id]);
            additionalData = orders.rows[0];
        } else if (user.user_type === 'garage') {
            const garage = await pool.query(`
                SELECT g.*, 
                       (SELECT COUNT(*) FROM orders WHERE garage_id = g.garage_id) as total_orders,
                       (SELECT COUNT(*) FROM bids WHERE garage_id = g.garage_id) as total_bids
                FROM garages g WHERE g.garage_id = $1
            `, [user_id]);
            additionalData = garage.rows[0] || {};
        } else if (user.user_type === 'driver') {
            const driver = await pool.query(`
                SELECT COUNT(*) as total_deliveries,
                       SUM(CASE WHEN da.status = 'delivered' THEN 1 ELSE 0 END) as completed_deliveries
                FROM delivery_assignments da WHERE da.driver_id = $1
            `, [user_id]);
            additionalData = driver.rows[0];
        }

        // Get recent activity
        const activity = await pool.query(`
            SELECT * FROM admin_audit_log 
            WHERE target_id = $1 
            ORDER BY created_at DESC LIMIT 10
        `, [user_id]);

        res.json({
            user,
            ...additionalData,
            recent_activity: activity.rows
        });
    } catch (err: any) {
        console.error('[ADMIN] getAdminUserDetails error:', err);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
};

/**
 * Update user details (admin)
 */
export const updateUserAdmin = async (req: AuthRequest, res: Response) => {
    const { user_id } = req.params;
    const { full_name, email, phone_number } = req.body;
    const adminId = req.user?.userId;

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get current values
            const current = await client.query(
                `SELECT full_name, email, phone_number FROM users WHERE user_id = $1`,
                [user_id]
            );

            if (current.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'User not found' });
            }

            // Update
            const result = await client.query(`
                UPDATE users SET
                    full_name = COALESCE($1, full_name),
                    email = COALESCE($2, email),
                    phone_number = COALESCE($3, phone_number),
                    updated_at = NOW()
                WHERE user_id = $4
                RETURNING user_id, full_name, email, phone_number, user_type
            `, [full_name, email, phone_number, user_id]);

            // Log action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, old_value, new_value)
                VALUES ($1, 'update_user', 'user', $2, $3, $4)
            `, [
                adminId,
                user_id,
                JSON.stringify(current.rows[0]),
                JSON.stringify({ full_name, email, phone_number })
            ]);

            await client.query('COMMIT');

            res.json({
                message: 'User updated successfully',
                user: result.rows[0]
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('[ADMIN] updateUserAdmin error:', err);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

/**
 * Admin suspend user
 */
export const adminSuspendUser = async (req: AuthRequest, res: Response) => {
    const { user_id } = req.params;
    const { reason } = req.body;
    const adminId = req.user?.userId;

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE users SET
                    is_suspended = true,
                    suspension_reason = $1,
                    updated_at = NOW()
                WHERE user_id = $2
                RETURNING user_id, full_name, user_type, is_suspended
            `, [reason || 'Suspended by admin', user_id]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'User not found' });
            }

            // Log action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, new_value)
                VALUES ($1, 'suspend_user', 'user', $2, $3)
            `, [adminId, user_id, JSON.stringify({ reason })]);

            await client.query('COMMIT');

            res.json({
                message: 'User suspended',
                user: result.rows[0]
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('[ADMIN] adminSuspendUser error:', err);
        res.status(500).json({ error: 'Failed to suspend user' });
    }
};

/**
 * Admin activate user
 */
export const adminActivateUser = async (req: AuthRequest, res: Response) => {
    const { user_id } = req.params;
    const adminId = req.user?.userId;

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE users SET
                    is_active = true,
                    is_suspended = false,
                    suspension_reason = NULL,
                    updated_at = NOW()
                WHERE user_id = $1
                RETURNING user_id, full_name, user_type, is_active, is_suspended
            `, [user_id]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'User not found' });
            }

            // Log action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, new_value)
                VALUES ($1, 'activate_user', 'user', $2, $3)
            `, [adminId, user_id, JSON.stringify({ status: 'activated' })]);

            await client.query('COMMIT');

            res.json({
                message: 'User activated',
                user: result.rows[0]
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('[ADMIN] adminActivateUser error:', err);
        res.status(500).json({ error: 'Failed to activate user' });
    }
};

/**
 * Admin reset user password
 */
export const adminResetPassword = async (req: AuthRequest, res: Response) => {
    const { user_id } = req.params;
    const { new_password } = req.body;
    const adminId = req.user?.userId;

    if (!new_password || new_password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(new_password, 10);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE users SET
                    password_hash = $1,
                    updated_at = NOW()
                WHERE user_id = $2
                RETURNING user_id, full_name, user_type
            `, [hashedPassword, user_id]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'User not found' });
            }

            // Log action (don't log the actual password!)
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, new_value)
                VALUES ($1, 'reset_password', 'user', $2, $3)
            `, [adminId, user_id, JSON.stringify({ action: 'password_reset' })]);

            await client.query('COMMIT');

            res.json({
                message: 'Password reset successfully',
                user: result.rows[0]
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('[ADMIN] adminResetPassword error:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

// ============================================================================
// ADMIN CREATE USER
// ============================================================================

/**
 * Create a new user (admin only)
 */
export const adminCreateUser = async (req: AuthRequest, res: Response) => {
    const adminId = req.user?.userId;
    const {
        phone_number,
        password,
        full_name,
        email,
        user_type,
        is_active = true,
        garage_data,
        driver_data,
        staff_data
    } = req.body;

    // Validation
    if (!phone_number || !password || !full_name || !user_type) {
        return res.status(400).json({ error: 'Phone, password, name, and user type are required' });
    }

    if (!['customer', 'garage', 'driver', 'admin', 'staff'].includes(user_type)) {
        return res.status(400).json({ error: 'Invalid user type' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (user_type === 'garage' && (!garage_data || !garage_data.garage_name)) {
        return res.status(400).json({ error: 'Garage name is required for garage users' });
    }

    if (user_type === 'staff' && (!staff_data || !staff_data.role)) {
        return res.status(400).json({
            error: 'Staff role is required',
            valid_roles: ['operations', 'accounting', 'customer_service', 'quality_control', 'logistics', 'hr', 'management']
        });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if phone already exists
            const existingUser = await client.query(
                `SELECT user_id FROM users WHERE phone_number = $1`,
                [phone_number]
            );
            if (existingUser.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Phone number already registered' });
            }

            // Hash password
            const bcrypt = require('bcryptjs');
            const passwordHash = await bcrypt.hash(password, 10);

            // Create user
            const userResult = await client.query(`
                INSERT INTO users (phone_number, password_hash, user_type, full_name, email, is_active)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING user_id, phone_number, full_name, email, user_type, is_active, created_at
            `, [phone_number, passwordHash, user_type, full_name, email || null, is_active]);

            const newUser = userResult.rows[0];

            // Create garage record if user_type is garage
            if (user_type === 'garage' && garage_data) {
                const demoExpiresAt = garage_data.approval_status === 'demo'
                    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    : null;

                await client.query(`
                    INSERT INTO garages (
                        garage_id, garage_name, trade_license_number, address, 
                        cr_number, approval_status, demo_expires_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    newUser.user_id,
                    garage_data.garage_name,
                    garage_data.trade_license_number || null,
                    garage_data.address || null,
                    garage_data.cr_number || null,
                    garage_data.approval_status || 'pending',
                    demoExpiresAt
                ]);
            }

            // Create driver record if user_type is driver
            if (user_type === 'driver') {
                await client.query(`
                    INSERT INTO drivers (
                        user_id, full_name, phone, email,
                        vehicle_type, vehicle_plate, vehicle_model,
                        status, is_active
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'available', true)
                `, [
                    newUser.user_id,
                    full_name,
                    phone_number,
                    email || null,
                    driver_data?.vehicle_type || 'motorcycle',
                    driver_data?.vehicle_plate || null,
                    driver_data?.vehicle_model || null
                ]);
            }

            // Create staff profile if user_type is staff
            if (user_type === 'staff' && staff_data) {
                await client.query(`
                    INSERT INTO staff_profiles (
                        user_id, role, department, employee_id, hire_date
                    ) VALUES ($1, $2, $3, $4, $5)
                `, [
                    newUser.user_id,
                    staff_data.role,
                    staff_data.department || null,
                    staff_data.employee_id || null,
                    staff_data.hire_date || new Date()
                ]);
            }

            // Log action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, new_value)
                VALUES ($1, 'create_user', $2, $3, $4)
            `, [adminId, user_type, newUser.user_id, JSON.stringify({
                phone_number,
                full_name,
                user_type,
                garage_name: garage_data?.garage_name
            })]);

            await client.query('COMMIT');

            res.status(201).json({
                message: `${user_type.charAt(0).toUpperCase() + user_type.slice(1)} created successfully`,
                user: newUser
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('[ADMIN] adminCreateUser error:', err);
        res.status(500).json({ error: 'Failed to create user' });
    }
};
