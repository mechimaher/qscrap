-- Schema alignment for integration tests and production parity
-- Ensures objects referenced by runtime services exist in canonical migrations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Push tokens table used by push.service.ts
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
    device_id VARCHAR(100),
    app_type VARCHAR(20) DEFAULT 'customer' CHECK (app_type IN ('customer', 'driver')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_user_token
    ON push_tokens(user_id, token);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user
    ON push_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_push_tokens_active
    ON push_tokens(is_active)
    WHERE is_active = true;

CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_push_tokens_updated_at ON push_tokens;
CREATE TRIGGER trigger_push_tokens_updated_at
    BEFORE UPDATE ON push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_push_tokens_updated_at();

-- 2) part_subcategory column used by order detail queries
ALTER TABLE part_requests
ADD COLUMN IF NOT EXISTS part_subcategory VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_part_requests_subcategory
    ON part_requests(part_category, part_subcategory)
    WHERE part_subcategory IS NOT NULL;

COMMENT ON COLUMN part_requests.part_subcategory IS
    'Subcategory of the part (e.g., Pistons under Engine category)';

-- 3) reward_transactions table expected by order/loyalty flows
CREATE TABLE IF NOT EXISTS reward_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    points_change INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    order_id UUID REFERENCES orders(order_id),
    description TEXT,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_transactions_customer
    ON reward_transactions(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reward_transactions_order
    ON reward_transactions(order_id);

CREATE INDEX IF NOT EXISTS idx_reward_transactions_type
    ON reward_transactions(transaction_type);

COMMENT ON TABLE reward_transactions IS
    'Audit trail for loyalty points accrual and redemption';

-- 4) Order payment/undo columns used by current order flow
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2) DEFAULT 0;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS deposit_status VARCHAR(20) DEFAULT 'none';

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS undo_deadline TIMESTAMPTZ;

COMMENT ON COLUMN orders.deposit_amount IS
    'Upfront deposit amount for order confirmation';

COMMENT ON COLUMN orders.deposit_status IS
    'Deposit lifecycle status: none, pending, paid, partially_refunded, refunded';

COMMENT ON COLUMN orders.undo_deadline IS
    'Grace window deadline for customer undo action after order creation';

CREATE INDEX IF NOT EXISTS idx_orders_undo_deadline
    ON orders(undo_deadline)
    WHERE undo_deadline IS NOT NULL;

-- Ensure pending_payment is permitted by status constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders
ADD CONSTRAINT orders_order_status_check CHECK (
    order_status IN (
        'pending_payment',
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'ready_for_collection',
        'collected',
        'qc_in_progress',
        'qc_passed',
        'qc_failed',
        'returning_to_garage',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'completed',
        'cancelled_by_customer',
        'cancelled_by_garage',
        'cancelled_by_ops',
        'disputed',
        'refunded'
    )
);
