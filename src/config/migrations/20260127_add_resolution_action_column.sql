-- Add resolution_action column to support_escalations
-- Captures what action was taken when resolving the escalation

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'support_escalations' AND column_name = 'resolution_action') THEN
        ALTER TABLE support_escalations 
        ADD COLUMN resolution_action VARCHAR(50) 
        CHECK (resolution_action IN ('refund', 'partial_refund', 'no_action', 'reassign', 'resolved'));
        
        COMMENT ON COLUMN support_escalations.resolution_action IS 'Action taken to resolve the escalation';
    END IF;
END $$;
