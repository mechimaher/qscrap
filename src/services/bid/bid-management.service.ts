/**
 * Bid Management Service
 * Handles bid updates, rejections, and withdrawals
 */
import { Pool } from 'pg';
import { createNotification } from '../notification.service';
import { emitToGarage, emitToUser } from '../../utils/socketIO';

const VALID_PART_CONDITIONS = ['new', 'used_excellent', 'used_good', 'used_fair', 'refurbished'];

export class BidManagementService {
    constructor(private pool: Pool) { }

    /**
     * Validate bid amount
     */
    private validateBidAmount(amount: unknown): { valid: boolean; value: number; message?: string } {
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
    }

    /**
     * Reject a bid (by customer)
     */
    async rejectBid(bidId: string, userId: string) {
        const check = await this.pool.query(
            `SELECT b.bid_id, b.garage_id, b.status, pr.car_make, pr.car_model 
             FROM bids b
             JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE b.bid_id = $1 AND pr.customer_id = $2`,
            [bidId, userId]
        );

        if (check.rows.length === 0) {
            throw new Error('Not authorized to reject this bid');
        }

        const bid = check.rows[0];

        if (bid.status !== 'pending') {
            throw new Error(`Cannot reject bid with status: ${bid.status}`);
        }

        await this.pool.query(
            "UPDATE bids SET status = 'rejected', updated_at = NOW() WHERE bid_id = $1",
            [bidId]
        );

        // Notify garage their bid was rejected
        await createNotification({
            userId: bid.garage_id,
            type: 'bid_rejected',
            title: 'Bid Not Selected',
            message: `Your bid for ${bid.car_make} ${bid.car_model} was not selected.`,
            data: { bid_id: bidId, car_make: bid.car_make, car_model: bid.car_model },
            target_role: 'garage'
        });

        emitToGarage(bid.garage_id, 'bid_rejected', {
            bid_id: bidId,
            message: `Your bid for ${bid.car_make} ${bid.car_model} was not selected.`
        });

        return { message: 'Bid rejected' };
    }

    /**
     * Update a bid (by garage) - only for pending bids
     */
    async updateBid(
        bidId: string,
        garageId: string,
        updates: {
            bid_amount?: unknown;
            warranty_days?: unknown;
            notes?: string;
            part_condition?: string;
            brand_name?: string;
        }
    ) {
        // Validate bid amount if provided
        if (updates.bid_amount !== undefined) {
            const amountCheck = this.validateBidAmount(updates.bid_amount);
            if (!amountCheck.valid) {
                throw new Error(amountCheck.message);
            }
        }

        // Validate part_condition if provided
        if (updates.part_condition !== undefined && !VALID_PART_CONDITIONS.includes(updates.part_condition)) {
            throw new Error('Part condition must be: new, used, or refurbished');
        }

        // Notes length validation
        if (updates.notes && updates.notes.length > 1000) {
            throw new Error('Notes cannot exceed 1000 characters');
        }

        const check = await this.pool.query(
            `SELECT b.*, pr.customer_id, pr.car_make, pr.car_model
             FROM bids b
             JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE b.bid_id = $1 AND b.garage_id = $2`,
            [bidId, garageId]
        );

        if (check.rows.length === 0) {
            throw new Error('Bid not found or not yours');
        }

        const bid = check.rows[0];

        if (bid.status !== 'pending') {
            throw new Error(`Cannot update bid with status: ${bid.status}`);
        }

        await this.pool.query(
            `UPDATE bids SET 
                bid_amount = COALESCE($1, bid_amount),
                warranty_days = COALESCE($2, warranty_days),
                notes = COALESCE($3, notes),
                part_condition = COALESCE($4, part_condition),
                brand_name = COALESCE($5, brand_name),
                updated_at = NOW()
             WHERE bid_id = $6`,
            [updates.bid_amount, updates.warranty_days, updates.notes, updates.part_condition, updates.brand_name, bidId]
        );

        // Notify customer of bid update
        await createNotification({
            userId: bid.customer_id,
            type: 'bid_updated',
            title: 'Bid Updated 🔄',
            message: `A garage updated their bid for ${bid.car_make} ${bid.car_model}`,
            data: { bid_id: bidId, request_id: bid.request_id, new_amount: updates.bid_amount },
            target_role: 'customer'
        });

        // Send Expo push notification
        try {
            const { pushService } = await import('../push.service');
            await pushService.sendToUser(
                bid.customer_id,
                'Bid Updated 🔄',
                `A garage updated their bid for ${bid.car_make} ${bid.car_model}`,
                { type: 'bid_updated', bid_id: bidId, request_id: bid.request_id, new_amount: updates.bid_amount },
                { channelId: 'bids', sound: true }
            );
        } catch (pushErr) {
            // Non-critical: log and continue
            console.error('Bid update push failed:', pushErr);
        }

        emitToUser(bid.customer_id, 'bid_updated', {
            request_id: bid.request_id,
            message: `A garage updated their bid for ${bid.car_make} ${bid.car_model}`,
            new_amount: updates.bid_amount
        });

        return { message: 'Bid updated successfully' };
    }

    /**
     * Withdraw a bid (by garage)
     */
    async withdrawBid(bidId: string, garageId: string) {
        const check = await this.pool.query(
            `SELECT b.*, pr.customer_id, pr.car_make, pr.car_model
             FROM bids b
             JOIN part_requests pr ON b.request_id = pr.request_id
             WHERE b.bid_id = $1 AND b.garage_id = $2`,
            [bidId, garageId]
        );

        if (check.rows.length === 0) {
            throw new Error('Bid not found or not yours');
        }

        const bid = check.rows[0];

        if (bid.status !== 'pending') {
            throw new Error(`Cannot withdraw bid with status: ${bid.status}`);
        }

        await this.pool.query(
            "UPDATE bids SET status = 'withdrawn', updated_at = NOW() WHERE bid_id = $1",
            [bidId]
        );

        await this.pool.query(
            'UPDATE part_requests SET bid_count = GREATEST(0, bid_count - 1) WHERE request_id = $1',
            [bid.request_id]
        );

        // Notify customer of bid withdrawal
        await createNotification({
            userId: bid.customer_id,
            type: 'bid_withdrawn',
            title: 'Bid Withdrawn',
            message: `A garage withdrew their bid for ${bid.car_make} ${bid.car_model}`,
            data: { bid_id: bidId, request_id: bid.request_id },
            target_role: 'customer'
        });

        emitToUser(bid.customer_id, 'bid_withdrawn', {
            request_id: bid.request_id,
            message: `A garage withdrew their bid for ${bid.car_make} ${bid.car_model}`
        });

        return { message: 'Bid withdrawn successfully' };
    }
}
