-- Platform Cleanup Migration
-- Date: 2026-01-22
-- Purpose: Remove Insurance and remaining Quick Services tables
-- Business Decision: Focus exclusively on Parts Marketplace

-- =============================================
-- INSURANCE MODULE REMOVAL
-- =============================================

-- Drop MOI reports first (depends on insurance_claims)
DROP TABLE IF EXISTS moi_reports CASCADE;

-- Drop price benchmarking tables
DROP TABLE IF EXISTS price_benchmarks CASCADE;

-- Drop insurance claims
DROP TABLE IF EXISTS insurance_claims CASCADE;

-- Drop insurance companies
DROP TABLE IF EXISTS insurance_companies CASCADE;

-- Drop related functions
DROP FUNCTION IF EXISTS update_insurance_claims_timestamp() CASCADE;
DROP FUNCTION IF EXISTS update_benchmark_stats() CASCADE;

-- =============================================
-- QUICK SERVICES CLEANUP (if tables still exist)
-- =============================================

DROP TABLE IF EXISTS service_bids CASCADE;
DROP TABLE IF EXISTS service_requests CASCADE;
DROP TABLE IF EXISTS service_definitions CASCADE;
DROP TABLE IF EXISTS quick_service_requests CASCADE;

-- Drop related ENUMs (if exist)
DROP TYPE IF EXISTS service_request_status_enum CASCADE;
DROP TYPE IF EXISTS provider_type_enum CASCADE;
DROP TYPE IF EXISTS service_category_enum CASCADE;

-- Remove service-related columns from garages (if exist)
ALTER TABLE garages DROP COLUMN IF EXISTS provider_type;
ALTER TABLE garages DROP COLUMN IF EXISTS service_capabilities;
ALTER TABLE garages DROP COLUMN IF EXISTS mobile_service_radius_km;

-- =============================================
-- CLEANUP insurance_agent user type (if exists in constraint)
-- =============================================

-- Note: The main users table constraint only allows:
-- customer, garage, driver, staff, admin
-- The insurance_agent type was added via migration but may not be active

-- =============================================
-- DEPRECATED TABLES - LEAVE FOR Q2 2025 AS PLANNED
-- =============================================
-- reviews - marked "Scheduled for removal Q2 2025"
-- user_addresses - marked "Scheduled for removal Q2 2025"

-- NOTE: escrow_payments table is preserved as it may be used 
-- by the parts marketplace escrow system

COMMENT ON SCHEMA public IS 'QScrap Parts Marketplace - Simplified (Parts Only, No Insurance/Services)';
