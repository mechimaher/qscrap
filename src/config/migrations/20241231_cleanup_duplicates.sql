-- Migration: 20241231_cleanup_duplicates.sql
-- Description: Remove duplicate constraints and add deprecation notices
-- Date: 2024-12-31

-- ============================================
-- STEP 1: Remove Duplicate Unique Constraint
-- ============================================
-- delivery_assignments has TWO identical unique constraints on order_id
-- Keep delivery_assignments_order_id_key, drop delivery_assignments_order_id_unique

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'delivery_assignments_order_id_unique'
    ) THEN
        ALTER TABLE public.delivery_assignments 
        DROP CONSTRAINT delivery_assignments_order_id_unique;
        RAISE NOTICE 'Dropped duplicate constraint: delivery_assignments_order_id_unique';
    ELSE
        RAISE NOTICE 'Constraint delivery_assignments_order_id_unique does not exist';
    END IF;
END;
$$;

-- ============================================
-- STEP 2: Remove Duplicate Indexes
-- ============================================
-- These indexes are duplicates of other indexes on the same columns

-- bids table duplicates
DROP INDEX IF EXISTS idx_bids_garage;           -- duplicate of idx_bids_garage_id
DROP INDEX IF EXISTS idx_bids_request_id;       -- covered by idx_bids_request_created

-- delivery_assignments duplicates
DROP INDEX IF EXISTS idx_assignments_driver;    -- duplicate of idx_delivery_assignments_driver_id
DROP INDEX IF EXISTS idx_assignments_order;     -- duplicate of idx_delivery_assignments_order_id
DROP INDEX IF EXISTS idx_assignments_status;    -- duplicate of idx_delivery_assignments_status

-- counter_offers duplicates  
DROP INDEX IF EXISTS idx_counter_offers_bid;    -- duplicate of idx_counter_offers_bid_id

-- disputes duplicates
DROP INDEX IF EXISTS idx_disputes_order;        -- duplicate of idx_disputes_order_id

-- orders duplicates
DROP INDEX IF EXISTS idx_orders_customer;       -- duplicate of idx_orders_customer_id
DROP INDEX IF EXISTS idx_orders_garage;         -- duplicate of idx_orders_garage_id

-- ============================================
-- STEP 3: Add Missing Index for Counter Offer Expiration Job
-- ============================================
CREATE INDEX IF NOT EXISTS idx_counter_offers_expires 
    ON public.counter_offers (expires_at) 
    WHERE status = 'pending';

-- ============================================
-- STEP 4: Add Soft Delete Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_not_deleted 
    ON public.users (user_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_not_deleted 
    ON public.orders (order_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_part_requests_not_deleted 
    ON public.part_requests (request_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bids_not_deleted 
    ON public.bids (bid_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_garages_not_deleted 
    ON public.garages (garage_id) 
    WHERE deleted_at IS NULL;

-- ============================================
-- STEP 5: Add Deprecation Comments
-- ============================================
COMMENT ON TABLE public.reviews IS 
    'DEPRECATED (2024-12-31): Use order_reviews instead. Scheduled for removal Q2 2025. DO NOT USE IN NEW CODE.';

COMMENT ON TABLE public.user_addresses IS 
    'DEPRECATED (2024-12-31): Use customer_addresses instead. Scheduled for removal Q2 2025. DO NOT USE IN NEW CODE.';

-- Record migration
INSERT INTO public.migrations (name) 
VALUES ('20241231_cleanup_duplicates')
ON CONFLICT (name) DO NOTHING;
