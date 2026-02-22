/**
 * Migration: Warranty Claims Table
 * 
 * Purpose: Support dedicated warranty claim workflow for defective parts
 * post-delivery (beyond 7-day return window).
 * 
 * Background:
 * - ReturnService handles 7-day returns (Qatar Law No. 8/2008 Article 26)
 * - Warranty claims are for defects discovered AFTER the 7-day window
 * - Requires Finance team approval (not Operations)
 * - Separate from standard refund flow
 * 
 * Related: SupportActionsService.executeWarrantyClaim()
 */

-- Create warranty_claims table
CREATE TABLE IF NOT EXISTS warranty_claims (
    claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES support_tickets(ticket_id) ON DELETE SET NULL,
    defect_description TEXT NOT NULL,
    evidence_urls TEXT[],
    claim_status VARCHAR(50) NOT NULL DEFAULT 'pending_finance_review',
    resolution_type VARCHAR(50), -- 'replacement', 'refund', 'repair_credit'
    refund_amount DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    resolution_notes TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_warranty_claims_order ON warranty_claims(order_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_status ON warranty_claims(claim_status);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_customer ON warranty_claims(customer_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_created ON warranty_claims(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE warranty_claims IS 'Warranty claims for defective parts post-delivery (beyond 7-day return window). Requires Finance approval.';
COMMENT ON COLUMN warranty_claims.claim_status IS 'pending_finance_review, approved, rejected, fulfilled';
COMMENT ON COLUMN warranty_claims.resolution_type IS 'replacement (send new part), refund (full/partial), repair_credit (credit for repair costs)';

-- Grant permissions (adjust based on your role setup)
-- GRANT SELECT, INSERT, UPDATE ON warranty_claims TO operations;
-- GRANT SELECT ON warranty_claims TO finance;
