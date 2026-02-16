/**
 * Dispute Service
 * Handles order disputes, refund calculations, responses, and auto-resolution
 */
import { Pool } from 'pg';

export const DISPUTE_CONFIGS: Record<string, {
    refundPercent: number;
    restockingFee: number;
    returnShippingBy: 'customer' | 'garage' | 'platform';
    deliveryRefund: boolean;
}> = {
    wrong_part: { refundPercent: 100, restockingFee: 0, returnShippingBy: 'garage', deliveryRefund: false },
    doesnt_fit: { refundPercent: 85, restockingFee: 15, returnShippingBy: 'customer', deliveryRefund: false },
    damaged: { refundPercent: 100, restockingFee: 0, returnShippingBy: 'platform', deliveryRefund: true },
    not_as_described: { refundPercent: 100, restockingFee: 0, returnShippingBy: 'garage', deliveryRefund: false },
    changed_mind: { refundPercent: 70, restockingFee: 30, returnShippingBy: 'customer', deliveryRefund: false }
};

export const DISPUTE_WINDOW_HOURS = 48;
export const MAX_DISPUTE_PHOTOS = 5;

export class DisputeOrderService {
    constructor(private pool: Pool) { }

    async createDispute(customerId: string, data: { order_id: string; reason: string; description: string; photoUrls: string[] }) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const orderResult = await client.query(`SELECT o.*, EXTRACT(EPOCH FROM (NOW() - COALESCE(o.delivered_at, o.updated_at))) / 3600 as hours_since_delivery FROM orders o WHERE o.order_id = $1`, [data.order_id]);
            if (orderResult.rows.length === 0) {throw new Error('Order not found');}
            const order = orderResult.rows[0];
            if (order.customer_id !== customerId) {throw new Error('Access denied');}
            if (order.order_status !== 'delivered') {throw new Error('Can only dispute delivered orders');}
            if (order.hours_since_delivery > DISPUTE_WINDOW_HOURS) {throw new Error(`Dispute window expired. You had ${DISPUTE_WINDOW_HOURS} hours after delivery to report issues.`);}

            const existingDispute = await client.query(`SELECT dispute_id FROM disputes WHERE order_id = $1`, [data.order_id]);
            if (existingDispute.rows.length > 0) {throw new Error('A dispute already exists for this order');}
            if (!DISPUTE_CONFIGS[data.reason]) {throw new Error('Invalid dispute reason');}
            if (data.photoUrls.length > MAX_DISPUTE_PHOTOS) {throw new Error(`Maximum ${MAX_DISPUTE_PHOTOS} photos allowed per dispute`);}
            if (['damaged', 'wrong_part', 'not_as_described'].includes(data.reason) && data.photoUrls.length === 0) {throw new Error('Photos are required for this type of dispute');}

            const config = DISPUTE_CONFIGS[data.reason];
            const partPrice = parseFloat(order.part_price);
            const deliveryFee = parseFloat(order.delivery_fee || 0);

            // Calculate refund amount - include delivery fee if applicable
            let refundAmount = Math.round(partPrice * (config.refundPercent / 100) * 100) / 100;
            if (config.deliveryRefund) {
                refundAmount += deliveryFee;
            }
            const restockingFee = Math.round(partPrice * (config.restockingFee / 100) * 100) / 100;

            const disputeResult = await client.query(`INSERT INTO disputes (order_id, customer_id, garage_id, reason, description, photo_urls, refund_amount, restocking_fee) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING dispute_id, created_at`, [data.order_id, customerId, order.garage_id, data.reason, data.description, data.photoUrls, refundAmount, restockingFee]);
            await client.query(`UPDATE orders SET order_status = 'disputed', updated_at = NOW() WHERE order_id = $1`, [data.order_id]);

            // CRITICAL: Hold any pending/processing payout for this order
            const payoutHoldResult = await client.query(`
                UPDATE garage_payouts 
                SET payout_status = 'held',
                    held_reason = 'Customer opened dispute: ' || $2,
                    held_at = NOW(),
                    updated_at = NOW()
                WHERE order_id = $1 
                AND payout_status IN ('pending', 'processing')
                RETURNING payout_id
            `, [data.order_id, data.reason]);

