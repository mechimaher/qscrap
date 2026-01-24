-- Migration: Email OTP System for Customer Registration
-- Date: 2026-01-24
-- Description: Adds email verification via OTP for secure, cost-free customer registration

-- 1. Create email_otps table
CREATE TABLE IF NOT EXISTS email_otps (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    purpose VARCHAR(50) NOT NULL DEFAULT 'registration', -- 'registration', 'password_reset', '2fa'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    user_agent TEXT,
    ip_address INET
);

-- Indexes for performance
CREATE INDEX idx_email_otps_email ON email_otps(email);
CREATE INDEX idx_email_otps_expiry ON email_otps(expires_at);
CREATE INDEX idx_email_otps_purpose ON email_otps(purpose);

-- 2. Add email column to users table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'email') THEN
        ALTER TABLE users ADD COLUMN email VARCHAR(255);
    END IF;
END $$;

-- 3. Add email_verified column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'email_verified') THEN
        ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 4. Create unique index on email (only for non-null emails)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(LOWER(email)) WHERE email IS NOT NULL;

-- 5. Add comment
COMMENT ON TABLE email_otps IS 'Stores OTP codes for email verification (registration, password reset, 2FA)';
COMMENT ON COLUMN email_otps.purpose IS 'Purpose of OTP: registration, password_reset, or 2fa';
COMMENT ON COLUMN email_otps.expires_at IS 'OTP expires after 10 minutes by default';
COMMENT ON COLUMN email_otps.max_attempts IS 'Maximum verification attempts allowed (default 5)';

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE 'Email OTP system migration completed successfully';
END $$;
