-- Garage Analytics Module
-- Purpose: Provide comprehensive analytics for garage performance tracking

-- 1. Create materialized view for daily garage analytics
CREATE MATERIALIZED VIEW garage_daily_analytics AS
SELECT 
    o.garage_id,
    DATE_TRUNC('day', o.created_at) as date,
    COUNT(DISTINCT o.order_id) as orders_count,
    SUM(o.total_amount) as revenue,
    AVG(o.platform_fee) as avg_platform_fee,
    COUNT(DISTINCT o.customer_id) as unique_customers,
    AVG(
        EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 3600
    ) as avg_fulfillment_hours,
    COUNT(CASE WHEN o.order_status = 'completed' THEN 1 END) as completed_orders,
    COUNT(CASE WHEN o.order_status = 'cancelled' THEN 1 END) as cancelled_orders,
    AVG(CASE WHEN o.order_status = 'completed' THEN o.rating END) as avg_rating
FROM orders o
WHERE o.created_at >= CURRENT_DATE - INTERVAL '365 days'
GROUP BY o.garage_id, DATE_TRUNC('day', o.created_at);

-- Create indexes for performance
CREATE INDEX idx_garage_daily_analytics_garage_date 
ON garage_daily_analytics(garage_id, date DESC);

CREATE INDEX idx_garage_daily_analytics_date 
ON garage_daily_analytics(date DESC);

-- 2. Create materialized view for popular parts by garage
CREATE MATERIALIZED VIEW garage_popular_parts AS
SELECT 
    o.garage_id,
    pr.part_description as part_name,
    pr.car_make,
    pr.car_model,
    COALESCE(pr.part_category, 'Other') as category,
    COUNT(*) as order_count,
    SUM(o.total_amount) as total_revenue,
    AVG(o.total_amount) as avg_price,
    MAX(o.created_at) as last_ordered
FROM orders o
JOIN part_requests pr ON o.request_id = pr.request_id
WHERE o.created_at >= CURRENT_DATE - INTERVAL '90 days'
  AND o.order_status IN ('completed', 'delivered')
GROUP BY o.garage_id, pr.part_description, pr.car_make, pr.car_model, pr.part_category
HAVING COUNT(*) >= 2;

CREATE INDEX idx_garage_popular_parts_garage 
ON garage_popular_parts(garage_id, order_count DESC);

-- 3. Create materialized view for bid performance metrics
CREATE MATERIALIZED VIEW garage_bid_analytics AS
SELECT 
    b.garage_id,
    DATE_TRUNC('month', b.created_at) as month,
    COUNT(*) as total_bids,
    COUNT(CASE WHEN b.bid_status = 'accepted' THEN 1 END) as won_bids,
    COUNT(CASE WHEN b.bid_status = 'rejected' THEN 1 END) as lost_bids,
    ROUND(
        COUNT(CASE WHEN b.bid_status = 'accepted' THEN 1 END)::NUMERIC / 
        NULLIF(COUNT(*), 0) * 100, 
        2
    ) as win_rate_percentage,
    AVG(b.bid_amount) as avg_bid_amount,
    AVG(
        EXTRACT(EPOCH FROM (b.updated_at - b.created_at)) / 60
    ) as avg_response_time_minutes
FROM bids b
WHERE b.created_at >= CURRENT_DATE - INTERVAL '365 days'
GROUP BY b.garage_id, DATE_TRUNC('month', b.created_at);

CREATE INDEX idx_garage_bid_analytics_garage_month 
ON garage_bid_analytics(garage_id, month DESC);

-- 4. Create function to refresh analytics views
CREATE OR REPLACE FUNCTION refresh_garage_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY garage_daily_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY garage_popular_parts;
    REFRESH MATERIALIZED VIEW CONCURRENTLY garage_bid_analytics;
END;
$$ LANGUAGE plpgsql;

-- 5. Create scheduled refresh (runs daily at 2 AM)
-- Note: Requires pg_cron extension
-- SELECT cron.schedule('refresh-garage-analytics', '0 2 * * *', 'SELECT refresh_garage_analytics()');

-- 6. Create analytics summary table for quick overview
CREATE TABLE IF NOT EXISTS garage_analytics_summary (
    summary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID REFERENCES garages(garage_id) ON DELETE CASCADE,
    period VARCHAR(20) NOT NULL, -- 'today', 'week', 'month', 'year'
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    total_bids INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0,
    avg_rating DECIMAL(3,2) DEFAULT 0,
    unique_customers INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(garage_id, period)
);

CREATE INDEX idx_garage_analytics_summary_garage 
ON garage_analytics_summary(garage_id);

-- 7. Create function to calculate garage summary
CREATE OR REPLACE FUNCTION calculate_garage_summary(
    p_garage_id UUID,
    p_period VARCHAR(20)
)
RETURNS TABLE (
    total_orders INTEGER,
    total_revenue DECIMAL,
    total_bids INTEGER,
    win_rate DECIMAL,
    avg_rating DECIMAL,
    unique_customers INTEGER
) AS $$
DECLARE
    start_date TIMESTAMPTZ;
BEGIN
    -- Determine date range
    CASE p_period
        WHEN 'today' THEN start_date := CURRENT_DATE;
        WHEN 'week' THEN start_date := CURRENT_DATE - INTERVAL '7 days';
        WHEN 'month' THEN start_date := CURRENT_DATE - INTERVAL '30 days';
        WHEN 'year' THEN start_date := CURRENT_DATE - INTERVAL '365 days';
        ELSE start_date := CURRENT_DATE - INTERVAL '30 days';
    END CASE;

    RETURN QUERY
    SELECT 
        COUNT(DISTINCT o.order_id)::INTEGER as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        (SELECT COUNT(*)::INTEGER FROM bids WHERE garage_id = p_garage_id AND created_at >= start_date) as total_bids,
        COALESCE(
            (SELECT win_rate_percentage 
             FROM garage_bid_analytics 
             WHERE garage_id = p_garage_id 
             ORDER BY month DESC LIMIT 1),
            0
        ) as win_rate,
        COALESCE(AVG(o.customer_rating), 0) as avg_rating,
        COUNT(DISTINCT o.customer_id)::INTEGER as unique_customers
    FROM orders o
    WHERE o.garage_id = p_garage_id 
      AND o.created_at >= start_date
      AND o.status IN ('completed', 'delivered');
END;
$$ LANGUAGE plpgsql;

COMMENT ON MATERIALIZED VIEW garage_daily_analytics IS 'Daily aggregated analytics for garage performance tracking';
COMMENT ON MATERIALIZED VIEW garage_popular_parts IS 'Most frequently ordered parts by garage for inventory insights';
COMMENT ON MATERIALIZED VIEW garage_bid_analytics IS 'Monthly bid performance metrics including win rates';
COMMENT ON FUNCTION calculate_garage_summary IS 'Calculate real-time summary statistics for a garage';
