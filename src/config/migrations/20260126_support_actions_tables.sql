-- Support Escalations Table
-- Used by support team to escalate orders to operations team

CREATE TABLE IF NOT EXISTS support_escalations (
    escalation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id),
    customer_id UUID NOT NULL REFERENCES users(user_id),
    escalated_by UUID NOT NULL REFERENCES users(user_id),
    reason TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'in_progress', 'resolved')),
    resolved_by UUID REFERENCES users(user_id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_escalations_status ON support_escalations(status);
CREATE INDEX IF NOT EXISTS idx_support_escalations_order ON support_escalations(order_id);
CREATE INDEX IF NOT EXISTS idx_support_escalations_priority ON support_escalations(priority) WHERE status = 'pending';

COMMENT ON TABLE support_escalations IS 'Escalations from support team to operations for complex issues';

-- Payout Reversals Table (if not exists)
-- Used when a payout was already confirmed but order needs refund
CREATE TABLE IF NOT EXISTS payout_reversals (
    reversal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID NOT NULL REFERENCES garages(garage_id),
    original_payout_id UUID REFERENCES garage_payouts(payout_id),
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'waived')),
    deducted_from_payout_id UUID REFERENCES garage_payouts(payout_id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payout_reversals_garage ON payout_reversals(garage_id);
CREATE INDEX IF NOT EXISTS idx_payout_reversals_status ON payout_reversals(status);

COMMENT ON TABLE payout_reversals IS 'Tracks amounts to be deducted from future garage payouts due to refunds';

-- Refunds Table (if not exists)
CREATE TABLE IF NOT EXISTS refunds (
    refund_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(order_id),
    customer_id UUID NOT NULL REFERENCES users(user_id),
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processed', 'failed')),
    payment_refund_id VARCHAR(100), -- External payment provider refund ID
    processed_by VARCHAR(50), -- 'support', 'operations', 'auto'
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_customer ON refunds(customer_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

COMMENT ON TABLE refunds IS 'Customer refund records with status tracking';
