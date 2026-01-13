-- Driver Wallets Table
CREATE TABLE IF NOT EXISTS driver_wallets (
    wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL UNIQUE REFERENCES drivers(driver_id) ON DELETE CASCADE,
    balance DECIMAL(10, 2) DEFAULT 0.00, -- Positive = Company owes Driver, Negative = Driver owes Company
    total_earned DECIMAL(10, 2) DEFAULT 0.00, -- Lifetime earnings (credits)
    cash_collected DECIMAL(10, 2) DEFAULT 0.00, -- Lifetime cash collected (debits)
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Driver Transactions Table
CREATE TABLE IF NOT EXISTS driver_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES driver_wallets(wallet_id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL, -- Positive (Credit) or Negative (Debit)
    type VARCHAR(50) NOT NULL, -- 'earning', 'cash_collection', 'payout', 'adjustment', 'bonus'
    reference_id VARCHAR(100), -- Order ID or Payout ID
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster history lookup
CREATE INDEX IF NOT EXISTS idx_driver_transactions_wallet_id ON driver_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_driver_transactions_created_at ON driver_transactions(created_at DESC);

-- Initialize wallets for existing drivers
INSERT INTO driver_wallets (driver_id, balance, total_earned)
SELECT driver_id, 0, 0 FROM drivers
WHERE driver_id NOT IN (SELECT driver_id FROM driver_wallets);
