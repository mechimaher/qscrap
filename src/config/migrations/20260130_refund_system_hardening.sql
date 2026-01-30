-- ============================================================================
-- Refund System Hardening Migration
-- Date: 2026-01-30
-- Purpose: Fix critical and high-risk issues identified in Senior Expert Audit
-- ============================================================================

-- ============================================================================
-- FIX FI-01: UNIQUE constraint to prevent double refunds
-- ============================================================================

-- First, clean up any existing duplicates (if any)
-- Keep only the most recent refund per order+type
WITH duplicates AS (
    SELECT refund_id, 
           ROW_NUMBER() OVER (PARTITION BY order_id, refund_type ORDER BY created_at DESC) as rn
    FROM refunds
    WHERE refund_type IS NOT NULL
)
DELETE FROM refunds 
WHERE refund_id IN (
    SELECT refund_id FROM duplicates WHERE rn > 1
);

-- Handle NULL refund_type by defaulting to 'manual'
UPDATE refunds SET refund_type = 'manual' WHERE refund_type IS NULL;

-- Add unique constraint (order_id, refund_type combination must be unique)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'refunds_order_type_unique'
    ) THEN
        ALTER TABLE refunds 
        ADD CONSTRAINT refunds_order_type_unique UNIQUE (order_id, refund_type);
    END IF;
END $$;

-- ============================================================================
-- FIX DM-01: Add foreign key constraints for referential integrity
-- ============================================================================

-- Add FK to orders (only if orders table exists and has order_id as PK)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'refunds_order_id_fkey'
    ) THEN
        ALTER TABLE refunds 
        ADD CONSTRAINT refunds_order_id_fkey 
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not add FK refunds_order_id_fkey: %', SQLERRM;
END $$;

-- ============================================================================
-- FIX SM-02: Normalize refund_status values
-- ============================================================================

-- Map 'approved' to 'pending' for consistency
UPDATE refunds SET refund_status = 'pending' 
WHERE refund_status = 'approved';

-- Update check constraint to remove 'approved' and ensure valid statuses only
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_refund_status_check;
ALTER TABLE refunds ADD CONSTRAINT refunds_refund_status_check 
    CHECK (refund_status IN ('pending', 'processing', 'completed', 'failed', 'rejected'));

-- ============================================================================
-- ENHANCEMENT: Add idempotency_key column for duplicate prevention
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refunds' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE refunds ADD COLUMN idempotency_key VARCHAR(255);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_idempotency_key 
            ON refunds(idempotency_key) WHERE idempotency_key IS NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- ENHANCEMENT: Add stripe_refund_status column for webhook sync
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refunds' AND column_name = 'stripe_refund_status'
    ) THEN
        ALTER TABLE refunds ADD COLUMN stripe_refund_status VARCHAR(50);
    END IF;
END $$;

-- ============================================================================
-- ENHANCEMENT: Add last_synced_at for reconciliation tracking
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refunds' AND column_name = 'last_synced_at'
    ) THEN
        ALTER TABLE refunds ADD COLUMN last_synced_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================================
-- ENHANCEMENT: Partial index for pending refunds (dashboard performance)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_refunds_pending_only 
    ON refunds(created_at DESC) WHERE refund_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_refunds_failed_only 
    ON refunds(created_at DESC) WHERE refund_status = 'failed';

-- ============================================================================
-- ENHANCEMENT: Add reconciliation_status for external audit
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refunds' AND column_name = 'reconciliation_status'
    ) THEN
        ALTER TABLE refunds ADD COLUMN reconciliation_status VARCHAR(20) 
            DEFAULT 'pending' CHECK (reconciliation_status IN ('pending', 'matched', 'mismatch', 'manual'));
    END IF;
END $$;

-- ============================================================================
-- Log migration completion
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Refund system hardening migration completed at %', NOW();
END $$;
