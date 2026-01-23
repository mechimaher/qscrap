-- Migration: Add ticket escalation and reopen columns
-- Purpose: Support auto-escalation after 24h and customer ticket reopen

DO $$ 
BEGIN
    -- escalated_at: When ticket was auto-escalated
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'support_tickets' AND column_name = 'escalated_at') THEN
        ALTER TABLE support_tickets ADD COLUMN escalated_at TIMESTAMP;
    END IF;
    
    -- reopened_at: When customer reopened the ticket
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'support_tickets' AND column_name = 'reopened_at') THEN
        ALTER TABLE support_tickets ADD COLUMN reopened_at TIMESTAMP;
    END IF;
    
    -- reopened_count: How many times ticket was reopened
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'support_tickets' AND column_name = 'reopened_count') THEN
        ALTER TABLE support_tickets ADD COLUMN reopened_count INTEGER DEFAULT 0;
    END IF;
    
    -- notes: Internal notes for ticket
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'support_tickets' AND column_name = 'notes') THEN
        ALTER TABLE support_tickets ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Index for finding stale tickets to escalate
CREATE INDEX IF NOT EXISTS idx_support_tickets_stale 
ON support_tickets(created_at, status, first_response_at) 
WHERE status = 'open' AND first_response_at IS NULL;

COMMENT ON COLUMN support_tickets.escalated_at IS 'When ticket was auto-escalated due to no response';
COMMENT ON COLUMN support_tickets.reopened_at IS 'When customer last reopened the ticket';
COMMENT ON COLUMN support_tickets.reopened_count IS 'Number of times ticket was reopened by customer';
