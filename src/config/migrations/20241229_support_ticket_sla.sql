-- QScrap Premium 2026 - Support Ticket SLA & Driver Payout Enhancement
-- Adds SLA tracking for support tickets

-- ============================================
-- SUPPORT TICKET SLA COLUMNS
-- ============================================

ALTER TABLE support_tickets 
ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMP,
ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS resolution_time_minutes INTEGER;

-- Set default SLA deadline for new tickets (24 hours)
UPDATE support_tickets 
SET sla_deadline = created_at + INTERVAL '24 hours'
WHERE sla_deadline IS NULL;

-- Add default for future inserts
ALTER TABLE support_tickets 
ALTER COLUMN sla_deadline SET DEFAULT (NOW() + INTERVAL '24 hours');

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_support_tickets_sla ON support_tickets(sla_deadline) 
WHERE status NOT IN ('resolved', 'closed');

CREATE INDEX IF NOT EXISTS idx_support_tickets_escalation ON support_tickets(escalation_level) 
WHERE status NOT IN ('resolved', 'closed');

-- ============================================
-- LOG MIGRATION
-- ============================================

COMMENT ON COLUMN support_tickets.sla_deadline IS 'Deadline for first response (default 24 hours)';
COMMENT ON COLUMN support_tickets.escalation_level IS '0=normal, 1=escalated, 2=urgent, 3=critical';
COMMENT ON COLUMN support_tickets.first_response_at IS 'When staff first responded';
COMMENT ON COLUMN support_tickets.resolution_time_minutes IS 'Total time to resolution';

INSERT INTO migrations (name, applied_at) 
VALUES ('20241229_support_ticket_sla', NOW())
ON CONFLICT (name) DO NOTHING;
