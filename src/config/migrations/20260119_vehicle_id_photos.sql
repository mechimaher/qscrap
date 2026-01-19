-- Migration: Add Vehicle Identification Photo Columns
-- Date: 2026-01-19
-- Purpose: Separate vehicle ID photos from part damage photos for Qatar scrap garages

ALTER TABLE part_requests 
ADD COLUMN IF NOT EXISTS car_front_image_url TEXT,
ADD COLUMN IF NOT EXISTS car_rear_image_url TEXT;

COMMENT ON COLUMN part_requests.car_front_image_url IS 'Front view of vehicle for identification (license plate, front bumper)';
COMMENT ON COLUMN part_requests.car_rear_image_url IS 'Rear view of vehicle for identification (model/trim verification)';
