-- Quick Services Database Schema
-- Supports battery change, wash, oil, tire, AC, breakdown services

-- 1. Quick service requests table
CREATE TABLE IF NOT EXISTS quick_service_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('battery', 'wash', 'oil', 'tire', 'ac', 'breakdown')),
    
    -- Location
    location_lat DECIMAL(10, 7),
    location_lng DECIMAL(10, 7),
    location_address TEXT,
    
    -- Vehicle info
    vehicle_make VARCHAR(50),
    vehicle_model VARCHAR(50),
    vehicle_year INTEGER,
    
    -- Request details
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
    priority_level INTEGER DEFAULT 2, -- 1=emergency, 2=normal
    
    -- Assignment
    assigned_garage_id UUID REFERENCES garages(garage_id),
    assigned_at TIMESTAMPTZ,
    
    -- Completion
    completed_at TIMESTAMPTZ,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    
    -- Pricing
    quoted_price DECIMAL(8,2),
    final_price DECIMAL(8,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quick_service_customer ON quick_service_requests(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quick_service_status ON quick_service_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quick_service_type ON quick_service_requests(service_type, status);
CREATE INDEX IF NOT EXISTS idx_quick_service_garage ON quick_service_requests(assigned_garage_id, status);

-- 3. Function to update status
CREATE OR REPLACE FUNCTION update_quick_service_status()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
    END IF;
    
    IF NEW.assigned_garage_id IS NOT NULL AND OLD.assigned_garage_id IS NULL THEN
        NEW.assigned_at = NOW();
        NEW.status = 'assigned';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quick_service_status_trigger
BEFORE UPDATE ON quick_service_requests
FOR EACH ROW
EXECUTE FUNCTION update_quick_service_status();

-- 4. View for quick service analytics
CREATE OR REPLACE VIEW quick_service_stats AS
SELECT 
    service_type,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    AVG(final_price) as avg_price,
    AVG(rating) FILTER (WHERE rating IS NOT NULL) as avg_rating,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_completion_minutes
FROM quick_service_requests
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY service_type;

COMMENT ON TABLE quick_service_requests IS 'Quick automotive services: battery, wash, oil, tire, AC, breakdown';
COMMENT ON VIEW quick_service_stats IS 'Analytics for quick service performance by type';
