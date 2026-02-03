// Migration endpoint - run database migrations via API
import { Router, Request, Response } from 'express';
import pool from '../config/db';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * Run OTP migration
 * GET /migrate/email-otp
 */
router.get('/email-otp', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        logger.info('Starting Email OTP migration...');

        const sqlPath = path.join(__dirname, '../../scripts/migrations/20260124_add_email_otp_system.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await client.query(sql);

        logger.info('Email OTP migration completed successfully!');

        res.json({
            success: true,
            message: 'Email OTP migration completed successfully',
            details: {
                tables_created: ['email_otps'],
                columns_added: ['users.email', 'users.email_verified'],
                indexes_created: ['idx_email_otps_email', 'idx_email_otps_expiry', 'idx_users_email_unique']
            }
        });
    } catch (error: any) {
        logger.error('Migration failed', { error });
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

export default router;
