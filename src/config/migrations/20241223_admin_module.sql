-- ============================================
-- Admin Module Migration
-- Garage Approval Workflow
-- Created: 2024-12-23
-- ============================================

-- Add approval workflow columns to garages table
ALTER TABLE garages ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) 
    DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'demo', 'expired'));

ALTER TABLE garages ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(user_id);
ALTER TABLE garages ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMP;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Index for approval queue performance
CREATE INDEX IF NOT EXISTS idx_garages_approval_status ON garages(approval_status);
CREATE INDEX IF NOT EXISTS idx_garages_approval_pending ON garages(approval_status, created_at) WHERE approval_status = 'pending';

-- Keep existing garages as pending - admin will activate manually
-- (Default is 'pending' so existing NULL values will be treated as pending)

-- Audit log table for admin actions
CREATE TABLE IF NOT EXISTS admin_audit_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES users(user_id),
    action_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON admin_audit_log(target_type, target_id);

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
    p_admin_id UUID,
    p_action_type VARCHAR(50),
    p_target_type VARCHAR(50),
    p_target_id UUID,
    p_old_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, old_value, new_value)
    VALUES (p_admin_id, p_action_type, p_target_type, p_target_id, p_old_value, p_new_value)
    RETURNING log_id INTO v_log_id;
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Add demo trial tracking to garage_subscriptions
ALTER TABLE garage_subscriptions ADD COLUMN IF NOT EXISTS is_admin_granted BOOLEAN DEFAULT false;
ALTER TABLE garage_subscriptions ADD COLUMN IF NOT EXISTS admin_notes TEXT;
