-- Fix: Add missing payout_type column to garage_payouts table
-- RefundService needs this to create reversal payouts

ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS payout_type VARCHAR(50) DEFAULT 'normal';
