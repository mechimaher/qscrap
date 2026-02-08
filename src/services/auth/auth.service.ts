/**
 * Auth Service
 * Handles user registration, login, token refresh, and account management
 */
import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
    getJwtSecret,
    BCRYPT_ROUNDS,
    TRIAL_DAYS,
    TOKEN_EXPIRY_SECONDS,
    REFRESH_TOKEN_EXPIRY_MS,
    generateRefreshToken,
    hashRefreshToken
} from '../../config/security';
import { emitToAdmin } from '../../utils/socketIO';
import logger from '../../utils/logger';

export interface RegisterData {
    phone_number: string;
    password: string;
    user_type: 'customer' | 'garage';
    full_name?: string;
    email?: string;
    garage_name?: string;
    address?: string;
    supplier_type?: string;
    specialized_brands?: string[];
    all_brands?: boolean;
    location_lat?: number;
    location_lng?: number;
    cr_number?: string;
    trade_license_number?: string;
    preferred_plan_code?: string; // Plan garage is interested in upgrading to
}

export interface LoginResult {
    token: string;
    refreshToken?: string;
    userId: string;
    userType: string;
    fullName?: string;
    phoneNumber?: string;
    status?: string;
    message?: string;
    staffRole?: string;
}

export class AuthService {
    constructor(private pool: Pool) { }

    async checkUserExists(phoneNumber: string): Promise<boolean> {
        const result = await this.pool.query('SELECT user_id FROM users WHERE phone_number = $1', [phoneNumber]);
        return result.rows.length > 0;
    }

    async registerUser(data: RegisterData): Promise<{ userId: string; token: string; refreshToken: string }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
            const userResult = await client.query(
                'INSERT INTO users (phone_number, password_hash, user_type, full_name, email) VALUES ($1, $2, $3, $4, $5) RETURNING user_id',
                [data.phone_number, hash, data.user_type, data.full_name, data.email || null]
            );
            const userId = userResult.rows[0].user_id;

            if (data.user_type === 'garage' && data.garage_name) {
                // SECURITY: Garages require admin verification before access
                // Status starts as 'pending' - admin reviews CR/license, then approves
                // preferred_plan_code captures their tier interest for admin
                await client.query(
                    `INSERT INTO garages (garage_id, garage_name, address, location_lat, location_lng, approval_status, supplier_type, specialized_brands, all_brands, cr_number, trade_license_number, current_plan_code, preferred_plan_code) 
                     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, NULL, $11)`,
                    [userId, data.garage_name, data.address, data.location_lat || null, data.location_lng || null, data.supplier_type || 'used', data.specialized_brands || [], data.all_brands !== false, data.cr_number || null, data.trade_license_number || null, data.preferred_plan_code || null]
                );
            }

            await client.query('COMMIT');

            // Emit real-time notification to admin dashboard for new garage registrations
            if (data.user_type === 'garage' && data.garage_name) {
                emitToAdmin('new_garage_registration', {
                    garage_id: userId,
                    garage_name: data.garage_name,
                    phone_number: data.phone_number,
                    registered_at: new Date().toISOString()
                });
            }

            const token = jwt.sign({ userId, userType: data.user_type }, getJwtSecret(), { expiresIn: TOKEN_EXPIRY_SECONDS });

            // Generate refresh token
            const refresh = generateRefreshToken();
            await client.query(
                `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
                 VALUES ($1, $2, NOW() + INTERVAL '1 millisecond' * $3)`,
                [userId, refresh.hash, REFRESH_TOKEN_EXPIRY_MS]
            );

            return { userId, token, refreshToken: refresh.token };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async login(phoneNumber: string, password: string): Promise<LoginResult> {
        const result = await this.pool.query('SELECT * FROM users WHERE phone_number = $1', [phoneNumber]);
        if (result.rows.length === 0) throw new Error('Invalid credentials');
        const user = result.rows[0];

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) throw new Error('Invalid credentials');
        if (user.is_active === false) throw new Error('Account deactivated');
        if (user.is_suspended) throw new Error(user.suspension_reason || 'Account suspended');

