import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import {
    getJwtSecret,
    BCRYPT_ROUNDS,
    TRIAL_DAYS,
    TOKEN_EXPIRY_SECONDS
} from '../config/security';

// ============================================
// VALIDATION HELPERS
// ============================================

// Phone number validation (Qatar format: +974XXXXXXXX or 974XXXXXXXX or XXXXXXXX)
const isValidPhoneNumber = (phone: string): boolean => {
    // Remove spaces and dashes
    const cleaned = phone.replace(/[\s-]/g, '');
    // Accept: +974XXXXXXXX, 974XXXXXXXX, or 8-digit local number
    const qatarPhoneRegex = /^(\+?974)?[3-7]\d{7}$/;
    return qatarPhoneRegex.test(cleaned);
};

// Password strength validation
const isStrongPassword = (password: string): { valid: boolean; message?: string } => {
    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number' };
    }
    return { valid: true };
};

// Note: JWT secret handling is now centralized in config/security.ts

// ============================================
// CONTROLLERS
// ============================================

export const register = async (req: Request, res: Response) => {
    const {
        phone_number, password, user_type, full_name, garage_name, address,
        // Garage specialization fields
        supplier_type, specialized_brands, all_brands
    } = req.body;

    // Basic field validation
    if (!phone_number || !password || !user_type) {
        return res.status(400).json({ error: 'Missing required fields: phone_number, password, user_type' });
    }

    // Phone number format validation
    if (!isValidPhoneNumber(phone_number)) {
        return res.status(400).json({
            error: 'Invalid phone number format',
            hint: 'Use Qatar format: +974XXXXXXXX or 8-digit local number'
        });
    }

    // Password length only (no complex requirements)
    if (password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    // User type validation
    if (!['customer', 'garage'].includes(user_type)) {
        return res.status(400).json({ error: 'Invalid user_type. Must be "customer" or "garage"' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check existing user
        const existing = await client.query('SELECT * FROM users WHERE phone_number = $1', [phone_number]);
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'User with this phone number already exists' });
        }

        const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Insert User
        const userResult = await client.query(
            'INSERT INTO users (phone_number, password_hash, user_type, full_name) VALUES ($1, $2, $3, $4) RETURNING user_id',
            [phone_number, hash, user_type, full_name]
        );
        const userId = userResult.rows[0].user_id;


        // Insert Garage Profile if needed - AUTO-GRANT 30-DAY DEMO TRIAL
        if (user_type === 'garage') {
            if (!garage_name) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Garage name is required for garage registration' });
            }

            // Calculate demo expiry date (30 days from now)
            const demoExpiresAt = new Date();
            demoExpiresAt.setDate(demoExpiresAt.getDate() + TRIAL_DAYS);

            // Create garage with auto demo trial and specialization
            await client.query(
                `INSERT INTO garages (garage_id, garage_name, address, approval_status, demo_expires_at,
                                      supplier_type, specialized_brands, all_brands) 
                 VALUES ($1, $2, $3, 'demo', $4, $5, $6, $7)`,
                [userId, garage_name, address, demoExpiresAt,
                    supplier_type || 'used',
                    specialized_brands || [],
                    all_brands !== false]
            );

            // Note: During demo, garage operates without formal subscription
            // Commission = 0% during demo
            // After demo expires, they must subscribe to continue
        }

        await client.query('COMMIT');

        const token = jwt.sign(
            { userId, userType: user_type },
            getJwtSecret(),
            { expiresIn: TOKEN_EXPIRY_SECONDS }
        );

        res.status(201).json({ token, userId, userType: user_type });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[AUTH] Registration error:', err.message);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    } finally {
        client.release();
    }
};

