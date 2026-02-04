-- Migration: 20260204_bid_flags.sql
-- Purpose: Add bid flagging and supersede workflow support
-- Author: QScrap Engineering
-- Date: February 4, 2026

BEGIN;

-- ============================================
-- 1. Create bid_flags table
-- ============================================
CREATE TABLE IF NOT EXISTS bid_flags (
    flag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id UUID NOT NULL REFERENCES bids(bid_id) ON DELETE CASCADE,
    flagged_by UUID NOT NULL REFERENCES users(user_id),
    reason VARCHAR(50) NOT NULL CHECK (reason IN (
        'wrong_part', 'wrong_picture', 'incorrect_price', 
        'missing_info', 'other'
    )),
    details TEXT,
    is_urgent BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'acknowledged', 'corrected', 'dismissed', 'cancelled'
    )),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    event_id UUID DEFAULT gen_random_uuid() -- Immutable audit reference
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bid_flags_bid_id ON bid_flags(bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_flags_status ON bid_flags(status);
CREATE INDEX IF NOT EXISTS idx_bid_flags_flagged_by ON bid_flags(flagged_by);
CREATE INDEX IF NOT EXISTS idx_bid_flags_created_at ON bid_flags(created_at DESC);

COMMENT ON TABLE bid_flags IS 'Tracks customer-flagged bids with reason and resolution status';
COMMENT ON COLUMN bid_flags.event_id IS 'Immutable UUID for audit trail - never changes';
COMMENT ON COLUMN bid_flags.is_urgent IS 'Customer marks as urgent for faster garage response';

-- ============================================
-- 2. Add supersede columns to bids table
-- ============================================
ALTER TABLE bids ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES bids(bid_id);
ALTER TABLE bids ADD COLUMN IF NOT EXISTS supersedes_bid_id UUID REFERENCES bids(bid_id);
ALTER TABLE bids ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;

COMMENT ON COLUMN bids.superseded_by IS 'Points to the new bid that replaced this one';
COMMENT ON COLUMN bids.supersedes_bid_id IS 'Points to the original bid this one replaces';
COMMENT ON COLUMN bids.version_number IS 'Incremental version for bid corrections';

-- ============================================
-- 3. Update bids status CHECK constraint
-- ============================================
-- First drop the existing constraint if it exists
ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_status_check;

-- Add new constraint with flagged and superseded statuses
ALTER TABLE bids ADD CONSTRAINT bids_status_check CHECK (
    status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired', 'flagged', 'superseded')
);

-- ============================================
-- 4. Create trigger for updated_at on bid_flags
-- ============================================
CREATE OR REPLACE FUNCTION update_bid_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bid_flags_updated_at ON bid_flags;
CREATE TRIGGER bid_flags_updated_at
    BEFORE UPDATE ON bid_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_bid_flags_updated_at();

-- ============================================
-- 5. Add index for supersede queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_bids_superseded_by ON bids(superseded_by) WHERE superseded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bids_supersedes_bid_id ON bids(supersedes_bid_id) WHERE supersedes_bid_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bids_status_flagged ON bids(garage_id, status) WHERE status = 'flagged';

COMMIT;

-- ============================================
-- Rollback script (run manually if needed)
-- ============================================
-- BEGIN;
-- DROP TABLE IF EXISTS bid_flags;
-- ALTER TABLE bids DROP COLUMN IF EXISTS superseded_by;
-- ALTER TABLE bids DROP COLUMN IF EXISTS supersedes_bid_id;
-- ALTER TABLE bids DROP COLUMN IF EXISTS version_number;
-- ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_status_check;
-- ALTER TABLE bids ADD CONSTRAINT bids_status_check CHECK (
--     status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired')
-- );
-- DROP FUNCTION IF EXISTS update_bid_flags_updated_at();
-- COMMIT;
