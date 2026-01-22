-- Migration: VIN Image Capture Support
-- Date: 2026-01-20
-- Purpose: Add vin_image_url column to store photos of registration card for VIN capture

-- Add VIN image column to customer_vehicles
ALTER TABLE customer_vehicles 
ADD COLUMN IF NOT EXISTS vin_image_url VARCHAR(500);

-- Add VIN image to part_requests (transmitted to garages)
ALTER TABLE part_requests 
ADD COLUMN IF NOT EXISTS vin_image_url VARCHAR(500);

-- Comments for documentation
COMMENT ON COLUMN customer_vehicles.vin_image_url IS 'Photo of registration card (Istimara) showing VIN number';
COMMENT ON COLUMN part_requests.vin_image_url IS 'VIN photo transmitted with request for garage reference';

-- Index for VIN lookups (only non-null VINs)
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_customer_vehicles_vin 
ON customer_vehicles(vin_number) 
WHERE vin_number IS NOT NULL AND vin_number != '';
