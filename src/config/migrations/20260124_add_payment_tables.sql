-- ============================================
-- Payment System Tables
-- Supports Stripe Test Mode + Future QPAY
-- ============================================

-- Payment intents (pending transactions)
CREATE TABLE IF NOT EXISTS payment_intents (
    intent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id),
    customer_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'QAR',
    intent_type VARCHAR(20) NOT NULL, -- 'deposit', 'full_payment', 'remaining'
    provider VARCHAR(20) NOT NULL, -- 'stripe', 'qpay', 'mock'
    provider_intent_id VARCHAR(255), -- Stripe/QPAY transaction ID
    provider_client_secret VARCHAR(255), -- For frontend confirmation
    status VARCHAR(20) DEFAULT 'pending', -- pending, requires_action, succeeded, failed, cancelled, refunded
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment methods (saved cards)
CREATE TABLE IF NOT EXISTS payment_methods (
    method_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_method_id VARCHAR(255) NOT NULL, -- Stripe pm_xxx
    card_last4 VARCHAR(4),
    card_brand VARCHAR(20), -- visa, mastercard, amex
    card_exp_month INT,
    card_exp_year INT,
    cardholder_name VARCHAR(100),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment refunds
CREATE TABLE IF NOT EXISTS payment_refunds (
    refund_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intent_id UUID REFERENCES payment_intents(intent_id),
    order_id UUID REFERENCES orders(order_id),
    amount DECIMAL(10,2) NOT NULL,
    reason VARCHAR(50), -- 'cancellation', 'dispute', 'admin', 'quality_issue'
    reason_text TEXT,
    provider_refund_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, succeeded, failed
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add payment fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_status VARCHAR(20) DEFAULT 'none'; -- none, pending, paid, partially_refunded, refunded
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_intent_id UUID REFERENCES payment_intents(intent_id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_payment_intent_id UUID REFERENCES payment_intents(intent_id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cod'; -- cod, card, wallet

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_intents_customer ON payment_intents(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_provider ON payment_intents(provider, provider_intent_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_customer ON payment_methods(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(customer_id, is_default) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_payment_refunds_order ON payment_refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_status ON payment_refunds(status);

-- Stripe customer mapping (for saved cards)
CREATE TABLE IF NOT EXISTS stripe_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_customer ON stripe_customers(customer_id);

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE payment_intents IS 'Payment transactions - supports multiple providers';
COMMENT ON TABLE payment_methods IS 'Saved payment methods (cards) for customers';
COMMENT ON TABLE payment_refunds IS 'Refund records linked to payment intents';
COMMENT ON TABLE stripe_customers IS 'Mapping between app customers and Stripe customer IDs';
COMMENT ON COLUMN orders.deposit_amount IS 'Upfront deposit amount (30% of total)';
COMMENT ON COLUMN orders.deposit_status IS 'Status of deposit payment';
COMMENT ON COLUMN orders.payment_method IS 'Payment method: cod (Cash on Delivery), card, wallet';
