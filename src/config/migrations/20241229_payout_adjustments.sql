-- QScrap Premium 2026 - Payout Adjustment Migration
-- Adds fields for tracking payout adjustments due to refunds

-- Add adjustment tracking to garage_payouts
ALTER TABLE garage_payouts 
ADD COLUMN IF NOT EXISTS original_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS adjustment_reason TEXT,
ADD COLUMN IF NOT EXISTS adjusted_at TIMESTAMP;

-- Add 'cancelled' status to payout_status enum
-- This is done via altering the CHECK constraint
ALTER TABLE garage_payouts DROP CONSTRAINT IF EXISTS garage_payouts_payout_status_check;

ALTER TABLE garage_payouts 
ADD CONSTRAINT garage_payouts_payout_status_check 
CHECK (payout_status IN (
    'pending', 
    'processing', 
    'awaiting_confirmation', 
    'completed', 
    'disputed', 
    'failed', 
    'on_hold',
    'cancelled'  -- NEW: For fully refunded orders
));

-- Create index for faster payout lookups by order
CREATE INDEX IF NOT EXISTS idx_garage_payouts_order_id ON garage_payouts(order_id);
CREATE INDEX IF NOT EXISTS idx_garage_payouts_garage_id ON garage_payouts(garage_id);
CREATE INDEX IF NOT EXISTS idx_garage_payouts_status ON garage_payouts(payout_status);

-- Comment the new columns
COMMENT ON COLUMN garage_payouts.original_amount IS 'Original payout amount before any adjustments';
COMMENT ON COLUMN garage_payouts.adjustment_reason IS 'Reason for payout adjustment (e.g., partial refund)';
COMMENT ON COLUMN garage_payouts.adjusted_at IS 'Timestamp when payout was adjusted';

-- Log this migration
INSERT INTO migrations (name, applied_at) 
VALUES ('20241229_payout_adjustments', NOW())
ON CONFLICT (name) DO NOTHING;
