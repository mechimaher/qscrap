-- =============================================================================
-- Enterprise Subscription Infrastructure Migration
-- Date: 2026-02-02
-- Purpose: Add saved payment methods and invoice tracking for 10/10 infrastructure
-- =============================================================================

-- 1. Garage Payment Methods Table (Saved Cards)
CREATE TABLE IF NOT EXISTS garage_payment_methods (
    method_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID NOT NULL REFERENCES garages(garage_id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255) NOT NULL,
    card_last4 VARCHAR(4),
    card_brand VARCHAR(20),  -- visa, mastercard, etc.
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_garage_payment_methods_garage ON garage_payment_methods(garage_id);

-- 2. Subscription Invoices Table
CREATE TABLE IF NOT EXISTS subscription_invoices (
    invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    garage_id UUID NOT NULL REFERENCES garages(garage_id),
    subscription_id UUID REFERENCES garage_subscriptions(subscription_id),
    request_id UUID REFERENCES subscription_change_requests(request_id),
    
    -- Invoice details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'QAR',
    status VARCHAR(20) DEFAULT 'pending',  -- pending, paid, void
    
    -- Payment info
    payment_method VARCHAR(20),  -- card, bank_transfer
    payment_intent_id VARCHAR(255),
    bank_reference VARCHAR(100),
    
    -- Plan info
    plan_name VARCHAR(100),
    plan_name_ar VARCHAR(100),
    billing_period_start DATE,
    billing_period_end DATE,
    
    -- PDF storage
    pdf_path VARCHAR(500),
    
    -- Timestamps
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscription_invoices_garage ON subscription_invoices(garage_id);
CREATE INDEX idx_subscription_invoices_number ON subscription_invoices(invoice_number);

-- 3. Add Stripe customer ID to garages (for saved payment methods)
ALTER TABLE garages 
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- 4. Add auto_renew tracking to garage_subscriptions
ALTER TABLE garage_subscriptions 
ADD COLUMN IF NOT EXISTS renewal_reminder_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_billing_attempt TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS billing_retry_count INTEGER DEFAULT 0;

-- 5. Webhook events log (for debugging and idempotency)
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    event_id VARCHAR(255) PRIMARY KEY,  -- Stripe event ID for idempotency
    event_type VARCHAR(100) NOT NULL,
    payload JSONB,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'processed'  -- processed, failed
);

-- 6. Generate invoice number sequence
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;

COMMENT ON TABLE garage_payment_methods IS 'Saved payment methods (Stripe) for garages';
COMMENT ON TABLE subscription_invoices IS 'Invoice records for subscription payments';
COMMENT ON TABLE stripe_webhook_events IS 'Log of processed Stripe webhook events';