            await client.query('COMMIT');

            return {
                dispute: disputeResult.rows[0],
                order,
                refundAmount,
                restockingFee,
                config,
                payoutHeld: payoutHoldResult.rows.length > 0
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async getMyDisputes(userId: string, userType: string, params: { page?: number; limit?: number; status?: string }) {
        const pageNum = Math.max(1, params.page || 1);
        const limitNum = Math.min(100, Math.max(1, params.limit || 20));
        const offset = (pageNum - 1) * limitNum;
        const field = userType === 'garage' ? 'garage_id' : 'customer_id';
        const queryParams: unknown[] = [userId];
        let paramIndex = 2;
        let whereClause = `WHERE d.${field} = $1`;
        if (params.status) { whereClause += ` AND d.status = $${paramIndex++}`; queryParams.push(params.status); }

        const countResult = await this.pool.query(`SELECT COUNT(*) FROM disputes d ${whereClause}`, queryParams);
        const total = parseInt(countResult.rows[0].count);
        const result = await this.pool.query(`SELECT d.*, o.order_number, o.part_price, o.total_amount, pr.car_make, pr.car_model, pr.part_description FROM disputes d JOIN orders o ON d.order_id = o.order_id JOIN part_requests pr ON o.request_id = pr.request_id ${whereClause} ORDER BY d.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`, [...queryParams, limitNum, offset]);
        return { disputes: result.rows, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } };
    }

    async getDisputeDetails(disputeId: string, userId: string) {
        const result = await this.pool.query(`SELECT d.*, o.order_number, o.part_price, o.total_amount, o.delivery_fee, pr.car_make, pr.car_model, pr.part_description, u.full_name as customer_name, g.garage_name FROM disputes d JOIN orders o ON d.order_id = o.order_id JOIN part_requests pr ON o.request_id = pr.request_id JOIN users u ON d.customer_id = u.user_id JOIN garages g ON d.garage_id = g.garage_id WHERE d.dispute_id = $1 AND (d.customer_id = $2 OR d.garage_id = $2)`, [disputeId, userId]);
        return result.rows[0] || null;
    }

    async garageRespond(disputeId: string, garageId: string, responseMessage: string) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const disputeResult = await client.query(`SELECT d.*, o.order_number, o.customer_id FROM disputes d JOIN orders o ON d.order_id = o.order_id WHERE d.dispute_id = $1 FOR UPDATE`, [disputeId]);
            if (disputeResult.rows.length === 0) {throw new Error('Dispute not found');}
            const dispute = disputeResult.rows[0];
            if (dispute.garage_id !== garageId) {throw new Error('Access denied');}
            if (dispute.status === 'resolved') {throw new Error('Dispute already resolved');}
            await client.query(`UPDATE disputes SET status = 'under_review', garage_response = $2, updated_at = NOW() WHERE dispute_id = $1`, [disputeId, responseMessage]);
            await client.query('COMMIT');
            return { dispute };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async autoResolveDisputes() {
        const result = await this.pool.query(`UPDATE disputes SET status = 'resolved', resolution = 'refund_approved', resolved_by = 'platform_auto', resolved_at = NOW() WHERE status = 'contested' AND created_at < NOW() - INTERVAL '48 hours' RETURNING dispute_id, order_id, customer_id, garage_id, refund_amount`);
        for (const dispute of result.rows) {
            await this.pool.query(`UPDATE orders SET order_status = 'refunded' WHERE order_id = $1`, [dispute.order_id]);
        }
        return result.rows;
    }

    async getPendingDisputesCount(garageId: string) {
        const result = await this.pool.query(`SELECT COUNT(*) as count FROM disputes WHERE garage_id = $1 AND status = 'pending'`, [garageId]);
        return parseInt(result.rows[0].count);
    }
}