        if (user.user_type === 'garage') {
            const garageResult = await this.pool.query(`SELECT approval_status, demo_expires_at, rejection_reason FROM garages WHERE garage_id = $1`, [user.user_id]);
            if (garageResult.rows.length > 0) {
                const garage = garageResult.rows[0];
                if (garage.approval_status === 'pending') throw new Error('pending_approval');
                if (garage.approval_status === 'rejected') throw new Error(`application_rejected:${garage.rejection_reason || 'Application rejected'}`);
                if (garage.approval_status === 'demo' && garage.demo_expires_at && new Date(garage.demo_expires_at) < new Date()) {
                    await this.pool.query(`UPDATE garages SET approval_status = 'expired' WHERE garage_id = $1`, [user.user_id]);
                    await this.pool.query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);
                    const token = jwt.sign({ userId: user.user_id, userType: user.user_type }, getJwtSecret(), { expiresIn: TOKEN_EXPIRY_SECONDS });
                    return { token, userId: user.user_id, userType: user.user_type, status: 'expired', message: 'Demo expired. Please upgrade.' };
                }
                if (garage.approval_status === 'expired') {
                    await this.pool.query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);
                    const token = jwt.sign({ userId: user.user_id, userType: user.user_type }, getJwtSecret(), { expiresIn: TOKEN_EXPIRY_SECONDS });
                    return { token, userId: user.user_id, userType: user.user_type, status: 'expired', message: 'Subscription expired. Please upgrade.' };
                }
            }
        }

        // For staff users, get their role from staff_profiles
        let staffRole: string | undefined;
        if (user.user_type === 'staff') {
            const staffResult = await this.pool.query(
                `SELECT role FROM staff_profiles WHERE user_id = $1 AND is_active = true`,
                [user.user_id]
            );
            if (staffResult.rows.length > 0) {
                staffRole = staffResult.rows[0].role;
            }
        }

        await this.pool.query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);
        const token = jwt.sign({
            userId: user.user_id,
            userType: user.user_type,
            staffRole: staffRole
        }, getJwtSecret(), { expiresIn: TOKEN_EXPIRY_SECONDS });

        // Generate refresh token
        const refresh = generateRefreshToken();
        await this.pool.query(
            `INSERT INTO refresh_tokens (user_id, token_hash, device_info, expires_at)
             VALUES ($1, $2, $3, NOW() + INTERVAL '1 millisecond' * $4)`,
            [user.user_id, refresh.hash, null, REFRESH_TOKEN_EXPIRY_MS]
        );

        return { token, refreshToken: refresh.token, userId: user.user_id, userType: user.user_type, fullName: user.full_name, phoneNumber: user.phone_number, staffRole };
    }

    async deleteAccount(userId: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Check user exists
            const userResult = await client.query('SELECT user_type, email, phone_number FROM users WHERE user_id = $1', [userId]);
            if (userResult.rows.length === 0) throw new Error('User not found');

            const userType = userResult.rows[0].user_type;
            const shortId = userId.slice(-8); // Last 8 chars of UUID for uniqueness
            const anonymizedPhone = `del${shortId}`; // Max 11 chars, fits varchar(20)
            const anonymizedEmail = `deleted_${userId}@deleted.local`;

            // GOOGLE PLAY 2026: Proper account deletion handling
            // Soft delete approach: anonymize user data while keeping referential integrity

            if (userType === 'customer') {
                // Cancel all active requests
                await client.query(
                    `UPDATE part_requests SET status = 'cancelled_by_customer' 
                     WHERE customer_id = $1 AND status IN ('active', 'pending')`,
                    [userId]
                );

                // Anonymize support tickets - set customer_id to NULL (allowed by schema)
                await client.query(
                    `UPDATE support_tickets SET customer_id = NULL 
                     WHERE customer_id = $1`,
                    [userId]
                );

                // Note: order_reviews references orders (not customers directly)
                // Orders are preserved for financial/audit purposes

                // Keep order history but anonymize personal details in orders if needed
                // (orders have foreign keys that need the user to exist)
            } else if (userType === 'garage') {
                // Deactivate garage
                await client.query(
                    `UPDATE garages 
                     SET approval_status = 'rejected', 
                         garage_name = $1,
                         is_active = false
                     WHERE garage_id = $2`,
                    [`Deleted Garage ${userId}`, userId]
                );

                // Cancel active bids
                await client.query(
                    `UPDATE bids SET status = 'withdrawn' 
                     WHERE garage_id = $1 AND status = 'pending'`,
                    [userId]
                );
            }

            // Anonymize user record (soft delete - maintains referential integrity)
            await client.query(
                `UPDATE users 
                 SET phone_number = $1,
                     email = $2,
                     full_name = 'Deleted User',
                     is_active = false,
                     is_suspended = true,
                     suspension_reason = 'Account deleted by user',
                     password_hash = 'deleted',
                     updated_at = NOW()
                 WHERE user_id = $3`,
                [anonymizedPhone, anonymizedEmail, userId]
            );

            // Tables with ON DELETE CASCADE will auto-clean:
            // - push_tokens, notifications, addresses, loyalty_balance, loyalty_history, vehicles

            await client.query('COMMIT');
        } catch (err: any) {
            await client.query('ROLLBACK');
            logger.error('Account deletion failed', {
                userId,
                error: err.message,
                code: err.code,
                detail: err.detail
            });
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Refresh an access token using a valid refresh token.
     * Implements token rotation: old refresh token is revoked, new pair issued.
     */
    async refreshAccessToken(refreshTokenRaw: string): Promise<{ token: string; refreshToken: string }> {
        const tokenHash = hashRefreshToken(refreshTokenRaw);

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Find active (non-revoked, non-expired) refresh token
            const result = await client.query(
                `SELECT rt.token_id, rt.user_id, u.user_type, u.is_active, u.is_suspended,
                        (SELECT sp.role FROM staff_profiles sp WHERE sp.user_id = u.user_id AND sp.is_active = true LIMIT 1) as staff_role
                 FROM refresh_tokens rt
                 JOIN users u ON rt.user_id = u.user_id
                 WHERE rt.token_hash = $1
                   AND rt.revoked_at IS NULL
                   AND rt.expires_at > NOW()
                 FOR UPDATE`,
                [tokenHash]
            );

            if (result.rows.length === 0) {
                throw new Error('Invalid or expired refresh token');
            }

            const row = result.rows[0];

            if (!row.is_active || row.is_suspended) {
                // Revoke all tokens for suspended/deactivated users
                await client.query(
                    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
                    [row.user_id]
                );
                await client.query('COMMIT');
                throw new Error('Account is deactivated or suspended');
            }

            // Revoke the used refresh token
            const newRefresh = generateRefreshToken();
            await client.query(
                `UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = (
                    SELECT token_id FROM refresh_tokens WHERE token_hash = $2
                ) WHERE token_id = $1`,
                [row.token_id, newRefresh.hash]
            );

            // Issue new refresh token
            await client.query(
                `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
                 VALUES ($1, $2, NOW() + INTERVAL '1 millisecond' * $3)`,
                [row.user_id, newRefresh.hash, REFRESH_TOKEN_EXPIRY_MS]
            );

            await client.query('COMMIT');

            // Issue new access token
            const token = jwt.sign({
                userId: row.user_id,
                userType: row.user_type,
                staffRole: row.staff_role || undefined
            }, getJwtSecret(), { expiresIn: TOKEN_EXPIRY_SECONDS });

            return { token, refreshToken: newRefresh.token };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Revoke a specific refresh token (logout).
     */
    async revokeRefreshToken(refreshTokenRaw: string): Promise<void> {
        const tokenHash = hashRefreshToken(refreshTokenRaw);
        await this.pool.query(
            `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
            [tokenHash]
        );
    }

    /**
     * Revoke all refresh tokens for a user (password change, account deletion, force logout).
     */
    async revokeAllUserTokens(userId: string): Promise<void> {
        await this.pool.query(
            `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
            [userId]
        );
    }
}
