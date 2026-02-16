-- Migration: Create refresh_tokens table for JWT refresh token rotation
-- Date: 2026-02-08
-- Finding: S-2 from Expert Review — Reduce attack window for stolen tokens

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash of the refresh token
    device_info TEXT,                  -- User agent / device identifier
    ip_address VARCHAR(45),            -- Client IP at issuance
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,            -- NULL = active, set = revoked
    replaced_by UUID REFERENCES refresh_tokens(token_id)  -- Token rotation chain
);

-- Fast lookup by token hash (primary query path)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash) WHERE revoked_at IS NULL;

-- Per-user token listing and revocation
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;

-- Cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;

-- Note: Migration tracking handled automatically by scripts/migrate.js
