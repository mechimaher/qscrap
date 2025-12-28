import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import fs from 'fs/promises';

// ============================================
// VALIDATION HELPERS
// ============================================

const validateBidAmount = (amount: any): { valid: boolean; value: number; message?: string } => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
        return { valid: false, value: 0, message: 'Bid amount must be a number' };
    }
    if (numAmount <= 0) {
        return { valid: false, value: 0, message: 'Bid amount must be greater than zero' };
    }
    if (numAmount > 1000000) {
        return { valid: false, value: 0, message: 'Bid amount exceeds maximum limit' };
    }
    return { valid: true, value: numAmount };
};

const validateWarrantyDays = (days: any): number | null => {
    if (days === undefined || days === null || days === '') return null;
    const numDays = parseInt(days, 10);
    if (isNaN(numDays) || numDays < 0 || numDays > 365) return null;
    return numDays;
};

const VALID_PART_CONDITIONS = ['new', 'used_excellent', 'used_good', 'used_fair', 'refurbished'];

// ============================================
// BID CONTROLLERS
// ============================================

export const submitBid = async (req: AuthRequest, res: Response) => {
    const { request_id } = req.params;
    const { request_id: bodyRequestId, bid_amount, warranty_days, notes, part_condition, brand_name, part_number } = req.body;

    console.log('[BID] Submit request body:', JSON.stringify(req.body, null, 2));
    console.log('[BID] Submit request files:', req.files ? (req.files as any[]).length : 0);

    const targetRequestId = request_id || bodyRequestId;
    const garageId = req.user!.userId;

    // Validate bid amount
    const amountCheck = validateBidAmount(bid_amount);
    if (!amountCheck.valid) {
        console.log('[BID] Amount validation failed:', amountCheck.message);
        return res.status(400).json({ error: amountCheck.message });
    }

    // Validate warranty days
    const validatedWarranty = validateWarrantyDays(warranty_days);

    // Part condition validation (REQUIRED - must be new, used, or refurbished)
    if (!part_condition || !VALID_PART_CONDITIONS.includes(part_condition)) {
        console.log('[BID] Condition validation failed:', part_condition);
        return res.status(400).json({ error: `Part condition is required. Must be one of: ${VALID_PART_CONDITIONS.join(', ')}` });
    }

    // Files
    const files = req.files as Express.Multer.File[];
    const image_urls = files ? files.map(f => '/' + f.path.replace(/\\/g, '/')) : [];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check request validity
        const reqCheck = await client.query('SELECT status, customer_id FROM part_requests WHERE request_id = $1', [targetRequestId]);
        if (reqCheck.rows.length === 0) throw new Error('Request not found');
        if (reqCheck.rows[0].status !== 'active') throw new Error('Request is no longer active');

        const customerId = reqCheck.rows[0].customer_id;

        // Check if garage already bid on this request
        const existingBid = await client.query(
            'SELECT bid_id FROM bids WHERE request_id = $1 AND garage_id = $2',
            [targetRequestId, garageId]
        );
        if (existingBid.rows.length > 0) {
            throw new Error('You have already submitted a bid for this request');
        }

        // Check subscription limits
        const subCheck = await client.query(
            `SELECT sp.max_bids_per_month, gs.bids_used_this_cycle, gs.status
             FROM garage_subscriptions gs
             LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
             WHERE gs.garage_id = $1 AND gs.status IN ('active', 'trial')
             ORDER BY gs.created_at DESC LIMIT 1`,
            [garageId]
        );

        if (subCheck.rows.length > 0) {
            const { max_bids_per_month, bids_used_this_cycle } = subCheck.rows[0];
            if (max_bids_per_month !== null && bids_used_this_cycle >= max_bids_per_month) {
                throw new Error('Bid limit reached for your subscription plan. Please upgrade to continue.');
            }
        }

        // Insert Bid
        const bidResult = await client.query(
            `INSERT INTO bids 
       (request_id, garage_id, bid_amount, warranty_days, notes, part_condition, brand_name, part_number, image_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING bid_id, created_at`,
            [targetRequestId, garageId, amountCheck.value, validatedWarranty, notes, part_condition, brand_name, part_number, image_urls]
        );

        // Update Request Count
        await client.query(
            `UPDATE part_requests SET bid_count = bid_count + 1 WHERE request_id = $1`,
            [targetRequestId]
        );

        // NOTE: Subscription bid counter is automatically incremented by database trigger
        // 'enforce_subscription_for_bid' - no manual increment needed to avoid duplication

        // Get bid count for anonymization
        const bidCountResult = await client.query(
            'SELECT COUNT(*) FROM bids WHERE request_id = $1',
            [targetRequestId]
        );
        const bidNumber = parseInt(bidCountResult.rows[0].count);

        await client.query('COMMIT');

        // Notify Customer (Real-time) - must match mobile app BidNotification interface
        try {
            (global as any).io.to(`user_${customerId}`).emit('new_bid', {
                bid_id: bidResult.rows[0].bid_id,
                request_id: targetRequestId,
                garage_name: `Garage #${bidNumber}`,
                bid_amount: amountCheck.value,
                part_condition: part_condition || 'used_good',
                warranty_days: validatedWarranty || 0,
                created_at: bidResult.rows[0].created_at
            });
            console.log(`[SOCKET] Emitted new_bid to user_${customerId}`);
        } catch (socketErr) {
            console.error('[SOCKET] Failed to emit new_bid:', socketErr);
        }

        res.status(201).json({
            message: 'Bid submitted successfully',
            bid_id: bidResult.rows[0].bid_id
        });
    } catch (err: any) {
        await client.query('ROLLBACK');

        // Cleanup uploaded files on error
        if (files && files.length > 0) {
            for (const file of files) {
                try {
                    await fs.unlink(file.path);
                    console.log(`[BID] Cleaned up file: ${file.path}`);
                } catch (unlinkErr) {
                    console.error('[BID] File cleanup error:', unlinkErr);
                }
            }
        }

        console.error('[BID] Submit error:', err.message);

        // Return user-friendly error messages
        let userMessage = 'Failed to submit bid';
        if (err.message.includes('not found')) userMessage = 'Request not found';
        else if (err.message.includes('not active')) userMessage = 'Request is no longer active';
        else if (err.message.includes('already submitted')) userMessage = 'You already bid on this request';
        else if (err.message.includes('limit reached')) userMessage = err.message;
        else if (err.message.includes('No active subscription')) userMessage = err.message;
        else if (err.message.includes('demo trial has expired')) userMessage = err.message;

        res.status(400).json({ error: userMessage });
    } finally {
        client.release();
    }
};

