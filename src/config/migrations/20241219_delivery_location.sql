-- ============================================================================
-- MIGRATION: Add delivery location coordinates to part_requests
-- Date: 2024-12-19
-- Purpose: Enable Uber-like location picker for customer requests
-- ============================================================================

-- Add lat/lng columns to part_requests for customer delivery location
ALTER TABLE part_requests 
ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC(10,8),
ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC(11,8);

-- Add index for location-based queries (future feature: nearby garages)
CREATE INDEX IF NOT EXISTS idx_requests_location 
ON part_requests(delivery_lat, delivery_lng) 
WHERE delivery_lat IS NOT NULL AND delivery_lng IS NOT NULL;

-- Also ensure delivery_assignments has pickup location from garage
-- (These may already exist from previous migrations)
ALTER TABLE delivery_assignments 
ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC(10,8),
ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC(11,8),
ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC(10,8),
ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC(11,8);

COMMENT ON COLUMN part_requests.delivery_lat IS 'Customer selected delivery latitude';
COMMENT ON COLUMN part_requests.delivery_lng IS 'Customer selected delivery longitude';
