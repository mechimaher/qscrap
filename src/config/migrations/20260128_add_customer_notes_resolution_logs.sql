-- Migration: Add customer_notes and resolution_logs tables for Support Dashboard
-- Date: 2026-01-28
-- Purpose: Support Customer Resolution Center features

-- Customer Notes (internal agent notes about customers)
CREATE TABLE IF NOT EXISTS customer_notes (
    note_id SERIAL PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES users(user_id),
    note_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_created ON customer_notes(created_at DESC);

-- Resolution Logs (track all quick actions performed by support agents)
CREATE TABLE IF NOT EXISTS resolution_logs (
    log_id SERIAL PRIMARY KEY,
    order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES users(user_id),
    action_type VARCHAR(50) NOT NULL, -- full_refund, partial_refund, cancel_order, etc.
    action_details JSONB, -- Additional data (amount, reason, etc.)
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resolution_logs_customer ON resolution_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_resolution_logs_order ON resolution_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_resolution_logs_created ON resolution_logs(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE customer_notes IS 'Internal agent notes about customers for Support Dashboard';
COMMENT ON TABLE resolution_logs IS 'Audit log of all quick actions performed by support agents';
COMMENT ON COLUMN resolution_logs.action_type IS 'Type of action: full_refund, partial_refund, goodwill_credit, cancel_order, reassign_driver, rush_delivery, escalate_to_ops';
COMMENT ON COLUMN resolution_logs.action_details IS 'JSON data with action-specific details like amount, reason, etc.';
