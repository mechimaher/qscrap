-- 20260129_complete_refunds_schema.sql
-- Ensures refunds table has all required columns for Finance Dashboard

-- Step 1: Add new columns if they don't exist
DO $$ BEGIN
    -- Add refund_amount if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'refund_amount') THEN
        ALTER TABLE refunds ADD COLUMN refund_amount DECIMAL(10,2);
    END IF;
    
    -- Add original_amount if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'original_amount') THEN
        ALTER TABLE refunds ADD COLUMN original_amount DECIMAL(10,2);
    END IF;
    
    -- Add refund_reason if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'refund_reason') THEN
        ALTER TABLE refunds ADD COLUMN refund_reason TEXT;
    END IF;
    
    -- Add refund_status if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'refund_status') THEN
        ALTER TABLE refunds ADD COLUMN refund_status VARCHAR(30) DEFAULT 'pending';
    END IF;
    
    -- Add refund_type if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'refund_type') THEN
        ALTER TABLE refunds ADD COLUMN refund_type TEXT DEFAULT 'support_refund';
    END IF;
    
    -- Add refund_method if missing  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'refund_method') THEN
        ALTER TABLE refunds ADD COLUMN refund_method TEXT DEFAULT 'original_payment';
    END IF;
    
    -- Add delivery_fee_retained if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'delivery_fee_retained') THEN
        ALTER TABLE refunds ADD COLUMN delivery_fee_retained DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- Add stripe_refund_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'stripe_refund_id') THEN
        ALTER TABLE refunds ADD COLUMN stripe_refund_id VARCHAR(100);
    END IF;
    
    -- Add initiated_by if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'initiated_by') THEN
        ALTER TABLE refunds ADD COLUMN initiated_by TEXT;
    END IF;
    
    -- Add processed_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'processed_at') THEN
        ALTER TABLE refunds ADD COLUMN processed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Step 2: Migrate data from old columns to new if old columns exist
DO $$ BEGIN
    -- Migrate amount -> refund_amount
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'amount') THEN
        UPDATE refunds SET refund_amount = amount WHERE refund_amount IS NULL AND amount IS NOT NULL;
        UPDATE refunds SET original_amount = amount WHERE original_amount IS NULL AND amount IS NOT NULL;
        ALTER TABLE refunds DROP COLUMN amount;
    END IF;
    
    -- Migrate reason -> refund_reason
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'reason') THEN
        UPDATE refunds SET refund_reason = reason WHERE refund_reason IS NULL AND reason IS NOT NULL;
        ALTER TABLE refunds DROP COLUMN reason;
    END IF;
    
    -- Migrate status -> refund_status
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'status') THEN
        UPDATE refunds SET refund_status = CASE 
            WHEN status = 'approved' THEN 'pending'
            WHEN status = 'processed' THEN 'completed'
            ELSE COALESCE(status, 'pending')
        END WHERE refund_status IS NULL OR refund_status = '';
        ALTER TABLE refunds DROP COLUMN status;
    END IF;
END $$;

-- Step 3: Add indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_refunds_refund_status ON refunds(refund_status);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at);

-- Step 4: Update status check constraint
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_refund_status_check;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_status_check;
ALTER TABLE refunds ADD CONSTRAINT refunds_refund_status_check 
    CHECK (refund_status IS NULL OR refund_status IN ('pending', 'processing', 'completed', 'failed', 'approved'));

SELECT 'Complete refunds schema migration done' as status;
