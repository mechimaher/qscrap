/**
 * UserManagementService - User CRUD & Account Management
 * Handles user creation, updates, suspension, and password management
 */

import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcrypt';
import {
    UserFilters,
    User,
    UserDetail,
    PaginatedUsers,
    UserUpdates,
    CreateUserDto
} from './types';
import {
    UserNotFoundError,
    UserAlreadySuspendedError,
    UserAlreadyActiveError,
    InvalidUserTypeError,
    WeakPasswordError,
    DuplicateEmailError,
    DuplicatePhoneError
} from './errors';

export class UserManagementService {
    constructor(private pool: Pool) { }

    /**
     * Get all users with filters and pagination
     */
    async getAllUsers(filters: UserFilters): Promise<PaginatedUsers> {
        const {
            user_type,
            is_active,
            is_suspended,
            search,
            page = 1,
            limit = 20
        } = filters;

        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (user_type) {
            whereClause += ` AND user_type = $${paramIndex++}`;
            params.push(user_type);
        }

        if (is_active !== undefined) {
            whereClause += ` AND is_active = $${paramIndex++}`;
            params.push(is_active);
        }

        if (is_suspended !== undefined) {
            whereClause += ` AND is_suspended = $${paramIndex++}`;
            params.push(is_suspended);
        }

        if (search) {
            whereClause += ` AND (full_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR phone_number ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Get count
        const countResult = await this.pool.query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);

        // Get paginated results
        const result = await this.pool.query(`
            SELECT user_id, user_type, full_name, email, phone_number, is_active, is_suspended, created_at
            FROM users
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...params, limit, offset]);

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

    /**
     * Get user details with activity
     */
    async getUserDetails(userId: string): Promise<UserDetail> {
        const userResult = await this.pool.query(`
            SELECT user_id, user_type, full_name, email, phone_number, 
                   is_active, is_suspended, created_at, last_login, suspension_reason
            FROM users
            WHERE user_id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
            throw new UserNotFoundError(userId);
        }

        const user = userResult.rows[0];

        // Get additional metrics based on user type
        let additionalData: any = {};

        if (user.user_type === 'customer') {
            const orderData = await this.pool.query(`
                SELECT COUNT(*) as total_orders
                FROM orders
                WHERE customer_id = $1
            `, [userId]);
            additionalData.total_orders = parseInt(orderData.rows[0].total_orders);
        } else if (user.user_type === 'garage') {
            const garageData = await this.pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM bids WHERE garage_id = $1) as total_bids,
                    (SELECT COUNT(*) FROM orders WHERE garage_id = $1) as total_orders
            `, [userId]);
            additionalData = garageData.rows[0];
        }