export const getMyBids = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { page = 1, limit = 20, status } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    try {
        let whereClause = 'WHERE b.garage_id = $1';
        const params: any[] = [garageId];
        let paramIndex = 2;

        if (status && ['pending', 'accepted', 'rejected', 'withdrawn'].includes(status as string)) {
            whereClause += ` AND b.status = $${paramIndex++}`;
            params.push(status);
        }

        const result = await pool.query(
            `SELECT b.*, 
                    CONCAT(pr.car_make, ' ', pr.car_model, ' ', pr.car_year) as car_summary, 
                    pr.part_description,
                    pr.request_id,
                    pr.status as request_status
             FROM bids b
             JOIN part_requests pr ON b.request_id = pr.request_id
             ${whereClause}
             ORDER BY b.created_at DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            [...params, limitNum, offset]
        );

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM bids b ${whereClause}`,
            params
        );

        res.json({
            bids: result.rows,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: parseInt(countResult.rows[0].count),
                pages: Math.ceil(parseInt(countResult.rows[0].count) / limitNum)
            }
        });
    } catch (err) {
        console.error('[BID] GetMyBids error:', err);
        res.status(500).json({ error: 'Failed to fetch bids' });
    }
};

export const rejectBid = async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const userId = req.user!.userId;

    try {
        const check = await pool.query(
            `SELECT b.bid_id, b.garage_id, b.status, pr.car_make, pr.car_model 
             FROM bids b
             JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE b.bid_id = $1 AND pr.customer_id = $2`,
            [bid_id, userId]
        );

        if (check.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized to reject this bid' });
        }

        const bid = check.rows[0];

        if (bid.status !== 'pending') {
            return res.status(400).json({ error: `Cannot reject bid with status: ${bid.status}` });
        }

        await pool.query(
            "UPDATE bids SET status = 'rejected', updated_at = NOW() WHERE bid_id = $1",
            [bid_id]
        );

        (global as any).io?.to(`garage_${bid.garage_id}`).emit('bid_rejected', {
            bid_id,
            message: `Your bid for ${bid.car_make} ${bid.car_model} was not selected.`
        });

        res.json({ message: 'Bid rejected' });
    } catch (err: any) {
        console.error('[BID] Reject error:', err.message);
        res.status(500).json({ error: 'Failed to reject bid' });
    }
};

