-- Clean: Drop all insurance-related tables
-- This migration cleans up insurance tables that are no longer needed

DROP TABLE IF EXISTS insurance_claims CASCADE;
DROP TABLE IF EXISTS insurance_companies CASCADE;
DROP TABLE IF EXISTS vehicle_history_events CASCADE;

-- Remove insurance_company_id from users table
ALTER TABLE users DROP COLUMN IF EXISTS insurance_company_id;

-- Remove insurance_agent from user_type constraint and re-add
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;
ALTER TABLE users ADD CONSTRAINT users_user_type_check 
CHECK (user_type IN ('customer', 'garage', 'driver', 'staff', 'admin'));
