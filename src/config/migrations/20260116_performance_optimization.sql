-- Database Performance Optimization (Simplified)
-- Purpose: Add critical indexes to improve query performance

-- ==================== Orders Table Optimization ====================

-- Composite index for customer order history
CREATE INDEX IF NOT EXISTS idx_orders_customer_created 
ON orders(customer_id, created_at DESC);

-- Composite index for garage order management
CREATE INDEX IF NOT EXISTS idx_orders_garage_status 
ON orders(garage_id, order_status, created_at DESC);

-- ==================== Bids Table Optimization ====================

-- Composite index for request bid listings
CREATE INDEX IF NOT EXISTS idx_bids_request_created 
ON bids(request_id, created_at DESC);

-- Index for garage bid history
CREATE INDEX IF NOT EXISTS idx_bids_garage_status 
ON bids(garage_id, status, created_at DESC);

-- ==================== Part Requests Table Optimization ====================

-- Index for active requests browsing
CREATE INDEX IF NOT EXISTS idx_part_requests_active 
ON part_requests(status, created_at DESC) 
WHERE status = 'active';

-- Index for customer request history
CREATE INDEX IF NOT EXISTS idx_part_requests_customer 
ON part_requests(customer_id, created_at DESC);

-- ==================== Garage Table Optimization ====================

-- Index for approved garage searches
CREATE INDEX IF NOT EXISTS idx_garages_approved 
ON garages(approval_status) 
WHERE approval_status = 'approved';

-- ==================== Analyze Tables ====================

ANALYZE orders;
ANALYZE bids;
ANALYZE part_requests;
ANALYZE garages;
ANALYZE users;

-- Enable query statistics extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
