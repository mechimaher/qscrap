-- ============================================
-- QScrap Migration: Add Missing Refunds Columns
-- Date: 2024-12-22
-- Purpose: Add refund_reason and processed_by columns to refunds table
-- ============================================

-- Add refund_reason column to track why refund was issued
ALTER TABLE refunds 
ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- Add processed_by column to track who processed the refund
ALTER TABLE refunds 
ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES users(user_id);

-- Done!
SELECT 'Migration completed: Added refund_reason and processed_by columns to refunds table' as status;
