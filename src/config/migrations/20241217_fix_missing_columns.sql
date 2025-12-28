-- ============================================
-- QScrap Migration: Fix Missing Columns
-- Run this migration to fix invoice generation and payout processing
-- ============================================

-- 1. Add cr_number to garages table (Required for Invoice Generation)
ALTER TABLE garages 
ADD COLUMN IF NOT EXISTS cr_number VARCHAR(50);

-- 2. Add resolution to disputes table (Required for Payout Processing)
ALTER TABLE disputes 
ADD COLUMN IF NOT EXISTS resolution VARCHAR(50) CHECK (resolution IN ('refund_approved', 'auto_approved', 'claim_rejected', 'partial_refund'));

-- 3. Add resolution_notes to disputes table if missing
ALTER TABLE disputes 
ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- 4. Add resolved_at and resolved_by to disputes if missing
ALTER TABLE disputes 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(user_id);

-- Done!
SELECT 'Migration completed: Added missing columns to garages and disputes tables' as status;
