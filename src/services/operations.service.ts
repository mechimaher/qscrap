/**
 * OperationsService - Operations Dashboard Business Logic
 * 
 * Extracted from operations.controller.ts (1,260 lines) to enable:
 * - Testability
 * - Reusability
 * - Consistent error handling
 */

import pool from '../config/db';
import { ApiError, ErrorCode } from '../middleware/errorHandler.middleware';
import { createNotification } from './notification.service';
import { cacheGetOrSet, CacheTTL, dashboardStatsKey, invalidateDashboardCache } from '../utils/cache';

// ============================================
// TYPES
// ============================================

export interface DashboardStats {
    active_requests: number;
    pending_bids: number;
    in_progress_orders: number;
    completed_today: number;
    revenue_today: number;
    active_drivers: number;
    pending_disputes: number;
    pending_returns: number;
}

export interface OrderFilters {
    status?: string;
    from_date?: string;
    to_date?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface DisputeFilters {
    status?: string;
    page?: number;
    limit?: number;
}

export interface UserFilters {
    type?: 'customer' | 'garage' | 'driver';
    status?: 'active' | 'suspended';
    search?: string;
    page?: number;
    limit?: number;
}

// ============================================
// OPERATIONS SERVICE
// ============================================

export class OperationsService {

    /**
     * Get live dashboard statistics (cached 1 minute)
     */
    static async getDashboardStats(): Promise<DashboardStats> {
        return cacheGetOrSet(dashboardStatsKey(), async () => {
            const result = await pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM part_requests WHERE status = 'pending') as active_requests,
                    (SELECT COUNT(*) FROM bids WHERE status = 'pending') as pending_bids,
                    (SELECT COUNT(*) FROM orders WHERE order_status IN ('confirmed', 'preparing', 'ready_for_pickup', 'collected', 'in_transit')) as in_progress_orders,
                    (SELECT COUNT(*) FROM orders WHERE order_status = 'completed' AND DATE(created_at) = CURRENT_DATE) as completed_today,
                    (SELECT COALESCE(SUM(platform_fee + delivery_fee), 0) FROM orders WHERE order_status = 'completed' AND DATE(created_at) = CURRENT_DATE) as revenue_today,
                    (SELECT COUNT(*) FROM drivers WHERE status = 'available') as active_drivers,
                    (SELECT COUNT(*) FROM disputes WHERE status IN ('pending', 'contested')) as pending_disputes,
                    (SELECT COUNT(*) FROM delivery_assignments WHERE assignment_type = 'return_to_garage' AND status = 'assigned') as pending_returns
            `);
            return result.rows[0];
        }, CacheTTL.SHORT);
    }

    /**
     * Get orders with filters and pagination
     */
    static async getOrders(filters: OrderFilters): Promise<{
        orders: unknown[];
        pagination: { page: number; total: number; pages: number };
    }> {
        const { status, from_date, to_date, search, page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params: unknown[] = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            whereClause += ` AND o.order_status = $${paramIndex++}`;
            params.push(status);
        }
        if (from_date) {
            whereClause += ` AND o.created_at >= $${paramIndex++}`;
            params.push(from_date);
        }
        if (to_date) {
            whereClause += ` AND o.created_at <= $${paramIndex++}`;
            params.push(to_date);
        }
        if (search) {
            whereClause += ` AND (o.order_number ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex} OR g.garage_name ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Count
        const countResult = await pool.query(`
            SELECT COUNT(*) FROM orders o
            JOIN users u ON o.customer_id = u.user_id
            JOIN garages g ON o.garage_id = g.garage_id
            ${whereClause}
        `, params);
        const total = parseInt(countResult.rows[0].count);

        // Data
        const result = await pool.query(`
            SELECT o.order_id, o.order_number, o.order_status, o.total_amount,
                   o.created_at, o.updated_at, o.driver_id, o.loyalty_discount,
                   u.full_name as customer_name, u.phone_number as customer_phone,
                   g.garage_name, g.garage_id,
                   pr.part_description, pr.car_make, pr.car_model,
                   d.full_name as driver_name
            FROM orders o
            JOIN users u ON o.customer_id = u.user_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            LEFT JOIN drivers d ON o.driver_id = d.user_id
            ${whereClause}
            ORDER BY o.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...params, limit, offset]);

        return {
            orders: result.rows,
            pagination: {
                page,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get order details with full history
     */
    static async getOrderDetails(order_id: string): Promise<unknown> {
        const orderResult = await pool.query(`
            SELECT o.*, 
                   u.full_name as customer_name, u.phone_number as customer_phone,
                   g.garage_name, g.address as garage_address,
                   pr.part_description, pr.car_make, pr.car_model, pr.car_year,
                   d.full_name as driver_name, d.phone as driver_phone
            FROM orders o
            JOIN users u ON o.customer_id = u.user_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            LEFT JOIN drivers d ON o.driver_id = d.user_id
            WHERE o.order_id = $1
        `, [order_id]);

        if (orderResult.rows.length === 0) {
            throw ApiError.notFound('Order not found');
        }

        // Get status history
        const historyResult = await pool.query(`
            SELECT old_status, new_status, reason, changed_by_type, created_at
            FROM order_status_history
            WHERE order_id = $1
            ORDER BY created_at ASC
        `, [order_id]);

        return {
            order: orderResult.rows[0],
            status_history: historyResult.rows
        };
    }

    /**
     * Get disputes with filters
     */
    static async getDisputes(filters: DisputeFilters): Promise<{
        disputes: unknown[];
        pagination: { page: number; total: number; pages: number };
    }> {
        const { status = 'pending', page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params: unknown[] = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            whereClause += ` AND d.status = $${paramIndex++}`;
            params.push(status);
        }

        // Count
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM disputes d ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Data
        const result = await pool.query(`
            SELECT d.*, o.order_number,
                   u.full_name as customer_name,
                   g.garage_name
            FROM disputes d
            JOIN orders o ON d.order_id = o.order_id
            JOIN users u ON d.customer_id = u.user_id
            JOIN garages g ON d.garage_id = g.garage_id
            ${whereClause}
            ORDER BY d.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...params, limit, offset]);

        return {
            disputes: result.rows,
            pagination: {
                page,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Resolve a dispute
     */
    static async resolveDispute(params: {
        dispute_id: string;
        resolution: string;
        admin_notes?: string;
        resolved_by: string;
    }): Promise<{ dispute: unknown }> {
        const { dispute_id, resolution, admin_notes, resolved_by } = params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE disputes SET
                    status = 'resolved',
                    resolution = $1,
                    admin_notes = $2,
                    resolved_by = $3,
                    resolved_at = NOW(),
                    updated_at = NOW()
                WHERE dispute_id = $4
                RETURNING *
            `, [resolution, admin_notes, resolved_by, dispute_id]);

            if (result.rows.length === 0) {
                throw ApiError.notFound('Dispute not found');
            }

            const dispute = result.rows[0];

            // Notify customer
            await createNotification({
                userId: dispute.customer_id,
                type: 'dispute_resolved',
                title: 'Dispute Resolved ✅',
                message: `Your dispute has been resolved: ${resolution}`,
                data: { dispute_id },
                target_role: 'customer'
            });

            await client.query('COMMIT');
            return { dispute };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get users with filters
     */
    static async getUsers(filters: UserFilters): Promise<{
        users: unknown[];
        pagination: { page: number; total: number; pages: number };
    }> {
        const { type, status, search, page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params: unknown[] = [];
        let paramIndex = 1;

        if (type) {
            whereClause += ` AND user_type = $${paramIndex++}`;
            params.push(type);
        }
        if (status === 'active') {
            whereClause += ` AND is_active = true AND is_suspended = false`;
        } else if (status === 'suspended') {
            whereClause += ` AND is_suspended = true`;
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

        // Data
        const result = await pool.query(`
            SELECT user_id, full_name, phone_number, email, user_type,
                   is_active, is_suspended, created_at
            FROM users
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...params, limit, offset]);

        return {
            users: result.rows,
            pagination: {
                page,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Suspend a user
     */
    static async suspendUser(user_id: string, reason: string, admin_id: string): Promise<{ success: boolean }> {
        await pool.query(`
            UPDATE users SET
                is_suspended = true,
                suspension_reason = $1,
                suspended_by = $2,
                updated_at = NOW()
            WHERE user_id = $3
        `, [reason, admin_id, user_id]);

        // Invalidate dashboard cache
        await invalidateDashboardCache();

        return { success: true };
    }

    /**
     * Activate a user
     */
    static async activateUser(user_id: string): Promise<{ success: boolean }> {
        await pool.query(`
            UPDATE users SET
                is_active = true,
                is_suspended = false,
                suspension_reason = NULL,
                updated_at = NOW()
            WHERE user_id = $1
        `, [user_id]);

        return { success: true };
    }

    /**
     * Get pending returns
     */
    static async getPendingReturns(): Promise<unknown[]> {
        const result = await pool.query(`
            SELECT da.*, o.order_number,
                   g.garage_name, g.address as garage_address
            FROM delivery_assignments da
            JOIN orders o ON da.order_id = o.order_id
            JOIN garages g ON o.garage_id = g.garage_id
            WHERE da.assignment_type = 'return_to_garage'
            AND da.status IN ('assigned', 'in_transit')
            ORDER BY da.created_at ASC
        `);
        return result.rows;
    }
}

export default OperationsService;
