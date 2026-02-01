-- Migration: Create password_reset_tokens table for B2B garage magic link system
-- Supports secure one-time token validation for garage account activation

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    token_type VARCHAR(50) DEFAULT 'password_reset',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

COMMENT ON TABLE password_reset_tokens IS 'Stores secure token hashes for password resets and garage setup magic links';
COMMENT ON COLUMN password_reset_tokens.token_type IS 'Type: password_reset, garage_setup, email_verify';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Populated when token is consumed, prevents reuse';
