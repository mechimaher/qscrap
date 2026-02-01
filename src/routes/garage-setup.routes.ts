/**
 * Garage Setup Routes - Magic Link Password Setup
 * Handles B2B garage account activation via magic link email
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../config/db';

const router = Router();

interface SetupTokenPayload {
    garage_id: string;
    type: string;
    iat: number;
}

/**
 * GET /garage/setup
 * Validate magic link token and return garage info
 */
router.get('/setup', async (req: Request, res: Response) => {
    try {
        const { token } = req.query;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid token'
            });
        }

        // Verify JWT token
        let decoded: SetupTokenPayload;
        try {
            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET || 'qscrap-secret-key-2026'
            ) as SetupTokenPayload;
        } catch (jwtErr: any) {
            if (jwtErr.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Token has expired. Please contact support for a new activation link.'
                });
            }
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        if (decoded.type !== 'garage_setup') {
            return res.status(400).json({
                success: false,
                error: 'Invalid token type'
            });
        }

        // Verify token hash exists and not used
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const tokenCheck = await pool.query(`
            SELECT * FROM password_reset_tokens 
            WHERE user_id = $1 
                AND token_hash = $2 
                AND token_type = 'garage_setup'
                AND expires_at > NOW()
                AND used_at IS NULL
        `, [decoded.garage_id, tokenHash]);

        if (tokenCheck.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Token has already been used or expired'
            });
        }

        // Get garage details
        const garageResult = await pool.query(`
            SELECT g.garage_id, g.garage_name, u.email, u.full_name
            FROM garages g
            JOIN users u ON g.garage_id = u.user_id
            WHERE g.garage_id = $1
        `, [decoded.garage_id]);

        if (garageResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Garage not found'
            });
        }

        const garage = garageResult.rows[0];

        return res.json({
            success: true,
            garage: {
                garage_id: garage.garage_id,
                garage_name: garage.garage_name,
                email: garage.email
            }
        });

    } catch (error) {
        console.error('[GarageSetup] Validation error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to validate token'
        });
    }
});

/**
 * POST /garage/setup
 * Set password and complete account activation
 */
router.post('/setup', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                success: false,
                error: 'Token and password are required'
            });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters'
            });
        }

        // Verify JWT token
        let decoded: SetupTokenPayload;
        try {
            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET || 'qscrap-secret-key-2026'
            ) as SetupTokenPayload;
        } catch (jwtErr: any) {
            if (jwtErr.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Token has expired. Please contact support for a new activation link.'
                });
            }
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        if (decoded.type !== 'garage_setup') {
            return res.status(400).json({
                success: false,
                error: 'Invalid token type'
            });
        }

        await client.query('BEGIN');

        // Verify token hash exists and not used
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const tokenCheck = await client.query(`
            SELECT * FROM password_reset_tokens 
            WHERE user_id = $1 
                AND token_hash = $2 
                AND token_type = 'garage_setup'
                AND expires_at > NOW()
                AND used_at IS NULL
            FOR UPDATE
        `, [decoded.garage_id, tokenHash]);

        if (tokenCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(401).json({
                success: false,
                error: 'Token has already been used or expired'
            });
        }

        // Hash the new password
        const passwordHash = await bcrypt.hash(password, 12);

        // Update user password
        await client.query(`
            UPDATE users SET
                password_hash = $1,
                is_active = true,
                updated_at = NOW()
            WHERE user_id = $2
        `, [passwordHash, decoded.garage_id]);

        // Mark token as used
        await client.query(`
            UPDATE password_reset_tokens SET used_at = NOW()
            WHERE user_id = $1 AND token_hash = $2
        `, [decoded.garage_id, tokenHash]);

        await client.query('COMMIT');

        console.log(`[GarageSetup] Password set successfully for garage ${decoded.garage_id}`);

        return res.json({
            success: true,
            message: 'Account activated successfully! You can now log in.',
            redirectUrl: '/login.html'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[GarageSetup] Setup error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to complete setup'
        });
    } finally {
        client.release();
    }
});

export default router;
