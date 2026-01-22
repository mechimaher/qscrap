-- Fix: Add missing columns for payout cancellation
-- The markAsCancelled function requires these columns

ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
