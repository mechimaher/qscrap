-- QScrap Payment System Migration
-- Enterprise-grade mock payment infrastructure
-- Designed for easy QPAY swap while maintaining security standards

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. PAYMENT TRANSACTIONS TABLE
-- ============================================================================
-- Stores all payment attempts and results
-- Optimized for high-frequency queries and compliance auditing

CREATE TABLE IF NOT EXISTS payment_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Order and User References
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Transaction Details
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'QAR',
    payment_method VARCHAR(20) NOT NULL, -- 'mock_card', 'cash', 'qpay'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'success', 'failed', 'refunded'
    
    -- Card Information (PCI-DSS compliant - last 4 only)
    card_last4 VARCHAR(4),
    card_brand VARCHAR(20), -- 'visa', 'mastercard', 'amex', 'discover'
    card_expiry_month INTEGER CHECK (card_expiry_month BETWEEN 1 AND 12),
    card_expiry_year INTEGER CHECK (card_expiry_year >= EXTRACT(YEAR FROM CURRENT_DATE)),
    
    -- Provider Response (encrypted/sanitized)
    provider_response JSONB,
    provider_transaction_id VARCHAR(255), -- External provider's ID
    
    -- Idempotency (prevent duplicate charges)
    idempotency_key VARCHAR(255) UNIQUE,
    
    -- Refund Information
    refund_amount DECIMAL(10,2) DEFAULT 0 CHECK (refund_amount >= 0 AND refund_amount <= amount),
    refund_reason TEXT,
    refunded_at TIMESTAMP,
    
    -- Audit Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    
    -- Error Details
    failure_reason TEXT,
    error_code VARCHAR(50),
    
    -- Additional Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'success', 'failed', 'refunded', 'cancelled')),
    CONSTRAINT valid_payment_method CHECK (payment_method IN ('mock_card', 'cash', 'qpay'))
);

-- Performance Indexes
CREATE INDEX idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_created_at ON payment_transactions(created_at DESC);
CREATE INDEX idx_payment_transactions_idempotency_key ON payment_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Composite index for common queries
CREATE INDEX idx_payment_transactions_user_status ON payment_transactions(user_id, status);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_payment_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_transactions_updated_at();

-- ============================================================================
-- 2. PAYMENT AUDIT LOGS TABLE
-- ============================================================================
-- Complete audit trail for compliance and debugging
-- Never deleted, append-only for forensic analysis

CREATE TABLE IF NOT EXISTS payment_audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Transaction Reference
    transaction_id UUID REFERENCES payment_transactions(transaction_id) ON DELETE CASCADE,
    
    -- Action Type
    action VARCHAR(50) NOT NULL, -- 'initiated', 'validated', 'processing', 'completed', 'failed', 'refunded'
    
    -- Request Context
    ip_address INET,
    user_agent TEXT,
    request_method VARCHAR(10), -- 'POST', 'GET', etc.
    request_path TEXT,
    
    -- Data (sanitized - no sensitive card info)
    request_data JSONB, -- Sanitized request payload
    response_data JSONB, -- Response payload
    
    -- Timing
    processing_time_ms INTEGER, -- For performance monitoring
    
    -- Audit Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_action CHECK (action IN ('initiated', 'validated', 'processing', 'completed', 'failed', 'refunded', 'cancelled'))
);

-- Indexes for audit queries
CREATE INDEX idx_payment_audit_logs_transaction_id ON payment_audit_logs(transaction_id);
CREATE INDEX idx_payment_audit_logs_action ON payment_audit_logs(action);
CREATE INDEX idx_payment_audit_logs_created_at ON payment_audit_logs(created_at DESC);
CREATE INDEX idx_payment_audit_logs_ip_address ON payment_audit_logs(ip_address);

-- ============================================================================
-- 3. IDEMPOTENCY KEYS TABLE
-- ============================================================================
-- Prevent duplicate payment processing
-- Auto-expires after 24 hours

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    
    -- Associated Transaction
    transaction_id UUID REFERENCES payment_transactions(transaction_id) ON DELETE CASCADE,
    
    -- Cached Response (for instant replay)
    response JSONB NOT NULL,
    
    -- Lifecycle
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    
    -- Metadata
    request_hash VARCHAR(64), -- SHA-256 hash of request for validation
    user_id UUID REFERENCES users(user_id)
);

-- Index for expiry cleanup job
CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_keys_user_id ON idempotency_keys(user_id);

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function to get transaction summary
CREATE OR REPLACE FUNCTION get_payment_summary(p_user_id UUID)
RETURNS TABLE (
    total_transactions BIGINT,
    successful_transactions BIGINT,
    failed_transactions BIGINT,
    total_amount DECIMAL(10,2),
    total_refunded DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS total_transactions,
        COUNT(*) FILTER (WHERE status = 'success')::BIGINT AS successful_transactions,
        COUNT(*) FILTER (WHERE status = 'failed')::BIGINT AS failed_transactions,
        COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0) AS total_amount,
        COALESCE(SUM(refund_amount), 0) AS total_refunded
    FROM payment_transactions
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired idempotency keys (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM idempotency_keys
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. INITIAL DATA / COMMENTS
-- ============================================================================

COMMENT ON TABLE payment_transactions IS 'Stores all payment transactions with PCI-DSS compliant card storage (last 4 digits only)';
COMMENT ON TABLE payment_audit_logs IS 'Append-only audit trail for compliance and forensics';
COMMENT ON TABLE idempotency_keys IS 'Prevents duplicate payment processing, auto-expires after 24h';

COMMENT ON COLUMN payment_transactions.idempotency_key IS 'Client-generated UUID to prevent duplicate charges';
COMMENT ON COLUMN payment_transactions.card_last4 IS 'Last 4 digits of card - PCI-DSS compliant';
COMMENT ON COLUMN payment_transactions.provider_response IS 'Encrypted response from payment provider';

-- Grant permissions (adjust as needed)
GRANT SELECT, INSERT, UPDATE ON payment_transactions TO qscrap_app;
GRANT SELECT, INSERT ON payment_audit_logs TO qscrap_app;
GRANT SELECT, INSERT, DELETE ON idempotency_keys TO qscrap_app;
