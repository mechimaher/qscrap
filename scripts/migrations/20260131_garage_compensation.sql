-- Migration: Add garage compensation tracking for cancellations
-- BRAIN v3.0 Compliance: Garages receive 5% of part price when customer cancels during/after preparation

-- Add garage_compensation to refunds table
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS garage_compensation NUMERIC(10,2) DEFAULT 0;

-- Add garage_compensation to cancellation_requests table
ALTER TABLE cancellation_requests ADD COLUMN IF NOT EXISTS garage_compensation NUMERIC(10,2) DEFAULT 0;

-- Add payout_type to garage_payouts if not exists (for tracking partial payouts)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'garage_payouts' AND column_name = 'payout_type') THEN
        ALTER TABLE garage_payouts ADD COLUMN payout_type VARCHAR(50) DEFAULT 'standard';
    END IF;
END $$;

-- Comment for documentation
COMMENT ON COLUMN refunds.garage_compensation IS 'Amount paid to garage as compensation for work done before cancellation (BRAIN v3.0 compliant)';
COMMENT ON COLUMN cancellation_requests.garage_compensation IS 'Garage share of cancellation fee (5% of part price for stages 5-7)';
