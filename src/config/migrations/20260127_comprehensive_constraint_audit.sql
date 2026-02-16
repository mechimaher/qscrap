-- 20260127_comprehensive_constraint_audit.sql
-- Deep audit fix: Ensure all CHECK constraints match code usage

-- 1. Fix users.user_type to include all actually used types
-- Current: customer, garage, driver, staff, admin, insurance_agent
-- Code also uses: superadmin (via JWT), cs_admin (via JWT), operations (via staff_profiles)
-- These are JWT token types, NOT database user_types - staff users have user_type='staff' 
-- and their specific role in staff_profiles table. NO CHANGE NEEDED.

-- 2. Ensure support_tickets constraints are complete
-- Already fixed in previous migrations

-- 3. Add 'cs_admin' and 'superadmin' as valid staff roles if needed
-- Actually these are NOT roles - they're handled via is_superadmin flag or role='customer_service'
-- NO CHANGE NEEDED here.

-- 4. Ensure refunds table has all the columns the code expects
-- The code in cancellation.service.ts inserts into refunds with different columns than support-actions.service.ts
-- Let's align them:
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'cancellation_id') THEN
        ALTER TABLE refunds ADD COLUMN cancellation_id UUID;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'original_amount') THEN
        ALTER TABLE refunds ADD COLUMN original_amount DECIMAL(10,2);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'refund_amount') THEN
        ALTER TABLE refunds ADD COLUMN refund_amount DECIMAL(10,2);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'fee_retained') THEN
        ALTER TABLE refunds ADD COLUMN fee_retained DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'delivery_fee_retained') THEN
        ALTER TABLE refunds ADD COLUMN delivery_fee_retained DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'refund_status') THEN
        ALTER TABLE refunds ADD COLUMN refund_status TEXT DEFAULT 'pending';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'stripe_refund_id') THEN
        ALTER TABLE refunds ADD COLUMN stripe_refund_id TEXT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'refund_reason') THEN
        ALTER TABLE refunds ADD COLUMN refund_reason TEXT;
    END IF;
END $$;

-- 5. Ensure payout_reversals has all needed columns
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payout_reversals' AND column_name = 'order_id') THEN
        ALTER TABLE payout_reversals ADD COLUMN order_id UUID;
    END IF;
END $$;

-- 6. Create index for refund lookups by order
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_cancellation ON refunds(cancellation_id);
CREATE INDEX IF NOT EXISTS idx_refunds_stripe ON refunds(stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;

-- 7. Update refunds status constraint to include 'processing' and 'completed'
-- Some schema variants use legacy "status", others use canonical "refund_status".
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'refunds' AND column_name = 'status') THEN
        ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_status_check;
        ALTER TABLE refunds ADD CONSTRAINT refunds_status_check
        CHECK (status IS NULL OR status IN ('pending', 'approved', 'processing', 'processed', 'completed', 'failed'));
    END IF;
END $$;

-- 8. Similar for refund_status column if different from status
-- Some inserts use 'refund_status' column with these values
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'refunds' AND column_name = 'refund_status') THEN
        ALTER TABLE refunds ADD CONSTRAINT refunds_refund_status_check
        CHECK (refund_status IS NULL OR refund_status IN ('pending', 'processing', 'completed', 'failed'));
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9. Ensure cancellation_requests table has all expected columns
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cancellation_requests') THEN
        CREATE TABLE cancellation_requests (
            cancellation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID NOT NULL REFERENCES orders(order_id),
            requested_by UUID NOT NULL,
            requested_by_type TEXT NOT NULL CHECK (requested_by_type IN ('customer', 'garage', 'operations')),
            reason_code TEXT,
            reason_text TEXT,
            order_status_at_cancel TEXT,
            time_since_order_minutes INTEGER,
            cancellation_fee_rate DECIMAL(5,4),
            cancellation_fee DECIMAL(10,2) DEFAULT 0,
            refund_amount DECIMAL(10,2),
            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'rejected')),
            created_at TIMESTAMP DEFAULT NOW(),
            processed_at TIMESTAMP
        );
        CREATE INDEX idx_cancellation_requests_order ON cancellation_requests(order_id);
    END IF;
END $$;

-- Done!
SELECT 'Comprehensive constraint audit complete' as status;
