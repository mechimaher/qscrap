-- QScrap Escrow Payment System
-- Holds funds until buyer confirms receipt or inspection window expires
-- Supports dispute resolution and automated releases

-- ============================================
-- ESCROW TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS escrow_transactions (
    escrow_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(user_id),
    seller_id UUID NOT NULL REFERENCES users(user_id),
    
    -- Financial
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    seller_payout DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'held' CHECK (status IN (
        'held',           -- Funds held in escrow
        'released',       -- Released to seller
        'refunded',       -- Refunded to buyer
        'disputed',       -- Under dispute
        'partial_release' -- Split between parties
    )),
    
    -- Inspection Window
    inspection_window_hours INTEGER DEFAULT 48,
    inspection_expires_at TIMESTAMP WITH TIME ZONE,
    buyer_confirmed_at TIMESTAMP WITH TIME ZONE,
    
    -- Release Tracking
    released_at TIMESTAMP WITH TIME ZONE,
    released_by UUID REFERENCES users(user_id),
    release_reason VARCHAR(100),
    
    -- Dispute
    dispute_raised_at TIMESTAMP WITH TIME ZONE,
    dispute_reason TEXT,
    dispute_resolved_at TIMESTAMP WITH TIME ZONE,
    dispute_resolution TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PROOF OF CONDITION CAPTURES
-- ============================================
CREATE TABLE IF NOT EXISTS proof_of_condition (
    proof_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_id UUID NOT NULL REFERENCES escrow_transactions(escrow_id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(order_id),
    
    -- Capture Type
    capture_type VARCHAR(30) NOT NULL CHECK (capture_type IN (
        'pickup_from_garage',    -- When item leaves garage
        'delivery_handoff',      -- When delivered to customer
        'customer_inspection',   -- Customer's own photos
        'dispute_evidence'       -- Evidence for dispute
    )),
    
    -- Media
    image_urls TEXT[] NOT NULL,
    video_url TEXT,
    thumbnail_url TEXT,
    
    -- Metadata
    captured_by UUID REFERENCES users(user_id),
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    location_lat DECIMAL(10,8),
    location_lng DECIMAL(11,8),
    device_info JSONB,
    
    -- Verification
    hash_signature VARCHAR(64),  -- SHA-256 of first image for tampering detection
    verified BOOLEAN DEFAULT false,
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ESCROW RELEASE RULES
-- ============================================
CREATE TABLE IF NOT EXISTS escrow_release_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    
    -- Conditions
    condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN (
        'buyer_confirmation',     -- Buyer explicitly confirms
        'inspection_window_expired', -- Time-based auto-release
        'dispute_resolved',       -- After dispute resolution
        'admin_override'          -- Manual admin action
    )),
    
    -- Actions
    release_to VARCHAR(20) DEFAULT 'seller' CHECK (release_to IN ('seller', 'buyer', 'split')),
    seller_percentage DECIMAL(5,2) DEFAULT 100,
    
    -- Timing
    delay_hours INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_escrow_order ON escrow_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_customer ON escrow_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_seller ON escrow_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_transactions(status);
CREATE INDEX IF NOT EXISTS idx_escrow_expires ON escrow_transactions(inspection_expires_at) WHERE status = 'held';
CREATE INDEX IF NOT EXISTS idx_proof_escrow ON proof_of_condition(escrow_id);
CREATE INDEX IF NOT EXISTS idx_proof_order ON proof_of_condition(order_id);

-- ============================================
-- AUTO-RELEASE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION auto_release_expired_escrow()
RETURNS INTEGER AS $$
DECLARE
    released_count INTEGER := 0;
BEGIN
    -- Release escrow where inspection window expired and buyer didn't dispute
    UPDATE escrow_transactions
    SET 
        status = 'released',
        released_at = NOW(),
        release_reason = 'inspection_window_expired',
        updated_at = NOW()
    WHERE 
        status = 'held'
        AND inspection_expires_at < NOW()
        AND dispute_raised_at IS NULL;
    
    GET DIAGNOSTICS released_count = ROW_COUNT;
    RETURN released_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ESCROW CREATION TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION set_escrow_inspection_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.inspection_expires_at IS NULL THEN
        NEW.inspection_expires_at := NOW() + (NEW.inspection_window_hours || ' hours')::INTERVAL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_escrow_expiry ON escrow_transactions;
CREATE TRIGGER trigger_set_escrow_expiry
    BEFORE INSERT ON escrow_transactions
    FOR EACH ROW
    EXECUTE FUNCTION set_escrow_inspection_expiry();

-- ============================================
-- DEFAULT RELEASE RULES
-- ============================================
INSERT INTO escrow_release_rules (rule_name, description, condition_type, release_to, seller_percentage)
VALUES 
    ('buyer_confirms', 'Buyer confirms receipt and satisfaction', 'buyer_confirmation', 'seller', 100),
    ('auto_release_48h', 'Auto-release after 48-hour inspection window', 'inspection_window_expired', 'seller', 100),
    ('dispute_buyer_wins', 'Dispute resolved in buyer favor', 'dispute_resolved', 'buyer', 100),
    ('dispute_seller_wins', 'Dispute resolved in seller favor', 'dispute_resolved', 'seller', 100),
    ('dispute_split', 'Dispute resolved with split refund', 'dispute_resolved', 'split', 50)
ON CONFLICT (rule_name) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE escrow_transactions IS 'Holds payment funds until buyer confirmation or inspection window expires';
COMMENT ON TABLE proof_of_condition IS 'Timestamped photo/video evidence of part condition at each handoff';
COMMENT ON TABLE escrow_release_rules IS 'Configurable rules for automatic and manual escrow releases';
COMMENT ON FUNCTION auto_release_expired_escrow IS 'Called by cron to release escrow after inspection window';
