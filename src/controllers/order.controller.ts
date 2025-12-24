import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getDeliveryFeeForLocation } from './delivery.controller';

// Get commission rate based on garage's status and subscription
// BUSINESS LOGIC:
// - Demo trial: 0% commission (garage keeps 100%)
// - Subscribed/Approved: 15% commission (or plan-specific rate)
const getGarageCommissionRate = async (garageId: string): Promise<number> => {
    // First check if garage is in demo mode
    const garageResult = await pool.query(
        `SELECT approval_status FROM garages WHERE garage_id = $1`,
        [garageId]
    );

    if (garageResult.rows.length > 0 && garageResult.rows[0].approval_status === 'demo') {
        // Demo trial = 0% commission
        return 0;
    }

    // Check for active subscription with custom commission rate
    const result = await pool.query(
        `SELECT sp.commission_rate 
         FROM garage_subscriptions gs
         JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
         WHERE gs.garage_id = $1 AND gs.status IN ('active', 'trial')
         ORDER BY gs.created_at DESC LIMIT 1`,
        [garageId]
    );

    // Use subscription rate if found, otherwise default 15%
    return result.rows.length > 0 ? parseFloat(result.rows[0].commission_rate) : 0.15;
};

// Accept a bid and create order
export const acceptBid = async (req: AuthRequest, res: Response) => {
    const { bid_id } = req.params;
    const customerId = req.user!.userId;
    const { payment_method, delivery_notes } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

        // Lock Bid
        const bidResult = await client.query(
            'SELECT * FROM bids WHERE bid_id = $1 FOR UPDATE',
            [bid_id]
        );
        if (bidResult.rows.length === 0) throw new Error('Bid not found');
        const bid = bidResult.rows[0];

        if (bid.status !== 'pending') throw new Error('Bid no longer available');

        // Lock Request
        const reqResult = await client.query(
            'SELECT * FROM part_requests WHERE request_id = $1 FOR UPDATE',
            [bid.request_id]
        );
        if (reqResult.rows.length === 0) throw new Error('Request not found');
        const request = reqResult.rows[0];

        if (request.customer_id !== customerId) throw new Error('Access denied');
        if (request.status !== 'active') throw new Error('Request already processed');

        // Get dynamic commission rate based on garage subscription
        const commissionRate = await getGarageCommissionRate(bid.garage_id);

        // Calculate Fees
        const part_price = parseFloat(bid.bid_amount);
        const platform_fee = Math.round(part_price * commissionRate * 100) / 100;

        // Get zone-based delivery fee if GPS coordinates available
        let delivery_fee = 25.00; // Default fallback
        let delivery_zone_id: number | null = null;
        if (request.delivery_latitude && request.delivery_longitude) {
            const zoneInfo = await getDeliveryFeeForLocation(
                parseFloat(request.delivery_latitude),
                parseFloat(request.delivery_longitude)
            );
            delivery_fee = zoneInfo.fee;
            delivery_zone_id = zoneInfo.zone_id;
        }

        const total_amount = part_price + delivery_fee;
        const garage_payout = part_price - platform_fee;

        // Get delivery address
        const deliveryAddress = request.delivery_address_text || request.delivery_address;

        // Create Order with enhanced fields
        const orderResult = await client.query(
            `INSERT INTO orders 
             (request_id, bid_id, customer_id, garage_id, part_price, commission_rate, 
              platform_fee, delivery_fee, total_amount, garage_payout_amount, 
              payment_method, delivery_address, delivery_notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING order_id, order_number`,
            [bid.request_id, bid_id, customerId, bid.garage_id, part_price, commissionRate,
                platform_fee, delivery_fee, total_amount, garage_payout,
            payment_method || 'cash', deliveryAddress, delivery_notes]
        );
        const order = orderResult.rows[0];

        // Update statuses
        await client.query("UPDATE bids SET status = 'accepted', updated_at = NOW() WHERE bid_id = $1", [bid_id]);
        await client.query(
            "UPDATE bids SET status = 'rejected', updated_at = NOW() WHERE request_id = $1 AND bid_id != $2 AND status = 'pending'",
            [bid.request_id, bid_id]
        );
        await client.query("UPDATE part_requests SET status = 'accepted', updated_at = NOW() WHERE request_id = $1", [bid.request_id]);

        // Log initial status
        await client.query(
            `INSERT INTO order_status_history 
             (order_id, old_status, new_status, changed_by, changed_by_type, reason)
             VALUES ($1, NULL, 'confirmed', $2, 'customer', 'Order created from accepted bid')`,
            [order.order_id, customerId]
        );

        // Update garage transaction count
        await client.query(
            `UPDATE garages SET total_transactions = total_transactions + 1, updated_at = NOW() WHERE garage_id = $1`,
            [bid.garage_id]
        );

        await client.query('COMMIT');

        // Notify winning garage (use garage_ room, not user_)
        (global as any).io.to(`garage_${bid.garage_id}`).emit('bid_accepted', {
            order_id: order.order_id,
            order_number: order.order_number,
            request_id: bid.request_id,
            notification: "🎉 Congratulations! Your bid was accepted."
        });

        // Notify customer that order is created
        (global as any).io.to(`user_${customerId}`).emit('order_created', {
            order_id: order.order_id,
            order_number: order.order_number,
            total_amount,
            notification: `✅ Order #${order.order_number} created! The garage will start preparing your part.`
        });

        // Notify rejected garages (also use garage_ room)
        const rejectedBids = await pool.query(
            `SELECT DISTINCT garage_id FROM bids WHERE request_id = $1 AND bid_id != $2`,
            [bid.request_id, bid_id]
        );
        rejectedBids.rows.forEach((r: any) => {
            (global as any).io.to(`garage_${r.garage_id}`).emit('bid_rejected', {
                request_id: bid.request_id,
                notification: "Another bid was selected for this request."
            });
        });

        res.json({
            message: 'Order created successfully',
            order_id: order.order_id,
            order_number: order.order_number,
            total_amount
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Update order status (Garage) - Strict role-based transitions
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { order_status, notes } = req.body;
    const garageId = req.user!.userId;

    // GARAGE can only change to these statuses (their responsibility ends at ready_for_pickup)
    const garageAllowedStatuses = ['preparing', 'ready_for_pickup'];
    if (!garageAllowedStatuses.includes(order_status)) {
        return res.status(400).json({
            error: 'Garages can only set status to "preparing" or "ready_for_pickup"',
            hint: 'Collection, QC, and delivery are handled by Operations team'
        });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify Ownership and get current status
        const check = await client.query(
            'SELECT customer_id, order_status, order_number FROM orders WHERE order_id = $1 AND garage_id = $2 FOR UPDATE',
            [order_id, garageId]
        );

        if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Order not found or not yours' });
        }

        const currentOrder = check.rows[0];
        const oldStatus = currentOrder.order_status;

        // STRICT transition rules for GARAGE role
        const allowedTransitions: Record<string, string[]> = {
            'confirmed': ['preparing'],           // Garage starts work
            'preparing': ['ready_for_pickup']     // Garage marks as ready
        };

        const allowed = allowedTransitions[oldStatus] || [];

        if (!allowed.includes(order_status)) {
            await client.query('ROLLBACK');

            // Provide helpful error messages
            const stageMessages: Record<string, string> = {
                'ready_for_pickup': 'Order is waiting for QScrap collection',
                'collected': 'Order has been collected by QScrap',
                'qc_in_progress': 'Order is being inspected',
                'qc_passed': 'Order passed QC and is ready for delivery',
                'qc_failed': 'Order failed QC and will be returned',
                'in_transit': 'Order is being delivered',
                'delivered': 'Order has been delivered',
                'completed': 'Order is completed'
            };

            return res.status(400).json({
                error: `Cannot change status from "${oldStatus}" to "${order_status}"`,
                reason: stageMessages[oldStatus] || `Order is in "${oldStatus}" stage`,
                hint: 'Once marked as ready, Operations team handles the rest'
            });
        }

        // Update order
        const updateFields: string[] = ['order_status = $1', 'updated_at = NOW()'];
        const updateValues: any[] = [order_status, order_id];

        if (order_status === 'delivered') {
            updateFields.push('actual_delivery_at = NOW()');
        }

        await client.query(
            `UPDATE orders SET ${updateFields.join(', ')} WHERE order_id = $2`,
            updateValues
        );

        // Log status change
        await client.query(
            `INSERT INTO order_status_history 
             (order_id, old_status, new_status, changed_by, changed_by_type, reason)
             VALUES ($1, $2, $3, $4, 'garage', $5)`,
            [order_id, oldStatus, order_status, garageId, notes]
        );

        await client.query('COMMIT');

        // Notify customer
        const customerId = currentOrder.customer_id;
        const statusMessages: Record<string, string> = {
            'preparing': '🔧 Your order is being prepared',
            'ready_for_pickup': '📦 Your order is ready and waiting for pickup',
            'in_transit': '🚚 Your order is on the way!',
            'delivered': '✅ Your order has been delivered'
        };

        (global as any).io.to(`user_${customerId}`).emit('order_status_updated', {
            order_id,
            order_number: currentOrder.order_number,
            old_status: oldStatus,
            new_status: order_status,
            notification: statusMessages[order_status] || `Order status updated to ${order_status}`
        });

        // Notify Operations when order is ready for collection
        if (order_status === 'ready_for_pickup') {
            (global as any).io.to('operations').emit('order_ready_for_pickup', {
                order_id,
                order_number: currentOrder.order_number,
                notification: `📦 Order #${currentOrder.order_number} is ready for collection!`
            });
        }

        res.json({
            message: 'Status updated successfully',
            old_status: oldStatus,
            new_status: order_status
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Get customer's orders with driver info for tracking - with pagination
export const getMyOrders = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const userType = req.user!.userType;
    const { status, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    try {
        const field = userType === 'customer' ? 'customer_id' : 'garage_id';

        // Build count query
        let countQuery = `SELECT COUNT(*) FROM orders o WHERE o.${field} = $1`;
        const countParams: any[] = [userId];
        if (status) {
            countQuery += ` AND o.order_status = $2`;
            countParams.push(status);
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limitNum);

        // Build main query
        let query = `
            SELECT o.*, 
                   pr.car_make, pr.car_model, pr.car_year, pr.part_description, pr.image_urls as request_images,
                   b.warranty_days, b.part_condition, b.brand_name, b.image_urls as bid_images,
                   g.garage_name,
                   da.assignment_id, da.status as delivery_status, 
                   da.estimated_delivery, da.pickup_at, da.delivered_at,
                   d.driver_id, d.full_name as driver_name, d.phone as driver_phone,
                   d.vehicle_type, d.vehicle_plate, d.current_lat as driver_lat, d.current_lng as driver_lng,
                   r.review_id
            FROM orders o
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN bids b ON o.bid_id = b.bid_id
            JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN delivery_assignments da ON o.order_id = da.order_id
            LEFT JOIN drivers d ON da.driver_id = d.driver_id
            LEFT JOIN order_reviews r ON o.order_id = r.order_id
            WHERE o.${field} = $1
        `;
        const params: any[] = [userId];
        let paramIndex = 2;

        if (status) {
            query += ` AND o.order_status = $${paramIndex++}`;
            params.push(status);
        }

        query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limitNum, offset);

        const result = await pool.query(query, params);
        res.json({
            orders: result.rows,
            pagination: { page: pageNum, limit: limitNum, total, pages: totalPages }
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// Get order details
export const getOrderDetails = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const userId = req.user!.userId;

    try {
        const result = await pool.query(
            `SELECT o.*, 
                    pr.car_make, pr.car_model, pr.car_year, pr.part_description, pr.image_urls as request_images,
                    b.warranty_days, b.part_condition, b.brand_name, b.image_urls as bid_images, b.notes as bid_notes,
                    g.garage_name, g.rating_average, g.rating_count,
                    u.full_name as customer_name, u.phone_number as customer_phone,
                    d.full_name as driver_name, d.phone as driver_phone, d.vehicle_type, d.vehicle_plate
             FROM orders o
             JOIN part_requests pr ON o.request_id = pr.request_id
             JOIN bids b ON o.bid_id = b.bid_id
             JOIN garages g ON o.garage_id = g.garage_id
             JOIN users u ON o.customer_id = u.user_id
             LEFT JOIN drivers d ON o.driver_id = d.driver_id
             WHERE o.order_id = $1 AND (o.customer_id = $2 OR o.garage_id = $2)`,
            [order_id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Get status history
        const history = await pool.query(
            `SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC`,
            [order_id]
        );

        // Get review if exists
        const review = await pool.query(
            `SELECT * FROM order_reviews WHERE order_id = $1`,
            [order_id]
        );

        res.json({
            order: result.rows[0],
            status_history: history.rows,
            review: review.rows[0] || null
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// Confirm delivery (Customer)
export const confirmDelivery = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const customerId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE orders 
             SET order_status = 'completed', 
                 completed_at = NOW(),
                 payment_status = 'paid',
                 updated_at = NOW()
             WHERE order_id = $1 AND customer_id = $2 AND order_status = 'delivered'
             RETURNING garage_id, order_number, garage_payout_amount`,
            [order_id, customerId]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Order not found or not in delivered status' });
        }

        const order = result.rows[0];

        // Log status change
        await client.query(
            `INSERT INTO order_status_history 
             (order_id, old_status, new_status, changed_by, changed_by_type, reason)
             VALUES ($1, 'delivered', 'completed', $2, 'customer', 'Customer confirmed receipt')`,
            [order_id, customerId]
        );

        // Create payout record for garage (skip if already exists from dispute/re-delivery)
        await client.query(
            `INSERT INTO garage_payouts 
             (garage_id, order_id, gross_amount, commission_amount, net_amount, scheduled_for)
             SELECT garage_id, order_id, part_price, platform_fee, garage_payout_amount, 
                    CURRENT_DATE + INTERVAL '7 days'
             FROM orders o WHERE o.order_id = $1
             AND NOT EXISTS (SELECT 1 FROM garage_payouts gp WHERE gp.order_id = o.order_id)`,
            [order_id]
        );

        // Free up the driver - set status back to available ONLY if no other active assignments
        await client.query(
            `UPDATE drivers 
             SET status = 'available', updated_at = NOW()
             WHERE driver_id = (SELECT driver_id FROM orders WHERE order_id = $1)
             AND driver_id IS NOT NULL
             AND NOT EXISTS (
                 SELECT 1 FROM delivery_assignments 
                 WHERE driver_id = drivers.driver_id 
                 AND status IN ('assigned', 'picked_up', 'in_transit')
                 AND order_id != $1
             )`,
            [order_id]
        );

        await client.query('COMMIT');

        // Notify garage (use garage_ room)
        (global as any).io.to(`garage_${order.garage_id}`).emit('order_completed', {
            order_id,
            order_number: order.order_number,
            notification: '✅ Customer confirmed delivery. Payment will be processed soon.',
            payout_amount: order.garage_payout_amount
        });

        // CRITICAL: Notify Operations dashboard for real-time update
        (global as any).io.to('operations').emit('order_status_updated', {
            order_id,
            order_number: order.order_number,
            old_status: 'delivered',
            new_status: 'completed',
            notification: `Order #${order.order_number} completed - customer confirmed receipt`
        });

        // Notify Operations about pending payout for finance badge
        (global as any).io.to('operations').emit('payout_pending', {
            order_id,
            order_number: order.order_number,
            garage_id: order.garage_id,
            payout_amount: order.garage_payout_amount,
            notification: `💰 Order #${order.order_number} complete - payout pending for garage`
        });

        res.json({
            message: 'Delivery confirmed. Thank you!',
            prompt_review: true
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Submit review (Customer)
export const submitReview = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const customerId = req.user!.userId;
    const { overall_rating, part_quality_rating, communication_rating, delivery_rating, review_text } = req.body;

    if (!overall_rating || overall_rating < 1 || overall_rating > 5) {
        return res.status(400).json({ error: 'Overall rating (1-5) is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify order belongs to customer and is completed
        const orderCheck = await client.query(
            `SELECT garage_id FROM orders 
             WHERE order_id = $1 AND customer_id = $2 AND order_status = 'completed'`,
            [order_id, customerId]
        );

        if (orderCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Order not found or not completed' });
        }

        const garageId = orderCheck.rows[0].garage_id;

        // Insert review with pending moderation status
        await client.query(
            `INSERT INTO order_reviews 
             (order_id, customer_id, garage_id, overall_rating, part_quality_rating, 
              communication_rating, delivery_rating, review_text, moderation_status, is_visible)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', false)
             ON CONFLICT (order_id) DO UPDATE SET
                overall_rating = EXCLUDED.overall_rating,
                part_quality_rating = EXCLUDED.part_quality_rating,
                communication_rating = EXCLUDED.communication_rating,
                delivery_rating = EXCLUDED.delivery_rating,
                review_text = EXCLUDED.review_text,
                moderation_status = 'pending',
                is_visible = false,
                updated_at = NOW()`,
            [order_id, customerId, garageId, overall_rating, part_quality_rating,
                communication_rating, delivery_rating, review_text]
        );

        await client.query('COMMIT');

        // Notify Operations about new review pending moderation
        (global as any).io.to('operations').emit('new_review_pending', {
            order_id,
            garage_id: garageId,
            overall_rating,
            notification: `⭐ New ${overall_rating}-star review submitted - pending moderation`
        });

        res.json({ message: 'Thank you for your review!' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Get garage reviews
export const getGarageReviews = async (req: AuthRequest, res: Response) => {
    const { garage_id } = req.params;

    try {
        const result = await pool.query(
            `SELECT r.*, u.full_name as customer_name
             FROM order_reviews r
             JOIN users u ON r.customer_id = u.user_id
             WHERE r.garage_id = $1 AND r.is_visible = true
             ORDER BY r.created_at DESC
             LIMIT 50`,
            [garage_id]
        );

        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_reviews,
                ROUND(AVG(overall_rating)::numeric, 2) as avg_rating,
                ROUND(AVG(part_quality_rating)::numeric, 2) as avg_part_quality,
                ROUND(AVG(communication_rating)::numeric, 2) as avg_communication,
                ROUND(AVG(delivery_rating)::numeric, 2) as avg_delivery
             FROM order_reviews
             WHERE garage_id = $1 AND is_visible = true`,
            [garage_id]
        );

        res.json({
            reviews: result.rows,
            stats: stats.rows[0]
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

