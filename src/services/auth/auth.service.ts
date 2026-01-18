/**
 * Auth Service
 * Handles user registration, login, and account management
 */
import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getJwtSecret, BCRYPT_ROUNDS, TRIAL_DAYS, TOKEN_EXPIRY_SECONDS } from '../../config/security';

export interface RegisterData {
    phone_number: string;
    password: string;
    user_type: 'customer' | 'garage';
    full_name?: string;
    garage_name?: string;
    address?: string;
    supplier_type?: string;
    specialized_brands?: string[];
    all_brands?: boolean;
    location_lat?: number;
    location_lng?: number;
}

export interface LoginResult {
    token: string;
    userId: string;
    userType: string;
    status?: string;
    message?: string;
}

export class AuthService {
    constructor(private pool: Pool) { }

    async checkUserExists(phoneNumber: string): Promise<boolean> {
        const result = await this.pool.query('SELECT user_id FROM users WHERE phone_number = $1', [phoneNumber]);
        return result.rows.length > 0;
    }

    async registerUser(data: RegisterData): Promise<{ userId: string; token: string }> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
            const userResult = await client.query('INSERT INTO users (phone_number, password_hash, user_type, full_name) VALUES ($1, $2, $3, $4) RETURNING user_id', [data.phone_number, hash, data.user_type, data.full_name]);
            const userId = userResult.rows[0].user_id;

            if (data.user_type === 'garage' && data.garage_name) {
                const demoExpiresAt = new Date();
                demoExpiresAt.setDate(demoExpiresAt.getDate() + TRIAL_DAYS);
                await client.query(`INSERT INTO garages (garage_id, garage_name, address, location_lat, location_lng, approval_status, demo_expires_at, supplier_type, specialized_brands, all_brands) VALUES ($1, $2, $3, $4, $5, 'demo', $6, $7, $8, $9)`, [userId, data.garage_name, data.address, data.location_lat || null, data.location_lng || null, demoExpiresAt, data.supplier_type || 'used', data.specialized_brands || [], data.all_brands !== false]);
            }

            await client.query('COMMIT');
            const token = jwt.sign({ userId, userType: data.user_type }, getJwtSecret(), { expiresIn: TOKEN_EXPIRY_SECONDS });
            return { userId, token };
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

        await this.pool.query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);
        const token = jwt.sign({ userId: user.user_id, userType: user.user_type }, getJwtSecret(), { expiresIn: TOKEN_EXPIRY_SECONDS });
        return { token, userId: user.user_id, userType: user.user_type };
    }

    async deleteAccount(userId: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const userResult = await client.query('SELECT user_type FROM users WHERE user_id = $1', [userId]);
            if (userResult.rows.length === 0) throw new Error('User not found');

            const anonymizedPhone = `deleted_${userId}_${Date.now()}`;
            await client.query(`UPDATE users SET phone_number = $1, full_name = 'Deleted User', is_active = false, password_hash = 'deleted', fcm_token = NULL WHERE user_id = $2`, [anonymizedPhone, userId]);
            if (userResult.rows[0].user_type === 'garage') {
                await client.query(`UPDATE garages SET approval_status = 'rejected', garage_name = $1 WHERE garage_id = $2`, [`Deleted Garage ${userId}`, userId]);
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
