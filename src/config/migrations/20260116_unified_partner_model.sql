-- Unified Partner Model Migration
-- Enables garages to offer multiple service types: parts, repairs, quick services
-- Date: January 16, 2026

-- ============================================
-- 1. ADD CAPABILITY FLAGS
-- ============================================

-- Add service capability flags to garages table
ALTER TABLE garages ADD COLUMN IF NOT EXISTS sells_parts BOOLEAN DEFAULT true;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS provides_repairs BOOLEAN DEFAULT false;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS provides_quick_services BOOLEAN DEFAULT false;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS has_mobile_technicians BOOLEAN DEFAULT false;

-- Service-specific details
ALTER TABLE garages ADD COLUMN IF NOT EXISTS quick_services_offered TEXT[] DEFAULT '{}';
ALTER TABLE garages ADD COLUMN IF NOT EXISTS repair_specializations TEXT[] DEFAULT '{}';
ALTER TABLE garages ADD COLUMN IF NOT EXISTS mobile_service_radius_km INTEGER DEFAULT 10;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS max_concurrent_services INTEGER DEFAULT 3;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS average_response_time_minutes INTEGER;

-- Business metrics
ALTER TABLE garages ADD COLUMN IF NOT EXISTS total_services_completed INTEGER DEFAULT 0;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS quick_service_rating DECIMAL(2,1);
ALTER TABLE garages ADD COLUMN IF NOT EXISTS repair_rating DECIMAL(2,1);

-- ============================================
-- 2. MIGRATE EXISTING DATA
-- ============================================

-- All existing garages currently sell parts (core functionality)
UPDATE garages 
SET sells_parts = true 
WHERE sells_parts IS NULL;

-- Set default empty arrays for new columns
UPDATE garages 
SET quick_services_offered = '{}' 
WHERE quick_services_offered IS NULL;

UPDATE garages 
SET repair_specializations = '{}' 
WHERE repair_specializations IS NULL;

-- ============================================
-- 3. CREATE INDEXES FOR SERVICE DISCOVERY
-- ============================================

-- Index for finding quick service providers
CREATE INDEX IF NOT EXISTS idx_garages_quick_services
    ON garages(garage_id)
    WHERE provides_quick_services = true;

-- Index for finding repair providers
CREATE INDEX IF NOT EXISTS idx_garages_repairs
    ON garages(garage_id)
    WHERE provides_repairs = true;

-- Spatial index for mobile service providers
CREATE INDEX IF NOT EXISTS idx_garages_mobile_location
    ON garages(location_lat, location_lng)
    WHERE has_mobile_technicians = true;

-- Composite index for service discovery with location
CREATE INDEX IF NOT EXISTS idx_garages_services_location
    ON garages(location_lat, location_lng);

-- Full-text search index for service offerings
CREATE INDEX IF NOT EXISTS idx_garages_quick_services_array
    ON garages USING GIN (quick_services_offered);
CREATE INDEX IF NOT EXISTS idx_garages_repair_specializations_array
    ON garages USING GIN (repair_specializations);

-- ============================================
-- 4. CREATE TECHNICIANS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS technicians (
    technician_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID REFERENCES garages(garage_id) ON DELETE CASCADE,
    
    -- Personal info
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    photo_url TEXT,
    
    -- Professional
    specializations TEXT[] DEFAULT '{}', -- ['battery', 'oil', 'electrical', 'brake']
    experience_years INTEGER,
    certification_urls TEXT[],
    
    -- Operational
    is_available BOOLEAN DEFAULT true,
    current_lat DECIMAL(10,8),
    current_lng DECIMAL(11,8),
    current_assignment_id UUID,
    
    -- Performance
    total_services_completed INTEGER DEFAULT 0,
    rating DECIMAL(2,1),
    average_service_time_minutes INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for technician management
CREATE INDEX IF NOT EXISTS idx_technicians_garage ON technicians(garage_id);
CREATE INDEX IF NOT EXISTS idx_technicians_available
    ON technicians(technician_id)
    WHERE is_available = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_technicians_location
    ON technicians(current_lat, current_lng)
    WHERE is_available = true;

-- ============================================
-- 5. ENHANCE QUICK SERVICE REQUESTS
-- ============================================

-- Link to technician
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'quick_service_requests'
    ) THEN
        EXECUTE 'ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS technician_id UUID REFERENCES technicians(technician_id)';

        -- Add workflow timestamps
        EXECUTE 'ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ';
        EXECUTE 'ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS service_started_at TIMESTAMPTZ';
        EXECUTE 'ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS service_ended_at TIMESTAMPTZ';

        -- Payment details
        EXECUTE 'ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20)';
        EXECUTE 'ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT ''pending''';
        EXECUTE 'ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS platform_commission DECIMAL(8,2)';
        EXECUTE 'ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS garage_earnings DECIMAL(8,2)';

        -- Service quality
        EXECUTE 'ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS before_photos TEXT[]';
        EXECUTE 'ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS after_photos TEXT[]';
        EXECUTE 'ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS diagnostic_notes TEXT';
        EXECUTE 'ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS additional_items JSONB';
    END IF;
END $$;

-- ============================================
-- 6. CREATE VIEWS FOR ANALYTICS
-- ============================================

