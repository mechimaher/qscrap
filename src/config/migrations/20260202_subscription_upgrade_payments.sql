-- Migration: Add payment tracking to subscription change requests
-- Date: 2026-02-02
-- Purpose: Enable payment-first subscription upgrade flow

-- Add payment tracking columns to subscription_change_requests
ALTER TABLE subscription_change_requests 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100),
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Add check constraint for valid payment statuses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'subscription_change_requests_payment_status_check'
    ) THEN
        ALTER TABLE subscription_change_requests 
        ADD CONSTRAINT subscription_change_requests_payment_status_check 
        CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded'));
    END IF;
END $$;

-- Comment on columns
COMMENT ON COLUMN subscription_change_requests.payment_status IS 'unpaid=no payment yet, pending=waiting for Stripe/bank, paid=verified, failed=payment failed, refunded=cancelled';
COMMENT ON COLUMN subscription_change_requests.payment_amount IS 'Amount to pay for upgrade (from subscription_plans.monthly_fee)';
COMMENT ON COLUMN subscription_change_requests.payment_intent_id IS 'Stripe PaymentIntent ID for card payments';
COMMENT ON COLUMN subscription_change_requests.invoice_number IS 'Invoice number for bank transfer payments';
COMMENT ON COLUMN subscription_change_requests.bank_reference IS 'Bank transfer reference number (admin-verified)';
COMMENT ON COLUMN subscription_change_requests.paid_at IS 'Timestamp when payment was verified';

-- Index for finding unpaid/pending requests
CREATE INDEX IF NOT EXISTS idx_sub_requests_payment_status 
ON subscription_change_requests(payment_status) 
WHERE payment_status IN ('unpaid', 'pending');
