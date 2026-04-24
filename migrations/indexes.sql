-- SQL Indexes for QScrap Performance Optimization

-- Functional index for brand filtering (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_part_requests_car_make_upper ON part_requests (UPPER(car_make));

-- Composite index for bid status and creation date
CREATE INDEX IF NOT EXISTS idx_bids_request_status_created ON bids (request_id, status, created_at DESC);
