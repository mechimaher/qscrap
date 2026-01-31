-- Migration: Add garage compensation tracking for cancellations
-- BRAIN v3.0 Compliance + Manual Review Workflow
-- Philosophy: "Customer is King" - Support/Finance team decides compensation

-- Add garage_compensation to refunds table
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS garage_compensation NUMERIC(10,2) DEFAULT 0;

-- Add columns to cancellation_requests for manual review workflow
ALTER TABLE cancellation_requests ADD COLUMN IF NOT EXISTS garage_compensation NUMERIC(10,2) DEFAULT 0;
ALTER TABLE cancellation_requests ADD COLUMN IF NOT EXISTS pending_compensation NUMERIC(10,2) DEFAULT 0;
ALTER TABLE cancellation_requests ADD COLUMN IF NOT EXISTS compensation_status VARCHAR(30) DEFAULT 'not_applicable';
-- compensation_status: 'not_applicable' | 'pending_review' | 'approved' | 'denied'

-- Add columns to garage_payouts for compensation review
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS payout_type VARCHAR(50) DEFAULT 'standard';
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS potential_compensation NUMERIC(10,2) DEFAULT 0;
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS review_reason VARCHAR(100);
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE garage_payouts ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Comments for documentation
COMMENT ON COLUMN cancellation_requests.garage_compensation IS 'Final approved compensation amount (set by Support/Finance)';
COMMENT ON COLUMN cancellation_requests.pending_compensation IS 'Potential compensation awaiting review';
COMMENT ON COLUMN cancellation_requests.compensation_status IS 'Review status: not_applicable, pending_review, approved, denied';
COMMENT ON COLUMN garage_payouts.potential_compensation IS 'Amount garage could receive if approved';
COMMENT ON COLUMN garage_payouts.review_reason IS 'Cancellation reason code for review';
COMMENT ON COLUMN garage_payouts.reviewed_by IS 'Support/Finance user who made the decision';
COMMENT ON COLUMN garage_payouts.reviewed_at IS 'When compensation decision was made';
COMMENT ON COLUMN garage_payouts.review_notes IS 'Notes from reviewer explaining decision';

