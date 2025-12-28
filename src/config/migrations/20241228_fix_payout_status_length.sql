-- ============================================
-- QScrap Migration: Fix Payout Status Length
-- Date: 2024-12-28
-- Purpose: Increase payout_status length to accommodate 'awaiting_confirmation'
-- ============================================

ALTER TABLE garage_payouts ALTER COLUMN payout_status TYPE varchar(50);

SELECT 'Migration completed: Increased payout_status length in garage_payouts table' as status;
