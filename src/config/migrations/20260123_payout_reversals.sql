-- Migration: Add payout_reversals table and held status support
-- Purpose: Enable holding payouts during disputes and tracking reversals

-- 1. Add held-related columns to garage_payouts if not exist
DO $$ 
BEGIN
    -- held_reason column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'garage_payouts' AND column_name = 'held_reason') THEN
        ALTER TABLE garage_payouts ADD COLUMN held_reason TEXT;
    END IF;
    
    -- held_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'garage_payouts' AND column_name = 'held_at') THEN
        ALTER TABLE garage_payouts ADD COLUMN held_at TIMESTAMP;
    END IF;
END $$;

-- 2. Create payout_reversals table
CREATE TABLE IF NOT EXISTS payout_reversals (
    reversal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID NOT NULL REFERENCES garages(garage_id),
    original_payout_id UUID REFERENCES garage_payouts(payout_id),
    order_id UUID REFERENCES orders(order_id),
    amount DECIMAL(12,2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'written_off')),
    deducted_from_payout_id UUID REFERENCES garage_payouts(payout_id),
    created_at TIMESTAMP DEFAULT NOW(),
    applied_at TIMESTAMP,
    notes TEXT
);

-- 3. Add index for quick reversal lookup
CREATE INDEX IF NOT EXISTS idx_payout_reversals_garage_status 
ON payout_reversals(garage_id, status);

CREATE INDEX IF NOT EXISTS idx_payout_reversals_pending 
ON payout_reversals(status) WHERE status = 'pending';

-- 4. Add index for held payouts
CREATE INDEX IF NOT EXISTS idx_garage_payouts_held 
ON garage_payouts(payout_status) WHERE payout_status = 'held';

COMMENT ON TABLE payout_reversals IS 'Tracks money owed by garages for refunded orders after payout was already confirmed';
COMMENT ON COLUMN payout_reversals.status IS 'pending = not yet deducted, applied = deducted from future payout, written_off = cancelled';
