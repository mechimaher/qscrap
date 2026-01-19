-- Platform Simplification Migration
-- Date: 2026-01-19
-- Purpose: Remove Quick Services and Repair Marketplace
-- CEO Decision: Focus exclusively on Parts Marketplace (Used, Commercial, Genuine)

-- Drop Quick Services Tables
DROP TABLE IF EXISTS quick_service_bookings CASCADE;
DROP TABLE IF EXISTS quick_service_providers CASCADE;
DROP TABLE IF EXISTS quick_service_pricing CASCADE;
DROP TABLE IF EXISTS quick_service_categories CASCADE;

-- Drop Repair Marketplace Tables
DROP TABLE IF EXISTS repair_requests CASCADE;
DROP TABLE IF EXISTS repair_garages CASCADE;
DROP TABLE IF EXISTS repair_quotes CASCADE;
DROP TABLE IF EXISTS repair_assignments CASCADE;

-- Drop any related functions
DROP FUNCTION IF EXISTS notify_quick_service_providers() CASCADE;
DROP FUNCTION IF EXISTS calculate_service_cost() CASCADE;

-- Drop any related triggers
-- (Will cascade from table drops)

COMMENT ON SCHEMA public IS 'QScrap Parts Marketplace - Simplified (Parts Only)';
