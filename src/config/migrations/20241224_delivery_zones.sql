-- ============================================
-- Delivery Zones Migration
-- Zone-based pricing from Industrial Area hub
-- ============================================

-- 1. Create delivery_zones table
CREATE TABLE IF NOT EXISTS delivery_zones (
    zone_id SERIAL PRIMARY KEY,
    zone_name VARCHAR(50) NOT NULL,
    min_distance_km DECIMAL(6,2) NOT NULL,  -- Minimum distance from hub
    max_distance_km DECIMAL(6,2) NOT NULL,  -- Maximum distance from hub
    delivery_fee DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Insert Qatar zones (distance from Industrial Area hub)
INSERT INTO delivery_zones (zone_name, min_distance_km, max_distance_km, delivery_fee) VALUES
    ('Zone 1 - Local', 0, 5, 10.00),
    ('Zone 2 - Nearby', 5, 10, 15.00),
    ('Zone 3 - Metro', 10, 20, 25.00),
    ('Zone 4 - Extended', 20, 35, 35.00),
    ('Zone 5 - Remote', 35, 999, 50.00)
ON CONFLICT DO NOTHING;

-- 3. Create zone fee history for audit
CREATE TABLE IF NOT EXISTS delivery_zone_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id INT REFERENCES delivery_zones(zone_id),
    old_fee DECIMAL(10,2),
    new_fee DECIMAL(10,2),
    changed_by UUID,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Add delivery_zone_id to orders (for analytics)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_zone_id INT REFERENCES delivery_zones(zone_id);

-- 5. Create hub_locations table for future multi-hub support
CREATE TABLE IF NOT EXISTS hub_locations (
    hub_id SERIAL PRIMARY KEY,
    hub_name VARCHAR(100) NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Insert Industrial Area as primary hub
INSERT INTO hub_locations (hub_name, latitude, longitude, is_primary, is_active) VALUES
    ('Industrial Area Hub', 25.2348, 51.4839, true, true)
ON CONFLICT DO NOTHING;

-- 7. Create index for fast zone lookups
CREATE INDEX IF NOT EXISTS idx_delivery_zones_distance ON delivery_zones(min_distance_km, max_distance_km);
CREATE INDEX IF NOT EXISTS idx_orders_zone ON orders(delivery_zone_id);

-- 8. Grant permissions
GRANT SELECT ON delivery_zones TO PUBLIC;
GRANT SELECT ON hub_locations TO PUBLIC;
