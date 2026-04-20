-- Driver Wallet System Migration
-- Creates tables for driver earnings, cash collection tracking

-- 1. Driver Wallets Table
CREATE TABLE IF NOT EXISTS driver_wallets (
    wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL UNIQUE REFERENCES drivers(driver_id) ON DELETE CASCADE,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_earned DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cash_collected DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Driver Transactions Table
CREATE TABLE IF NOT EXISTS driver_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES driver_wallets(wallet_id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('earning', 'cash_collection', 'payout', 'adjustment', 'bonus')),
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_driver_wallets_driver_id ON driver_wallets(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_transactions_wallet_id ON driver_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_driver_transactions_created_at ON driver_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_transactions_type ON driver_transactions(type);

-- 4. Initialize Wallets for Existing Drivers
INSERT INTO driver_wallets (driver_id, balance, total_earned, cash_collected)
SELECT 
    driver_id,
    0.00 as balance,
    COALESCE(total_earnings, 0) as total_earned,
    0.00 as cash_collected
FROM drivers
ON CONFLICT (driver_id) DO NOTHING;

-- 5. Backfill Earning Transactions from driver_payouts
INSERT INTO driver_transactions (wallet_id, amount, type, reference_id, description, created_at)
SELECT 
    dw.wallet_id,
    dp.amount,
    'earning' as type,
    dp.order_id as reference_id,
    'Delivery Earning #' || dp.order_number as description,
    dp.created_at
FROM driver_payouts dp
JOIN driver_wallets dw ON dp.driver_id = dw.driver_id
WHERE dp.status = 'pending'
ON CONFLICT DO NOTHING;

-- 6. Update wallet balances based on backfilled transactions
UPDATE driver_wallets dw
SET 
    balance = COALESCE((
        SELECT SUM(amount) 
        FROM driver_transactions dt 
        WHERE dt.wallet_id = dw.wallet_id
    ), 0),
    total_earned = COALESCE((
        SELECT SUM(amount) 
        FROM driver_transactions dt 
        WHERE dt.wallet_id = dw.wallet_id AND dt.type = 'earning'
    ), 0),
    cash_collected = COALESCE((
        SELECT SUM(ABS(amount)) 
        FROM driver_transactions dt 
        WHERE dt.wallet_id = dw.wallet_id AND dt.type = 'cash_collection'
    ), 0);

COMMIT;
