-- ============================================
-- QScrap Migration: Driver Reassignment Support
-- Adds columns to track driver reassignments
-- ============================================

-- Add reassignment tracking columns to delivery_assignments
ALTER TABLE delivery_assignments 
ADD COLUMN IF NOT EXISTS previous_driver_id UUID REFERENCES drivers(driver_id),
ADD COLUMN IF NOT EXISTS reassignment_reason TEXT,
ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS reassigned_by UUID REFERENCES users(user_id);

-- Create index for reassignment history queries
CREATE INDEX IF NOT EXISTS idx_assignments_reassigned 
ON delivery_assignments(previous_driver_id) 
WHERE previous_driver_id IS NOT NULL;

-- Done!
SELECT 'Driver reassignment migration completed successfully' as status;
