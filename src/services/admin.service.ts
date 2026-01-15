/**
 * AdminService - Platform Administration Business Logic
 * 
 * Extracted from admin.controller.ts (1,572 lines) to enable:
 * - Testability
 * - Reusability
 * - Consistent error handling
 * - Type safety
 */

import pool from '../config/db';
import { ApiError, ErrorCode } from '../middleware/errorHandler.middleware';

// ============================================
// TYPES
// ============================================

export interface Garage {
    garage_id: string;
    garage_name: string;
    approval_status: 'pending' | 'approved' | 'rejected' | 'demo' | 'expired';
    demo_expires_at?: Date;
    phone_number?: string;
    email?: string;
}

export interface ApproveGarageParams {
    garage_id: string;
    admin_id: string;
    notes?: string;
}

export interface RejectGarageParams {
    garage_id: string;
    admin_id: string;
    reason: string;
}

export interface GrantDemoParams {
    garage_id: string;
    admin_id: string;
    days?: number;
    notes?: string;
}

export interface AssignPlanParams {
    garage_id: string;
    admin_id: string;
    plan_id: string;
    months?: number;
    notes?: string;
}

export interface DashboardStats {
    pending_approvals: number;
    pending_plan_requests: number;
    active_orders: number;
    open_disputes: number;
    monthly_revenue: number;
    approved_garages: number;
    active_demos: number;
    expiring_soon: number;
    total_staff: number;
    total_users: number;
    active_drivers: number;
    today_signups: number;
}

const DEMO_PERIOD_DAYS = 30;

// ============================================
// ADMIN SERVICE
// ============================================

export class AdminService {