        return {
            ...user,
            ...additionalData
        };
    }

    /**
     * Update user details (admin)
     */
    async updateUser(userId: string, adminId: string, updates: UserUpdates): Promise<User> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const setClauses: string[] = [];
            const params: any[] = [];
            let paramIndex = 1;

            if (updates.full_name) {
                setClauses.push(`full_name = $${paramIndex++}`);
                params.push(updates.full_name);
            }

            if (updates.email) {
                setClauses.push(`email = $${paramIndex++}`);
                params.push(updates.email);
            }

            if (updates.phone_number) {
                setClauses.push(`phone_number = $${paramIndex++}`);
                params.push(updates.phone_number);
            }

            if (updates.is_active !== undefined) {
                setClauses.push(`is_active = $${paramIndex++}`);
                params.push(updates.is_active);
            }

            if (setClauses.length === 0) {
                throw new Error('No valid updates provided');
            }

            setClauses.push(`updated_at = NOW()`);
            params.push(userId);

            const result = await client.query(`
                UPDATE users
                SET ${setClauses.join(', ')}
                WHERE user_id = $${paramIndex}
                RETURNING user_id, user_type, full_name, email, phone_number, is_active, is_suspended, created_at
            `, params);

            if (result.rows.length === 0) {
                throw new UserNotFoundError(userId);
            }

            // Log action
            await this.logAdminAction(client, adminId, 'update_user', userId, updates);

            await client.query('COMMIT');
            return result.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Suspend user account
     */
    async suspendUser(userId: string, adminId: string, reason: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Check current status
            const currentStatus = await client.query(
                'SELECT is_suspended FROM users WHERE user_id = $1',
                [userId]
            );

            if (currentStatus.rows.length === 0) {
                throw new UserNotFoundError(userId);
            }

            if (currentStatus.rows[0].is_suspended) {
                throw new UserAlreadySuspendedError(userId);
            }

            await client.query(`
                UPDATE users
                SET is_suspended = true,
                    suspension_reason = $1,
                    updated_at = NOW()
                WHERE user_id = $2
            `, [reason, userId]);

            // Log action
            await this.logAdminAction(client, adminId, 'suspend_user', userId, { reason });

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Activate/unsuspend user account
     */
    async activateUser(userId: string, adminId: string, notes?: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const currentStatus = await client.query(
                'SELECT is_suspended FROM users WHERE user_id = $1',
                [userId]
            );

            if (currentStatus.rows.length === 0) {
                throw new UserNotFoundError(userId);
            }

            if (!currentStatus.rows[0].is_suspended) {
                throw new UserAlreadyActiveError(userId);
            }

            await client.query(`
                UPDATE users
                SET is_suspended = false,
                    suspension_reason = NULL,
                    updated_at = NOW()
                WHERE user_id = $1
            `, [userId]);

            // Log action
            await this.logAdminAction(client, adminId, 'activate_user', userId, { notes });

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Reset user password (admin)
     */
    async resetPassword(userId: string, adminId: string, newPassword: string): Promise<void> {
        if (newPassword.length < 8) {
            throw new WeakPasswordError();
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const passwordHash = await bcrypt.hash(newPassword, 10);

            const result = await client.query(`
                UPDATE users
                SET password_hash = $1,
                    reset_required = true,
                    updated_at = NOW()
                WHERE user_id = $2
            `, [passwordHash, userId]);

            if (result.rowCount === 0) {
                throw new UserNotFoundError(userId);
            }

            // Log action (don't log password!)
            await this.logAdminAction(client, adminId, 'reset_password', userId, {
                reset_required: true
            });

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Create new user (admin only - all types)
     */
    async createUser(adminId: string, userData: CreateUserDto): Promise<User> {
        const {
            user_type,
            full_name,
            email,
            phone_number,
            password,
            garage_data,
            driver_data,
            permissions
        } = userData;

        // Validate user type
        const validTypes = ['customer', 'garage', 'driver', 'staff'];
        if (!validTypes.includes(user_type)) {
            throw new InvalidUserTypeError(user_type);
        }

        // Validate password
        if (password.length < 8) {
            throw new WeakPasswordError();
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Check for duplicates
            const duplicateCheck = await client.query(`
                SELECT user_id, email, phone_number FROM users
                WHERE email = $1 OR phone_number = $2
            `, [email, phone_number]);

            if (duplicateCheck.rows.length > 0) {
                const dup = duplicateCheck.rows[0];
                if (dup.email === email) {
                    throw new DuplicateEmailError(email);
                }
                if (dup.phone_number === phone_number) {
                    throw new DuplicatePhoneError(phone_number);
                }
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // Create user
            const userResult = await client.query(`
                INSERT INTO users (user_type, full_name, email, phone_number, password_hash, is_active)
                VALUES ($1, $2, $3, $4, $5, true)
                RETURNING user_id, user_type, full_name, email, phone_number, is_active, is_suspended, created_at
            `, [user_type, full_name, email, phone_number, passwordHash]);

            const user = userResult.rows[0];

            // Create type-specific record
            if (user_type === 'garage' && garage_data) {
                await client.query(`
                    INSERT INTO garages (garage_id, garage_name, address, location_lat, location_lng, commercial_registration)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    user.user_id,
                    garage_data.garage_name,
                    garage_data.address,
                    garage_data.location_lat,
                    garage_data.location_lng,
                    garage_data.commercial_registration
                ]);
            } else if (user_type === 'driver' && driver_data) {
                await client.query(`
                    INSERT INTO drivers (user_id, full_name, phone, vehicle_type, vehicle_plate, vehicle_model)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    user.user_id,
                    full_name,
                    phone_number,
                    driver_data.vehicle_type,
                    driver_data.vehicle_plate,
                    driver_data.vehicle_model
                ]);
            } else if (user_type === 'staff' && permissions && permissions.length > 0) {
                // Insert staff permissions (if staff_permissions table exists)
                for (const permission of permissions) {
                    await client.query(`
                        INSERT INTO staff_permissions (user_id, permission)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                    `, [user.user_id, permission]);
                }
            }

            // Log action
            await this.logAdminAction(client, adminId, 'create_user', user.user_id, {
                user_type,
                email,
                phone_number
            });

            await client.query('COMMIT');
            return user;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Log admin action
     */
    private async logAdminAction(
        client: PoolClient,
        adminId: string,
        actionType: string,
        targetId: string,
        data: any
    ): Promise<void> {
        await client.query(`
            INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, new_value)
            VALUES ($1, $2, 'user', $3, $4)
        `, [adminId, actionType, targetId, JSON.stringify(data)]);
    }
}
