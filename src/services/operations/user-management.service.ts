/**
 * User Management Service
 * Handles customer and garage directory with statistics
 */
import { Pool } from 'pg';
import { UserFilters, PaginationMetadata } from './types';

export class UserManagementService {
    constructor(private pool: Pool) { }

    /**
     * Get users (customers or garages) with pagination
     */
    async getUsers(filters: UserFilters): Promise<{ users: any[]; pagination: PaginationMetadata }> {
        const { type, search, page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;

        if (type === 'garage') {
            let query = `
                SELECT g.*, u.email, u.phone_number as phone, u.created_at as user_created,
                       (SELECT COUNT(*) FROM orders WHERE garage_id = g.garage_id) as total_orders,
                       (SELECT COUNT(*) FROM orders WHERE garage_id = g.garage_id AND order_status = 'completed') as completed_orders
                FROM garages g
                JOIN users u ON g.garage_id = u.user_id
            `;
            const params: any[] = [];
            let paramIndex = 1;

            if (search) {
                query += ` WHERE (g.garage_name ILIKE $${paramIndex} OR u.phone_number ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }

            query += ` ORDER BY g.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            params.push(limit, offset);

            const result = await this.pool.query(query, params);

            // Get count
            let countQuery = `SELECT COUNT(*) FROM garages g JOIN users u ON g.garage_id = u.user_id`;
            const countParams: any[] = [];
            if (search) {
                countQuery += ` WHERE (g.garage_name ILIKE $1 OR u.phone_number ILIKE $1)`;
                countParams.push(`%${search}%`);
            }
            const countResult = await this.pool.query(countQuery, countParams);
            const total = parseInt(countResult.rows[0].count);

            return {
                users: result.rows,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } else {
            // Customers
            let query = `
                SELECT u.*,
                       (SELECT COUNT(*) FROM orders WHERE customer_id = u.user_id) as total_orders,
                       (SELECT COUNT(*) FROM part_requests WHERE customer_id = u.user_id) as total_requests
                FROM users u
                WHERE u.user_type = 'customer'
            `;
            const params: any[] = [];
            let paramIndex = 1;

            if (search) {
                query += ` AND (u.full_name ILIKE $${paramIndex} OR u.phone_number ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }

            query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            params.push(limit, offset);

            const result = await this.pool.query(query, params);

            // Get count
            let countQuery = `SELECT COUNT(*) FROM users u WHERE u.user_type = 'customer'`;
            const countParams: any[] = [];
            if (search) {
                countQuery += ` AND (u.full_name ILIKE $1 OR u.phone_number ILIKE $1)`;
                countParams.push(`%${search}%`);
            }
            const countResult = await this.pool.query(countQuery, countParams);
            const total = parseInt(countResult.rows[0].count);

            return {
                users: result.rows,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        }
    }

    /**
     * Get single user details
     */
    async getUserDetails(userId: string): Promise<any> {
        const result = await this.pool.query(`
            SELECT u.*, 
                   g.garage_name, g.license_number, g.commercial_reg as cr_number,
                   (SELECT COUNT(*) FROM orders WHERE customer_id = u.user_id) as customer_orders,
                   (SELECT COUNT(*) FROM orders WHERE garage_id = u.user_id) as garage_orders,
                   (SELECT COUNT(*) FROM part_requests WHERE customer_id = u.user_id) as total_requests,
                   (SELECT SUM(total_amount) FROM orders WHERE customer_id = u.user_id AND order_status = 'completed') as total_spend
            FROM users u
            LEFT JOIN garages g ON u.user_id = g.garage_id
            WHERE u.user_id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            throw new Error('User not found');
        }

        return result.rows[0];
    }

    /**
     * Suspend user
     */
    async suspendUser(userId: string, reason: string): Promise<void> {
        await this.pool.query(`
            UPDATE users SET is_active = false, updated_at = NOW() WHERE user_id = $1
        `, [userId]);

        // LOG SUSPENSION (Institutional Mandate)
        console.log(`[USER_MGMT] User ${userId} suspended. Reason: ${reason}`);
    }

    /**
     * Activate user
     */
    async activateUser(userId: string): Promise<void> {
        await this.pool.query(`
            UPDATE users SET is_active = true, updated_at = NOW() WHERE user_id = $1
        `, [userId]);
    }

    /**
     * Get user directory statistics
     */
    async getUserStats(): Promise<any> {
        const result = await this.pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE user_type = 'customer') as count_customers,
                (SELECT COUNT(*) FROM garages) as count_garages,
                (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
                (SELECT COUNT(*) FROM users WHERE is_active = false) as inactive_users,
                (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_users_week
        `);
        return result.rows[0];
    }
}
