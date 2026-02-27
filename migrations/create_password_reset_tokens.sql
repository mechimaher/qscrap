-- QScrap Backend - Password Reset Tokens Table
-- Enterprise-standard password reset with OTP verification

-- Password Reset Tokens Table
-- Stores one-time tokens for password reset flow

-- ENSURE users table has a unique constraint on email to allow foreign key references
-- This is also a security best practice for email-based auth
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT fk_password_reset_user 
        FOREIGN KEY (email) 
        REFERENCES users(email) 
        ON DELETE CASCADE
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_email 
    ON password_reset_tokens(email);

CREATE INDEX IF NOT EXISTS idx_password_reset_token 
    ON password_reset_tokens(token);

CREATE INDEX IF NOT EXISTS idx_password_reset_expires 
    ON password_reset_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_password_reset_used 
    ON password_reset_tokens(used);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_password_reset_lookup 
    ON password_reset_tokens(email, token, otp_code, used, expires_at);

-- Add comment for documentation
COMMENT ON TABLE password_reset_tokens IS 'Stores one-time password reset tokens with OTP verification';
COMMENT ON COLUMN password_reset_tokens.token_id IS 'Unique identifier for reset token';
COMMENT ON COLUMN password_reset_tokens.email IS 'User email associated with reset request';
COMMENT ON COLUMN password_reset_tokens.token IS 'Secure random token for password reset';
COMMENT ON COLUMN password_reset_tokens.otp_code IS '6-digit OTP code for verification';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration timestamp (5 minutes)';
COMMENT ON COLUMN password_reset_tokens.used IS 'Whether token has been used';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Timestamp when token was used';

-- Grant permissions (adjust based on your DB user)
-- GRANT SELECT, INSERT, UPDATE ON password_reset_tokens TO qscrap_app;
-- GRANT SELECT ON password_reset_tokens TO qscrap_readonly;
