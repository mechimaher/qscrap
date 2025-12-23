import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db';

// ============================================
// CONFIGURATION
// ============================================
const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '30', 10);
const TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days in seconds

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

// JWT secret - MUST be set in production
const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('FATAL: JWT_SECRET environment variable is required in production');
        }
        console.warn('[AUTH] WARNING: Using development JWT secret. Set JWT_SECRET in production!');
        return 'dev-secret-not-for-production-use-only';
    }
    return secret;
};

// ============================================
// CONTROLLERS
// ============================================

export const register = async (req: Request, res: Response) => {
    const { phone_number, password, user_type, full_name, garage_name, address } = req.body;

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

    // Password strength validation
    const passwordCheck = isStrongPassword(password);
    if (!passwordCheck.valid) {
        return res.status(400).json({ error: passwordCheck.message });
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

        const hash = await bcrypt.hash(password, 12); // Increased from 10 to 12 rounds

        // Insert User
        const userResult = await client.query(
            'INSERT INTO users (phone_number, password_hash, user_type, full_name) VALUES ($1, $2, $3, $4) RETURNING user_id',
            [phone_number, hash, user_type, full_name]
        );
        const userId = userResult.rows[0].user_id;


        // Insert Garage Profile if needed
        if (user_type === 'garage') {
            if (!garage_name) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Garage name is required for garage registration' });
            }
            await client.query(
                'INSERT INTO garages (garage_id, garage_name, address) VALUES ($1, $2, $3)',
                [userId, garage_name, address]
            );

            // Get starter plan for trial subscription
            const planResult = await client.query(
                "SELECT plan_id FROM subscription_plans WHERE plan_code = 'starter' AND is_active = true LIMIT 1"
            );

            const planId = planResult.rows.length > 0 ? planResult.rows[0].plan_id : null;

            // Create free trial subscription with plan_id
            await client.query(
                `INSERT INTO garage_subscriptions (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end, trial_ends_at)
                 VALUES ($1, $2, 'trial', CURRENT_DATE, CURRENT_DATE + $3, NOW() + INTERVAL '1 day' * $3)`,
                [userId, planId, TRIAL_DAYS]
            );
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
