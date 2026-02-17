import { Request, Response } from 'express';
import logger from '../utils/logger';

/**
 * Dashboard Activity Controller
 * Handles customer activity feeds and garage badge counts
 */

/**
 * GET /customer/activity
 * Get unified activity feed (Parts Orders only - Quick Services purged Jan 19)
 */
export const getCustomerActivity = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.userId;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;

        const pool = (await import('../config/db')).default;

        // Parts Marketplace orders only (Quick Services purged Jan 19, 2026)
        const result = await pool.query(`
            SELECT 
                order_id::text as id,
                'spare_part' as type,
                created_at as date,
                order_status as status,
                'Spare Parts Order' as title,
                'Order #' || SUBSTRING(order_id::text, 1, 8) as subtitle,
                COALESCE(total_amount, 0) as price,
                'QAR' as currency,
                'spare_part' as icon_key,
                actual_delivery_at as completed_at,
                delivery_address
            FROM orders
            WHERE customer_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        // Get total count for pagination
        const countResult = await pool.query(
            `SELECT COUNT(*) as total FROM orders WHERE customer_id = $1`,
            [userId]
        );

        res.json({
            success: true,
            activities: result.rows,
            total: parseInt(countResult.rows[0].total),
            page: Math.floor(offset / limit) + 1,
            limit
        });
    } catch (error) {
        logger.error('Get customer activity error', { error });
        res.status(500).json({ success: false, error: 'Failed to fetch activity' });
    }
};

/**
 * GET /garage/badge-counts
 * Get badge counts for garage dashboard notification badges
 */
export const getGarageBadgeCounts = async (req: Request, res: Response): Promise<void> => {
    try {
        // For garage users, userId IS garageId (they're the same)
        const garageId = (req as any).user?.userId;
        if (!garageId) {
            res.status(403).json({ error: 'Garage not found' });
            return;
        }

        const pool = (await import('../config/db')).default;
        const { BadgeCountService } = await import('../services/notification/badge.service');
        const badgeService = new BadgeCountService(pool);

        const counts = await badgeService.getGarageBadgeCounts(garageId);
        res.json({ success: true, ...counts });
    } catch (err) {
        logger.error('Garage badge counts error', { error: err });
        res.status(500).json({ error: 'Failed to get badge counts' });
    }
};
