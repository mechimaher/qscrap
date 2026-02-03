-- Migration: Cleanup Orphan Database Objects
-- Date: 2026-02-03
-- Audit Reference: Enterprise Audit Phase 1
-- Status: Verified safe (tables empty, functions have no triggers)

-- =============================================
-- PHASE 1: DROP EMPTY TABLES
-- =============================================
-- ad_impressions: 0 rows (never used)
-- ad_placements: 0 rows (never used)

DROP TABLE IF EXISTS ad_impressions CASCADE;
DROP TABLE IF EXISTS ad_placements CASCADE;

-- =============================================
-- PHASE 2: DROP ORPHAN FUNCTIONS
-- =============================================
-- These functions have no dependent triggers

DROP FUNCTION IF EXISTS find_service_providers();
DROP FUNCTION IF EXISTS update_quick_service_status();
DROP FUNCTION IF EXISTS check_daily_budget_exceeded();

-- =============================================
-- ROLLBACK (if needed)
-- =============================================
-- Cannot rollback - tables were empty
-- Functions can be recreated from original schema if needed
