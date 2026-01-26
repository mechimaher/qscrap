-- Migration: Customer Resolution Center
-- Run this migration via the backend migration system or directly on database

-- Customer notes table for internal notes
CREATE TABLE IF NOT EXISTS customer_notes (
    note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(user_id),
    agent_id UUID NOT NULL REFERENCES users(user_id),
    note_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes(customer_id);

-- Resolution logs table for action tracking
CREATE TABLE IF NOT EXISTS resolution_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id),
    customer_id UUID REFERENCES users(user_id),
    agent_id UUID NOT NULL REFERENCES users(user_id),
    action_type VARCHAR(50) NOT NULL, -- 'refund', 'reassign_driver', 'contact_garage', 'cancel', etc.
    action_details JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resolution_logs_order ON resolution_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_resolution_logs_customer ON resolution_logs(customer_id);
