-- Push Tokens Table Migration
-- Stores device push tokens for Expo Push Notifications
-- Supports both customer and driver apps

CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
    device_id VARCHAR(100),
    app_type VARCHAR(20) DEFAULT 'customer' CHECK (app_type IN ('customer', 'driver')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Unique constraint: One token per user (prevent duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_user_token ON push_tokens(user_id, token);

-- Index for fast token lookup by user
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);

-- Index for filtering active tokens only
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = true;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_push_tokens_updated_at ON push_tokens;
CREATE TRIGGER trigger_push_tokens_updated_at
    BEFORE UPDATE ON push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_push_tokens_updated_at();

-- Grant permissions (if needed)
-- GRANT ALL ON push_tokens TO qscrap_app;
