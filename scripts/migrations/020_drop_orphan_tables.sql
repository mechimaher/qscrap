-- Migration: Drop orphan/unused tables
-- These tables are not referenced in any code and have no data
-- Analysis done on 2026-01-23

-- 1. workshop_availability - Workshop scheduling feature never built
DROP TABLE IF EXISTS workshop_availability CASCADE;

-- 2. service_bids - Duplicate of bids system
DROP TABLE IF EXISTS service_bids CASCADE;

-- 3. service_requests - Duplicate of part_requests
DROP TABLE IF EXISTS service_requests CASCADE;

-- 4. garage_analytics_summary - Never implemented, empty
DROP TABLE IF EXISTS garage_analytics_summary CASCADE;

-- 5. insurance_claims - Insurance feature not built
DROP TABLE IF EXISTS insurance_claims CASCADE;

-- 6. insurance_companies - Insurance feature not built
DROP TABLE IF EXISTS insurance_companies CASCADE;

-- 7. inspection_criteria - QC criteria not used
DROP TABLE IF EXISTS inspection_criteria CASCADE;

-- 8. operations_staff - Replaced by staff_profiles table
DROP TABLE IF EXISTS operations_staff CASCADE;
