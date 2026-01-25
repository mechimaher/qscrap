/**
 * Dashboard Service
 * Handles garage and customer dashboard stats, profile management, addresses, notifications
 */
import { Pool } from 'pg';

export class DashboardService {
    constructor(private pool: Pool) { }

    // ============= GARAGE DASHBOARD =============
    async getGarageStats(garageId: string) {
        const [pendingBids, activeBids, activeOrders, completedOrders, revenue, profile] = await Promise.all([
            this.pool.query(`SELECT COUNT(*) as count FROM bids WHERE garage_id = $1 AND status = 'pending'`, [garageId]),
            this.pool.query(`SELECT COUNT(*) as count FROM bids WHERE garage_id = $1 AND status = 'accepted' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`, [garageId]),
            this.pool.query(`SELECT COUNT(*) as count FROM orders WHERE garage_id = $1 AND order_status NOT IN ('completed', 'delivered', 'cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops', 'refunded')`, [garageId]),
            this.pool.query(`SELECT COUNT(*) as count FROM orders WHERE garage_id = $1 AND order_status = 'completed' AND completed_at >= DATE_TRUNC('month', CURRENT_DATE)`, [garageId]),
            this.pool.query(`SELECT COALESCE(SUM(garage_payout_amount), 0) as total FROM orders WHERE garage_id = $1 AND order_status = 'completed' AND completed_at >= DATE_TRUNC('month', CURRENT_DATE)`, [garageId]),
            this.pool.query(`SELECT g.*, gs.plan_id, gs.status as subscription_status, sp.plan_name FROM garages g LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status IN ('active', 'trial') LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id WHERE g.garage_id = $1`, [garageId])
        ]);

        return {
            stats: {
                pending_bids: parseInt(pendingBids.rows[0].count),
                accepted_bids_month: parseInt(activeBids.rows[0].count),
                active_orders: parseInt(activeOrders.rows[0].count),
                completed_orders_month: parseInt(completedOrders.rows[0].count),
                revenue_month: parseFloat(revenue.rows[0].total)
            },
            profile: profile.rows[0] || null
        };
    }

    async getGarageProfile(garageId: string) {
        const result = await this.pool.query(`
            SELECT g.garage_id, g.garage_name, g.address, g.rating_average, g.rating_count,
                   g.total_transactions, g.created_at, g.cr_number, g.trade_license_number, g.bank_name, g.bank_account, g.iban,
                   g.approval_status, g.demo_expires_at, g.supplier_type, g.specialized_brands, g.all_brands,
                   g.location_lat, g.location_lng, u.phone_number,
                   gs.plan_id, gs.status as subscription_status, gs.trial_ends_at, gs.billing_cycle_end,
                   COALESCE(sp.plan_name, CASE WHEN g.approval_status = 'demo' THEN 'Demo Trial' ELSE 'No Plan' END) as plan_name,
                   COALESCE(sp.commission_rate, 0.15) as commission_rate, sp.max_bids_per_month,
                   COALESCE((SELECT SUM(garage_payout_amount) FROM orders WHERE garage_id = g.garage_id AND order_status = 'completed'), 0) as total_revenue
            FROM garages g
            LEFT JOIN users u ON g.garage_id = u.user_id
            LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status IN ('active', 'trial')
            LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            WHERE g.garage_id = $1`, [garageId]);

        if (result.rows.length === 0) return null;
        const profile = result.rows[0];
        if (!profile.subscription_status && profile.approval_status === 'demo') {
            profile.subscription_status = 'demo';
            profile.plan_name = 'Demo Trial';
            profile.billing_cycle_end = profile.demo_expires_at;
        }
        return profile;
    }

    async updateGarageBusinessDetails(garageId: string, data: { cr_number?: string; trade_license_number?: string; bank_name?: string; bank_account?: string; iban?: string }) {
        const result = await this.pool.query(`
            UPDATE garages SET cr_number = COALESCE($1, cr_number), trade_license_number = COALESCE($2, trade_license_number),
            bank_name = COALESCE($3, bank_name), bank_account = COALESCE($4, bank_account), iban = COALESCE($5, iban), updated_at = NOW()
            WHERE garage_id = $6 RETURNING garage_id, cr_number, trade_license_number, bank_name, iban`,
            [data.cr_number || null, data.trade_license_number || null, data.bank_name || null, data.bank_account || null, data.iban || null, garageId]);
        return result.rows[0];
    }

    async updateGarageSpecialization(garageId: string, data: { supplier_type?: string; specialized_brands?: string[]; all_brands?: boolean }) {
        const result = await this.pool.query(`
            UPDATE garages SET supplier_type = COALESCE($1, supplier_type), specialized_brands = COALESCE($2, specialized_brands),
            all_brands = COALESCE($3, all_brands), updated_at = NOW()
            WHERE garage_id = $4 RETURNING garage_id, supplier_type, specialized_brands, all_brands`,
            [data.supplier_type || null, data.specialized_brands || null, data.all_brands, garageId]);
        return result.rows[0];
    }

