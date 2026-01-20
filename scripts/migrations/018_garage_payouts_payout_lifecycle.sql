-- Migration: 018_garage_payouts_payout_lifecycle.sql
-- Date: 2026-01-20
-- Description: Add columns required for complete payout lifecycle (send, confirm, dispute)
-- This migration ensures the garage_payouts table supports:
--   - Sending payouts (notes, updated_at)
--   - Confirming payouts (received_amount, confirmed_at, confirmation_notes)
--   - Disputing payouts (dispute_reason, dispute_description, disputed_at)
--   - 'confirmed' status in the check constraint

-- Add missing columns for payout lifecycle
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS received_amount DECIMAL(10,2);
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS confirmation_notes TEXT;
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS dispute_reason VARCHAR(100);
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS dispute_description TEXT;
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMP;

-- Update the status check constraint to include 'confirmed' status
ALTER TABLE garage_payouts DROP CONSTRAINT IF EXISTS garage_payouts_payout_status_check;
ALTER TABLE garage_payouts ADD CONSTRAINT garage_payouts_payout_status_check 
    CHECK (payout_status IN ('pending', 'processing', 'awaiting_confirmation', 'confirmed', 'completed', 'disputed', 'failed', 'on_hold', 'cancelled'));

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_payouts_confirmed ON garage_payouts (payout_status) WHERE payout_status = 'confirmed';
