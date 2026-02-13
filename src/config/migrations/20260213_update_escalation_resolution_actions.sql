-- Update resolution_action CHECK constraint to include new action types
-- Old: 'refund', 'partial_refund', 'no_action', 'reassign', 'resolved'
-- New: adds 'approve_refund', 'approve_cancellation', 'reject', 'acknowledge'

DO $$
BEGIN
    -- Drop old CHECK constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'support_escalations'::regclass 
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%resolution_action%'
    ) THEN
        ALTER TABLE support_escalations 
        DROP CONSTRAINT IF EXISTS support_escalations_resolution_action_check;
    END IF;
    
    -- Add updated CHECK constraint with all action types
    ALTER TABLE support_escalations 
    ADD CONSTRAINT support_escalations_resolution_action_check 
    CHECK (resolution_action IN (
        'refund', 'partial_refund', 'no_action', 'reassign', 'resolved',
        'approve_refund', 'approve_cancellation', 'reject', 'acknowledge'
    ));
    
    -- Also allow 'rejected' as escalation status  
    -- (current statuses: pending, in_progress, resolved)
    -- This is needed for the reject action
END $$;
