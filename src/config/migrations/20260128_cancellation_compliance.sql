-- Migration: 20260128_cancellation_compliance.sql
-- Purpose: Add tables required for BRAIN-compliant cancellation/refund system
-- Created: 2026-01-28
-- Reference: Cancellation-Refund-BRAIN.md v3.0 FINAL

DO $$
BEGIN
    -- ========================================
    -- 1. return_requests table (7-day return window)
    -- ========================================
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'return_requests') THEN
        CREATE TABLE return_requests (
            return_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID NOT NULL REFERENCES orders(order_id),
            customer_id UUID NOT NULL REFERENCES users(user_id),
            reason VARCHAR(50) NOT NULL,
            photo_urls TEXT[],
            condition_description TEXT,
            return_fee NUMERIC(10,2) DEFAULT 0,
            delivery_fee_retained NUMERIC(10,2) DEFAULT 0,
            refund_amount NUMERIC(10,2),
            status VARCHAR(20) DEFAULT 'pending',
            pickup_driver_id UUID REFERENCES drivers(driver_id),
            admin_notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            processed_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT return_requests_reason_check CHECK (reason IN ('unused', 'defective', 'wrong_part')),
            CONSTRAINT return_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'pickup_scheduled', 'picked_up', 'inspected', 'completed'))
        );

        CREATE INDEX idx_return_requests_order ON return_requests(order_id);
        CREATE INDEX idx_return_requests_customer ON return_requests(customer_id);
        CREATE INDEX idx_return_requests_status ON return_requests(status);

        RAISE NOTICE 'Created return_requests table';
    END IF;

    -- ========================================
    -- 2. garage_penalties table
    -- ========================================
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'garage_penalties') THEN
        CREATE TABLE garage_penalties (
            penalty_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            garage_id UUID NOT NULL REFERENCES garages(garage_id),
            order_id UUID REFERENCES orders(order_id),
            penalty_type VARCHAR(30) NOT NULL,
            amount NUMERIC(10,2) NOT NULL,
            reason TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            deducted_from_payout_id UUID REFERENCES garage_payouts(payout_id),
            waived_by UUID REFERENCES users(user_id),
            waived_at TIMESTAMP WITH TIME ZONE,
            waiver_reason TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT garage_penalties_type_check CHECK (penalty_type IN ('cancellation', 'repeat_cancellation', 'wrong_part', 'damaged_part', 'out_of_stock')),
            CONSTRAINT garage_penalties_status_check CHECK (status IN ('pending', 'deducted', 'waived'))
        );

        CREATE INDEX idx_garage_penalties_garage ON garage_penalties(garage_id);
        CREATE INDEX idx_garage_penalties_status ON garage_penalties(status);
        CREATE INDEX idx_garage_penalties_created ON garage_penalties(created_at);

        RAISE NOTICE 'Created garage_penalties table';
    END IF;

    -- ========================================
    -- 3. customer_abuse_tracking table
    -- ========================================
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_abuse_tracking') THEN
        CREATE TABLE customer_abuse_tracking (
            tracking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID NOT NULL REFERENCES users(user_id),
            month_year VARCHAR(7) NOT NULL, -- e.g., '2026-01'
            returns_count INTEGER DEFAULT 0,
            defective_claims_count INTEGER DEFAULT 0,
            cancellations_count INTEGER DEFAULT 0,
            flag_level VARCHAR(10) DEFAULT 'none',
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(customer_id, month_year),
            CONSTRAINT abuse_flag_check CHECK (flag_level IN ('none', 'yellow', 'orange', 'red', 'black'))
        );

        CREATE INDEX idx_abuse_tracking_customer ON customer_abuse_tracking(customer_id);
        CREATE INDEX idx_abuse_tracking_month ON customer_abuse_tracking(month_year);

        RAISE NOTICE 'Created customer_abuse_tracking table';
    END IF;

    -- ========================================
    -- 4. delivery_vouchers table
    -- ========================================
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_vouchers') THEN
        CREATE TABLE delivery_vouchers (
            voucher_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID NOT NULL REFERENCES users(user_id),
            order_id UUID REFERENCES orders(order_id),
            amount NUMERIC(10,2) NOT NULL,
            reason VARCHAR(100),
            code VARCHAR(20) UNIQUE,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            used_at TIMESTAMP WITH TIME ZONE,
            used_on_order_id UUID REFERENCES orders(order_id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT voucher_amount_check CHECK (amount > 0 AND amount <= 50)
        );

        CREATE INDEX idx_vouchers_customer ON delivery_vouchers(customer_id);
        CREATE INDEX idx_vouchers_expires ON delivery_vouchers(expires_at);

        RAISE NOTICE 'Created delivery_vouchers table';
    END IF;

    -- ========================================
    -- 5. Add missing columns to refunds table
    -- ========================================
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'refund_type') THEN
        ALTER TABLE refunds ADD COLUMN refund_type VARCHAR(30);
        RAISE NOTICE 'Added refund_type to refunds table';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'delivery_fee_retained') THEN
        ALTER TABLE refunds ADD COLUMN delivery_fee_retained NUMERIC(10,2) DEFAULT 0;
        RAISE NOTICE 'Added delivery_fee_retained to refunds table';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'stripe_refund_id') THEN
        ALTER TABLE refunds ADD COLUMN stripe_refund_id VARCHAR(100);
        RAISE NOTICE 'Added stripe_refund_id to refunds table';
    END IF;

    -- ========================================
    -- 6. Add cancellation tracking to garages
    -- ========================================
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'garages' AND column_name = 'cancellations_this_month') THEN
        ALTER TABLE garages ADD COLUMN cancellations_this_month INTEGER DEFAULT 0;
        ALTER TABLE garages ADD COLUMN last_cancellation_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added cancellation tracking to garages table';
    END IF;

    RAISE NOTICE 'Migration 20260128_cancellation_compliance completed successfully';
END $$;

-- Record migration
INSERT INTO migrations (name) VALUES ('20260128_cancellation_compliance')
ON CONFLICT DO NOTHING;
