import { Request, Response } from 'express';
import logger from '../utils/logger';

/**
 * Fraud Prevention Controller
 * Handles fraud detection, return requests, abuse tracking, and penalties
 */

/**
 * GET /fraud-stats
 * Get fraud prevention statistics for dashboard
 */
export const getFraudStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const pool = (global as any).pool;

        // Get customers on watchlist (flag = watchlist, high_risk, or blocked)
        const watchlistResult = await pool.query(`
            SELECT COUNT(DISTINCT customer_id) as count 
            FROM customers 
            WHERE fraud_flag IN ('watchlist', 'high_risk', 'blocked')
        `);

        // Get pending return requests
        const pendingReturnsResult = await pool.query(`
            SELECT COUNT(*) as count 
            FROM return_requests 
            WHERE status = 'pending'
        `);

        // Get penalties issued this month
        const penaltiesResult = await pool.query(`
            SELECT COALESCE(SUM(penalty_amount), 0) as total 
            FROM garage_penalties 
            WHERE created_at >= DATE_TRUNC('month', NOW())
        `);

        // Prevented fraud amount (rejected returns + blocked orders)
        const preventedResult = await pool.query(`
            SELECT COALESCE(SUM(refund_amount), 0) as total 
            FROM return_requests 
            WHERE status = 'rejected' 
            AND created_at >= DATE_TRUNC('month', NOW())
        `);

        res.json({
            watchlist_count: parseInt(watchlistResult.rows[0]?.count || '0'),
            pending_returns: parseInt(pendingReturnsResult.rows[0]?.count || '0'),
            penalties_this_month: parseFloat(penaltiesResult.rows[0]?.total || '0'),
            prevented_amount: parseFloat(preventedResult.rows[0]?.total || '0')
        });
    } catch (error) {
        logger.error('Failed to get fraud stats', { error });
        res.json({
            watchlist_count: 0,
            pending_returns: 0,
            penalties_this_month: 0,
            prevented_amount: 0
        });
    }
};

/**
 * GET /return-requests
 * Get return requests with optional status filter
 */
export const getReturnRequests = async (req: Request, res: Response): Promise<void> => {
    try {
        const pool = (global as any).pool;
        const status = req.query.status || 'pending';

        const result = await pool.query(`
            SELECT 
                rr.return_id,
                rr.order_id,
                rr.customer_id,
                rr.reason,
                rr.description,
                rr.photo_urls,
                rr.refund_amount,
                rr.status,
                rr.created_at,
                c.full_name as customer_name,
                c.phone_number as customer_phone,
                o.order_number,
                o.part_description
            FROM return_requests rr
            LEFT JOIN customers c ON rr.customer_id = c.customer_id
            LEFT JOIN orders o ON rr.order_id = o.order_id
            WHERE rr.status = $1
            ORDER BY rr.created_at DESC
            LIMIT 50
        `, [status]);

        res.json({ return_requests: result.rows });
    } catch (error) {
        logger.error('Failed to get return requests', { error });
        res.json({ return_requests: [] });
    }
};

/**
 * POST /return-requests/:return_id/approve
 * Approve a return request
 */
export const approveReturnRequest = async (req: Request, res: Response): Promise<void> => {
    try {
        const { return_id } = req.params;
        const operatorId = (req as any).user?.userId;

        const { getReturnService } = await import('../services/cancellation/return.service');
        const pool = (global as any).pool;
        const returnService = getReturnService(pool);
        const result = await returnService.approveReturn(return_id, operatorId);

        res.json(result);
    } catch (error: any) {
        logger.error('Approve return error', { error });
        res.status(400).json({ error: error.message || 'Failed to approve return' });
    }
};

/**
 * POST /return-requests/:return_id/reject
 * Reject a return request
 */