export const login = async (req: Request, res: Response) => {
    const { phone_number, password } = req.body;

    if (!phone_number || !password) {
        return res.status(400).json({ error: 'Phone number and password are required' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE phone_number = $1', [phone_number]);
        if (result.rows.length === 0) {
            // Don't reveal whether user exists
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if user is active
        if (user.is_active === false) {
            return res.status(403).json({
                error: 'Account deactivated',
                message: 'Your account has been deactivated. Please contact support.'
            });
        }

        // Check if user is suspended
        if (user.is_suspended) {
            return res.status(403).json({
                error: 'Account suspended',
                message: user.suspension_reason || 'Your account has been suspended. Please contact support.'
            });
        }

        // ============================================
        // GARAGE APPROVAL CHECK (Admin Module)
        // ============================================
        if (user.user_type === 'garage') {
            const garageResult = await pool.query(
                `SELECT approval_status, demo_expires_at, rejection_reason 
                 FROM garages WHERE garage_id = $1`,
                [user.user_id]
            );

            if (garageResult.rows.length > 0) {
                const garage = garageResult.rows[0];
                const approvalStatus = garage.approval_status || 'pending';

                // Block pending garages
                if (approvalStatus === 'pending') {
                    return res.status(403).json({
                        error: 'pending_approval',
                        message: 'Your account is pending approval. Our team will review your application shortly. You will receive a notification once approved.',
                        status: 'pending'
                    });
                }

                // Block rejected garages
                if (approvalStatus === 'rejected') {
                    return res.status(403).json({
                        error: 'application_rejected',
                        message: garage.rejection_reason || 'Your application has been rejected. Please contact support for more information.',
                        status: 'rejected'
                    });
                }

                // Check if demo has expired
                if (approvalStatus === 'demo' && garage.demo_expires_at) {
                    const demoExpiry = new Date(garage.demo_expires_at);
                    if (demoExpiry < new Date()) {
                        // Auto-update status to 'expired'
                        await pool.query(
                            `UPDATE garages SET approval_status = 'expired' WHERE garage_id = $1`,
                            [user.user_id]
                        );

                        // Allow login but with expired flag (grace period for upgrade)
                        const token = jwt.sign(
                            { userId: user.user_id, userType: user.user_type },
                            getJwtSecret(),
                            { expiresIn: TOKEN_EXPIRY_SECONDS }
                        );

                        await pool.query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);

                        return res.json({
                            token,
                            userType: user.user_type,
                            userId: user.user_id,
                            status: 'expired',
                            message: 'Your demo trial has expired. Please upgrade to continue using all features.'
                        });
                    }
                }

                // Handle already-expired status (allow login with warning)
                if (approvalStatus === 'expired') {
                    const token = jwt.sign(
                        { userId: user.user_id, userType: user.user_type },
                        getJwtSecret(),
                        { expiresIn: TOKEN_EXPIRY_SECONDS }
                    );

                    await pool.query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);

                    return res.json({
                        token,
                        userType: user.user_type,
                        userId: user.user_id,
                        status: 'expired',
                        message: 'Your subscription has expired. Please upgrade to continue using all features.'
                    });
                }

                // Approved and valid demo accounts can proceed
            }
        }

        // Update last login timestamp
        await pool.query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);

        const token = jwt.sign(
            { userId: user.user_id, userType: user.user_type },
            getJwtSecret(),
            { expiresIn: TOKEN_EXPIRY_SECONDS }
        );

        res.json({ token, userType: user.user_type, userId: user.user_id });
    } catch (err: any) {
        console.error('[AUTH] Login error:', err);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
};

export const deleteAccount = async (req: Request, res: Response) => {
    // @ts-ignore
    const userId = req.user?.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if user exists
        const userResult = await client.query('SELECT user_type FROM users WHERE user_id = $1', [userId]);
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found' });
        }

        // Log the deletion for audit
        console.log(`[AUTH] Deleting account for user ${userId}`);

        // anonymize user data (Soft Delete)
        const anonymizedPhone = `deleted_${userId}_${Date.now()}`;
        const anonymizedName = 'Deleted User';

        await client.query(
            `UPDATE users 
             SET phone_number = $1, 
                 full_name = $2, 
                 is_active = false, 
                 password_hash = 'deleted',
                 fcm_token = NULL
             WHERE user_id = $3`,
            [anonymizedPhone, anonymizedName, userId]
        );

        if (userResult.rows[0].user_type === 'garage') {
            await client.query(
                `UPDATE garages 
                 SET approval_status = 'rejected', 
                     garage_name = $1 
                 WHERE garage_id = $2`,
                [`Deleted Garage ${userId}`, userId]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Account deleted successfully' });

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[AUTH] Delete account error:', err);
        res.status(500).json({ error: 'Failed to delete account' });
    } finally {
        client.release();
    }
};
