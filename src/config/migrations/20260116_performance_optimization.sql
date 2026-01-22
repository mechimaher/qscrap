-- Database Performance Optimization
-- Purpose: Add critical indexes to improve query performance

-- ==================== Orders Table Optimization ====================

-- Composite index for customer order history (most common query)
CREATE INDEX  IF NOT EXISTS idx_orders_customer_created 
ON orders(customer_id, created_at DESC);

-- Composite index for garage order management
CREATE INDEX  IF NOT EXISTS idx_orders_garage_status 
ON orders(garage_id, order_status, created_at DESC);

-- Index for active order queries (used in operations dashboard)
CREATE INDEX  IF NOT EXISTS idx_orders_active_status 
ON orders(order_status, created_at DESC) 
WHERE order_status IN ('confirmed', 'preparing', 'ready_for_pickup', 'in_transit', 'out_for_delivery');

-- Index for completed orders analytics
CREATE INDEX  IF NOT EXISTS idx_orders_completed_date 
ON orders(garage_id, completed_at DESC) 
WHERE order_status = 'completed';

-- ==================== Bids Table Optimization ====================

-- Composite index for request bid listings (critical for bid browsing)
CREATE INDEX  IF NOT EXISTS idx_bids_request_created 
ON bids(request_id, created_at DESC);

-- Index for garage bid history
CREATE INDEX  IF NOT EXISTS idx_bids_garage_status 
ON bids(garage_id, status, created_at DESC);

-- Index for pending bids (high-traffic query)
CREATE INDEX  IF NOT EXISTS idx_bids_pending_created 
ON bids(created_at DESC) 
WHERE status = 'pending';

-- ==================== Part Requests Table Optimization ====================

-- Index for active requests browsing (most critical query)
CREATE INDEX  IF NOT EXISTS idx_part_requests_active 
ON part_requests(status, created_at DESC) 
WHERE status = 'active';

-- Index for customer request history
CREATE INDEX  IF NOT EXISTS idx_part_requests_customer 
ON part_requests(customer_id, created_at DESC);

-- Composite index for category filtering
CREATE INDEX  IF NOT EXISTS idx_part_requests_category_status 
ON part_requests(part_category, status, created_at DESC);

-- Index for car make/model searches
CREATE INDEX  IF NOT EXISTS idx_part_requests_car_make 
ON part_requests(car_make, car_model, status);

-- ==================== Garage Table Optimization ====================

-- Index for approved garage searches
CREATE INDEX  IF NOT EXISTS idx_garages_approved 
ON garages(approval_status, rating_average DESC) 
WHERE approval_status = 'approved';

-- Index for specialized brand filtering
CREATE INDEX  IF NOT EXISTS idx_garages_specialized_brands 
ON garages USING GIN(specialized_brands);

-- ==================== User Sessions & Authentication ====================

-- Index for session lookups (if using database sessions)
CREATE INDEX  IF NOT EXISTS idx_users_email_active 
ON users(email, account_status) 
WHERE account_status = 'active';

-- ==================== Analytics & Reporting ====================

-- Index for revenue calculations
CREATE INDEX  IF NOT EXISTS idx_orders_revenue_date 
ON orders(created_at, total_amount) 
WHERE order_status = 'completed';

-- Index for garage performance tracking
CREATE INDEX  IF NOT EXISTS idx_orders_garage_performance 
ON orders(garage_id, order_status, completed_at);

-- ==================== Optimize Existing Indexes ====================

-- Analyze tables to update statistics
ANALYZE orders;
ANALYZE bids;
ANALYZE part_requests;
ANALYZE garages;
ANALYZE users;

-- ==================== Connection Pool Optimization ====================

-- Update PostgreSQL configuration for better performance
-- These are recommendations to add to postgresql.conf

-- Increase shared buffers (25% of RAM for dedicated DB server)
-- shared_buffers = 2GB

-- Increase work_mem for complex queries
-- work_mem = 16MB

-- Increase effective_cache_size (50-75% of RAM)
-- effective_cache_size = 6GB

-- Enable parallel query execution
-- max_parallel_workers_per_gather = 4
-- max_parallel_workers = 8

-- Optimize checkpoint behavior
-- checkpoint_completion_target = 0.9

-- ==================== Query Performance Monitoring ====================

-- Create extension for query statistics (if not exists)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View to monitor slow queries
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time,
    stddev_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100 -- Queries averaging > 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;

COMMENT ON VIEW slow_queries IS 'Monitor queries with average execution time > 100ms';

-- ==================== Index Usage Statistics ====================

-- View to check index usage
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

COMMENT ON VIEW index_usage_stats IS 'Monitor index usage to identify unused indexes';

-- ==================== Table Bloat Detection ====================

-- View to monitor table bloat
CREATE OR REPLACE VIEW table_bloat_check AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    ROUND(100 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_tuple_percent
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;

COMMENT ON VIEW table_bloat_check IS 'Monitor table bloat and vacuum effectiveness';
