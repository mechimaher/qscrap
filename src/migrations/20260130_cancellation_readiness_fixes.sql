-- Migration: Add unique constraint to prevent double refunds
-- Date: 2026-01-30
-- Issue: CR-01 - Double refund possible via race condition

-- Add unique constraint on (order_id, refund_type) to prevent duplicate refunds
-- This ensures only one refund of each type can exist per order

-- First, check if there are any existing duplicates and clean them up
-- Keep only the first refund for each order_id + refund_type combination
DELETE FROM refunds r1
WHERE EXISTS (
    SELECT 1 FROM refunds r2 
    WHERE r2.order_id = r1.order_id 
      AND r2.refund_type = r1.refund_type 
      AND r2.created_at < r1.created_at
);

-- Add the unique constraint
ALTER TABLE refunds 
ADD CONSTRAINT unique_order_refund_type 
UNIQUE (order_id, refund_type);

-- Add index for faster payout cancellation lookups (CR-03)
CREATE INDEX IF NOT EXISTS idx_garage_payouts_order_id 
ON garage_payouts(order_id);

-- Add index for orphan order detection performance (HR-02)
CREATE INDEX IF NOT EXISTS idx_orders_pending_payment_created 
ON orders(created_at) 
WHERE order_status = 'pending_payment';

-- Add index for SLA auto-cancel detection (HR-03)
CREATE INDEX IF NOT EXISTS idx_orders_preparing_updated 
ON orders(updated_at) 
WHERE order_status = 'preparing';

COMMENT ON CONSTRAINT unique_order_refund_type ON refunds IS 
    'Prevents double refunds - CR-01 fix from Jan 30 2026 audit';
