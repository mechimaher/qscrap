-- 20260127_support_audit_fixes.sql
-- Fixes critical issues identified in enterprise audit
-- V2: Added DROP IF EXISTS to handle partial creation

-- 1. Create refunds table (CRITICAL - SupportActionsService depends on this)
DROP TABLE IF EXISTS refunds CASCADE;
CREATE TABLE refunds (
    refund_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(order_id),
    customer_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','processed','failed')),
    processed_by TEXT,
    payment_intent_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    CONSTRAINT unique_order_refund UNIQUE (order_id)
);

CREATE INDEX idx_refunds_customer ON refunds(customer_id);
CREATE INDEX idx_refunds_status ON refunds(status);

COMMENT ON TABLE refunds IS 'Customer refund records with race condition protection';

-- 2. Create payout_reversals table (CRITICAL - handlePayoutForRefund depends on this)
DROP TABLE IF EXISTS payout_reversals CASCADE;
CREATE TABLE payout_reversals (
    reversal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID NOT NULL,
    original_payout_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','processed','failed')),
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

CREATE INDEX idx_payout_reversals_garage ON payout_reversals(garage_id);
CREATE INDEX idx_payout_reversals_payout ON payout_reversals(original_payout_id);

COMMENT ON TABLE payout_reversals IS 'Tracks reversals for garage payouts that were already sent';

-- 3. Create order_status_history table if not exists (for audit trail)
CREATE TABLE IF NOT EXISTS order_status_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(order_id),
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID,
    changed_by_type TEXT DEFAULT 'system' CHECK(changed_by_type IN ('system','customer','garage','driver','admin','support','operations')),
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created ON order_status_history(created_at);

COMMENT ON TABLE order_status_history IS 'Complete audit trail of all order status changes';

-- 4. Add ticket_id to resolution_logs for linking actions to tickets
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'resolution_logs' AND column_name = 'ticket_id') THEN
        ALTER TABLE resolution_logs ADD COLUMN ticket_id UUID REFERENCES support_tickets(ticket_id);
    END IF;
END $$;

-- 5. Seed canned responses (CRITICAL - templates button shows empty)
INSERT INTO canned_responses (title, message_text, category) VALUES
('Delivery Delay Apology', 
 'We sincerely apologize for the delay in your delivery. Our team is working to expedite your order. We will keep you updated on the progress and appreciate your patience.',
 'delivery'),
 
('Refund Confirmation', 
 'Your refund has been processed successfully. The amount will be credited to your original payment method within 5-7 business days. Thank you for your patience.',
 'billing'),
 
('Part Quality Resolution', 
 'We''re sorry to hear about the quality issue with your part. We take this very seriously. Please share photos of the issue so we can process a replacement or refund for you.',
 'part_quality'),

('Order Tracking Help', 
 'You can track your order in real-time using the Track button in your order details. The driver''s location updates every few seconds once they''re on the way.',
 'delivery'),

('Thank You Closing', 
 'Thank you for choosing QScrap! We appreciate your business. Is there anything else I can help you with today?',
 'general'),

('Payout Status', 
 'Your payout is being processed and will be sent to your registered bank account within 1-2 business days after order completion confirmation.',
 'payout'),

('Bid Dispute Resolution', 
 'We understand your concern about this bid. Our team will review the details and get back to you within 24 hours with a resolution.',
 'bid_dispute'),

('Account Verification', 
 'To verify your account, please ensure your phone number is correct and check for an OTP message. If you''re still having issues, please call our support hotline.',
 'account')
ON CONFLICT DO NOTHING;

-- 6. Index for efficient internal message filtering
CREATE INDEX IF NOT EXISTS idx_chat_messages_public 
ON chat_messages(ticket_id, created_at) 
WHERE is_internal = false;

-- Done!
