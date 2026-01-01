-- Add original_bid_amount to bids table to track initial garage offer
ALTER TABLE bids ADD COLUMN IF NOT EXISTS original_bid_amount NUMERIC;

-- Backfill existing rows (assume current amount is original for now)
UPDATE bids SET original_bid_amount = bid_amount WHERE original_bid_amount IS NULL;
