import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';

// Garage Dashboard Stats
export const getGarageStats = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        // Get various stats in parallel
        const [pendingBids, activeBids, activeOrders, completedOrders, revenue, profile] = await Promise.all([
            // Pending bids count
            pool.query(
                `SELECT COUNT(*) as count FROM bids WHERE garage_id = $1 AND status = 'pending'`,
                [garageId]
            ),
            // Accepted bids this month
            pool.query(
                `SELECT COUNT(*) as count FROM bids 
                 WHERE garage_id = $1 AND status = 'accepted' 
                 AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
                [garageId]
            ),
            // Active orders
            pool.query(
                `SELECT COUNT(*) as count FROM orders 
                 WHERE garage_id = $1 AND order_status NOT IN ('completed', 'delivered', 'cancelled_by_customer', 'cancelled_by_garage', 'refunded')`,
                [garageId]
            ),
            // Completed orders this month
            pool.query(
                `SELECT COUNT(*) as count FROM orders 
                 WHERE garage_id = $1 AND order_status = 'completed'
                 AND completed_at >= DATE_TRUNC('month', CURRENT_DATE)`,
                [garageId]
            ),
            // Revenue this month
            pool.query(
                `SELECT COALESCE(SUM(garage_payout_amount), 0) as total FROM orders 
                 WHERE garage_id = $1 AND order_status = 'completed'
                 AND completed_at >= DATE_TRUNC('month', CURRENT_DATE)`,
                [garageId]
            ),
            // Garage profile
            pool.query(
                `SELECT g.*, gs.plan_id, gs.status as subscription_status, sp.plan_name
                 FROM garages g
                 LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status IN ('active', 'trial')
                 LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
                 WHERE g.garage_id = $1`,
                [garageId]
            )
        ]);

        res.json({
            stats: {
                pending_bids: parseInt(pendingBids.rows[0].count),
                accepted_bids_month: parseInt(activeBids.rows[0].count),
                active_orders: parseInt(activeOrders.rows[0].count),
                completed_orders_month: parseInt(completedOrders.rows[0].count),
                revenue_month: parseFloat(revenue.rows[0].total)
            },
            profile: profile.rows[0] || null
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// Garage Profile
export const getGarageProfile = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;

    try {
        const result = await pool.query(
            `SELECT g.garage_id, g.garage_name, g.address, g.rating_average, g.rating_count,
                    g.total_transactions, g.created_at,
                    g.cr_number, g.trade_license_number, g.bank_name, g.bank_account, g.iban,
                    g.approval_status, g.demo_expires_at,
                    g.supplier_type, g.specialized_brands, g.all_brands,
                    u.phone_number,
                    gs.plan_id, gs.status as subscription_status, gs.trial_ends_at, gs.billing_cycle_end,
                    COALESCE(sp.plan_name, 
                        CASE WHEN g.approval_status = 'demo' THEN 'Demo Trial' ELSE 'No Plan' END
                    ) as plan_name, 
                    COALESCE(sp.commission_rate, 0.15) as commission_rate, 
                    sp.max_bids_per_month,
                    COALESCE((SELECT SUM(garage_payout_amount) FROM orders WHERE garage_id = g.garage_id AND order_status = 'completed'), 0) as total_revenue
             FROM garages g
             LEFT JOIN users u ON g.garage_id = u.user_id
             LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id AND gs.status IN ('active', 'trial')
             LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
             WHERE g.garage_id = $1`,
            [garageId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Garage not found' });
        }

        const profile = result.rows[0];

        // If no subscription but has demo, set subscription info from demo
        if (!profile.subscription_status && profile.approval_status === 'demo') {
            profile.subscription_status = 'demo';
            profile.plan_name = 'Demo Trial';
            profile.billing_cycle_end = profile.demo_expires_at;
        }

        res.json(profile);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// Update Garage Business Details (CR Number, Bank Info for Qatar Legal Compliance)
export const updateGarageBusinessDetails = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { cr_number, trade_license_number, bank_name, bank_account, iban } = req.body;

    try {
        const result = await pool.query(
            `UPDATE garages SET 
                cr_number = COALESCE($1, cr_number),
                trade_license_number = COALESCE($2, trade_license_number),
                bank_name = COALESCE($3, bank_name),
                bank_account = COALESCE($4, bank_account),
                iban = COALESCE($5, iban),
                updated_at = NOW()
             WHERE garage_id = $6
             RETURNING garage_id, cr_number, trade_license_number, bank_name, iban`,
            [cr_number || null, trade_license_number || null, bank_name || null, bank_account || null, iban || null, garageId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Garage not found' });
        }

        res.json({
            message: 'Business details updated successfully',
            garage: result.rows[0]
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// Update Garage Specialization (Supplier Type and Brand Specialization)
export const updateGarageSpecialization = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const { supplier_type, specialized_brands, all_brands } = req.body;

    // Validate supplier_type
    if (supplier_type && !['used', 'new', 'both'].includes(supplier_type)) {
        return res.status(400).json({ error: 'supplier_type must be one of: used, new, both' });
    }

    // Validate specialized_brands is an array
    if (specialized_brands && !Array.isArray(specialized_brands)) {
        return res.status(400).json({ error: 'specialized_brands must be an array' });
    }

    try {
        const result = await pool.query(
            `UPDATE garages SET 
                supplier_type = COALESCE($1, supplier_type),
                specialized_brands = COALESCE($2, specialized_brands),
                all_brands = COALESCE($3, all_brands),
                updated_at = NOW()
             WHERE garage_id = $4
             RETURNING garage_id, supplier_type, specialized_brands, all_brands`,
            [supplier_type || null, specialized_brands || null, all_brands, garageId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Garage not found' });
        }

        res.json({
            message: 'Garage specialization updated successfully',
            garage: result.rows[0]
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// Customer Dashboard Stats  
export const getCustomerStats = async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;

    try {
        const [activeRequests, totalOrders, inProgressOrders, awaitingConfirmation] = await Promise.all([
            pool.query(
                `SELECT COUNT(*) as count FROM part_requests WHERE customer_id = $1 AND status = 'active'`,
                [customerId]
            ),
            pool.query(
                `SELECT COUNT(*) as count FROM orders WHERE customer_id = $1`,
                [customerId]
            ),
            // In Progress = orders that are actively being processed (NOT delivered/completed/cancelled)
            pool.query(
                `SELECT COUNT(*) as count FROM orders 
                 WHERE customer_id = $1 AND order_status IN ('confirmed', 'preparing', 'ready_for_pickup', 'collected', 'qc_in_progress', 'qc_passed', 'in_transit')`,
                [customerId]
            ),
            // Awaiting Confirmation = delivered but not yet confirmed by customer
            pool.query(
                `SELECT COUNT(*) as count FROM orders 
                 WHERE customer_id = $1 AND order_status = 'delivered'`,
                [customerId]
            )
        ]);

        res.json({
            stats: {
                active_requests: parseInt(activeRequests.rows[0].count),
                total_orders: parseInt(totalOrders.rows[0].count),
                pending_deliveries: parseInt(inProgressOrders.rows[0].count), // Renamed: truly in-progress
                awaiting_confirmation: parseInt(awaitingConfirmation.rows[0].count) // NEW: delivered, needs confirmation
            }
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// ===== CUSTOMER PROFILE =====
export const getCustomerProfile = async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;

    try {
        // Get user info, stats, and addresses in parallel
        const [userResult, statsResult, addressesResult] = await Promise.all([
            // User info
            pool.query(
                `SELECT user_id, full_name, phone_number, email, created_at 
                 FROM users WHERE user_id = $1`,
                [customerId]
            ),
            // Stats
            pool.query(
                `SELECT 
                    (SELECT COUNT(*) FROM part_requests WHERE customer_id = $1) as total_requests,
                    (SELECT COUNT(*) FROM orders WHERE customer_id = $1) as total_orders,
                    (SELECT COUNT(*) FROM orders WHERE customer_id = $1 AND order_status = 'completed') as completed_orders,
                    (SELECT COUNT(*) FROM order_reviews WHERE customer_id = $1) as reviews_given`,
                [customerId]
            ),
            // Addresses
            pool.query(
                `SELECT address_id, label, address_line, area, city, delivery_notes, is_default
                 FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC`,
                [customerId]
            )
        ]);

        res.json({
            user: userResult.rows[0] || null,
            stats: statsResult.rows[0] || { total_requests: 0, completed_orders: 0, reviews_given: 0 },
            addresses: addressesResult.rows
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// Update customer profile
export const updateCustomerProfile = async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;
    const { full_name, email } = req.body;

    try {
        const result = await pool.query(
            `UPDATE users SET full_name = $1, email = $2, updated_at = NOW() 
             WHERE user_id = $3 RETURNING user_id, full_name, phone_number, email`,
            [full_name, email, customerId]
        );

        res.json({ user: result.rows[0], message: 'Profile updated successfully' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// Add address
export const addAddress = async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;
    const { label, address_line, area, delivery_notes, is_default } = req.body;

    try {
        // If setting as default, unset others first
        if (is_default) {
            await pool.query(
                `UPDATE customer_addresses SET is_default = false WHERE customer_id = $1`,
                [customerId]
            );
        }

        const result = await pool.query(
            `INSERT INTO customer_addresses (customer_id, label, address_line, area, delivery_notes, is_default)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [customerId, label || 'Home', address_line, area, delivery_notes, is_default || false]
        );

        res.json({ address: result.rows[0], message: 'Address added successfully' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// Delete address
export const deleteAddress = async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;
    const { addressId } = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM customer_addresses WHERE address_id = $1 AND customer_id = $2 RETURNING address_id`,
            [addressId, customerId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Address not found' });
        }

        res.json({ message: 'Address deleted' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// Set default address
export const setDefaultAddress = async (req: AuthRequest, res: Response) => {
    const customerId = req.user!.userId;
    const { addressId } = req.params;

    try {
        // Unset all defaults
        await pool.query(
            `UPDATE customer_addresses SET is_default = false WHERE customer_id = $1`,
            [customerId]
        );

        // Set new default
        const result = await pool.query(
            `UPDATE customer_addresses SET is_default = true 
             WHERE address_id = $1 AND customer_id = $2 RETURNING *`,
            [addressId, customerId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Address not found' });
        }

        res.json({ address: result.rows[0], message: 'Default address updated' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// ===== NOTIFICATIONS =====
export const getNotifications = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    try {
        const result = await pool.query(
            `SELECT notification_id, title, body, notification_type, is_read, created_at
             FROM notifications WHERE user_id = $1 
             ORDER BY created_at DESC LIMIT 50`,
            [userId]
        );

        res.json({ notifications: result.rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { notificationId } = req.params;

    try {
        await pool.query(
            `UPDATE notifications SET is_read = true WHERE notification_id = $1 AND user_id = $2`,
            [notificationId, userId]
        );

        res.json({ message: 'Notification marked as read' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    try {
        await pool.query(
            `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
            [userId]
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
