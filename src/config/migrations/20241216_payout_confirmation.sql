-- Migration to add 2-way confirmation workflow columns to garage_payouts
-- Date: 2024-12-16

-- 1. Add new columns for 2-way confirmation workflow
ALTER TABLE garage_payouts 
ADD COLUMN IF NOT EXISTS garage_confirmation_notes TEXT,
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS confirmation_deadline TIMESTAMP,
ADD COLUMN IF NOT EXISTS auto_confirmed BOOLEAN DEFAULT false;

-- 2. Drop and recreate status constraint to include new statuses
ALTER TABLE garage_payouts DROP CONSTRAINT IF EXISTS garage_payouts_payout_status_check;
ALTER TABLE garage_payouts ADD CONSTRAINT garage_payouts_payout_status_check 
CHECK (payout_status IN ('pending', 'processing', 'awaiting_confirmation', 'completed', 'disputed', 'failed', 'on_hold'));

-- 3. Create index for awaiting confirmation queries
CREATE INDEX IF NOT EXISTS idx_payouts_awaiting ON garage_payouts(payout_status) WHERE payout_status = 'awaiting_confirmation';
CREATE INDEX IF NOT EXISTS idx_payouts_disputed ON garage_payouts(payout_status) WHERE payout_status = 'disputed';

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'garage_payouts' 
ORDER BY ordinal_position;
