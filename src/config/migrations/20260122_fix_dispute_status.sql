-- Migration: Fix dispute status constraint to include 'under_review'
-- Created: 2026-01-22
-- Purpose: The garageRespond() function sets status to 'under_review' but this wasn't in the CHECK constraint

-- Drop existing constraint
ALTER TABLE disputes 
DROP CONSTRAINT IF EXISTS disputes_status_check;

-- Add updated constraint with 'under_review' status
ALTER TABLE disputes 
ADD CONSTRAINT disputes_status_check 
CHECK (status IN ('pending', 'contested', 'under_review', 'accepted', 'refund_approved', 'refund_denied', 'resolved', 'auto_resolved', 'cancelled'));

SELECT 'Migration completed: Added under_review to disputes status constraint' as status;