    /**
     * Get garages with filters and pagination
     */
    static async getGarages(params: {
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{ garages: Garage[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
        const { status, search, page = 1, limit = 20 } = params;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const queryParams: unknown[] = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            whereClause += ` AND g.approval_status = $${paramIndex++}`;
            queryParams.push(status);
        }

        if (search) {
            whereClause += ` AND (g.garage_name ILIKE $${paramIndex} OR u.phone_number ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        // Count
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM garages g JOIN users u ON g.garage_id = u.user_id ${whereClause}`,
            queryParams
        );
        const total = parseInt(countResult.rows[0].count);

        // Data
        const result = await pool.query(`
            SELECT 
                g.*,
                u.phone_number,
                u.email,
                u.full_name,
                u.is_active,
                u.created_at as registration_date,
                (SELECT COUNT(*) FROM orders WHERE garage_id = g.garage_id) as total_orders,
                (SELECT COUNT(*) FROM bids WHERE garage_id = g.garage_id) as total_bids,
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
        `, [...queryParams, limit, offset]);

        return {
            garages: result.rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Approve a garage
     */
    static async approveGarage(params: ApproveGarageParams): Promise<{ garage: Garage }> {
        const { garage_id, admin_id, notes } = params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const garageResult = await client.query(`
                UPDATE garages SET
                    approval_status = 'approved',
                    approval_date = NOW(),
                    approved_by = $1,
                    admin_notes = $2,
                    updated_at = NOW()
                WHERE garage_id = $3
                RETURNING *
            `, [admin_id, notes || 'Approved by admin', garage_id]);

            if (garageResult.rows.length === 0) {
                throw ApiError.notFound('Garage not found');
            }

            // Activate user account
            await client.query(`
                UPDATE users SET is_active = true, updated_at = NOW()
                WHERE user_id = $1
            `, [garage_id]);

            // Log action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, new_value)
                VALUES ($1, 'approve_garage', 'garage', $2, $3)
            `, [admin_id, garage_id, JSON.stringify({ status: 'approved', notes })]);

            await client.query('COMMIT');
            return { garage: garageResult.rows[0] };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Reject a garage
     */
    static async rejectGarage(params: RejectGarageParams): Promise<{ garage: Garage }> {
        const { garage_id, admin_id, reason } = params;

        if (!reason) {
            throw ApiError.badRequest('Rejection reason is required');
        }

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
                throw ApiError.notFound('Garage not found');
            }

            // Deactivate user
            await client.query(`
                UPDATE users SET is_active = false, updated_at = NOW()
                WHERE user_id = $1
            `, [garage_id]);

            // Log action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, new_value)
                VALUES ($1, 'reject_garage', 'garage', $2, $3)
            `, [admin_id, garage_id, JSON.stringify({ status: 'rejected', reason })]);

            await client.query('COMMIT');
            return { garage: result.rows[0] };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Grant demo access to a garage
     */
    static async grantDemoAccess(params: GrantDemoParams): Promise<{ garage: Garage; expires_at: Date }> {
        const { garage_id, admin_id, days = DEMO_PERIOD_DAYS, notes } = params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + Number(days));

            // Cancel active subscriptions
            await client.query(`
                UPDATE garage_subscriptions 
                SET status = 'cancelled', cancelled_at = NOW(), 
                    cancellation_reason = 'Downgraded to demo by admin',
                    updated_at = NOW()
                WHERE garage_id = $1 AND status IN ('active', 'trial')
            `, [garage_id]);

            // Update garage to demo
            const result = await client.query(`
                UPDATE garages SET
                    approval_status = 'demo',
                    demo_expires_at = $1,
                    approved_by = $2,
                    admin_notes = $3,
                    updated_at = NOW()
                WHERE garage_id = $4
                RETURNING *
            `, [expiryDate, admin_id, notes || `Demo access for ${days} days`, garage_id]);

            if (result.rows.length === 0) {
                throw ApiError.notFound('Garage not found');
            }

            // Activate user
            await client.query(`
                UPDATE users SET is_active = true, updated_at = NOW()
                WHERE user_id = $1
            `, [garage_id]);

            // Log action
            await client.query(`
                INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, new_value)
                VALUES ($1, 'grant_demo', 'garage', $2, $3)
            `, [admin_id, garage_id, JSON.stringify({ days, expires_at: expiryDate })]);

            await client.query('COMMIT');
            return { garage: result.rows[0], expires_at: expiryDate };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Assign a subscription plan to a garage
     */
    static async assignPlanToGarage(params: AssignPlanParams): Promise<{ subscription: unknown }> {
        const { garage_id, admin_id, plan_id, months = 1, notes } = params;

        if (!plan_id) {
            throw ApiError.badRequest('Plan ID is required');
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Verify plan exists
            const planCheck = await client.query(
                `SELECT * FROM subscription_plans WHERE plan_id = $1`,
                [plan_id]
            );
            if (planCheck.rows.length === 0) {
                throw ApiError.notFound('Plan not found');
            }
            const plan = planCheck.rows[0];

            // Cancel existing subscriptions
            await client.query(`
                UPDATE garage_subscriptions 
                SET status = 'cancelled', updated_at = NOW()
                WHERE garage_id = $1 AND status IN ('active', 'trial')
            `, [garage_id]);

            // Update garage to approved
            await client.query(`
                UPDATE garages SET
                    approval_status = 'approved',
                    demo_expires_at = NULL,
                    approved_by = $1,
                    approval_date = NOW(),
                    updated_at = NOW()
                WHERE garage_id = $2
            `, [admin_id, garage_id]);

            // Activate user
            await client.query(`
                UPDATE users SET is_active = true, is_suspended = false, updated_at = NOW()
                WHERE user_id = $1
            `, [garage_id]);

            // Create subscription
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
            `, [admin_id, garage_id, JSON.stringify({ plan_id, plan_name: plan.plan_name, months })]);

            await client.query('COMMIT');
            return { subscription: subResult.rows[0] };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get admin dashboard statistics
     */
    static async getDashboardStats(): Promise<DashboardStats> {
        const result = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM garages WHERE approval_status = 'pending' OR approval_status IS NULL) as pending_approvals,
                (SELECT COUNT(*) FROM subscription_change_requests WHERE status = 'pending') as pending_plan_requests,
                (SELECT COUNT(*) FROM orders WHERE order_status IN ('confirmed', 'preparing', 'ready_for_pickup', 'collected', 'in_transit')) as active_orders,
                (SELECT COUNT(*) FROM disputes WHERE status IN ('pending', 'contested')) as open_disputes,
                (SELECT COALESCE(SUM(platform_fee + delivery_fee), 0) FROM orders WHERE order_status = 'completed' AND created_at > NOW() - INTERVAL '30 days') as monthly_revenue,
                (SELECT COUNT(*) FROM garages WHERE approval_status = 'approved') as approved_garages,
                (SELECT COUNT(*) FROM garages WHERE approval_status = 'demo' AND demo_expires_at > NOW()) as active_demos,
                (SELECT COUNT(*) FROM garages WHERE approval_status = 'demo' AND demo_expires_at > NOW() AND demo_expires_at <= NOW() + INTERVAL '7 days') as expiring_soon,
                (SELECT COUNT(*) FROM users WHERE user_type = 'staff') as total_staff,
                (SELECT COUNT(*) FROM users WHERE user_type IN ('customer', 'garage', 'driver')) as total_users,
                (SELECT COUNT(*) FROM drivers d JOIN users u ON d.user_id = u.user_id WHERE d.status = 'available' AND u.is_suspended = false) as active_drivers,
                (SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURRENT_DATE) as today_signups
        `);

        return result.rows[0];
    }

    /**
     * Get audit log with pagination
     */
    static async getAuditLog(params: {
        action_type?: string;
        target_type?: string;
        page?: number;
        limit?: number;
    }): Promise<{ logs: unknown[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
        const { action_type, target_type, page = 1, limit = 20 } = params;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const queryParams: unknown[] = [];
        let paramIndex = 1;

        if (action_type) {
            whereClause += ` AND action_type = $${paramIndex++}`;
            queryParams.push(action_type);
        }
        if (target_type) {
            whereClause += ` AND target_type = $${paramIndex++}`;
            queryParams.push(target_type);
        }

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM admin_audit_log ${whereClause}`,
            queryParams
        );
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(`
            SELECT al.*, u.full_name as admin_name, u.email as admin_email
            FROM admin_audit_log al
            LEFT JOIN users u ON al.admin_id = u.user_id
            ${whereClause}
            ORDER BY al.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...queryParams, limit, offset]);

        return {
            logs: result.rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
}

export default AdminService;
