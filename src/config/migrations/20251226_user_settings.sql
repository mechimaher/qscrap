-- Add settings column to users table for storing app preferences
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{"theme": "system", "language": "en", "notifications": {"push": true, "bid": true, "order": true, "delivery": true}}'::jsonb;

-- Index for efficient querying if we ever need to find users by preference (optional but good practice)
CREATE INDEX IF NOT EXISTS idx_users_settings ON users USING gin (settings);
