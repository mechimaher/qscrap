-- ============================================
-- AUDIT LOGS TABLE MIGRATION
-- Created: 2024-12-18
-- Purpose: Track all state-changing operations for compliance and debugging
-- ============================================

-- Create the audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    user_type VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(100),
    method VARCHAR(10),
    path VARCHAR(500),
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_body JSONB,
    response_status INTEGER,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Add comment for documentation
COMMENT ON TABLE audit_logs IS 'Tracks all state-changing API operations for compliance and debugging';

-- ============================================
-- Optional: Create partitioning for large-scale deployments
-- Uncomment if expecting high volume
-- ============================================
-- CREATE TABLE audit_logs_archive (LIKE audit_logs INCLUDING ALL);
-- ALTER TABLE audit_logs_archive ADD CONSTRAINT archive_date_check 
--   CHECK (created_at < NOW() - INTERVAL '90 days');

-- ============================================
-- Cleanup policy: Auto-delete logs older than 90 days
-- Add to cron job or use pg_cron extension
-- ============================================
-- DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';

COMMIT;
