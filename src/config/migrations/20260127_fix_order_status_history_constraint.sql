-- 20260127_fix_order_status_history_constraint.sql
-- Fix the check constraint to include 'support' and 'operations'

-- Drop the old constraint if it exists
ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_changed_by_type_check;

-- Add updated constraint with all valid types
ALTER TABLE order_status_history 
ADD CONSTRAINT order_status_history_changed_by_type_check 
CHECK (changed_by_type IN ('system', 'customer', 'garage', 'driver', 'admin', 'support', 'operations'));
