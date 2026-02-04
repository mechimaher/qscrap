-- Migration: 20260204_undo_grace_window.sql
-- Purpose: Add 30-second undo capability for accidental order accepts
-- Sprint: VVIP Gap Remediation Sprint 1 (G-01)

-- 1. Add undo columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS undo_deadline TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS undo_used BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS undo_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS undo_reason TEXT;

-- 2. Add 'cancelled_by_undo' to order status constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check CHECK (
    order_status = ANY (ARRAY[
        'pending_payment'::text,
        'confirmed'::text, 
        'preparing'::text, 
        'ready_for_pickup'::text, 
        'ready_for_collection'::text, 
        'collected'::text, 
        'qc_in_progress'::text, 
        'qc_passed'::text, 
        'qc_failed'::text, 
        'returning_to_garage'::text, 
        'in_transit'::text, 
        'delivered'::text, 
        'completed'::text, 
        'cancelled_by_customer'::text, 
        'cancelled_by_garage'::text, 
        'cancelled_by_ops'::text,
        'cancelled_by_undo'::text,  -- NEW: Undo cancellation
        'disputed'::text, 
        'refunded'::text
    ])
);

-- 3. Create audit log table for compliance
CREATE TABLE IF NOT EXISTS undo_audit_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id) ON DELETE SET NULL,
    action VARCHAR(30) NOT NULL,
    actor_id UUID NOT NULL,
    actor_type VARCHAR(20) NOT NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT undo_audit_log_action_check CHECK (
        action IN ('undo_initiated', 'undo_completed', 'undo_expired', 'undo_failed')
    ),
    CONSTRAINT undo_audit_log_actor_type_check CHECK (
        actor_type IN ('customer', 'garage', 'system', 'admin')
    )
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_undo_deadline ON orders(undo_deadline) WHERE undo_deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_undo_audit_order ON undo_audit_log(order_id);
CREATE INDEX IF NOT EXISTS idx_undo_audit_created ON undo_audit_log(created_at DESC);

-- 5. Add comments for documentation
COMMENT ON COLUMN orders.undo_deadline IS 'Timestamp until which order can be undone (30s from creation)';
COMMENT ON COLUMN orders.undo_used IS 'Whether the undo option was exercised';
COMMENT ON COLUMN orders.undo_at IS 'Timestamp when undo was executed';
COMMENT ON COLUMN orders.undo_reason IS 'User-provided reason for undo';
COMMENT ON TABLE undo_audit_log IS 'Compliance audit trail for order undo operations';

-- 6. Record migration
INSERT INTO migrations (name) VALUES ('20260204_undo_grace_window') ON CONFLICT DO NOTHING;
