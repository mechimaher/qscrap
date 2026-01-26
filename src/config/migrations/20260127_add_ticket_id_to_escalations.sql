-- 20260127_add_ticket_id_to_escalations.sql
-- Add ticket_id column to support_escalations for proper linking

-- Add ticket_id column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'support_escalations' AND column_name = 'ticket_id') THEN
        ALTER TABLE support_escalations ADD COLUMN ticket_id UUID;
        
        -- Add foreign key constraint
        ALTER TABLE support_escalations 
        ADD CONSTRAINT fk_escalations_ticket 
        FOREIGN KEY (ticket_id) REFERENCES support_tickets(ticket_id) ON DELETE SET NULL;
        
        -- Add index for lookups
        CREATE INDEX idx_escalations_ticket ON support_escalations(ticket_id);
    END IF;
END $$;

-- Add assigned_to column if missing (for operations to claim escalations)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'support_escalations' AND column_name = 'assigned_to') THEN
        ALTER TABLE support_escalations ADD COLUMN assigned_to UUID;
    END IF;
END $$;

-- Update existing escalations to link to any related ticket
UPDATE support_escalations e
SET ticket_id = (
    SELECT t.ticket_id 
    FROM support_tickets t 
    WHERE t.order_id = e.order_id 
    AND t.customer_id = e.customer_id
    ORDER BY t.created_at DESC 
    LIMIT 1
)
WHERE e.ticket_id IS NULL;

SELECT 'Escalations ticket_id added and linked' as status;