    async updateGarageLocation(garageId: string, lat: number, lng: number, address?: string) {
        const updateFields = ['location_lat = $1', 'location_lng = $2', 'updated_at = NOW()'];
        const params: (number | string)[] = [lat, lng];
        if (address) { updateFields.push(`address = $${params.length + 1}`); params.push(address); }
        params.push(garageId);
        const result = await this.pool.query(`UPDATE garages SET ${updateFields.join(', ')} WHERE garage_id = $${params.length} RETURNING garage_id, garage_name, address, location_lat, location_lng`, params);
        return result.rows[0];
    }

    // ============= CUSTOMER DASHBOARD =============
    async getCustomerStats(customerId: string) {
        const [activeRequests, totalOrders, inProgressOrders, awaitingConfirmation] = await Promise.all([
            this.pool.query(`SELECT COUNT(*) as count FROM part_requests WHERE customer_id = $1 AND status = 'active'`, [customerId]),
            this.pool.query(`SELECT COUNT(*) as count FROM orders WHERE customer_id = $1`, [customerId]),
            this.pool.query(`SELECT COUNT(*) as count FROM orders WHERE customer_id = $1 AND order_status IN ('confirmed', 'preparing', 'ready_for_pickup', 'collected', 'in_transit')`, [customerId]),
            this.pool.query(`SELECT COUNT(*) as count FROM orders WHERE customer_id = $1 AND order_status = 'delivered'`, [customerId])
        ]);
        return {
            active_requests: parseInt(activeRequests.rows[0].count),
            total_orders: parseInt(totalOrders.rows[0].count),
            pending_deliveries: parseInt(inProgressOrders.rows[0].count),
            awaiting_confirmation: parseInt(awaitingConfirmation.rows[0].count)
        };
    }

    async getCustomerProfile(customerId: string) {
        const [userResult, statsResult, addressesResult] = await Promise.all([
            this.pool.query(`SELECT user_id, full_name, phone_number, email, created_at FROM users WHERE user_id = $1`, [customerId]),
            this.pool.query(`SELECT (SELECT COUNT(*) FROM part_requests WHERE customer_id = $1) as total_requests, (SELECT COUNT(*) FROM orders WHERE customer_id = $1) as total_orders, (SELECT COUNT(*) FROM orders WHERE customer_id = $1 AND order_status = 'completed') as completed_orders, (SELECT COUNT(*) FROM order_reviews WHERE customer_id = $1) as reviews_given`, [customerId]),
            this.pool.query(`SELECT address_id, label, address_line, area, city, delivery_notes, is_default FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC`, [customerId])
        ]);
        return { user: userResult.rows[0] || null, stats: statsResult.rows[0] || { total_requests: 0, completed_orders: 0, reviews_given: 0 }, addresses: addressesResult.rows };
    }

    async updateCustomerProfile(customerId: string, data: { full_name?: string; email?: string }) {
        const result = await this.pool.query(`UPDATE users SET full_name = $1, email = $2, updated_at = NOW() WHERE user_id = $3 RETURNING user_id, full_name, phone_number, email`, [data.full_name, data.email, customerId]);
        return result.rows[0];
    }

    // ============= ADDRESSES =============
    async addAddress(customerId: string, data: { label?: string; address_line: string; area: string; delivery_notes?: string; is_default?: boolean }) {
        if (data.is_default) { await this.pool.query(`UPDATE customer_addresses SET is_default = false WHERE customer_id = $1`, [customerId]); }
        const result = await this.pool.query(`INSERT INTO customer_addresses (customer_id, label, address_line, area, delivery_notes, is_default) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [customerId, data.label || 'Home', data.address_line, data.area, data.delivery_notes, data.is_default || false]);
        return result.rows[0];
    }

    async deleteAddress(customerId: string, addressId: string) {
        const result = await this.pool.query(`DELETE FROM customer_addresses WHERE address_id = $1 AND customer_id = $2 RETURNING address_id`, [addressId, customerId]);
        return result.rowCount! > 0;
    }

    async setDefaultAddress(customerId: string, addressId: string) {
        await this.pool.query(`UPDATE customer_addresses SET is_default = false WHERE customer_id = $1`, [customerId]);
        const result = await this.pool.query(`UPDATE customer_addresses SET is_default = true WHERE address_id = $1 AND customer_id = $2 RETURNING *`, [addressId, customerId]);
        return result.rows[0];
    }

    // ============= NOTIFICATIONS =============
    async getNotifications(userId: string) {
        const result = await this.pool.query(`SELECT notification_id, title, body as message, notification_type as type, is_read, created_at, data->'related_id' as related_id, data FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]);
        return result.rows;
    }

    async markNotificationRead(userId: string, notificationId: string) {
        await this.pool.query(`UPDATE notifications SET is_read = true WHERE notification_id = $1 AND user_id = $2`, [notificationId, userId]);
    }

    async markAllNotificationsRead(userId: string) {
        await this.pool.query(`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, [userId]);
    }

    async deleteNotification(userId: string, notificationId: string) {
        const result = await this.pool.query(`DELETE FROM notifications WHERE notification_id = $1 AND user_id = $2`, [notificationId, userId]);
        return result.rowCount! > 0;
    }

    async clearAllNotifications(userId: string) {
        const result = await this.pool.query(`DELETE FROM notifications WHERE user_id = $1`, [userId]);
        return result.rowCount || 0;
    }
}