export const updateBid = async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const { bid_amount, warranty_days, notes, part_condition, brand_name } = req.body;
    const garageId = req.user!.userId;

    // Validate bid amount if provided
    if (bid_amount !== undefined) {
        const amountCheck = validateBidAmount(bid_amount);
        if (!amountCheck.valid) {
            return res.status(400).json({ error: amountCheck.message });
        }
    }

    // Validate part_condition if provided (REQUIRED values only)
    if (part_condition !== undefined && !VALID_PART_CONDITIONS.includes(part_condition)) {
        return res.status(400).json({ error: 'Part condition must be: new, used, or refurbished' });
    }

    // Notes length validation
    if (notes && notes.length > 1000) {
        return res.status(400).json({ error: 'Notes cannot exceed 1000 characters' });
    }

    try {
        const check = await pool.query(
            `SELECT b.*, pr.customer_id, pr.car_make, pr.car_model
             FROM bids b
             JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE b.bid_id = $1 AND b.garage_id = $2`,
            [bid_id, garageId]
        );

        if (check.rows.length === 0) {
            return res.status(403).json({ error: 'Bid not found or not yours' });
        }

        const bid = check.rows[0];

        if (bid.status !== 'pending') {
            return res.status(400).json({ error: `Cannot update bid with status: ${bid.status}` });
        }

        await pool.query(
            `UPDATE bids SET 
                bid_amount = COALESCE($1, bid_amount),
                warranty_days = COALESCE($2, warranty_days),
                notes = COALESCE($3, notes),
                part_condition = COALESCE($4, part_condition),
                brand_name = COALESCE($5, brand_name),
                updated_at = NOW()
             WHERE bid_id = $6`,
            [bid_amount, warranty_days, notes, part_condition, brand_name, bid_id]
        );

        (global as any).io?.to(`user_${bid.customer_id}`).emit('bid_updated', {
            request_id: bid.request_id,
            message: `A garage updated their bid for ${bid.car_make} ${bid.car_model}`,
            new_amount: bid_amount
        });

        res.json({ message: 'Bid updated successfully' });
    } catch (err: any) {
        console.error('[BID] Update error:', err.message);
        res.status(500).json({ error: 'Failed to update bid' });
    }
};

export const withdrawBid = async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const garageId = req.user!.userId;

    try {
        const check = await pool.query(
            `SELECT b.*, pr.customer_id, pr.car_make, pr.car_model
             FROM bids b
             JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE b.bid_id = $1 AND b.garage_id = $2`,
            [bid_id, garageId]
        );

        if (check.rows.length === 0) {
            return res.status(403).json({ error: 'Bid not found or not yours' });
        }

        const bid = check.rows[0];

        if (bid.status !== 'pending') {
            return res.status(400).json({ error: `Cannot withdraw bid with status: ${bid.status}` });
        }

        await pool.query(
            "UPDATE bids SET status = 'withdrawn', updated_at = NOW() WHERE bid_id = $1",
            [bid_id]
        );

        await pool.query(
            'UPDATE part_requests SET bid_count = GREATEST(0, bid_count - 1) WHERE request_id = $1',
            [bid.request_id]
        );

        (global as any).io?.to(`user_${bid.customer_id}`).emit('bid_withdrawn', {
            request_id: bid.request_id,
            message: `A garage withdrew their bid for ${bid.car_make} ${bid.car_model}`
        });

        res.json({ message: 'Bid withdrawn successfully' });
    } catch (err: any) {
        console.error('[BID] Withdraw error:', err.message);
        res.status(500).json({ error: 'Failed to withdraw bid' });
    }
};
