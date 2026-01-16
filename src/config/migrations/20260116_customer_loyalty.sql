-- Customer Loyalty & Rewards Program
-- Purpose: Points-based rewards system with tier benefits

-- 1. Create reward_tiers table (reference data)
CREATE TABLE IF NOT EXISTS reward_tiers (
    tier_name VARCHAR(20) PRIMARY KEY,
    min_points INTEGER NOT NULL,
    discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    priority_support BOOLEAN DEFAULT false,
    tier_badge_color VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tiers
INSERT INTO reward_tiers (tier_name, min_points, discount_percentage, priority_support, tier_badge_color) VALUES
('bronze', 0, 0, false, '#CD7F32'),
('silver', 1000, 5.00, false, '#C0C0C0'),
('gold', 3000, 10.00, true, '#FFD700'),
('platinum', 10000, 15.00, true, '#E5E4E2')
ON CONFLICT (tier_name) DO NOTHING;

-- 2. Create customer_rewards table
CREATE TABLE IF NOT EXISTS customer_rewards (
    reward_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES users(user_id) ON DELETE CASCADE UNIQUE,
    points_balance INTEGER DEFAULT 0 CHECK (points_balance >= 0),
    lifetime_points INTEGER DEFAULT 0,
    current_tier VARCHAR(20) DEFAULT 'bronze' REFERENCES reward_tiers(tier_name),
    tier_since TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_rewards_customer ON customer_rewards(customer_id);
CREATE INDEX idx_customer_rewards_tier ON customer_rewards(current_tier);

-- 3. Create reward_transactions table (audit log)
CREATE TABLE IF NOT EXISTS reward_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    points_change INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- earned, redeemed, expired, bonus, refunded
    order_id UUID REFERENCES orders(order_id),
    description TEXT,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reward_transactions_customer ON reward_transactions(customer_id, created_at DESC);
CREATE INDEX idx_reward_transactions_order ON reward_transactions(order_id);
CREATE INDEX idx_reward_transactions_type ON reward_transactions(transaction_type);

-- 4. Create function to calculate tier from points
CREATE OR REPLACE FUNCTION calculate_tier(p_points INTEGER)
RETURNS VARCHAR(20) AS $$
BEGIN
    IF p_points >= 10000 THEN RETURN 'platinum';
    ELSIF p_points >= 3000 THEN RETURN 'gold';
    ELSIF p_points >= 1000 THEN RETURN 'silver';
    ELSE RETURN 'bronze';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Create function to update customer tier
CREATE OR REPLACE FUNCTION update_customer_tier()
RETURNS TRIGGER AS $$
DECLARE
    new_tier VARCHAR(20);
    old_tier VARCHAR(20);
BEGIN
    new_tier := calculate_tier(NEW.lifetime_points);
    old_tier := NEW.current_tier;
    
    IF new_tier != old_tier THEN
        NEW.current_tier := new_tier;
        NEW.tier_since := NOW();
    END IF;
    
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to customer_rewards
DROP TRIGGER IF EXISTS trigger_update_tier ON customer_rewards;
CREATE TRIGGER trigger_update_tier
    BEFORE UPDATE ON customer_rewards
    FOR EACH ROW
    WHEN (OLD.lifetime_points IS DISTINCT FROM NEW.lifetime_points)
    EXECUTE FUNCTION update_customer_tier();

-- 6. Create function to add points (with transaction log)
CREATE OR REPLACE FUNCTION add_customer_points(
    p_customer_id UUID,
    p_points INTEGER,
    p_transaction_type VARCHAR(50),
    p_order_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
    new_balance INTEGER,
    new_tier VARCHAR(20)
) AS $$
DECLARE
    v_reward_id UUID;
    v_new_balance INTEGER;
    v_new_tier VARCHAR(20);
BEGIN
    -- Insert or get customer reward record
    INSERT INTO customer_rewards (customer_id, points_balance, lifetime_points)
    VALUES (p_customer_id, 0, 0)
    ON CONFLICT (customer_id) DO NOTHING
    RETURNING reward_id INTO v_reward_id;
    
    -- Update points
    UPDATE customer_rewards
    SET 
        points_balance = points_balance + p_points,
        lifetime_points = CASE 
            WHEN p_points > 0 THEN lifetime_points + p_points 
            ELSE lifetime_points 
        END,
        last_activity = NOW()
    WHERE customer_id = p_customer_id
    RETURNING points_balance, current_tier INTO v_new_balance, v_new_tier;
    
    -- Log transaction
    INSERT INTO reward_transactions (
        customer_id, points_change, transaction_type, 
        order_id, description, balance_after
    ) VALUES (
        p_customer_id, p_points, p_transaction_type,
        p_order_id, p_description, v_new_balance
    );
    
    RETURN QUERY SELECT v_new_balance, v_new_tier;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to redeem points for discount
CREATE OR REPLACE FUNCTION redeem_points_for_discount(
    p_customer_id UUID,
    p_points_to_redeem INTEGER
)
RETURNS TABLE (
    success BOOLEAN,
    discount_amount DECIMAL(10,2),
    new_balance INTEGER,
    message TEXT
) AS $$
DECLARE
    v_current_balance INTEGER;
    v_discount DECIMAL(10,2);
    v_new_balance INTEGER;
BEGIN
    -- Check current balance
    SELECT points_balance INTO v_current_balance
    FROM customer_rewards
    WHERE customer_id = p_customer_id;
    
    IF v_current_balance IS NULL THEN
        RETURN QUERY SELECT false, 0::DECIMAL, 0, 'No reward account found';
        RETURN;
    END IF;
    
    IF v_current_balance < p_points_to_redeem THEN
        RETURN QUERY SELECT false, 0::DECIMAL, v_current_balance, 'Insufficient points';
        RETURN;
    END IF;
    
    -- Calculate discount (100 points = 10 QAR)
    v_discount := (p_points_to_redeem / 100.0) * 10.0;
    
    -- Deduct points
    SELECT new_balance INTO v_new_balance
    FROM add_customer_points(
        p_customer_id,
        -p_points_to_redeem,
        'redeemed',
        NULL,
        format('Redeemed %s points for %s QAR discount', p_points_to_redeem, v_discount)
    );
    
    RETURN QUERY SELECT true, v_discount, v_new_balance, 'Points redeemed successfully';
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to get customer rewards summary
CREATE OR REPLACE FUNCTION get_customer_rewards_summary(p_customer_id UUID)
RETURNS TABLE (
    points_balance INTEGER,
    lifetime_points INTEGER,
    current_tier VARCHAR(20),
    discount_percentage DECIMAL(5,2),
    priority_support BOOLEAN,
    tier_badge_color VARCHAR(20),
    next_tier VARCHAR(20),
    points_to_next_tier INTEGER
) AS $$
DECLARE
    v_current_tier VARCHAR(20);
    v_lifetime_points INTEGER;
BEGIN
    SELECT cr.current_tier, cr.lifetime_points
    INTO v_current_tier, v_lifetime_points
    FROM customer_rewards cr
    WHERE cr.customer_id = p_customer_id;
    
    RETURN QUERY
    SELECT 
        cr.points_balance,
        cr.lifetime_points,
        cr.current_tier,
        rt.discount_percentage,
        rt.priority_support,
        rt.tier_badge_color,
        CASE 
            WHEN cr.current_tier = 'bronze' THEN 'silver'
            WHEN cr.current_tier = 'silver' THEN 'gold'
            WHEN cr.current_tier = 'gold' THEN 'platinum'
            ELSE 'platinum'
        END as next_tier,
        CASE 
            WHEN cr.current_tier = 'bronze' THEN GREATEST(0, 1000 - cr.lifetime_points)
            WHEN cr.current_tier = 'silver' THEN GREATEST(0, 3000 - cr.lifetime_points)
            WHEN cr.current_tier = 'gold' THEN GREATEST(0, 10000 - cr.lifetime_points)
            ELSE 0
        END as points_to_next_tier
    FROM customer_rewards cr
    JOIN reward_tiers rt ON cr.current_tier = rt.tier_name
    WHERE cr.customer_id = p_customer_id;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger to automatically award points on order completion
CREATE OR REPLACE FUNCTION award_points_on_order_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_points_earned INTEGER;
BEGIN
    -- Only award points when status changes to 'completed'
    IF NEW.order_status = 'completed' AND OLD.order_status != 'completed' THEN
        -- Calculate points: 1 point per 10 QAR
        v_points_earned := FLOOR(NEW.total_amount / 10);
        
        -- Award points
        PERFORM add_customer_points(
            NEW.customer_id,
            v_points_earned,
            'earned',
            NEW.order_id,
            format('Earned from Order #%s', NEW.order_number)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_award_points_on_completion ON orders;
CREATE TRIGGER trigger_award_points_on_completion
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION award_points_on_order_completion();

COMMENT ON TABLE customer_rewards IS 'Customer loyalty points and tier tracking';
COMMENT ON TABLE reward_transactions IS 'Audit log of all points transactions';
COMMENT ON TABLE reward_tiers IS 'Tier definitions with benefits';
COMMENT ON FUNCTION add_customer_points IS 'Add or deduct points with transaction logging';
COMMENT ON FUNCTION redeem_points_for_discount IS 'Redeem points for order discount';
