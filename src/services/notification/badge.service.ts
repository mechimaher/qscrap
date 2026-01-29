/**
 * Badge Count Service
 * Provides real-time badge counts for notifications across customer and garage apps
 * Enterprise-grade notification system like Talabat/Keeta
 */
import { Pool } from 'pg';

export class BadgeCountService {
    constructor(private pool: Pool) { }

    /**
     * Get badge counts for customer mobile app
     * Used for tab bar badges on Requests, Orders, Profile tabs
     */
    async getCustomerBadgeCounts(customerId: string): Promise<{
        requests: { active: number; with_bids: number; pending_action: number };
        orders: { active: number; pending_payment: number; in_transit: number; pending_confirmation: number };
        notifications: { unread: number };
        total_badge: number;
    }> {
        // Get request counts
        // Note: Valid part_requests.status values are: active, accepted, expired, cancelled_by_customer
        // 'accepted' means bid was accepted and order created - no longer needs customer attention
        const requestsResult = await this.pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'active') as active,
                COUNT(*) FILTER (WHERE status = 'active' AND 
                    (SELECT COUNT(*) FROM bids WHERE bids.request_id = part_requests.request_id AND bids.status = 'active') > 0
                ) as with_bids,
                COUNT(*) FILTER (WHERE status = 'active' AND 
                    EXISTS (
                        SELECT 1 FROM bids b 
                        LEFT JOIN counter_offers co ON co.bid_id = b.bid_id
                        WHERE b.request_id = part_requests.request_id 
                        AND co.offered_by_type = 'garage' AND co.status = 'pending'
                    )
                ) as pending_action
            FROM part_requests
            WHERE customer_id = $1 AND status = 'active' AND deleted_at IS NULL
        `, [customerId]);

        // Get order counts
        // Note: Valid order_status values are: pending_payment, confirmed, preparing, ready_for_pickup, in_transit, delivered, completed, etc.
        // Valid payment_status values are: pending, paid, refunded, partially_refunded
        const ordersResult = await this.pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE order_status IN ('pending_payment', 'confirmed', 'preparing', 'ready_for_pickup', 'in_transit')) as active,
                COUNT(*) FILTER (WHERE order_status = 'pending_payment') as pending_payment,
                COUNT(*) FILTER (WHERE order_status = 'in_transit') as in_transit,
                COUNT(*) FILTER (WHERE order_status = 'delivered' AND payment_status != 'paid') as pending_confirmation
            FROM orders o
            WHERE o.customer_id = $1 AND o.deleted_at IS NULL
        `, [customerId]);

        // Get unread notification count
        const notificationsResult = await this.pool.query(`
            SELECT COUNT(*) as unread
            FROM notifications
            WHERE user_id = $1 AND is_read = false
        `, [customerId]);

        const requests = requestsResult.rows[0] || { active: 0, with_bids: 0, pending_action: 0 };
        const orders = ordersResult.rows[0] || { active: 0, pending_payment: 0, in_transit: 0, pending_confirmation: 0 };
        const notifications = notificationsResult.rows[0] || { unread: 0 };

        // Calculate total badge (items needing attention)
        const requestsBadge = parseInt(requests.with_bids) + parseInt(requests.pending_action);
        const ordersBadge = parseInt(orders.pending_payment) + parseInt(orders.pending_confirmation);
        const notificationsBadge = parseInt(notifications.unread);

        return {
            requests: {
                active: parseInt(requests.active) || 0,
                with_bids: parseInt(requests.with_bids) || 0,
                pending_action: parseInt(requests.pending_action) || 0,
            },
            orders: {
                active: parseInt(orders.active) || 0,
                pending_payment: parseInt(orders.pending_payment) || 0,
                in_transit: parseInt(orders.in_transit) || 0,
                pending_confirmation: parseInt(orders.pending_confirmation) || 0,
            },
            notifications: {
                unread: notificationsBadge,
            },
            total_badge: requestsBadge + ordersBadge + notificationsBadge,
        };
    }

    /**
     * Get badge counts for garage dashboard
     * Used for sidebar badges and header notifications
     */
    async getGarageBadgeCounts(garageId: string): Promise<{
        new_requests: number;
        my_active_bids: number;
        pending_orders: number;
        counter_offers_pending: number;
        total_badge: number;
    }> {
        // Get garage profile for smart filtering
        const garageResult = await this.pool.query(
            `SELECT supplier_type, specialized_brands, all_brands FROM garages WHERE garage_id = $1`,
            [garageId]
        );
        const garage = garageResult.rows[0];

        // Build smart filter for requests matching garage profile
        let requestFilter = "status = 'active'";
        const params: any[] = [garageId];
        let paramIndex = 2;

        if (garage) {
            if (garage.supplier_type === 'new') {
                requestFilter += ` AND condition_required IN ('new', 'any')`;
            } else if (garage.supplier_type === 'used') {
                requestFilter += ` AND condition_required IN ('used', 'any')`;
            }
            if (!garage.all_brands && garage.specialized_brands?.length > 0) {
                requestFilter += ` AND UPPER(car_make) = ANY($${paramIndex}::text[])`;
                params.push(garage.specialized_brands.map((b: string) => b.toUpperCase()));
                paramIndex++;
            }
        }

        // Count new requests matching garage profile (not yet bid on by this garage)
        const newRequestsResult = await this.pool.query(`
            SELECT COUNT(*) as count
            FROM part_requests pr
            WHERE ${requestFilter}
            AND NOT EXISTS (
                SELECT 1 FROM bids b WHERE b.request_id = pr.request_id AND b.garage_id = $1
            )
            AND pr.created_at > NOW() - INTERVAL '48 hours'
        `, params);

        // Count active bids by this garage
        const activeBidsResult = await this.pool.query(`
            SELECT COUNT(*) as count
            FROM bids b
            JOIN part_requests pr ON b.request_id = pr.request_id
            WHERE b.garage_id = $1 AND pr.status = 'active' AND b.status = 'active'
        `, [garageId]);

        // Count pending orders for this garage (orders needing garage attention)
        const pendingOrdersResult = await this.pool.query(`
            SELECT COUNT(*) as count
            FROM orders o
            WHERE o.garage_id = $1 
            AND o.order_status IN ('confirmed', 'preparing', 'ready_for_pickup', 'ready_for_collection')
        `, [garageId]);

        // Count counter offers waiting for garage response (made by customer, pending)
        const counterOffersResult = await this.pool.query(`
            SELECT COUNT(*) as count
            FROM counter_offers co
            JOIN bids b ON co.bid_id = b.bid_id
            WHERE b.garage_id = $1 
            AND co.offered_by_type = 'customer'
            AND co.status = 'pending'
        `, [garageId]);

        const newRequests = parseInt(newRequestsResult.rows[0]?.count) || 0;
        const activeBids = parseInt(activeBidsResult.rows[0]?.count) || 0;
        const pendingOrders = parseInt(pendingOrdersResult.rows[0]?.count) || 0;
        const counterOffers = parseInt(counterOffersResult.rows[0]?.count) || 0;

        return {
            new_requests: newRequests,
            my_active_bids: activeBids,
            pending_orders: pendingOrders,
            counter_offers_pending: counterOffers,
            total_badge: newRequests + pendingOrders + counterOffers,
        };
    }
}
