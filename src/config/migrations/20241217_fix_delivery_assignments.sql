-- ============================================
-- QScrap Migration: Fix Delivery Assignments Unique Constraint
-- Run this migration to fix the 500 error on collect order
-- ============================================

-- Step 1: Add unique constraint on order_id for delivery_assignments
-- This is required for the ON CONFLICT (order_id) clause used in collectOrder and assignDriver

-- First, remove any duplicate order_id entries (keep the most recent one)
DELETE FROM delivery_assignments
WHERE assignment_id NOT IN (
    SELECT DISTINCT ON (order_id) assignment_id
    FROM delivery_assignments
    ORDER BY order_id, created_at DESC
);

-- Now add the unique constraint
ALTER TABLE delivery_assignments DROP CONSTRAINT IF EXISTS delivery_assignments_order_id_unique;
ALTER TABLE delivery_assignments 
ADD CONSTRAINT delivery_assignments_order_id_unique UNIQUE (order_id);

-- Done!
SELECT 'Migration completed: delivery_assignments unique constraint added' as status;
