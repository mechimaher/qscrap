-- 20260127_fix_refunds_schema_alignment.sql
-- Aligns refunds table across support-actions and finance modules

-- Add initiated_by column if missing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'initiated_by') THEN
        ALTER TABLE refunds ADD COLUMN initiated_by TEXT;
    END IF;
END $$;

-- Add refund_type column if missing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'refund_type') THEN
        ALTER TABLE refunds ADD COLUMN refund_type TEXT DEFAULT 'support_refund';
    END IF;
END $$;

-- Add refund_method column if missing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'refund_method') THEN
        ALTER TABLE refunds ADD COLUMN refund_method TEXT DEFAULT 'original_payment';
    END IF;
END $$;

-- Fix existing records that used old column names
-- The old inserts used (order_id, customer_id, amount, reason, status, processed_by)
-- We need to migrate to the new columns

-- First, check if 'amount' column exists and migrate to refund_amount
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'amount')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'refund_amount') THEN
        -- Rename amount to refund_amount
        ALTER TABLE refunds RENAME COLUMN amount TO refund_amount;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'amount') THEN
        -- Both exist, copy data and drop old
        UPDATE refunds SET refund_amount = amount WHERE refund_amount IS NULL AND amount IS NOT NULL;
        ALTER TABLE refunds DROP COLUMN amount;
    END IF;
END $$;

-- Copy status to refund_status if both exist
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'refund_status') THEN
        -- Map old status values to new ones
        UPDATE refunds SET refund_status = CASE 
            WHEN status = 'approved' THEN 'pending'
            WHEN status = 'processed' THEN 'completed'
            ELSE COALESCE(refund_status, status)
        END WHERE refund_status IS NULL OR refund_status = '';
        -- Drop old column
        ALTER TABLE refunds DROP COLUMN status;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'status') THEN
        -- Only status exists, rename to refund_status
        ALTER TABLE refunds RENAME COLUMN status TO refund_status;
    END IF;
END $$;

-- Copy reason to refund_reason
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'reason')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'refund_reason') THEN
        UPDATE refunds SET refund_reason = reason WHERE refund_reason IS NULL AND reason IS NOT NULL;
        ALTER TABLE refunds DROP COLUMN reason;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'reason') THEN
        ALTER TABLE refunds RENAME COLUMN reason TO refund_reason;
    END IF;
END $$;

-- Copy processed_by to initiated_by if needed
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'processed_by')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'initiated_by') THEN
        UPDATE refunds SET initiated_by = processed_by WHERE initiated_by IS NULL AND processed_by IS NOT NULL;
    END IF;
END $$;

-- Add index on refund_status for dashboard queries
CREATE INDEX IF NOT EXISTS idx_refunds_refund_status ON refunds(refund_status);

-- Ensure constraint is updated
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_refund_status_check;
ALTER TABLE refunds ADD CONSTRAINT refunds_refund_status_check 
    CHECK (refund_status IS NULL OR refund_status IN ('pending', 'processing', 'completed', 'failed', 'approved'));

SELECT 'Refunds schema alignment complete' as status;
