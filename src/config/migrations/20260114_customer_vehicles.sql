-- Migration: Customer Vehicles (My Fleet)
-- Allows customers to save their vehicles for quick selection on repeat orders
-- Date: 2026-01-14

-- Create customer_vehicles table
CREATE TABLE IF NOT EXISTS customer_vehicles (
    vehicle_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Vehicle Info
    car_make VARCHAR(100) NOT NULL,
    car_model VARCHAR(100) NOT NULL,
    car_year INTEGER NOT NULL CHECK (car_year >= 1970 AND car_year <= 2030),
    vin_number VARCHAR(17),
    
    -- Vehicle Photos (optional)
    front_image_url VARCHAR(500),
    rear_image_url VARCHAR(500),
    
    -- User-friendly metadata
    nickname VARCHAR(50),  -- e.g. "Dad's Patrol", "Mom's X5"
    is_primary BOOLEAN DEFAULT false,
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    request_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_customer ON customer_vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_last_used ON customer_vehicles(customer_id, last_used_at DESC);

-- Unique constraint: one vehicle per VIN per customer (only if VIN is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_vehicles_vin_unique 
ON customer_vehicles(customer_id, vin_number) 
WHERE vin_number IS NOT NULL AND vin_number != '';

-- Add vehicle photo columns to part_requests table
ALTER TABLE part_requests 
ADD COLUMN IF NOT EXISTS car_front_image_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS car_rear_image_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS saved_vehicle_id UUID REFERENCES customer_vehicles(vehicle_id);

-- Trigger to update last_used_at when vehicle is used
CREATE OR REPLACE FUNCTION update_vehicle_last_used()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.saved_vehicle_id IS NOT NULL THEN
        UPDATE customer_vehicles 
        SET last_used_at = NOW(), 
            request_count = request_count + 1,
            updated_at = NOW()
        WHERE vehicle_id = NEW.saved_vehicle_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS trg_update_vehicle_last_used ON part_requests;
CREATE TRIGGER trg_update_vehicle_last_used
    AFTER INSERT ON part_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_last_used();

-- Comment for documentation
COMMENT ON TABLE customer_vehicles IS 'Stores customer saved vehicles for quick selection on repeat orders (My Fleet feature)';
COMMENT ON COLUMN customer_vehicles.nickname IS 'User-friendly name like "Dad''s Patrol" or "Family SUV"';
COMMENT ON COLUMN customer_vehicles.is_primary IS 'Primary/default vehicle for this customer';