export const rejectReturnRequest = async (req: Request, res: Response): Promise<void> => {
    try {
        const { return_id } = req.params;
        const { rejection_reason } = req.body;
        const operatorId = (req as any).user?.userId;

        if (!rejection_reason) {
            res.status(400).json({ error: 'Rejection reason is required' });
            return;
        }

        const { getReturnService } = await import('../services/cancellation/return.service');
        const pool = (global as any).pool;
        const returnService = getReturnService(pool);
        const result = await returnService.rejectReturn(return_id, operatorId, rejection_reason);

        res.json(result);
    } catch (error: any) {
        logger.error('Reject return error', { error });
        res.status(400).json({ error: error.message || 'Failed to reject return' });
    }
};

/**
 * GET /abuse-tracking
 * Get customer abuse tracking data
 */
export const getAbuseTracking = async (req: Request, res: Response): Promise<void> => {
    try {
        const pool = (global as any).pool;
        const flag = req.query.flag;

        let query = `
            SELECT 
                c.customer_id,
                c.full_name,
                c.phone_number,
                c.fraud_flag,
                COALESCE(cat.returns_count, 0) as returns_this_month,
                COALESCE(cat.defective_claims_count, 0) as defective_claims_this_month,
                COALESCE(cat.cancellations_count, 0) as cancellations_this_month,
                COALESCE(cat.last_updated, c.updated_at) as updated_at
            FROM customers c
            LEFT JOIN customer_abuse_tracking cat 
                ON c.customer_id = cat.customer_id 
                AND cat.month_year = TO_CHAR(NOW(), 'YYYY-MM')
            WHERE c.fraud_flag IS NOT NULL AND c.fraud_flag != 'none'
        `;

        const params: any[] = [];
        if (flag) {
            query += ` AND c.fraud_flag = $1`;
            params.push(flag);
        }

        query += ` ORDER BY 
            CASE c.fraud_flag 
                WHEN 'blocked' THEN 1 
                WHEN 'high_risk' THEN 2 
                WHEN 'watchlist' THEN 3 
                ELSE 4 
            END,
            cat.returns_count DESC NULLS LAST
            LIMIT 100`;

        const result = await pool.query(query, params);
        res.json({ customers: result.rows });
    } catch (error) {
        logger.error('Failed to get abuse tracking', { error });
        res.json({ customers: [] });
    }
};

/**
 * POST /abuse-flag
 * Update customer fraud flag
 */
export const updateAbuseFlag = async (req: Request, res: Response): Promise<void> => {
    try {
        const pool = (global as any).pool;
        const { customer_id, fraud_flag } = req.body;
        const operatorId = (req as any).user?.userId;

        const validFlags = ['none', 'watchlist', 'high_risk', 'blocked'];
        if (!validFlags.includes(fraud_flag)) {
            res.status(400).json({ error: 'Invalid flag value' });
            return;
        }

        await pool.query(
            `UPDATE customers SET fraud_flag = $1, updated_at = NOW() WHERE customer_id = $2`,
            [fraud_flag, customer_id]
        );

        // Audit log
        await pool.query(
            `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, details)
             VALUES ('customer', $1, 'fraud_flag_updated', $2, $3)`,
            [customer_id, operatorId, JSON.stringify({ new_flag: fraud_flag })]
        );

        logger.info('Customer fraud flag updated', { customer_id, fraud_flag, operatorId });
        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to update abuse flag', { error });
        res.status(500).json({ error: 'Failed to update flag' });
    }
};

/**
 * GET /garage-penalties
 * Get garage penalties list
 */
export const getGaragePenalties = async (req: Request, res: Response): Promise<void> => {
    try {
        const pool = (global as any).pool;

        const result = await pool.query(`
            SELECT 
                gp.penalty_id,
                gp.garage_id,
                gp.order_id,
                gp.reason,
                gp.penalty_amount,
                gp.status,
                gp.created_at,
                g.business_name as garage_name,
                o.order_number
            FROM garage_penalties gp
            LEFT JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN orders o ON gp.order_id = o.order_id
            ORDER BY gp.created_at DESC
            LIMIT 50
        `);

        res.json({ penalties: result.rows });
    } catch (error) {
        logger.error('Failed to get garage penalties', { error });
        res.json({ penalties: [] });
    }
};
