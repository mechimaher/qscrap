import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { emitToUser, emitToGarage, emitToOperations } from '../utils/socketIO';

// Dispute reason configurations with refund rules
const DISPUTE_CONFIGS: Record<string, {
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

const DISPUTE_WINDOW_HOURS = 48;
const MAX_DISPUTE_PHOTOS = 5; // Premium 2026: Limit photos per dispute

// Create a dispute
export const createDispute = async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;
    const { order_id, reason, description } = req.body;
    const files = req.files as Express.Multer.File[];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get order details
        const orderResult = await client.query(
            `SELECT o.*, 
                    EXTRACT(EPOCH FROM (NOW() - COALESCE(o.delivered_at, o.updated_at))) / 3600 as hours_since_delivery
             FROM orders o 
             WHERE o.order_id = $1`,
            [order_id]
        );

        if (orderResult.rows.length === 0) {
            throw new Error('Order not found');
        }

        const order = orderResult.rows[0];

        // Validate ownership
        if (order.customer_id !== customerId) {
            throw new Error('Access denied');
        }

        // Validate order status
        if (order.order_status !== 'delivered') {
            throw new Error('Can only dispute delivered orders');
        }

        // Validate dispute window (48 hours)
        if (order.hours_since_delivery > DISPUTE_WINDOW_HOURS) {
            throw new Error(`Dispute window expired. You had ${DISPUTE_WINDOW_HOURS} hours after delivery to report issues.`);
        }

        // Check for existing dispute
        const existingDispute = await client.query(
            `SELECT dispute_id FROM disputes WHERE order_id = $1`,
            [order_id]
        );
        if (existingDispute.rows.length > 0) {
            throw new Error('A dispute already exists for this order');
        }

        // Validate reason
        if (!DISPUTE_CONFIGS[reason]) {
            throw new Error('Invalid dispute reason');
        }

        // Process uploaded photos
        const photoUrls = files ? files.map(f => `/uploads/${f.filename}`) : [];

        // PREMIUM 2026: Enforce photo limits
        if (photoUrls.length > MAX_DISPUTE_PHOTOS) {
            throw new Error(`Maximum ${MAX_DISPUTE_PHOTOS} photos allowed per dispute`);
        }

        // Require photos for certain reasons
        if (['damaged', 'wrong_part', 'not_as_described'].includes(reason) && photoUrls.length === 0) {
            throw new Error('Photos are required for this type of dispute');
        }

        // Calculate refund amounts
        const config = DISPUTE_CONFIGS[reason];
        const partPrice = parseFloat(order.part_price);
        const refundAmount = Math.round(partPrice * (config.refundPercent / 100) * 100) / 100;
        const restockingFee = Math.round(partPrice * (config.restockingFee / 100) * 100) / 100;

        // Create dispute
        const disputeResult = await client.query(
            `INSERT INTO disputes 
             (order_id, customer_id, garage_id, reason, description, photo_urls, 
              refund_amount, restocking_fee)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING dispute_id, created_at`,
            [order_id, customerId, order.garage_id, reason, description,
                photoUrls, refundAmount, restockingFee]
        );

        // Update order status
        await client.query(
            `UPDATE orders SET order_status = 'disputed', updated_at = NOW() WHERE order_id = $1`,
            [order_id]
        );

        await client.query('COMMIT');

        // Notify garage with full dispute data
        const io = (global as any).io;
        io.to(`garage_${order.garage_id}`).emit('dispute_created', {
            dispute_id: disputeResult.rows[0].dispute_id,
            order_id: order_id,
            order_number: order.order_number,
            reason: reason,
            description: description,
            photo_urls: photoUrls,
            refund_amount: refundAmount,
            restocking_fee: restockingFee,
            notification: `⚠️ New dispute on Order #${order.order_number}: ${reason.replace(/_/g, ' ')}`
        });

        res.status(201).json({
            message: 'Dispute submitted successfully',
            dispute_id: disputeResult.rows[0].dispute_id,
            expected_refund: refundAmount,
            restocking_fee: restockingFee,
            return_shipping_by: config.returnShippingBy,
            delivery_refunded: config.deliveryRefund
        });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Get my disputes (for customer or garage) - with pagination
export const getMyDisputes = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const userType = req.user!.userType;
    const { page = 1, limit = 20, status } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    try {
        const field = userType === 'garage' ? 'garage_id' : 'customer_id';
        const params: unknown[] = [userId];
        let paramIndex = 2;

        let whereClause = `WHERE d.${field} = $1`;
        if (status) {
            whereClause += ` AND d.status = $${paramIndex++}`;
            params.push(status);
        }

        // Count query
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM disputes d ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limitNum);

        // Main query with pagination
        const result = await pool.query(
            `SELECT d.*, o.order_number, o.part_price, o.total_amount,
                    pr.car_make, pr.car_model, pr.part_description
             FROM disputes d
             JOIN orders o ON d.order_id = o.order_id
             JOIN part_requests pr ON o.request_id = pr.request_id
             ${whereClause}
             ORDER BY d.created_at DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            [...params, limitNum, offset]
        );

        res.json({
            disputes: result.rows,
            pagination: { page: pageNum, limit: limitNum, total, pages: totalPages }
        });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Get dispute details
export const getDisputeDetails = async (req: AuthRequest, res: Response) => {
    const { dispute_id } = req.params;
    const userId = req.user!.userId;

    try {
        const result = await pool.query(
            `SELECT d.*, o.order_number, o.part_price, o.total_amount, o.delivery_fee,
                    pr.car_make, pr.car_model, pr.part_description,
                    u.full_name as customer_name, g.garage_name
             FROM disputes d
             JOIN orders o ON d.order_id = o.order_id
             JOIN part_requests pr ON o.request_id = pr.request_id
             JOIN users u ON d.customer_id = u.user_id
             JOIN garages g ON d.garage_id = g.garage_id
             WHERE d.dispute_id = $1 
               AND (d.customer_id = $2 OR d.garage_id = $2)`,
            [dispute_id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Dispute not found' });
        }

        res.json({ dispute: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// Garage responds to dispute (explanation only - Operations makes final decision)
export const garageRespondToDispute = async (req: AuthRequest, res: Response) => {
    const { dispute_id } = req.params;
    const { response_message } = req.body;
    const garageId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get dispute
        const disputeResult = await client.query(
            `SELECT d.*, o.order_number, o.customer_id
             FROM disputes d
             JOIN orders o ON d.order_id = o.order_id
             WHERE d.dispute_id = $1 FOR UPDATE`,
            [dispute_id]
        );

        if (disputeResult.rows.length === 0) {
            throw new Error('Dispute not found');
        }

        const dispute = disputeResult.rows[0];

        if (dispute.garage_id !== garageId) {
            throw new Error('Access denied');
        }

        if (dispute.status === 'resolved') {
            throw new Error('Dispute already resolved');
        }

        // Garage can only provide their explanation/response
        // Status changes to 'under_review' for Operations to handle
        await client.query(
            `UPDATE disputes 
             SET status = 'under_review', 
                 garage_response = $2,
                 updated_at = NOW()
             WHERE dispute_id = $1`,
            [dispute_id, response_message]
        );

        await client.query('COMMIT');

        // Notify customer and operations
        const io = (global as any).io;

        io.to(`user_${dispute.customer_id}`).emit('dispute_updated', {
            dispute_id: dispute_id,
            order_number: dispute.order_number,
            notification: `Garage has responded to your dispute for Order #${dispute.order_number}. Customer service is reviewing.`
        });

        // Notify operations that dispute needs review
        io.to('operations').emit('dispute_needs_review', {
            dispute_id: dispute_id,
            order_number: dispute.order_number,
            notification: `Dispute #${dispute_id} for Order #${dispute.order_number} needs review - garage has responded.`
        });

        res.json({
            message: 'Response submitted. Customer service will review and make a decision.',
            status: 'under_review'
        });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: getErrorMessage(err) });
    } finally {
        client.release();
    }
};

