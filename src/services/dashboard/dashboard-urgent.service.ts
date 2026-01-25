/**
 * Dashboard Urgent Service
 * Handles customer urgent actions and contextual data for smart homescreen
 */
import { Pool } from 'pg';

export class DashboardUrgentService {
    constructor(private pool: Pool) { }

    async getCustomerUrgentActions(customerId: string) {
        const urgentActions: any[] = [];

        // 1. Pending payments
        const pendingPayments = await this.pool.query(`
            SELECT order_id, order_number, total_amount, created_at FROM orders
            WHERE customer_id = $1 AND payment_status = 'pending'
            AND order_status NOT IN ('cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops', 'refunded')
            ORDER BY created_at DESC LIMIT 5`, [customerId]);

        pendingPayments.rows.forEach(order => {
            urgentActions.push({
                type: 'payment_pending', priority: 1, order_id: order.order_id,
                order_number: order.order_number, amount: order.total_amount,
                created_at: order.created_at, action: 'Complete payment to proceed with order'
            });
        });

        // 2. Delivery confirmations needed
        const deliveryConfirmations = await this.pool.query(`
            SELECT order_id, order_number, actual_delivery_at, delivery_address FROM orders
            WHERE customer_id = $1 AND order_status = 'delivered' AND actual_delivery_at IS NOT NULL
            ORDER BY actual_delivery_at DESC LIMIT 5`, [customerId]);

        deliveryConfirmations.rows.forEach(order => {
            urgentActions.push({
                type: 'delivery_confirmation', priority: 1, order_id: order.order_id,
                order_number: order.order_number, delivered_at: order.actual_delivery_at,
                address: order.delivery_address, action: 'Confirm delivery to complete order'
            });
        });

        // 3. Expiring bids (<24 hours)
        const expiringBids = await this.pool.query(`
            SELECT b.bid_id, b.request_id, b.bid_amount, b.created_at, g.garage_name,
                   pr.part_description, pr.car_make, pr.car_model, pr.car_year,
                   EXTRACT(EPOCH FROM (pr.expires_at - NOW())) as seconds_until_expiry
            FROM bids b JOIN garages g ON b.garage_id = g.garage_id JOIN part_requests pr ON b.request_id = pr.request_id
            WHERE pr.customer_id = $1 AND b.status = 'pending' AND pr.status = 'active'
            AND pr.expires_at > NOW() AND pr.expires_at < NOW() + INTERVAL '24 hours'
            ORDER BY pr.expires_at ASC LIMIT 5`, [customerId]);

        expiringBids.rows.forEach(bid => {
            urgentActions.push({
                type: 'bid_expiring', priority: 2, bid_id: bid.bid_id, request_id: bid.request_id,
                garage_name: bid.garage_name, amount: bid.bid_amount,
                part_description: bid.part_description, vehicle: `${bid.car_year} ${bid.car_make} ${bid.car_model}`,
                expires_in_seconds: Math.floor(bid.seconds_until_expiry), action: 'Review bid before it expires'
            });
        });

        // Note: Quick Services technician tracking removed (Jan 19 purge - "Simplicity is Beauty")
        // Parts Marketplace only - no technician dispatch functionality


        // 5. Pending counter-offers
        const pendingCounterOffers = await this.pool.query(`
            SELECT co.counter_offer_id, co.bid_id, co.proposed_amount, co.created_at, co.expires_at, g.garage_name,
                   pr.part_description, EXTRACT(EPOCH FROM (co.expires_at - NOW())) as seconds_until_expiry
            FROM counter_offers co JOIN bids b ON co.bid_id = b.bid_id
            JOIN garages g ON b.garage_id = g.garage_id JOIN part_requests pr ON b.request_id = pr.request_id
            WHERE pr.customer_id = $1 AND co.status = 'pending' AND co.expires_at > NOW()
            ORDER BY co.expires_at ASC LIMIT 5`, [customerId]);

        pendingCounterOffers.rows.forEach(offer => {
            urgentActions.push({
                type: 'counter_offer_pending', priority: 2, counter_offer_id: offer.counter_offer_id,
                bid_id: offer.bid_id, garage_name: offer.garage_name, new_amount: offer.proposed_amount,
                part_description: offer.part_description, expires_in_seconds: Math.floor(offer.seconds_until_expiry),
                action: 'Respond to garage counter-offer'
            });
        });

        urgentActions.sort((a, b) => a.priority - b.priority);
        return urgentActions;
    }

    async getCustomerContextualData(customerId: string) {
        // Quick Services removed Jan 19 - Parts Marketplace only
        const [unreadBids, activeOrders, moneySaved, loyaltyPoints] = await Promise.all([
            this.pool.query(`SELECT COUNT(DISTINCT b.bid_id) as count FROM bids b JOIN part_requests pr ON b.request_id = pr.request_id WHERE pr.customer_id = $1 AND b.status = 'pending' AND pr.status = 'active'`, [customerId]),
            this.pool.query(`SELECT COUNT(*) as count FROM orders WHERE customer_id = $1 AND order_status NOT IN ('completed', 'delivered', 'cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops', 'refunded')`, [customerId]),
            this.pool.query(`SELECT COALESCE(SUM(total_amount), 0) as total_spent, COUNT(*) as order_count FROM orders WHERE customer_id = $1 AND order_status = 'completed' AND completed_at >= DATE_TRUNC('month', CURRENT_DATE)`, [customerId]),
            this.pool.query(`SELECT COALESCE(points_balance, 0) as balance FROM customer_rewards WHERE customer_id = $1`, [customerId])
        ]);

        const totalSpent = parseFloat(moneySaved.rows[0].total_spent);
        const orderCount = parseInt(moneySaved.rows[0].order_count);
        const estimatedMarketPrice = totalSpent / 0.85;
        const moneySavedAmount = estimatedMarketPrice - totalSpent;

        return {
            unread_bids: parseInt(unreadBids.rows[0].count),
            active_orders: parseInt(activeOrders.rows[0].count),
            money_saved_this_month: Math.round(moneySavedAmount),
            loyalty_points: loyaltyPoints.rows[0] ? parseInt(loyaltyPoints.rows[0].balance) : 0,
            orders_this_month: orderCount
        };
    }
}
