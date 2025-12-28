-- ============================================
-- QScrap Staff Profiles Migration
-- Adds 'staff' user type and staff_profiles table
-- ============================================

-- 1. Update user_type constraint to include 'staff'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;
ALTER TABLE users ADD CONSTRAINT users_user_type_check 
    CHECK (user_type IN ('customer', 'garage', 'driver', 'staff', 'admin'));

-- 2. Create staff_profiles table
CREATE TABLE IF NOT EXISTS staff_profiles (
    staff_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'operations', 'accounting', 'customer_service', 
        'quality_control', 'logistics', 'hr', 'management'
    )),
    department VARCHAR(100),
    employee_id VARCHAR(50),
    hire_date DATE,
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff_profiles(role);
CREATE INDEX IF NOT EXISTS idx_staff_user ON staff_profiles(user_id);

-- 4. Migrate existing 'operations' users to 'staff' (if any exist)
UPDATE users 
SET user_type = 'staff' 
WHERE user_type = 'operations';

-- 5. Insert staff profile for migrated operations users
INSERT INTO staff_profiles (user_id, role)
SELECT user_id, 'operations' 
FROM users 
WHERE user_type = 'staff' 
  AND user_id NOT IN (SELECT user_id FROM staff_profiles WHERE user_id IS NOT NULL);