// Auto-resolve contested disputes after 48 hours (favor customer - admin can override)
export const autoResolveDisputes = async () => {
    try {
        const result = await pool.query(
            `UPDATE disputes 
             SET status = 'resolved',
                 resolution = 'refund_approved',
                 resolved_by = 'platform_auto',
                 resolved_at = NOW()
             WHERE status = 'contested'
               AND created_at < NOW() - INTERVAL '48 hours'
             RETURNING dispute_id, order_id, customer_id, garage_id, refund_amount`
        );

        // Update related orders
        for (const dispute of result.rows) {
            await pool.query(
                `UPDATE orders SET order_status = 'refunded' WHERE order_id = $1`,
                [dispute.order_id]
            );

            // Notify customer
            const io = (global as any).io;
            io.to(`user_${dispute.customer_id}`).emit('dispute_resolved', {
                dispute_id: dispute.dispute_id,
                resolution: 'refund_approved',
                refund_amount: dispute.refund_amount,
                notification: `✅ Your dispute was resolved in your favor. Refund: ${dispute.refund_amount} QAR`
            });

            // Notify garage about resolution
            io.to(`garage_${dispute.garage_id}`).emit('dispute_resolved', {
                dispute_id: dispute.dispute_id,
                order_id: dispute.order_id,
                resolution: 'refund_approved',
                notification: `⚠️ Dispute auto-resolved: Refund of ${dispute.refund_amount} QAR issued to customer.`
            });
        }

        if (result.rowCount && result.rowCount > 0) {
            console.log(`Auto-resolved ${result.rowCount} disputes`);
        }
    } catch (err) {
        console.error('Auto-resolve disputes failed:', err);
    }
};

// Get pending disputes count for garage
export const getPendingDisputesCount = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const result = await pool.query(
            `SELECT COUNT(*) as count FROM disputes WHERE garage_id = $1 AND status = 'pending'`,
            [garageId]
        );

        res.json({ pending_count: parseInt(result.rows[0].count) });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
