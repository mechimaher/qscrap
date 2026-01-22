-- Loyalty System Database Functions
-- Required for LoyaltyService.ts operations

-- ============================================
-- 1. GET CUSTOMER REWARDS SUMMARY
-- ============================================
CREATE OR REPLACE FUNCTION get_customer_rewards_summary(p_customer_id UUID)
RETURNS TABLE(
    points_balance INTEGER,
    lifetime_points INTEGER,
    current_tier VARCHAR(50),
    discount_percentage DECIMAL(5,2),
    priority_support BOOLEAN,
    tier_badge_color VARCHAR(50),
    next_tier VARCHAR(50),
    points_to_next_tier INTEGER
) AS $$
DECLARE
    v_points INTEGER;
    v_lifetime INTEGER;
    v_tier VARCHAR(50);
    v_discount DECIMAL(5,2);
    v_priority BOOLEAN;
    v_color VARCHAR(50);
BEGIN
    -- Get current points
    SELECT cr.points_balance, cr.lifetime_points
    INTO v_points, v_lifetime
    FROM customer_rewards cr
    WHERE cr.customer_id = p_customer_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Determine tier based on lifetime points
    SELECT rt.tier_name, rt.discount_percentage, rt.priority_support, rt.tier_badge_color
    INTO v_tier, v_discount, v_priority, v_color
    FROM reward_tiers rt
    WHERE rt.min_points <= COALESCE(v_lifetime, 0)
    ORDER BY rt.min_points DESC
    LIMIT 1;
    
    -- Default tier if none found
    IF v_tier IS NULL THEN
        v_tier := 'bronze';
        v_discount := 0;
        v_priority := false;
        v_color := '#CD7F32';
    END IF;
    
    RETURN QUERY
    SELECT 
        COALESCE(v_points, 0),
        COALESCE(v_lifetime, 0),
        v_tier,
        v_discount,
        v_priority,
        v_color,
        CASE v_tier
            WHEN 'bronze' THEN 'silver'
            WHEN 'silver' THEN 'gold'
            WHEN 'gold' THEN 'platinum'
            ELSE 'platinum'
        END::VARCHAR(50),
        CASE v_tier
            WHEN 'bronze' THEN 500 - COALESCE(v_lifetime, 0)
            WHEN 'silver' THEN 2000 - COALESCE(v_lifetime, 0)
            WHEN 'gold' THEN 5000 - COALESCE(v_lifetime, 0)
            ELSE 0
        END;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. ADD CUSTOMER POINTS
-- ============================================
CREATE OR REPLACE FUNCTION add_customer_points(
    p_customer_id UUID,
    p_points INTEGER,
    p_transaction_type VARCHAR(50),
    p_order_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE(
    new_balance INTEGER,
    new_tier VARCHAR(50)
) AS $$
DECLARE
    v_new_balance INTEGER;
    v_new_tier VARCHAR(50);
BEGIN
    -- Update customer points
    UPDATE customer_rewards
    SET 
        points_balance = points_balance + p_points,
        lifetime_points = lifetime_points + GREATEST(p_points, 0),
        updated_at = NOW()
    WHERE customer_id = p_customer_id
    RETURNING points_balance INTO v_new_balance;
    
    -- Create if not exists
    IF NOT FOUND THEN
        INSERT INTO customer_rewards (customer_id, points_balance, lifetime_points)
        VALUES (p_customer_id, p_points, GREATEST(p_points, 0))
        RETURNING points_balance INTO v_new_balance;
    END IF;
    
    -- Record transaction
    INSERT INTO reward_transactions (
        customer_id, 
        points_change, 
        transaction_type, 
        order_id, 
        description,
        balance_after
    ) VALUES (
        p_customer_id,
        p_points,
        p_transaction_type,
        p_order_id,
        p_description,
        v_new_balance
    );
    
    -- Determine new tier
    SELECT tier_name INTO v_new_tier
    FROM reward_tiers
    WHERE min_points <= (
        SELECT lifetime_points FROM customer_rewards WHERE customer_id = p_customer_id
    )
    ORDER BY min_points DESC
    LIMIT 1;
    
    RETURN QUERY SELECT v_new_balance, COALESCE(v_new_tier, 'bronze');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. REDEEM POINTS FOR DISCOUNT
-- ============================================
CREATE OR REPLACE FUNCTION redeem_points_for_discount(
    p_customer_id UUID,
    p_points_to_redeem INTEGER
)
RETURNS TABLE(
    success BOOLEAN,
    discount_amount DECIMAL(10,2),
    new_balance INTEGER,
    message TEXT
) AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_discount DECIMAL(10,2);
BEGIN
    -- Check current balance
    SELECT points_balance INTO v_current_balance
    FROM customer_rewards
    WHERE customer_id = p_customer_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0::DECIMAL(10,2), 0, 'Account not found'::TEXT;
        RETURN;
    END IF;
    
    IF v_current_balance < p_points_to_redeem THEN
        RETURN QUERY SELECT false, 0::DECIMAL(10,2), v_current_balance, 'Insufficient points'::TEXT;
        RETURN;
    END IF;
    
    -- Calculate discount (10 points = 1 QAR)
    v_discount := p_points_to_redeem / 10.0;
    
    -- Deduct points
    UPDATE customer_rewards
    SET 
        points_balance = points_balance - p_points_to_redeem,
        updated_at = NOW()
    WHERE customer_id = p_customer_id
    RETURNING points_balance INTO v_new_balance;
    
    -- Record redemption transaction
    INSERT INTO reward_transactions (
        customer_id,
        points_change,
        transaction_type,
        description,
        balance_after
    ) VALUES (
        p_customer_id,
        -p_points_to_redeem,
        'redemption',
        'Points redeemed for discount',
        v_new_balance
    );
    
    RETURN QUERY SELECT true, v_discount, v_new_balance, 'Points redeemed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. CREATE REWARD_TIERS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS reward_tiers (
    tier_id SERIAL PRIMARY KEY,
    tier_name VARCHAR(50) NOT NULL UNIQUE,
    min_points INTEGER NOT NULL DEFAULT 0,
    discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    priority_support BOOLEAN NOT NULL DEFAULT false,
    tier_badge_color VARCHAR(50) NOT NULL DEFAULT '#CD7F32',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default tiers if table is empty
INSERT INTO reward_tiers (tier_name, min_points, discount_percentage, priority_support, tier_badge_color)
SELECT * FROM (VALUES
    ('bronze', 0, 0, false, '#CD7F32'),
    ('silver', 500, 5, false, '#C0C0C0'),
    ('gold', 2000, 10, true, '#FFD700'),
    ('platinum', 5000, 15, true, '#E5E4E2')
) AS v(tier_name, min_points, discount_percentage, priority_support, tier_badge_color)
WHERE NOT EXISTS (SELECT 1 FROM reward_tiers LIMIT 1);

-- ============================================
-- 5. CREATE REWARD_TRANSACTIONS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS reward_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    points_change INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    order_id UUID,
    description TEXT,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reward_transactions_customer ON reward_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_reward_transactions_created ON reward_transactions(created_at DESC);

-- ============================================
-- 6. CREATE CUSTOMER_REWARDS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS customer_rewards (
    customer_id UUID PRIMARY KEY,
    points_balance INTEGER NOT NULL DEFAULT 0,
    lifetime_points INTEGER NOT NULL DEFAULT 0,
    current_tier VARCHAR(50) DEFAULT 'bronze',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
