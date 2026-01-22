-- Delivery Fee Tiers System
-- Enables order-value based discounts on delivery fees

-- Create delivery fee tiers table
CREATE TABLE IF NOT EXISTS delivery_fee_tiers (
    tier_id SERIAL PRIMARY KEY,
    min_order_value DECIMAL(10,2) NOT NULL,
    max_order_value DECIMAL(10,2),  -- NULL means no upper limit
    discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    description VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed default tiers
INSERT INTO delivery_fee_tiers (min_order_value, max_order_value, discount_percent, description) VALUES
(0, 199.99, 0, 'Standard delivery fee'),
(200, 499.99, 20, '20% off delivery for orders 200-500 QAR'),
(500, 999.99, 40, '40% off delivery for orders 500-1000 QAR'),
(1000, NULL, 100, 'FREE delivery for orders 1000+ QAR')
ON CONFLICT DO NOTHING;

-- Add refund_type column to refunds table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'refund_type') THEN
        ALTER TABLE refunds ADD COLUMN refund_type VARCHAR(50) DEFAULT 'customer_refusal';
    END IF;
END $$;

-- Add delivery_fee_retained column to refunds table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'delivery_fee_retained') THEN
        ALTER TABLE refunds ADD COLUMN delivery_fee_retained DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- Create index for faster tier lookups
CREATE INDEX IF NOT EXISTS idx_delivery_fee_tiers_active 
ON delivery_fee_tiers (is_active, min_order_value);

COMMENT ON TABLE delivery_fee_tiers IS 'Order-value based discount tiers for delivery fees';
COMMENT ON COLUMN delivery_fee_tiers.discount_percent IS 'Percentage discount applied to base delivery fee (0-100)';
COMMENT ON COLUMN refunds.refund_type IS 'Type: cancelled_before_dispatch, customer_refusal, wrong_part, driver_failure';
COMMENT ON COLUMN refunds.delivery_fee_retained IS 'Amount of delivery fee retained (not refunded) for business protection';
