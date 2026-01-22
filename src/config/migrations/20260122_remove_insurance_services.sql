-- Platform Cleanup Migration
-- Date: 2026-01-22
-- Purpose: Remove Insurance and remaining Quick Services tables
-- Business Decision: Focus exclusively on Parts Marketplace

-- =============================================
-- INSURANCE MODULE REMOVAL
-- =============================================

-- Drop escrow activity log first (depends on escrow_payments)
DROP TABLE IF EXISTS escrow_activity_log CASCADE;

-- Drop escrow_payments - THIS IS INSURANCE-ONLY (references insurance_claims)
-- NOTE: escrow_transactions table for PARTS MARKETPLACE is PRESERVED
DROP TABLE IF EXISTS escrow_payments CASCADE;

-- Drop MOI reports (depends on insurance_claims)
DROP TABLE IF EXISTS moi_reports CASCADE;
DROP TABLE IF EXISTS moi_accident_reports CASCADE;

-- Drop price benchmarking tables
DROP TABLE IF EXISTS price_benchmarks CASCADE;

-- Drop insurance claims (references insurance_companies)
DROP TABLE IF EXISTS insurance_claims CASCADE;

-- Drop insurance companies
DROP TABLE IF EXISTS insurance_companies CASCADE;

-- Drop related functions
DROP FUNCTION IF EXISTS update_insurance_claims_timestamp() CASCADE;
DROP FUNCTION IF EXISTS update_benchmark_stats() CASCADE;
DROP FUNCTION IF EXISTS check_escrow_expiry() CASCADE;
DROP FUNCTION IF EXISTS log_escrow_activity() CASCADE;

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
-- CLEANUP insurance_agent users (CONFIRMED BY USER)
-- =============================================

-- Delete any insurance_agent users if they exist
DELETE FROM users WHERE user_type = 'insurance_agent';

-- Note: The main users table constraint already only allows:
-- customer, garage, driver, staff, admin
-- No constraint update needed as insurance_agent was never in the main constraint

-- =============================================
-- DEPRECATED TABLES - LEAVE FOR Q2 2025 AS PLANNED
-- =============================================
-- reviews - marked "Scheduled for removal Q2 2025"
-- user_addresses - marked "Scheduled for removal Q2 2025"

-- =============================================
-- PRESERVED TABLES (Parts Marketplace)
-- =============================================
-- escrow_transactions - Used by parts marketplace buyer protection
-- proof_of_condition - Handoff evidence for parts orders
-- escrow_release_rules - Configurable release rules

COMMENT ON SCHEMA public IS 'QScrap Parts Marketplace - Simplified (Parts Only, No Insurance/Services)';