-- Partner performance by service type
CREATE OR REPLACE VIEW partner_service_performance AS
SELECT 
    g.garage_id,
    g.garage_name as partner_name,
    g.sells_parts,
    g.provides_repairs,
    g.provides_quick_services,
    g.has_mobile_technicians,
    
    -- Parts metrics
    COUNT(DISTINCT b.request_id) as total_part_requests,
    COUNT(DISTINCT CASE WHEN o.order_status = 'completed' THEN o.order_id END) as completed_part_orders,
    
    -- Quick service metrics (table may not exist in this schema version)
    0::BIGINT as total_quick_services,
    0::BIGINT as completed_quick_services,
    NULL::DECIMAL as avg_quick_service_rating,
    
    -- Combined
    g.rating_average as overall_rating,
    g.total_services_completed
FROM garages g
LEFT JOIN bids b ON g.garage_id = b.garage_id
LEFT JOIN orders o ON b.bid_id = o.bid_id
GROUP BY g.garage_id, g.garage_name, g.rating_average, g.total_services_completed;

-- Quick service revenue analytics
CREATE OR REPLACE VIEW quick_service_revenue AS
SELECT 
    NULL::TIMESTAMPTZ as date,
    NULL::TEXT as service_type,
    0::BIGINT as total_requests,
    0::BIGINT as completed,
    0::NUMERIC as total_revenue,
    0::NUMERIC as platform_commission,
    0::NUMERIC as garage_earnings,
    NULL::NUMERIC as avg_price,
    NULL::NUMERIC as avg_completion_minutes
WHERE false;

-- ============================================
-- 7. CREATE FUNCTIONS
-- ============================================

-- Function to find nearby service providers
CREATE OR REPLACE FUNCTION find_service_providers(
    request_type TEXT,
    customer_lat DECIMAL,
    customer_lng DECIMAL,
    radius_km INTEGER DEFAULT 15,
    limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    garage_id UUID,
    name VARCHAR(255),
    distance_km DECIMAL,
    rating DECIMAL,
    response_time INTEGER,
    capabilities TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.garage_id,
        g.garage_name::VARCHAR(255),
        ROUND((
            SQRT(
                POWER(COALESCE(g.location_lat, customer_lat) - customer_lat, 2) +
                POWER(COALESCE(g.location_lng, customer_lng) - customer_lng, 2)
            ) * 111
        )::numeric, 2) as distance_km,
        g.rating_average::DECIMAL,
        g.average_response_time_minutes,
        ARRAY_REMOVE(ARRAY[
            CASE WHEN g.sells_parts THEN 'parts' END,
            CASE WHEN g.provides_repairs THEN 'repairs' END,
            CASE WHEN g.provides_quick_services THEN 'quick_services' END,
            CASE WHEN g.has_mobile_technicians THEN 'mobile' END
        ]::TEXT[], NULL) as capabilities
    FROM garages g
    WHERE g.deleted_at IS NULL
        AND (
            COALESCE(g.location_lat, customer_lat) BETWEEN customer_lat - (radius_km::DECIMAL / 111) AND customer_lat + (radius_km::DECIMAL / 111)
        )
        AND (
            COALESCE(g.location_lng, customer_lng) BETWEEN customer_lng - (radius_km::DECIMAL / 111) AND customer_lng + (radius_km::DECIMAL / 111)
        )
        AND CASE request_type
            WHEN 'parts' THEN g.sells_parts
            WHEN 'repairs' THEN g.provides_repairs
            WHEN 'quick_service' THEN g.provides_quick_services AND g.has_mobile_technicians
            ELSE true
        END
    ORDER BY 
        g.rating DESC,
        distance_km ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update garage capabilities
CREATE OR REPLACE FUNCTION update_garage_capabilities()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Auto-enable mobile technicians if quick services enabled and techs exist
    IF NEW.provides_quick_services = true THEN
        SELECT EXISTS(
            SELECT 1 FROM technicians 
            WHERE garage_id = NEW.garage_id AND is_active = true
        ) INTO NEW.has_mobile_technicians;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER garage_capabilities_trigger
BEFORE UPDATE ON garages
FOR EACH ROW
EXECUTE FUNCTION update_garage_capabilities();

-- ============================================
-- 8. SAMPLE DATA (For testing)
-- ============================================

-- Enable quick services for a test garage
-- UPDATE garages 
-- SET 
--     provides_quick_services = true,
--     quick_services_offered = ARRAY['battery', 'oil', 'wash', 'tire'],
--     mobile_service_radius_km = 15,
--     max_concurrent_services = 5
-- WHERE garage_id = 'test-garage-id';

COMMENT ON COLUMN garages.sells_parts IS 'Can list and sell spare parts';
COMMENT ON COLUMN garages.provides_repairs IS 'Offers workshop repair services';
COMMENT ON COLUMN garages.provides_quick_services IS 'Provides quick on-site services (battery, oil, etc)';
COMMENT ON COLUMN garages.has_mobile_technicians IS 'Has mobile technicians for on-site service';
COMMENT ON TABLE technicians IS 'Mobile technicians for quick services';
COMMENT ON FUNCTION find_service_providers IS 'Find nearby garages by service type and location';
