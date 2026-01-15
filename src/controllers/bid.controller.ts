import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { emitToGarage, emitToUser, emitToOperations } from '../utils/socketIO';
import { createNotification } from '../services/notification.service';
import fs from 'fs/promises';

import { catchAsync } from '../utils/catchAsync';
import { submitBid as serviceSubmitBid } from '../services/bid.service';

// ============================================
// VALIDATION HELPERS (Required for updateBid)
// ============================================

const VALID_PART_CONDITIONS = ['new', 'used_excellent', 'used_good', 'used_fair', 'refurbished'];

const validateBidAmount = (amount: unknown): { valid: boolean; value: number; message?: string } => {
    const numAmount = parseFloat(String(amount));
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

// ============================================
// BID CONTROLLERS
// ============================================

export const submitBid = catchAsync(async (req: AuthRequest, res: Response) => {
    const { request_id } = req.params;
    const { request_id: bodyRequestId, bid_amount, warranty_days, notes, part_condition, brand_name, part_number } = req.body;
    const garageId = req.user!.userId;

    const targetRequestId = request_id || bodyRequestId;

    const result = await serviceSubmitBid({
        requestId: targetRequestId,
        garageId,
        bidAmount: bid_amount,
        warrantyDays: warranty_days,
        notes,
        partCondition: part_condition,
        brandName: brand_name,
        partNumber: part_number,
        files: req.files as Express.Multer.File[]
    });

    res.status(201).json({
        message: result.message,
        bid_id: result.bid.bid_id
    });
});

export const getMyBids = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { page = 1, limit = 20, status } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    try {
        let whereClause = 'WHERE b.garage_id = $1';
        const params: unknown[] = [garageId];
        let paramIndex = 2;

        if (status && ['pending', 'accepted', 'rejected', 'withdrawn'].includes(status as string)) {
            whereClause += ` AND b.status = $${paramIndex++}`;
            params.push(status);
        }

        // Join with orders to get final accepted amount for accepted bids
        const result = await pool.query(
            `SELECT b.*, 
                    CONCAT(pr.car_make, ' ', pr.car_model, ' ', pr.car_year) as car_summary, 
                    pr.part_description,
                    pr.request_id,
                    pr.status as request_status,
                    o.part_price as final_accepted_amount,
                    o.order_number,
                    o.order_id
             FROM bids b
             JOIN part_requests pr ON b.request_id = pr.request_id
             LEFT JOIN orders o ON b.bid_id = o.bid_id
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

export const getBidById = async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const garageId = req.user!.userId;

    try {
        const result = await pool.query(
            `SELECT b.*, 
                    pr.car_make, pr.car_model, pr.car_year, 
                    pr.part_description,
                    pr.request_id
             FROM bids b
             JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE b.bid_id = $1 AND b.garage_id = $2`,
            [bid_id, garageId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bid not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('[BID] GetBidById error:', err);
        res.status(500).json({ error: 'Failed to fetch bid' });
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

        // Notify garage their bid was rejected (Persistent + Push)
        await createNotification({
            userId: bid.garage_id,
            type: 'bid_rejected',
            title: 'Bid Not Selected',
            message: `Your bid for ${bid.car_make} ${bid.car_model} was not selected.`,
            data: { bid_id, car_make: bid.car_make, car_model: bid.car_model },
            target_role: 'garage'
        });

        emitToGarage(bid.garage_id, 'bid_rejected', {
            bid_id,
            message: `Your bid for ${bid.car_make} ${bid.car_model} was not selected.`
        });

        res.json({ message: 'Bid rejected' });
    } catch (err) {
        console.error('[BID] Reject error:', getErrorMessage(err));
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

        // Notify customer of bid update (Persistent + Push)
        await createNotification({
            userId: bid.customer_id,
            type: 'bid_updated',
            title: 'Bid Updated 🔄',
            message: `A garage updated their bid for ${bid.car_make} ${bid.car_model}`,
            data: { bid_id, request_id: bid.request_id, new_amount: bid_amount },
            target_role: 'customer'
        });

        emitToUser(bid.customer_id, 'bid_updated', {
            request_id: bid.request_id,
            message: `A garage updated their bid for ${bid.car_make} ${bid.car_model}`,
            new_amount: bid_amount
        });

        res.json({ message: 'Bid updated successfully' });
    } catch (err) {
        console.error('[BID] Update error:', getErrorMessage(err));
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

        // Notify customer of bid withdrawal (Persistent + Push)
        await createNotification({
            userId: bid.customer_id,
            type: 'bid_withdrawn',
            title: 'Bid Withdrawn',
            message: `A garage withdrew their bid for ${bid.car_make} ${bid.car_model}`,
            data: { bid_id, request_id: bid.request_id },
            target_role: 'customer'
        });

        emitToUser(bid.customer_id, 'bid_withdrawn', {
            request_id: bid.request_id,
            message: `A garage withdrew their bid for ${bid.car_make} ${bid.car_model}`
        });

        res.json({ message: 'Bid withdrawn successfully' });
    } catch (err) {
        console.error('[BID] Withdraw error:', getErrorMessage(err));
        res.status(500).json({ error: 'Failed to withdraw bid' });
    }
};

import { pricingService } from '../services/pricing.service';

// GET /api/v1/bids/estimate
export const getFairPriceEstimate = async (req: AuthRequest, res: Response) => {
    const { part_name, car_make, car_model, car_year } = req.query;

    if (!part_name || !car_make || !car_model) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const estimate = await pricingService.getFairPriceEstimate(
            String(part_name),
            String(car_make),
            String(car_model),
            Number(car_year) || 0
        );

        res.json({ estimate });
    } catch (err) {
        console.error('[BID] Estimate error:', err);
        res.status(500).json({ error: 'Failed to get estimate' });
    }
};
