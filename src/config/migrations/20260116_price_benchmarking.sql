-- ============================================
-- INSURANCE PRICE BENCHMARKING
-- Week 3-4: Historical Pricing & Fraud Detection
-- ============================================

-- 1. Part Price History Table
CREATE TABLE IF NOT EXISTS part_price_history (
    price_record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Part Information
    part_name VARCHAR(255) NOT NULL,
    part_category VARCHAR(100),
    part_number VARCHAR(100), -- OEM or aftermarket part number
    
    -- Vehicle Information
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_year INT,
    
    -- Pricing
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'QAR',
    
    -- Source of Price
    source VARCHAR(50) NOT NULL, -- quote, invoice, catalog, claim
    source_id UUID, -- Reference to claim_id, order_id, etc.
    garage_id UUID, -- Seller/provider
    
    -- Metadata
    recorded_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign Keys
    FOREIGN KEY (garage_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Indexes for fast price lookups
CREATE INDEX idx_part_price_lookup ON part_price_history(part_name, vehicle_make, vehicle_model);
CREATE INDEX idx_part_price_stats ON part_price_history(part_name, recorded_at);
CREATE INDEX idx_part_price_category ON part_price_history(part_category, recorded_at);
CREATE INDEX idx_part_price_vehicle ON part_price_history(vehicle_make, vehicle_model, vehicle_year);
CREATE INDEX idx_part_price_source ON part_price_history(source, source_id);

-- ============================================
-- 2. Price Statistics Materialized View
-- (For faster benchmark queries)
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS part_price_benchmarks AS
SELECT 
    part_name,
    vehicle_make,
    vehicle_model,
    COUNT(*) as sample_size,
    AVG(price) as avg_price,
    MIN(price) as min_price,
    MAX(price) as max_price,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) as median_price,
    STDDEV(price) as std_dev,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) as p25,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) as p75,
    MAX(recorded_at) as last_updated
FROM part_price_history
WHERE recorded_at > NOW() - INTERVAL '180 days' -- Last 6 months only
GROUP BY part_name, vehicle_make, vehicle_model
HAVING COUNT(*) >= 3; -- Need at least 3 data points

CREATE UNIQUE INDEX idx_benchmark_lookup ON part_price_benchmarks(part_name, vehicle_make, vehicle_model);

-- ============================================
-- 3. Function to Refresh Benchmarks
-- ============================================

CREATE OR REPLACE FUNCTION refresh_price_benchmarks()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY part_price_benchmarks;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Outlier Detection Function
-- ============================================

CREATE OR REPLACE FUNCTION detect_price_outlier(
    p_part_name VARCHAR,
    p_vehicle_make VARCHAR,
    p_vehicle_model VARCHAR,
    p_quoted_price DECIMAL
)
RETURNS TABLE(
    is_outlier BOOLEAN,
    deviation_percent DECIMAL,
    avg_market_price DECIMAL,
    outlier_severity VARCHAR
) AS $$
DECLARE
    v_avg_price DECIMAL;
    v_std_dev DECIMAL;
    v_deviation DECIMAL;
    v_deviation_pct DECIMAL;
BEGIN
    -- Get benchmark statistics
    SELECT avg_price, std_dev INTO v_avg_price, v_std_dev
    FROM part_price_benchmarks
    WHERE 
        part_name = p_part_name
        AND vehicle_make = p_vehicle_make
        AND vehicle_model = p_vehicle_model;
    
    -- If no benchmark data, return not outlier
    IF v_avg_price IS NULL THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, 'no_data'::VARCHAR;
        RETURN;
    END IF;
    
    -- Calculate deviation
    v_deviation := p_quoted_price - v_avg_price;
    v_deviation_pct := (v_deviation / v_avg_price) * 100;
    
    -- Determine outlier status and severity
    IF v_deviation_pct > 50 THEN
        RETURN QUERY SELECT TRUE, v_deviation_pct, v_avg_price, 'critical'::VARCHAR;
    ELSIF v_deviation_pct > 30 THEN
        RETURN QUERY SELECT TRUE, v_deviation_pct, v_avg_price, 'high'::VARCHAR;
    ELSIF v_deviation_pct > 15 THEN
        RETURN QUERY SELECT TRUE, v_deviation_pct, v_avg_price, 'medium'::VARCHAR;
    ELSIF v_deviation_pct > 10 THEN
        RETURN QUERY SELECT TRUE, v_deviation_pct, v_avg_price, 'low'::VARCHAR;
    ELSE
        RETURN QUERY SELECT FALSE, v_deviation_pct, v_avg_price, 'normal'::VARCHAR;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Auto-populate from existing claims
-- ============================================

INSERT INTO part_price_history (
    part_name, vehicle_make, vehicle_model, vehicle_year,
    price, source, source_id, garage_id, recorded_at
)
SELECT 
    ic.part_name,
    ic.vehicle_make,
    ic.vehicle_model,
    ic.vehicle_year,
    COALESCE(ic.scrapyard_estimate, ic.agency_estimate, 0) as price,
    'claim' as source,
    ic.claim_id as source_id,
    u.user_id as garage_id,
    ic.created_at as recorded_at
FROM insurance_claims ic
LEFT JOIN part_requests pr ON ic.part_request_id = pr.request_id
LEFT JOIN users u ON pr.user_id = u.user_id
WHERE ic.part_name IS NOT NULL
  AND (ic.scrapyard_estimate > 0 OR ic.agency_estimate > 0)
ON CONFLICT DO NOTHING;

-- Refresh benchmarks with initial data
SELECT refresh_price_benchmarks();

-- ============================================
-- 6. Trigger to auto-add prices from new claims
-- ============================================

CREATE OR REPLACE FUNCTION auto_record_claim_price()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.part_name IS NOT NULL AND NEW.scrapyard_estimate > 0 THEN
        INSERT INTO part_price_history (
            part_name, vehicle_make, vehicle_model, vehicle_year,
            price, source, source_id, recorded_at
        ) VALUES (
            NEW.part_name, NEW.vehicle_make, NEW.vehicle_model, NEW.vehicle_year,
            NEW.scrapyard_estimate, 'claim', NEW.claim_id, NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claim_price_recording
AFTER INSERT OR UPDATE ON insurance_claims
FOR EACH ROW
EXECUTE FUNCTION auto_record_claim_price();

-- ============================================
-- GRANTS
-- ============================================

GRANT SELECT, INSERT ON part_price_history TO qscrap_app;
GRANT SELECT ON part_price_benchmarks TO qscrap_app;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
