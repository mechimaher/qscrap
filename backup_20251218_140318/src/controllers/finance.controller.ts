import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';

// Get payout summary and pending payouts
export const getPayoutSummary = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        let garageId = null;
        let whereClause = '';
        const params: any[] = [];

        if (userType === 'garage') {
            // For garage users, userId IS the garage_id
            garageId = userId;
            whereClause = 'WHERE garage_id = $1';
            params.push(garageId);
        }

        // Get payout stats
        const statsResult = await pool.query(`
            SELECT 
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'completed'), 0) as completed_payouts,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'confirmed'), 0) as confirmed_payouts,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status IN ('completed', 'confirmed')), 0) as total_paid,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'pending'), 0) as pending_payouts,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status IN ('processing', 'awaiting_confirmation')), 0) as processing_payouts,
                COUNT(*) FILTER (WHERE payout_status = 'pending') as pending_count,
                COALESCE(SUM(net_amount) FILTER (
                    WHERE payout_status IN ('completed', 'confirmed') 
                    AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
                    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
                ), 0) as this_month_completed
            FROM garage_payouts
            ${whereClause}
        `, params);

        let totalRevenue = 0;

        if (userType === 'garage') {
            // For garage, Total Revenue = Sum of all completed/pending net_amounts
            const revRes = await pool.query(`
                SELECT COALESCE(SUM(net_amount), 0) as total_revenue
                FROM garage_payouts
                WHERE garage_id = $1 AND payout_status != 'cancelled'
             `, [garageId]);
            totalRevenue = revRes.rows[0].total_revenue;
        } else {
            // For Admin/Ops, Total Revenue = Platform Fees
            const revenueResult = await pool.query(`
                SELECT COALESCE(SUM(platform_fee), 0) as total_revenue
                FROM orders
                WHERE order_status NOT IN ('cancelled_by_customer', 'cancelled_by_garage', 'refunded', 'disputed')
            `);
            totalRevenue = revenueResult.rows[0].total_revenue;
        }

        // Get pending payouts list
        const pendingResult = await pool.query(`
            SELECT gp.*, g.garage_name, o.order_number
            FROM garage_payouts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN orders o ON gp.order_id = o.order_id
            WHERE gp.payout_status = 'pending' ${userType === 'garage' ? 'AND gp.garage_id = $1' : ''}
            ORDER BY gp.created_at ASC
            LIMIT 20
        `, userType === 'garage' ? [garageId] : []);

        res.json({
            stats: {
                ...statsResult.rows[0],
                total_revenue: totalRevenue
            },
            pending_payouts: pendingResult.rows
        });
    } catch (err: any) {
        console.error('getPayoutSummary Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get all payouts with filters
export const getPayouts = async (req: AuthRequest, res: Response) => {
    const { status, garage_id, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        // Force garage filter for garage users
        if (userType === 'garage') {
            // For garage users, userId IS the garage_id
            whereClause += ` AND gp.garage_id = $${paramIndex++}`;
            params.push(userId);
        } else if (garage_id) {
            // Admin/Ops can filter by any garage
            whereClause += ` AND gp.garage_id = $${paramIndex++}`;
            params.push(garage_id);
        }

        if (status) {
            whereClause += ` AND gp.payout_status = $${paramIndex++}`;
            params.push(status);
        }

        const result = await pool.query(`
            SELECT gp.*, g.garage_name, o.order_number
            FROM garage_payouts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN orders o ON gp.order_id = o.order_id
            ${whereClause}
            ORDER BY gp.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...params, Number(limit), offset]);

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM garage_payouts gp ${whereClause}`,
            params
        );

        res.json({
            payouts: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: Number(page),
            limit: Number(limit)
        });
    } catch (err: any) {
        console.error('getPayouts Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Process a payout (mark as completed)
export const processPayout = async (req: AuthRequest, res: Response) => {
    const { payout_id } = req.params;
    const { payout_reference, payout_method } = req.body;

    try {
        const result = await pool.query(`
            UPDATE garage_payouts SET
                payout_status = 'completed',
                payout_method = $1,
                payout_reference = $2,
                processed_at = NOW()
            WHERE payout_id = $3
            RETURNING *
        `, [payout_method || 'bank_transfer', payout_reference || null, payout_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payout not found' });
        }

        res.json({
            payout: result.rows[0],
            message: 'Payout processed successfully'
        });
    } catch (err: any) {
        console.error('processPayout Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Hold a payout
export const holdPayout = async (req: AuthRequest, res: Response) => {
    const { payout_id } = req.params;
    const { reason } = req.body;

    try {
        const result = await pool.query(`
            UPDATE garage_payouts SET
                payout_status = 'on_hold',
                failure_reason = $1
            WHERE payout_id = $2
            RETURNING *
        `, [reason || 'Manual hold by operations', payout_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payout not found' });
        }

        res.json({
            payout: result.rows[0],
            message: 'Payout put on hold'
        });
    } catch (err: any) {
        console.error('holdPayout Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get transaction details
export const getTransactionDetails = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;

    try {
        // Get order info
        const orderResult = await pool.query(`
            SELECT o.*, pr.part_description, pr.car_make, pr.car_model,
                   g.garage_name, u.full_name as customer_name,
                   b.bid_amount, b.bid_id
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users u ON o.customer_id = u.user_id
            JOIN bids b ON o.bid_id = b.bid_id
            WHERE o.order_id = $1
        `, [order_id]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Get payout for this order
        const payoutResult = await pool.query(
            'SELECT * FROM garage_payouts WHERE order_id = $1',
            [order_id]
        );

        // Get refunds for this order
        const refundResult = await pool.query(
            'SELECT * FROM refunds WHERE order_id = $1',
            [order_id]
        );

        res.json({
            order: orderResult.rows[0],
            payout: payoutResult.rows[0] || null,
            refunds: refundResult.rows
        });
    } catch (err: any) {
        console.error('getTransactionDetails Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Create a refund
export const createRefund = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { refund_amount, refund_reason, refund_method } = req.body;

    if (!refund_amount || !refund_reason) {
        return res.status(400).json({ error: 'Amount and reason are required' });
    }

    try {
        const result = await pool.query(`
            INSERT INTO refunds (order_id, refund_amount, refund_reason, refund_method, refund_status, processed_by)
            VALUES ($1, $2, $3, $4, 'completed', $5)
            RETURNING *
        `, [order_id, refund_amount, refund_reason, refund_method || 'original_payment', req.user?.userId]);

        res.status(201).json({
            refund: result.rows[0],
            message: 'Refund created successfully'
        });
    } catch (err: any) {
        console.error('createRefund Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get revenue report
export const getRevenueReport = async (req: AuthRequest, res: Response) => {
    const { period = '30d' } = req.query;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    let interval = '30 days';
    if (period === '7d') interval = '7 days';
    if (period === '90d') interval = '90 days';

    try {
        let garageId = null;
        let whereClause = '';
        const params: any[] = [];

        if (userType === 'garage') {
            // For garage users, userId IS the garage_id
            garageId = userId;
            whereClause = 'AND garage_id = $1';
            params.push(garageId);
        }

        // Daily revenue for the period
        const dailyResult = await pool.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as orders,
                COALESCE(SUM(gross_amount), 0) as gross,
                COALESCE(SUM(commission_amount), 0) as commission,
                COALESCE(SUM(net_amount), 0) as net
            FROM garage_payouts
            WHERE created_at >= CURRENT_DATE - INTERVAL '${interval}' ${whereClause}
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, params);

        // Top garages (If garage, only show self)
        const topGaragesResult = await pool.query(`
            SELECT g.garage_name, 
                   COUNT(DISTINCT gp.order_id) as orders,
                   COALESCE(SUM(gp.gross_amount), 0) as revenue
            FROM garage_payouts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            WHERE gp.created_at >= CURRENT_DATE - INTERVAL '${interval}' ${userType === 'garage' ? 'AND gp.garage_id = $1' : ''}
            GROUP BY g.garage_id, g.garage_name
            ORDER BY revenue DESC
            LIMIT 10
        `, userType === 'garage' ? [garageId] : []);

        res.json({
            period,
            daily_revenue: dailyResult.rows,
            top_garages: topGaragesResult.rows
        });
    } catch (err: any) {
        console.error('getRevenueReport Error:', err);
        res.status(500).json({ error: 'Failed to generate revenue report' });
    }
};
// Get recent transactions (unified Payouts and Refunds) - OPTIMIZED
export const getTransactions = async (req: AuthRequest, res: Response) => {
    const { limit = 20 } = req.query;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        let garageFilter = '';
        const params: any[] = [Number(limit)];

        if (userType === 'garage') {
            garageFilter = 'WHERE garage_id = $2';
            params.push(userId);
        }

        // Optimized query with JOINs - no N+1
        const result = await pool.query(`
            SELECT 
                t.*,
                o.order_number,
                g.garage_name
            FROM (
                SELECT 
                    payout_id::text as id,
                    'payout' as transaction_type,
                    net_amount as amount,
                    payout_status as status,
                    created_at,
                    order_id,
                    garage_id
                FROM garage_payouts
                ${garageFilter}
                
                UNION ALL
                
                SELECT 
                    refund_id::text as id,
                    'refund' as transaction_type,
                    refund_amount as amount,
                    refund_status as status,
                    created_at,
                    order_id,
                    NULL as garage_id
                FROM refunds
                ${userType === 'garage' ? 'WHERE order_id IN (SELECT order_id FROM orders WHERE garage_id = $2)' : ''}
            ) as t
            LEFT JOIN orders o ON t.order_id = o.order_id
            LEFT JOIN garages g ON t.garage_id = g.garage_id
            ORDER BY t.created_at DESC
            LIMIT $1
        `, params);

        res.json({ transactions: result.rows });
    } catch (err: any) {
        console.error('getTransactions Error:', err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
};

// ============================================
// AUTO-PROCESSING PAYOUT SYSTEM
// ============================================

// Force process a pending payout immediately (Operations override)
export const forceProcessPayout = async (req: AuthRequest, res: Response) => {
    const { payout_id } = req.params;
    const { payout_reference, payout_method, notes } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if payout exists and is processable
        const checkResult = await client.query(`
            SELECT gp.*, g.garage_name, o.order_number
            FROM garage_payouts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN orders o ON gp.order_id = o.order_id
            WHERE gp.payout_id = $1
        `, [payout_id]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Payout not found' });
        }

        const payout = checkResult.rows[0];

        if (payout.payout_status === 'completed') {
            return res.status(400).json({ error: 'Payout already completed' });
        }

        // Force process the payout
        const result = await client.query(`
            UPDATE garage_payouts SET
                payout_status = 'completed',
                payout_method = $1,
                payout_reference = $2,
                processed_at = NOW(),
                failure_reason = $3
            WHERE payout_id = $4
            RETURNING *
        `, [
            payout_method || 'manual_transfer',
            payout_reference || `MANUAL-${Date.now()}`,
            notes ? `Force processed: ${notes}` : 'Force processed by operations',
            payout_id
        ]);

        await client.query('COMMIT');

        // Notify garage
        const io = (global as any).io;
        if (io) {
            io.to(`garage_${payout.garage_id}`).emit('payout_completed', {
                payout_id: payout_id,
                order_id: payout.order_id,
                amount: payout.net_amount,
                reference: payout_reference || `MANUAL-${Date.now()}`,
                notification: `✅ Payment of ${payout.net_amount} QAR has been processed!`
            });
        }

        res.json({
            payout: result.rows[0],
            message: 'Payout force-processed successfully'
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[FINANCE] forceProcessPayout error:', err);
        res.status(500).json({ error: 'Failed to process payout' });
    } finally {
        client.release();
    }
};

// Release a held payout back to pending
export const releasePayout = async (req: AuthRequest, res: Response) => {
    const { payout_id } = req.params;
    const { scheduled_for } = req.body;

    try {
        const scheduledDate = scheduled_for
            ? new Date(scheduled_for)
            : new Date(Date.now() + 24 * 60 * 60 * 1000); // Default: tomorrow

        const result = await pool.query(`
            UPDATE garage_payouts SET
                payout_status = 'pending',
                failure_reason = NULL,
                scheduled_for = $1
            WHERE payout_id = $2 AND payout_status = 'on_hold'
            RETURNING *, (SELECT garage_name FROM garages WHERE garage_id = garage_payouts.garage_id) as garage_name
        `, [scheduledDate, payout_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payout not found or not on hold' });
        }

        const payout = result.rows[0];

        // Notify garage
        const io = (global as any).io;
        if (io) {
            io.to(`garage_${payout.garage_id}`).emit('payout_released', {
                payout_id: payout_id,
                scheduled_for: scheduledDate.toISOString().split('T')[0],
                notification: `🔓 Payout released! Payment scheduled for ${scheduledDate.toLocaleDateString()}`
            });
        }

        res.json({
            payout: result.rows[0],
            message: `Payout released and scheduled for ${scheduledDate.toLocaleDateString()}`
        });
    } catch (err: any) {
        console.error('[FINANCE] releasePayout error:', err);
        res.status(500).json({ error: 'Failed to release payout' });
    }
};

// Get payout processing status and timeline
export const getPayoutStatus = async (req: AuthRequest, res: Response) => {
    const { payout_id } = req.params;

    try {
        const result = await pool.query(`
            SELECT gp.*,
                   g.garage_name,
                   o.order_number, o.order_status, o.completed_at,
                   CASE 
                       WHEN gp.payout_status = 'completed' THEN 'Completed'
                       WHEN gp.payout_status = 'on_hold' THEN 'On Hold'
                       WHEN gp.payout_status = 'processing' THEN 'Processing'
                       WHEN gp.scheduled_for <= CURRENT_DATE THEN 'Ready for Processing'
                       ELSE 'Scheduled'
                   END as processing_status,
                   CASE 
                       WHEN gp.payout_status = 'pending' AND gp.scheduled_for > CURRENT_DATE 
                       THEN gp.scheduled_for - CURRENT_DATE 
                       ELSE 0 
                   END as days_until_processing,
                   (
                       SELECT COUNT(*) > 0 
                       FROM disputes d 
                       WHERE d.order_id = gp.order_id 
                       AND d.status IN ('pending', 'under_review', 'contested')
                   ) as has_active_dispute
            FROM garage_payouts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN orders o ON gp.order_id = o.order_id
            WHERE gp.payout_id = $1
        `, [payout_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payout not found' });
        }

        res.json({ payout: result.rows[0] });
    } catch (err: any) {
        console.error('[FINANCE] getPayoutStatus error:', err);
        res.status(500).json({ error: 'Failed to fetch payout status' });
    }
};

// Get payout configuration (for admin/operations)
export const getPayoutConfig = async (_req: AuthRequest, res: Response) => {
    // In production, these would be stored in a config table
    const config = {
        processing_delay_days: 7,
        auto_processing_enabled: true,
        dispute_hold_enabled: true,
        payout_methods: ['bank_transfer', 'cash', 'check', 'mobile_transfer'],
        minimum_payout_amount: 0,
        confirmation_deadline_days: 7,
        next_auto_process_run: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    };

    res.json({ config });
};

// ============================================
// 2-WAY CONFIRMATION PAYOUT WORKFLOW
// ============================================

/**
 * Operations: Send Payment to Garage
 * Marks payout as sent and awaiting garage confirmation
 */
export const sendPayment = async (req: AuthRequest, res: Response) => {
    const { payout_id } = req.params;
    const { payout_method, payout_reference, notes, payment_proof_url } = req.body;

    // Debug logging
    console.log('[FINANCE] sendPayment request body:', JSON.stringify(req.body, null, 2));
    console.log('[FINANCE] payout_method:', payout_method, 'payout_reference:', payout_reference);

    if (!payout_method || !payout_reference) {
        return res.status(400).json({ error: 'Payment method and reference number are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get payout details
        const payoutResult = await client.query(`
            SELECT gp.*, g.garage_name, o.order_number
            FROM garage_payouts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN orders o ON gp.order_id = o.order_id
            WHERE gp.payout_id = $1
            FOR UPDATE OF gp
        `, [payout_id]);

        if (payoutResult.rows.length === 0) {
            throw new Error('Payout not found');
        }

        const payout = payoutResult.rows[0];

        if (payout.payout_status === 'completed' || payout.payout_status === 'confirmed') {
            throw new Error('Payout already completed');
        }

        // Calculate confirmation deadline (7 days from now) - store in notes for reference
        const confirmationDeadline = new Date();
        confirmationDeadline.setDate(confirmationDeadline.getDate() + 7);

        // Update payout status to awaiting_confirmation
        // Using existing columns only - no schema migration needed
        const result = await client.query(`
            UPDATE garage_payouts SET
                payout_status = 'awaiting_confirmation',
                payout_method = $1,
                payout_reference = $2,
                processed_at = NOW(),
                failure_reason = $3
            WHERE payout_id = $4
            RETURNING *
        `, [
            payout_method,
            payout_reference,
            notes ? `Notes: ${notes}` : null,
            payout_id
        ]);

        await client.query('COMMIT');

        // Notify garage via Socket.IO
        const io = (global as any).io;
        if (io) {
            io.to(`garage_${payout.garage_id}`).emit('payment_sent', {
                payout_id: payout_id,
                order_number: payout.order_number,
                amount: payout.net_amount,
                method: payout_method,
                reference: payout_reference,
                deadline: confirmationDeadline.toISOString(),
                notification: `💰 Payment of ${payout.net_amount} QAR sent via ${payout_method}! Reference: ${payout_reference}. Please confirm receipt within 7 days.`
            });
        }

        res.json({
            payout: result.rows[0],
            message: 'Payment sent successfully. Awaiting garage confirmation.',
            confirmation_deadline: confirmationDeadline
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[FINANCE] sendPayment error:', err);
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
};

/**
 * Garage: Confirm Payment Receipt
 */
export const confirmPayment = async (req: AuthRequest, res: Response) => {
    const { payout_id } = req.params;
    const { notes } = req.body;
    const garageId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get payout and verify ownership
        const payoutResult = await client.query(`
            SELECT gp.*, o.order_number
            FROM garage_payouts gp
            LEFT JOIN orders o ON gp.order_id = o.order_id
            WHERE gp.payout_id = $1 AND gp.garage_id = $2
            FOR UPDATE OF gp
        `, [payout_id, garageId]);

        if (payoutResult.rows.length === 0) {
            throw new Error('Payout not found or access denied');
        }

        const payout = payoutResult.rows[0];

        if (payout.payout_status !== 'awaiting_confirmation') {
            throw new Error(`Cannot confirm payout with status: ${payout.payout_status}`);
        }

        // Update to completed (confirmed = completed in our workflow)
        const result = await client.query(`
            UPDATE garage_payouts SET
                payout_status = 'completed',
                confirmed_at = NOW(),
                garage_confirmation_notes = $1
            WHERE payout_id = $2
            RETURNING *
        `, [notes || 'Confirmed by garage', payout_id]);

        await client.query('COMMIT');

        // Notify operations
        const io = (global as any).io;
        if (io) {
            io.emit('payment_confirmed', {
                payout_id: payout_id,
                garage_id: garageId,
                order_number: payout.order_number,
                amount: payout.net_amount,
                notification: `✅ Garage confirmed receipt of ${payout.net_amount} QAR payment.`
            });
        }

        res.json({
            payout: result.rows[0],
            message: 'Payment confirmed successfully. Thank you!'
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[FINANCE] confirmPayment error:', err);
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
};

/**
 * Garage: Dispute/Report Issue with Payment
 */
export const disputePayment = async (req: AuthRequest, res: Response) => {
    const { payout_id } = req.params;
    const { dispute_reason, description } = req.body;
    const garageId = req.user!.userId;

    if (!dispute_reason) {
        return res.status(400).json({ error: 'Dispute reason is required' });
    }

    const validReasons = ['not_received', 'wrong_amount', 'partial_payment', 'other'];
    if (!validReasons.includes(dispute_reason)) {
        return res.status(400).json({ error: 'Invalid dispute reason' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get payout and verify ownership
        const payoutResult = await client.query(`
            SELECT gp.*, o.order_number, g.garage_name
            FROM garage_payouts gp
            LEFT JOIN orders o ON gp.order_id = o.order_id
            JOIN garages g ON gp.garage_id = g.garage_id
            WHERE gp.payout_id = $1 AND gp.garage_id = $2 FOR UPDATE OF gp
        `, [payout_id, garageId]);

        if (payoutResult.rows.length === 0) {
            throw new Error('Payout not found or access denied');
        }

        const payout = payoutResult.rows[0];

        if (payout.payout_status !== 'awaiting_confirmation') {
            throw new Error(`Cannot dispute payout with status: ${payout.payout_status}`);
        }

        // Update to disputed
        const result = await client.query(`
            UPDATE garage_payouts SET
                payout_status = 'disputed',
                failure_reason = $1,
                garage_confirmation_notes = $2
            WHERE payout_id = $3
            RETURNING *
        `, [
            `${dispute_reason}: ${description || 'No details provided'}`,
            description || dispute_reason,
            payout_id
        ]);

        await client.query('COMMIT');

        // Notify operations
        const io = (global as any).io;
        if (io) {
            io.emit('payment_disputed', {
                payout_id: payout_id,
                garage_id: garageId,
                garage_name: payout.garage_name,
                order_number: payout.order_number,
                amount: payout.net_amount,
                reason: dispute_reason,
                description: description,
                notification: `⚠️ Garage disputed payment of ${payout.net_amount} QAR. Reason: ${dispute_reason}`
            });
        }

        res.json({
            payout: result.rows[0],
            message: 'Payment issue reported. Operations will review and contact you.'
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[FINANCE] disputePayment error:', err);
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
};

/**
 * Garage: Get Payouts Awaiting Confirmation
 */
export const getAwaitingConfirmation = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        // Query using existing columns - calculate deadline as 7 days from created_at/processed_at
        const result = await pool.query(`
            SELECT gp.*, o.order_number,
                   GREATEST(0, 7 - EXTRACT(DAY FROM (NOW() - COALESCE(gp.processed_at, gp.created_at)))) as days_remaining
            FROM garage_payouts gp
            LEFT JOIN orders o ON gp.order_id = o.order_id
            WHERE gp.garage_id = $1 
              AND gp.payout_status = 'awaiting_confirmation'
            ORDER BY gp.created_at ASC
        `, [garageId]);

        res.json({
            awaiting_confirmation: result.rows,
            count: result.rows.length
        });
    } catch (err: any) {
        console.error('[FINANCE] getAwaitingConfirmation error:', err);
        res.status(500).json({ error: 'Failed to fetch awaiting confirmations' });
    }
};

/**
 * Operations: Resolve Disputed Payment
 */
export const resolvePaymentDispute = async (req: AuthRequest, res: Response) => {
    const { payout_id } = req.params;
    const { resolution, new_amount, notes, resend_payment } = req.body;

    const validResolutions = ['confirmed_received', 'amount_corrected', 'resent_payment', 'cancelled'];
    if (!validResolutions.includes(resolution)) {
        return res.status(400).json({ error: 'Invalid resolution type' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const payoutResult = await client.query(`
            SELECT gp.*, g.garage_name, o.order_number
            FROM garage_payouts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            LEFT JOIN orders o ON gp.order_id = o.order_id
            WHERE gp.payout_id = $1 FOR UPDATE OF gp
        `, [payout_id]);

        if (payoutResult.rows.length === 0) {
            throw new Error('Payout not found');
        }

        const payout = payoutResult.rows[0];

        let newStatus = 'completed';
        let updateNotes = notes || '';

        if (resolution === 'confirmed_received') {
            newStatus = 'completed';
            updateNotes = `Dispute resolved: Garage confirmed receipt after review. ${notes || ''}`;
        } else if (resolution === 'amount_corrected' && new_amount) {
            newStatus = 'awaiting_confirmation';
            updateNotes = `Amount corrected from ${payout.net_amount} to ${new_amount}. ${notes || ''}`;
        } else if (resolution === 'resent_payment') {
            newStatus = 'awaiting_confirmation';
            updateNotes = `Payment resent. ${notes || ''}`;
        } else if (resolution === 'cancelled') {
            newStatus = 'failed';
            updateNotes = `Payout cancelled by operations. ${notes || ''}`;
        }

        const confirmationDeadline = new Date();
        confirmationDeadline.setDate(confirmationDeadline.getDate() + 7);

        // Build update dynamically based on whether new_amount is provided
        let updateQuery = `
            UPDATE garage_payouts SET
                payout_status = $1,
                failure_reason = $2,
                resolved_by = $3,
                resolved_at = NOW()`;

        const queryParams: any[] = [newStatus, updateNotes, req.user?.userId];
        let paramIndex = 4;

        if (new_amount !== undefined && new_amount !== null) {
            updateQuery += `, net_amount = $${paramIndex}::numeric`;
            queryParams.push(new_amount);
            paramIndex++;
        }

        if (newStatus === 'awaiting_confirmation') {
            updateQuery += `, confirmation_deadline = $${paramIndex}`;
            queryParams.push(confirmationDeadline);
            paramIndex++;
        }

        updateQuery += ` WHERE payout_id = $${paramIndex} RETURNING *`;
        queryParams.push(payout_id);

        const result = await client.query(updateQuery, queryParams);

        await client.query('COMMIT');

        // Notify garage
        const io = (global as any).io;
        if (io) {
            io.to(`garage_${payout.garage_id}`).emit('dispute_resolved', {
                payout_id: payout_id,
                order_number: payout.order_number,
                resolution: resolution,
                new_status: newStatus,
                notification: `📋 Payment dispute resolved: ${resolution.replace(/_/g, ' ')}. ${resend_payment ? 'Please check for new payment.' : ''}`
            });
        }

        res.json({
            payout: result.rows[0],
            message: `Dispute resolved: ${resolution}`
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[FINANCE] resolvePaymentDispute error:', err);
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
};

/**
 * CRON JOB: Auto-confirm payouts after deadline
 * Call this from scheduler every hour
 */
export const autoConfirmPayouts = async () => {
    try {
        // Auto-confirm payouts that have been awaiting_confirmation for more than 7 days
        const result = await pool.query(`
            UPDATE garage_payouts SET
                payout_status = 'confirmed',
                failure_reason = COALESCE(failure_reason, '') || ' | Auto-confirmed after 7 days'
            WHERE payout_status = 'awaiting_confirmation'
              AND processed_at < NOW() - INTERVAL '7 days'
            RETURNING payout_id, garage_id, net_amount, order_id
        `);

        if (result.rowCount && result.rowCount > 0) {
            console.log(`[CRON] Auto-confirmed ${result.rowCount} payouts`);

            // Notify affected garages
            const io = (global as any).io;
            if (io) {
                for (const payout of result.rows) {
                    io.to(`garage_${payout.garage_id}`).emit('payment_auto_confirmed', {
                        payout_id: payout.payout_id,
                        amount: payout.net_amount,
                        notification: `ℹ️ Payment of ${payout.net_amount} QAR was auto-confirmed after 7 days.`
                    });
                }
            }
        }

        return result.rowCount || 0;
    } catch (err) {
        console.error('[CRON] autoConfirmPayouts error:', err);
        return 0;
    }
};

/**
 * Operations: Get payment statistics with confirmation status
 */
export const getPaymentStats = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE payout_status = 'pending') as pending_count,
                COUNT(*) FILTER (WHERE payout_status = 'awaiting_confirmation') as awaiting_count,
                COUNT(*) FILTER (WHERE payout_status = 'confirmed') as confirmed_count,
                COUNT(*) FILTER (WHERE payout_status = 'disputed') as disputed_count,
                COUNT(*) FILTER (WHERE payout_status = 'completed') as completed_count,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'pending'), 0) as pending_amount,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'awaiting_confirmation'), 0) as awaiting_amount,
                COALESCE(SUM(net_amount) FILTER (WHERE payout_status = 'disputed'), 0) as disputed_amount
            FROM garage_payouts
        `);

        res.json({ stats: result.rows[0] });
    } catch (err: any) {
        console.error('[FINANCE] getPaymentStats error:', err);
        res.status(500).json({ error: 'Failed to fetch payment stats' });
    }
};
