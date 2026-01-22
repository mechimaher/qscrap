-- Migration: 20260118_schema_optimization.sql
-- Description: Decompose 'garages' table, add reporting indexes, and create safe transition views.

BEGIN;

-- ==========================================
-- 1. Table Decomposition: garage_settings
-- ==========================================
CREATE TABLE IF NOT EXISTS IF NOT EXISTS garage_settings (
    garage_id UUID PRIMARY KEY REFERENCES garages(garage_id) ON DELETE CASCADE,
    auto_renew BOOLEAN DEFAULT true,
    provides_repairs BOOLEAN DEFAULT false,
    provides_quick_services BOOLEAN DEFAULT false,
    mobile_service_radius_km INTEGER,
    max_concurrent_services INTEGER DEFAULT 3,
    service_capabilities UUID[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill data from garages
INSERT INTO garage_settings (
    garage_id, auto_renew, provides_repairs, provides_quick_services, 
    mobile_service_radius_km, max_concurrent_services, service_capabilities
)
SELECT 
    garage_id, auto_renew, provides_repairs, provides_quick_services, 
    mobile_service_radius_km, max_concurrent_services, service_capabilities
FROM garages
ON CONFLICT (garage_id) DO NOTHING;

-- ==========================================
-- 2. Table Decomposition: garage_stats
-- ==========================================
CREATE TABLE IF NOT EXISTS IF NOT EXISTS garage_stats (
    garage_id UUID PRIMARY KEY REFERENCES garages(garage_id) ON DELETE CASCADE,
    total_services_completed INTEGER DEFAULT 0,
    quick_service_rating NUMERIC(2,1),
    repair_rating NUMERIC(2,1),
    average_response_time_minutes INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill data from garages
INSERT INTO garage_stats (
    garage_id, total_services_completed, quick_service_rating, 
    repair_rating, average_response_time_minutes
)
SELECT 
    garage_id, total_services_completed, quick_service_rating, 
    repair_rating, average_response_time_minutes
FROM garages
ON CONFLICT (garage_id) DO NOTHING;

-- ==========================================
-- 3. Legacy Support View
-- ==========================================
-- This view combines the core table with the new extension tables
CREATE OR REPLACE VIEW v_garages_full_view AS
SELECT 
    g.garage_id, g.garage_name, g.cr_number, g.location_lat, g.location_lng, g.approval_status,
    s.auto_renew, s.provides_repairs, s.provides_quick_services, s.mobile_service_radius_km,
    s.max_concurrent_services, s.service_capabilities,
    st.total_services_completed, st.quick_service_rating, st.repair_rating,
    st.average_response_time_minutes
FROM garages g
LEFT JOIN garage_settings s ON g.garage_id = s.garage_id
LEFT JOIN garage_stats st ON g.garage_id = st.garage_id;

-- ==========================================
-- 4. High-Value Reporting Indexes
-- ==========================================

-- Audit Logs (Compliance Reports)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_logs_created_at_desc ON audit_logs(created_at DESC);

-- Notifications ("My Alerts" Feed)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_notifications_user_recent ON notifications(user_id, created_at DESC);

-- Orders (Sales Reporting)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_orders_created_at_date ON orders(created_at DESC);

-- Ad Impressions (High Volume Analytics)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_ad_impressions_timestamp_brin ON ad_impressions USING BRIN("timestamp");

COMMIT;
