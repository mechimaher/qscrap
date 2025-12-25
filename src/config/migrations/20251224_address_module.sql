-- Address Management Module
-- Created: 2025-12-24

CREATE TABLE IF NOT EXISTS user_addresses (
    address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL, -- e.g. 'Home', 'Work', 'Office'
    address_text TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_address_modtime() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_address_modtime ON user_addresses;
CREATE TRIGGER trg_update_address_modtime
BEFORE UPDATE ON user_addresses
FOR EACH ROW
EXECUTE FUNCTION update_address_modtime();
