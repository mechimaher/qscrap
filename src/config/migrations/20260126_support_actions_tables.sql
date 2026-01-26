-- Support Escalations Table
-- Used by support team to escalate orders to operations team

CREATE TABLE IF NOT EXISTS support_escalations (
    escalation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID,
    customer_id UUID NOT NULL,
    escalated_by UUID NOT NULL,
    reason TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'in_progress', 'resolved')),
    resolved_by UUID,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_escalations_status ON support_escalations(status);
CREATE INDEX IF NOT EXISTS idx_support_escalations_order ON support_escalations(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_escalations_priority ON support_escalations(priority) WHERE status = 'pending';

COMMENT ON TABLE support_escalations IS 'Escalations from support team to operations for complex issues';

-- Payout Reversals Table (if not exists)
-- Used when a payout was already confirmed but order needs refund
CREATE TABLE IF NOT EXISTS payout_reversals (
    reversal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID NOT NULL,
    original_payout_id UUID,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'waived')),
    deducted_from_payout_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payout_reversals_garage ON payout_reversals(garage_id);
CREATE INDEX IF NOT EXISTS idx_payout_reversals_status ON payout_reversals(status);

COMMENT ON TABLE payout_reversals IS 'Tracks amounts to be deducted from future garage payouts due to refunds';

-- Refunds Table (if not exists) - skip if already exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'refunds') THEN
        CREATE TABLE refunds (
            refund_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID NOT NULL,
            customer_id UUID NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            reason TEXT,
            status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processed', 'failed')),
            payment_refund_id VARCHAR(100),
            processed_by VARCHAR(50),
            processed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX idx_refunds_order ON refunds(order_id);
        CREATE INDEX idx_refunds_customer ON refunds(customer_id);
        CREATE INDEX idx_refunds_status ON refunds(status);
    END IF;
END $$;

COMMENT ON TABLE refunds IS 'Customer refund records with status tracking';

