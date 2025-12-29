-- QScrap Premium 2026 - Database Cleanup and Index Migration
-- Adds missing indexes, constraints, soft deletes, and documentation

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Counter offers need fast bid lookups
CREATE INDEX IF NOT EXISTS idx_counter_offers_bid_id ON counter_offers(bid_id);
CREATE INDEX IF NOT EXISTS idx_counter_offers_status ON counter_offers(status);

-- Delivery assignments need fast order lookups  
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order_id ON delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_driver_id ON delivery_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON delivery_assignments(status);

-- Bids need fast request lookups
CREATE INDEX IF NOT EXISTS idx_bids_request_id ON bids(request_id);
CREATE INDEX IF NOT EXISTS idx_bids_garage_id ON bids(garage_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);

-- Orders need status filtering
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_garage_id ON orders(garage_id);

-- Part requests need filtering
CREATE INDEX IF NOT EXISTS idx_part_requests_status ON part_requests(status);
CREATE INDEX IF NOT EXISTS idx_part_requests_customer_id ON part_requests(customer_id);

-- Disputes need order lookups
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

-- Refunds need order lookups
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);

-- ============================================
-- UNIQUE CONSTRAINTS
-- ============================================

-- Ensure unique payout reference (with NULL handling)
CREATE UNIQUE INDEX IF NOT EXISTS idx_garage_payouts_unique_reference 
ON garage_payouts(payout_reference) 
WHERE payout_reference IS NOT NULL;

-- Ensure only one default template per document type
DROP INDEX IF EXISTS idx_default_template;
CREATE UNIQUE INDEX idx_default_template_type 
ON document_templates (document_type) 
WHERE is_default = true;

-- Ensure one bid per garage per request
CREATE UNIQUE INDEX IF NOT EXISTS idx_bids_unique_garage_request 
ON bids(garage_id, request_id) 
WHERE status NOT IN ('withdrawn', 'expired');

-- ============================================
-- SOFT DELETE COLUMNS
-- ============================================

ALTER TABLE part_requests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================
-- CAR YEAR CONSTRAINT FIX
-- ============================================

-- Drop the old static constraint
ALTER TABLE part_requests DROP CONSTRAINT IF EXISTS part_requests_car_year_check;

-- Add dynamic constraint (allows cars up to 2 years in future for pre-orders)
ALTER TABLE part_requests 
ADD CONSTRAINT part_requests_car_year_dynamic_check 
CHECK (car_year >= 1900 AND car_year <= EXTRACT(YEAR FROM NOW()) + 2);

-- ============================================
-- DISPUTE PHOTO LIMIT (via comment, enforced in app)
-- ============================================
COMMENT ON COLUMN disputes.photo_urls IS 'Array of photo URLs. App enforces limit of 5 photos, 5MB each.';

-- ============================================
-- LEGACY TABLE DOCUMENTATION
-- ============================================
COMMENT ON TABLE reviews IS 'DEPRECATED: Use order_reviews instead. Retained for historical data.';
COMMENT ON TABLE user_addresses IS 'DEPRECATED: Use customer_addresses instead. Retained for migration period.';

-- ============================================
-- LOG MIGRATION
-- ============================================
INSERT INTO migrations (name, applied_at) 
VALUES ('20241229_indexes_constraints_cleanup', NOW())
ON CONFLICT (name) DO NOTHING;
