-- ============================================
-- QScrap Performance Indexes Migration
-- Created: 2024-12-24
-- Purpose: Maximum query performance for scale
-- ============================================

-- ============================================
-- 1. ORDERS TABLE INDEXES (Most Critical)
-- ============================================

-- Order status queries (dashboard, filtering)
CREATE INDEX IF NOT EXISTS idx_orders_status 
ON orders(order_status);

-- Customer order history (customer dashboard)
CREATE INDEX IF NOT EXISTS idx_orders_customer_created 
ON orders(customer_id, created_at DESC);

-- Garage order management (garage dashboard)
CREATE INDEX IF NOT EXISTS idx_orders_garage_created 
ON orders(garage_id, created_at DESC);

-- Active orders for operations
CREATE INDEX IF NOT EXISTS idx_orders_active 
ON orders(order_status, created_at DESC) 
WHERE order_status IN ('confirmed', 'preparing', 'ready_for_pickup', 'in_transit', 'qc_passed', 'out_for_delivery');

-- Completed orders for revenue reports
CREATE INDEX IF NOT EXISTS idx_orders_completed_date 
ON orders(created_at DESC) 
WHERE order_status = 'completed';

-- Order number lookup
CREATE INDEX IF NOT EXISTS idx_orders_order_number 
ON orders(order_number);

-- ============================================
-- 2. REQUESTS TABLE INDEXES
-- ============================================

-- Active requests (garage dashboard)
CREATE INDEX IF NOT EXISTS idx_requests_status 
ON part_requests(status);

-- Customer requests (customer dashboard)
CREATE INDEX IF NOT EXISTS idx_requests_customer_created 
ON part_requests(customer_id, created_at DESC);

-- Open requests for bidding
CREATE INDEX IF NOT EXISTS idx_requests_open 
ON part_requests(status, created_at DESC) 
WHERE status IN ('pending', 'bidding');

-- ============================================
-- 3. BIDS TABLE INDEXES
-- ============================================

-- Bids per request (request detail page)
CREATE INDEX IF NOT EXISTS idx_bids_request_created 
ON bids(request_id, created_at DESC);

-- Garage bid history
CREATE INDEX IF NOT EXISTS idx_bids_garage_created 
ON bids(garage_id, created_at DESC);

-- Bid status filtering
CREATE INDEX IF NOT EXISTS idx_bids_status 
ON bids(status);

-- ============================================
-- 4. DELIVERY ASSIGNMENTS INDEXES
-- ============================================

-- Driver assignments (driver app)
CREATE INDEX IF NOT EXISTS idx_delivery_driver_status 
ON delivery_assignments(driver_id, status);

-- Order delivery lookup
CREATE INDEX IF NOT EXISTS idx_delivery_order 
ON delivery_assignments(order_id);

-- Active deliveries
CREATE INDEX IF NOT EXISTS idx_delivery_active 
ON delivery_assignments(status, created_at DESC) 
WHERE status IN ('assigned', 'picked_up', 'in_transit');

-- ============================================
-- 5. USERS TABLE INDEXES
-- ============================================

-- User type filtering (admin user management)
CREATE INDEX IF NOT EXISTS idx_users_type 
ON users(user_type);

-- Phone lookup (login)
CREATE INDEX IF NOT EXISTS idx_users_phone 
ON users(phone_number);

-- Active users
CREATE INDEX IF NOT EXISTS idx_users_active 
ON users(is_active, user_type);

-- ============================================
-- 6. GARAGES TABLE INDEXES
-- ============================================

-- Approval status (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_garages_approval_status 
ON garages(approval_status);

-- Pending approvals
CREATE INDEX IF NOT EXISTS idx_garages_pending 
ON garages(created_at ASC) 
WHERE approval_status = 'pending' OR approval_status IS NULL;

-- Demo garages expiring
CREATE INDEX IF NOT EXISTS idx_garages_demo_expiry 
ON garages(demo_expires_at ASC) 
WHERE approval_status = 'demo';

-- Garage search/listing
CREATE INDEX IF NOT EXISTS idx_garages_name_search 
ON garages(garage_name);

-- ============================================
-- 7. DISPUTES TABLE INDEXES
-- ============================================

-- Open disputes (operations)
CREATE INDEX IF NOT EXISTS idx_disputes_status 
ON disputes(status);

-- Order disputes
CREATE INDEX IF NOT EXISTS idx_disputes_order 
ON disputes(order_id);

-- ============================================
-- 8. GARAGE SUBSCRIPTIONS INDEXES
-- ============================================

-- Active subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_active 
ON garage_subscriptions(garage_id, status) 
WHERE status = 'active';

-- Expiring subscriptions (renewal report)
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry 
ON garage_subscriptions(billing_cycle_end ASC) 
WHERE status = 'active';

-- ============================================
-- 9. AUDIT LOG INDEXES
-- ============================================

-- Admin activity
CREATE INDEX IF NOT EXISTS idx_audit_admin_date 
ON admin_audit_log(admin_id, created_at DESC);

-- Target lookup
CREATE INDEX IF NOT EXISTS idx_audit_target 
ON admin_audit_log(target_type, target_id);

-- Action type filtering
CREATE INDEX IF NOT EXISTS idx_audit_action_date 
ON admin_audit_log(action_type, created_at DESC);

-- ============================================
-- 10. QUALITY INSPECTIONS INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_qc_order 
ON quality_inspections(order_id);

CREATE INDEX IF NOT EXISTS idx_qc_passed 
ON quality_inspections(result, created_at DESC);

-- ============================================
-- 11. REVIEWS TABLE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_reviews_garage 
ON reviews(garage_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_order 
ON reviews(order_id);

-- ============================================
-- 12. SUPPORT TICKETS INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tickets_status 
ON support_tickets(status);

CREATE INDEX IF NOT EXISTS idx_tickets_user 
ON support_tickets(customer_id, created_at DESC);

-- ============================================
-- ANALYZE TABLES (Update Statistics)
-- ============================================

ANALYZE orders;
ANALYZE part_requests;
ANALYZE bids;
ANALYZE delivery_assignments;
ANALYZE users;
ANALYZE garages;
ANALYZE disputes;
ANALYZE garage_subscriptions;
ANALYZE admin_audit_log;
