/**
 * Bid Service
 * 
 * Centralized business logic for bidding operations.
 * Extracted from bid.controller.ts
 */

import pool from '../config/db';
import { emitToUser, emitToGarage } from '../utils/socketIO';
import fs from 'fs/promises';

// ============================================
// TYPES
// ============================================

export interface SubmitBidParams {
    requestId: string;
    garageId: string;
    bidAmount: unknown;
    warrantyDays: unknown;
    notes?: string;
    partCondition: string;
    brandName?: string;
    partNumber?: string;
    files?: Express.Multer.File[];
}

export interface BidResult {
    bid: any;
    message: string;
}

// ============================================
// VALIDATION HELPERS
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

const validateWarrantyDays = (days: unknown): number | null => {
    if (days === undefined || days === null || days === '') return null;
    const numDays = parseInt(String(days), 10);
    if (isNaN(numDays) || numDays < 0 || numDays > 365) return null;
    return numDays;
};

// ============================================
// SERVICE METHODS
// ============================================

/**
 * Submit a new bid
 */
export async function submitBid(params: SubmitBidParams): Promise<BidResult> {
    const { requestId, garageId, bidAmount, warrantyDays, notes, partCondition, brandName, partNumber, files } = params;

    // 1. Validation
    const amountCheck = validateBidAmount(bidAmount);
    if (!amountCheck.valid) {
        throw new Error(amountCheck.message);
    }

    const validatedWarranty = validateWarrantyDays(warrantyDays);

    if (!partCondition || !VALID_PART_CONDITIONS.includes(partCondition)) {
        throw new Error(`Part condition is required. Must be one of: ${VALID_PART_CONDITIONS.join(', ')}`);
    }

    const imageUrls = files ? files.map(f => '/' + f.path.replace(/\\/g, '/')) : [];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 2. Check Request Validity
        const reqCheck = await client.query('SELECT status, customer_id FROM part_requests WHERE request_id = $1', [requestId]);
        if (reqCheck.rows.length === 0) throw new Error('Request not found');
        if (reqCheck.rows[0].status !== 'active') throw new Error('Request is no longer active');

        const customerId = reqCheck.rows[0].customer_id;

        // 3. Check Duplicate Bid
        const existingBid = await client.query(
            'SELECT bid_id FROM bids WHERE request_id = $1 AND garage_id = $2',
            [requestId, garageId]
        );
        if (existingBid.rows.length > 0) {
            throw new Error('You have already submitted a bid for this request');
        }

        // 4. Check Subscription Limits
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

        // 5. Insert Bid
        const bidResult = await client.query(
            `INSERT INTO bids 
       (request_id, garage_id, bid_amount, warranty_days, notes, part_condition, brand_name, part_number, image_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING bid_id, created_at`,
            [requestId, garageId, amountCheck.value, validatedWarranty, notes, partCondition, brandName, partNumber, imageUrls]
        );

        // 6. Update Request Count
        await client.query(
            `UPDATE part_requests SET bid_count = bid_count + 1 WHERE request_id = $1`,
            [requestId]
        );

        // Get bid number for anon display
        const bidCountResult = await client.query(
            'SELECT COUNT(*) FROM bids WHERE request_id = $1',
            [requestId]
        );
        const bidNumber = parseInt(bidCountResult.rows[0].count);

        await client.query('COMMIT');

        // 7. Notifications
        const bid = bidResult.rows[0];
        notifyBidSubmission(customerId, requestId, bid.bid_id, bidNumber, amountCheck.value, partCondition, validatedWarranty || 0, bid.created_at);

        return {
            bid,
            message: 'Bid submitted successfully'
        };

    } catch (err) {
        await client.query('ROLLBACK');

        // Cleanup files on error
        if (files && files.length > 0) {
            for (const file of files) {
                try {
                    await fs.unlink(file.path);
                } catch (e) { console.error('File cleanup failed', e); }
            }
        }

        throw err;
    } finally {
        client.release();
    }
}

async function notifyBidSubmission(customerId: string, requestId: string, bidId: string, bidNumber: number, amount: number, condition: string, warranty: number, createdAt: Date) {
    try {
        // Send push notification
        const { pushService } = await import('./push.service');
        await pushService.sendToUser(
            customerId,
            '🔔 New Bid Received!',
            `Garage #${bidNumber} bid ${amount} QAR for your part`,
            {
                type: 'new_bid',
                requestId,
                bidId,
                bidAmount: amount,
            },
            { channelId: 'bids', sound: true }
        );

        // Send in-app notification
        await import('../services/notification.service').then(ns => ns.createNotification({
            userId: customerId,
            type: 'new_bid',
            title: 'New Bid Received 🏷️',
            message: `Garage #${bidNumber} placed a bid of ${amount} QAR`,
            data: {
                bid_id: bidId,
                request_id: requestId,
                garage_name: `Garage #${bidNumber}`,
                bid_amount: amount,
                part_condition: condition,
                warranty_days: warranty,
                created_at: createdAt
            },
            target_role: 'customer'
        }));

        // Send WebSocket notification
        emitToUser(customerId, 'new_bid', {
            bid_id: bidId,
            request_id: requestId,
            garage_name: `Garage #${bidNumber}`,
            bid_amount: amount,
            part_condition: condition,
            warranty_days: warranty,
            created_at: createdAt
        });
    } catch (err) {
        console.error('Bid notification failed', err);
    }
}
