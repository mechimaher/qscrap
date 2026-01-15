-- ============================================
-- Performance Indexes for 1M+ Scale
-- Created: 2026-01-15
-- ============================================

-- Composite index for customer order history (most common query)
CREATE INDEX IF NOT EXISTS idx_orders_customer_created 
    ON orders(customer_id, created_at DESC);

-- Composite index for garage bid activity
CREATE INDEX IF NOT EXISTS idx_bids_garage_status_created 
    ON bids(garage_id, status, created_at DESC);

-- Composite index for active customer requests
CREATE INDEX IF NOT EXISTS idx_requests_customer_status 
    ON part_requests(customer_id, status, created_at DESC);

-- Index for order tracking (driver + status)
CREATE INDEX IF NOT EXISTS idx_orders_driver_status 
    ON orders(driver_id, order_status) 
    WHERE order_status IN ('in_transit', 'collected');

-- Index for pending counter-offers (expiry check job)
CREATE INDEX IF NOT EXISTS idx_counter_offers_pending_expires 
    ON counter_offers(expires_at) 
    WHERE status = 'pending';

-- Index for garage subscription billing
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_cycle 
    ON garage_subscriptions(billing_cycle_end, status) 
    WHERE status = 'active';

-- Index for notifications (user + unread)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
    ON notifications(user_id, is_read, created_at DESC) 
    WHERE is_read = false;

-- Analyze all tables after index creation
ANALYZE orders;
ANALYZE bids;
ANALYZE part_requests;
ANALYZE counter_offers;
ANALYZE garage_subscriptions;
ANALYZE notifications;
