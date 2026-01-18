/**
 * AnalyticsService - Admin Dashboard Statistics & Audit Logs
 * Simplest admin service - no complex business logic, just data aggregation
 */

import { Pool } from 'pg';
import {
    DashboardStats,
    AuditFilters,
    PaginatedAuditLog
} from './types';

export class AnalyticsService {
    constructor(private pool: Pool) { }

    /**
     * Get admin dashboard overview statistics
     * Aggregates critical metrics from across the platform
     */
    async getDashboardStats(): Promise<DashboardStats> {
        const result = await this.pool.query(`
            SELECT
                -- Critical metrics
                (SELECT COUNT(*) FROM garages WHERE approval_status = 'pending' OR approval_status IS NULL) as pending_approvals,
                (SELECT COUNT(*) FROM subscription_change_requests WHERE status = 'pending') as pending_plan_requests,
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

        return {
            pending_approvals: parseInt(result.rows[0].pending_approvals) || 0,
            pending_plan_requests: parseInt(result.rows[0].pending_plan_requests) || 0,
            active_orders: parseInt(result.rows[0].active_orders) || 0,
            open_disputes: parseInt(result.rows[0].open_disputes) || 0,
            monthly_revenue: parseFloat(result.rows[0].monthly_revenue) || 0,
            approved_garages: parseInt(result.rows[0].approved_garages) || 0,
            active_demos: parseInt(result.rows[0].active_demos) || 0,
            expiring_soon: parseInt(result.rows[0].expiring_soon) || 0,
            total_staff: parseInt(result.rows[0].total_staff) || 0,
            total_users: parseInt(result.rows[0].total_users) || 0,
            active_drivers: parseInt(result.rows[0].active_drivers) || 0,
            today_signups: parseInt(result.rows[0].today_signups) || 0
        };
    }

    /**
     * Get admin audit log with filtering and pagination
     * Tracks all administrative actions for compliance
     */
    async getAuditLog(filters: AuditFilters): Promise<PaginatedAuditLog> {
        const {
            action_type,
            target_type,
            page = 1,
            limit = 20
        } = filters;

        const pageNum = Math.max(1, page);
        const limitNum = Math.min(100, Math.max(1, limit));
        const offset = (pageNum - 1) * limitNum;

        // Build WHERE clause
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
        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM admin_audit_log al ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Get paginated logs
        const result = await this.pool.query(`
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

        return {
            logs: result.rows,
            pagination: {
                current_page: pageNum,
                total_pages: Math.ceil(total / limitNum),
                total,
                limit: limitNum
            }
        };
    }
}
