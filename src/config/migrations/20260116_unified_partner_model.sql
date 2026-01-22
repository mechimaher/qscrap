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
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_garages_quick_services ON garages 
WHERE provides_quick_services = true AND is_active = true;

-- Index for finding repair providers
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_garages_repairs ON garages 
WHERE provides_repairs = true AND is_active = true;

-- Spatial index for mobile service providers
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_garages_mobile_location ON garages 
USING GIST (location)
WHERE has_mobile_technicians = true AND is_active = true;

-- Composite index for service discovery with location
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_garages_services_location ON garages 
USING GIST (location)
WHERE is_active = true;

-- Full-text search index for service offerings
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_garages_service_search ON garages 
USING GIN (
    to_tsvector('english', 
        COALESCE(quick_services_offered::text, '') || ' ' ||
        COALESCE(repair_specializations::text, '')
    )
)
WHERE provides_quick_services = true OR provides_repairs = true;

-- ============================================
-- 4. CREATE TECHNICIANS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS IF NOT EXISTS technicians (
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
    current_location geography(POINT),
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
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_technicians_garage ON technicians(garage_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_technicians_available ON technicians 
WHERE is_available = true AND is_active = true;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_technicians_location ON technicians 
USING GIST (current_location)
WHERE is_available = true;

-- ============================================
-- 5. ENHANCE QUICK SERVICE REQUESTS
-- ============================================

-- Link to technician
ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS technician_id UUID REFERENCES technicians(technician_id);

-- Add workflow timestamps
ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS service_started_at TIMESTAMPTZ;
ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS service_ended_at TIMESTAMPTZ;

-- Payment details
ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20); -- 'cash', 'card', 'wallet'
ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS platform_commission DECIMAL(8,2);
ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS garage_earnings DECIMAL(8,2);

-- Service quality
ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS before_photos TEXT[];
ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS after_photos TEXT[];
ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS diagnostic_notes TEXT;
ALTER TABLE quick_service_requests ADD COLUMN IF NOT EXISTS additional_items JSONB; -- [{item, price, approved}]

-- ============================================
-- 6. CREATE VIEWS FOR ANALYTICS
-- ============================================

-- Partner performance by service type
CREATE OR REPLACE VIEW partner_service_performance AS
SELECT 
    g.garage_id,
    g.name as partner_name,
    g.sells_parts,
    g.provides_repairs,
    g.provides_quick_services,
    g.has_mobile_technicians,
    
    -- Parts metrics
    COUNT(DISTINCT r.request_id) as total_part_requests,
    COUNT(DISTINCT CASE WHEN o.status = 'completed' THEN o.order_id END) as completed_part_orders,
    
    -- Quick service metrics
    COUNT(DISTINCT qs.request_id) as total_quick_services,
    COUNT(DISTINCT CASE WHEN qs.status = 'completed' THEN qs.request_id END) as completed_quick_services,
    AVG(CASE WHEN qs.rating IS NOT NULL THEN qs.rating END) as avg_quick_service_rating,
    
    -- Combined
    g.rating as overall_rating,
    g.total_services_completed
FROM garages g
LEFT JOIN requests r ON g.garage_id = r.garage_id
LEFT JOIN orders o ON r.request_id = o.request_id
LEFT JOIN quick_service_requests qs ON g.garage_id = qs.assigned_garage_id
GROUP BY g.garage_id, g.name;

-- Quick service revenue analytics
CREATE OR REPLACE VIEW quick_service_revenue AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    service_type,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    SUM(final_price) as total_revenue,
    SUM(platform_commission) as platform_commission,
    SUM(garage_earnings) as garage_earnings,
    AVG(final_price) as avg_price,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_completion_minutes
FROM quick_service_requests
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', created_at), service_type
ORDER BY date DESC;

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
        g.name,
        ROUND(ST_Distance(
            g.location,
            ST_SetSRID(ST_Point(customer_lng, customer_lat), 4326)::geography
        ) / 1000, 2) as distance_km,
        g.rating,
        g.average_response_time_minutes,
        ARRAY[
            CASE WHEN g.sells_parts THEN 'parts' END,
            CASE WHEN g.provides_repairs THEN 'repairs' END,
            CASE WHEN g.provides_quick_services THEN 'quick_services' END,
            CASE WHEN g.has_mobile_technicians THEN 'mobile' END
        ]::TEXT[] as capabilities
    FROM garages g
    WHERE g.is_active = true
        AND ST_DWithin(
            g.location,
            ST_SetSRID(ST_Point(customer_lng, customer_lat), 4326)::geography,
            radius_km * 1000
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
