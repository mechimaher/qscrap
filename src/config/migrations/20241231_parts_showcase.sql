-- ============================================
-- QScrap Migration: Enterprise Parts Showcase
-- Enterprise-tier garages can showcase parts
-- ============================================

-- Main parts showcase table
CREATE TABLE IF NOT EXISTS garage_parts (
    part_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID NOT NULL REFERENCES garages(garage_id) ON DELETE CASCADE,
    
    -- Part Details
    title VARCHAR(200) NOT NULL,
    part_description TEXT,
    part_number VARCHAR(100),
    
    -- Vehicle Compatibility
    car_make VARCHAR(100) NOT NULL,
    car_model VARCHAR(100),
    car_year_from INT,
    car_year_to INT,
    
    -- Condition & Pricing
    part_condition VARCHAR(20) NOT NULL CHECK (part_condition IN ('new', 'used', 'refurbished')),
    price DECIMAL(10,2) NOT NULL,
    price_type VARCHAR(20) DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'negotiable')),
    warranty_days INT DEFAULT 0,
    
    -- Media (same pattern as bids.image_urls)
    image_urls TEXT[] DEFAULT '{}',
    
    -- Inventory
    quantity INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'hidden')),
    
    -- Metrics
    view_count INT DEFAULT 0,
    order_count INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_garage_parts_garage ON garage_parts(garage_id);
CREATE INDEX IF NOT EXISTS idx_garage_parts_active ON garage_parts(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_garage_parts_make ON garage_parts(car_make);
CREATE INDEX IF NOT EXISTS idx_garage_parts_created ON garage_parts(created_at DESC);

-- Add showcase feature flag to subscription_plans if not present
-- Enterprise plan should have {"featured": true, "showcase": true} in features
UPDATE subscription_plans 
SET features = features || '{"showcase": true}'::jsonb
WHERE plan_code = 'enterprise' 
  AND NOT (features ? 'showcase');

SELECT 'Parts Showcase migration completed!' as status;
