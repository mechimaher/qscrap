-- Migration: Update staff_profiles role constraint
-- Change 'accounting' to 'finance' to match Finance Dashboard naming

-- Drop old constraint
ALTER TABLE staff_profiles DROP CONSTRAINT IF EXISTS staff_profiles_role_check;

-- Add new constraint with 'finance' instead of 'accounting'
ALTER TABLE staff_profiles ADD CONSTRAINT staff_profiles_role_check 
CHECK (role IN ('operations', 'finance', 'customer_service', 'quality_control', 'logistics', 'hr', 'management'));
