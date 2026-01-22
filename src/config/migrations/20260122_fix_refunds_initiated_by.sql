-- Fix: Add missing initiated_by column to refunds table
-- RefundService.createRefund requires this column

ALTER TABLE refunds ADD COLUMN IF NOT EXISTS initiated_by UUID REFERENCES users(user_id);
