-- Driver Payout System + Delivery Chat Migration
-- Features: Driver earnings tracking + Real-time customer-driver chat

-- 1. Driver Payouts Table
CREATE TABLE IF NOT EXISTS driver_payouts (
    payout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(driver_id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES delivery_assignments(assignment_id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(order_id) ON DELETE SET NULL,
    order_number VARCHAR(20),
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
    notes TEXT,
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for driver payouts
CREATE INDEX IF NOT EXISTS idx_driver_payouts_driver ON driver_payouts(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_payouts_status ON driver_payouts(status);
CREATE INDEX IF NOT EXISTS idx_driver_payouts_created ON driver_payouts(created_at DESC);

-- 2. Delivery Chat Table (text-only, active during delivery)
CREATE TABLE IF NOT EXISTS delivery_chats (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES delivery_assignments(assignment_id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(order_id),
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'driver')),
    sender_id UUID NOT NULL REFERENCES users(user_id),
    message TEXT NOT NULL,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Ensure read_at column exists (in case table existed without it)
ALTER TABLE delivery_chats ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;

-- Indexes for chat
CREATE INDEX IF NOT EXISTS idx_delivery_chats_assignment ON delivery_chats(assignment_id);
CREATE INDEX IF NOT EXISTS idx_delivery_chats_created ON delivery_chats(created_at);
CREATE INDEX IF NOT EXISTS idx_delivery_chats_unread ON delivery_chats(assignment_id) WHERE read_at IS NULL;

-- 3. Add total_earnings column to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0;

-- Success message
DO $$ BEGIN RAISE NOTICE 'Migration complete: driver_payouts, delivery_chats tables created'; END $$;
