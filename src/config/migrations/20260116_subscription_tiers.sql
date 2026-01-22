-- Premium Subscription System
-- Purpose: Tiered subscription plans with feature gating

-- 1. Create subscription_plans table (reference data)
CREATE TABLE IF NOT EXISTS IF NOT EXISTS subscription_plans (
    plan_code VARCHAR(20) PRIMARY KEY,
    plan_name VARCHAR(50) NOT NULL,
    monthly_price_qar DECIMAL(10,2) NOT NULL,
    annual_price_qar DECIMAL(10,2) NOT NULL,
    max_monthly_orders INTEGER,
    analytics_enabled BOOLEAN DEFAULT false,
    priority_support BOOLEAN DEFAULT false,
    api_access BOOLEAN DEFAULT false,
    ad_campaigns_allowed BOOLEAN DEFAULT false,
    max_team_members INTEGER DEFAULT 1,
    features_json JSONB,
    display_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert subscription tiers
INSERT INTO subscription_plans (
    plan_code, plan_name, monthly_price_qar, annual_price_qar,
    max_monthly_orders, analytics_enabled, priority_support,
    api_access, ad_campaigns_allowed, max_team_members,
    features_json, display_order
) VALUES
('starter', 'Starter', 0, 0, 50, false, false, false, false, 1,
 '{"bid_limit_per_day": 20, "showcase_products": 5, "featured_listing": false}'::jsonb, 1),
 
('professional', 'Professional', 299, 2990, 200, true, false, false, true, 3,
 '{"bid_limit_per_day": 100, "showcase_products": 50, "featured_listing": true, "analytics_retention_days": 90}'::jsonb, 2),
 
('enterprise', 'Enterprise', 799, 7990, -1, true, true, true, true, 10,
 '{"bid_limit_per_day": -1, "showcase_products": -1, "featured_listing": true, "analytics_retention_days": 365, "custom_branding": true, "dedicated_support": true}'::jsonb, 3)
ON CONFLICT (plan_code) DO UPDATE SET
    monthly_price_qar = EXCLUDED.monthly_price_qar,
    annual_price_qar = EXCLUDED.annual_price_qar,
    max_monthly_orders = EXCLUDED.max_monthly_orders,
    analytics_enabled = EXCLUDED.analytics_enabled,
    priority_support = EXCLUDED.priority_support,
    api_access = EXCLUDED.api_access,
    ad_campaigns_allowed = EXCLUDED.ad_campaigns_allowed,
    max_team_members = EXCLUDED.max_team_members,
    features_json = EXCLUDED.features_json;

-- 2. Add subscription fields to garages table (if not exists)
ALTER TABLE garages 
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) DEFAULT 'starter' REFERENCES subscription_plans(plan_code),
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(10) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true;

-- Create index for subscription queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_garages_subscription ON garages(subscription_plan, subscription_end_date);

-- 3. Create subscription_history table (audit trail)
CREATE TABLE IF NOT EXISTS IF NOT EXISTS subscription_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID REFERENCES garages(garage_id) ON DELETE CASCADE,
    old_plan VARCHAR(20) REFERENCES subscription_plans(plan_code),
    new_plan VARCHAR(20) REFERENCES subscription_plans(plan_code),
    change_reason VARCHAR(50), -- upgrade, downgrade, renewal, cancellation
    changed_by UUID REFERENCES users(user_id),
    price_paid DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_garage ON subscription_history(garage_id, created_at DESC);

-- 4. Function to check feature access
CREATE OR REPLACE FUNCTION check_feature_access(
    p_garage_id UUID,
    p_feature VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_plan_code VARCHAR(20);
    v_plan_features JSONB;
    v_has_access BOOLEAN;
BEGIN
    -- Get garage's current plan
    SELECT subscription_plan INTO v_plan_code
    FROM garages
    WHERE garage_id = p_garage_id;
    
    -- Check against plan features
    IF p_feature = 'analytics' THEN
        SELECT analytics_enabled INTO v_has_access
        FROM subscription_plans
        WHERE plan_code = v_plan_code;
    ELSIF p_feature = 'api_access' THEN
        SELECT api_access INTO v_has_access
        FROM subscription_plans
        WHERE plan_code = v_plan_code;
    ELSIF p_feature = 'ad_campaigns' THEN
        SELECT ad_campaigns_allowed INTO v_has_access
        FROM subscription_plans
        WHERE plan_code = v_plan_code;
    ELSIF p_feature = 'priority_support' THEN
        SELECT priority_support INTO v_has_access
        FROM subscription_plans
        WHERE plan_code = v_plan_code;
    ELSE
        v_has_access := false;
    END IF;
    
    RETURN COALESCE(v_has_access, false);
END;
$$ LANGUAGE plpgsql;

-- 5. Function to upgrade/downgrade subscription
CREATE OR REPLACE FUNCTION change_subscription(
    p_garage_id UUID,
    p_new_plan VARCHAR(20),
    p_billing_cycle VARCHAR(10),
    p_changed_by UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    price DECIMAL(10,2)
) AS $$
DECLARE
    v_old_plan VARCHAR(20);
    v_price DECIMAL(10,2);
BEGIN
    -- Get current plan
    SELECT subscription_plan INTO v_old_plan
    FROM garages
    WHERE garage_id = p_garage_id;
    
    -- Get new plan price
    IF p_billing_cycle = 'annual' THEN
        SELECT annual_price_qar INTO v_price
        FROM subscription_plans
        WHERE plan_code = p_new_plan;
    ELSE
        SELECT monthly_price_qar INTO v_price
        FROM subscription_plans
        WHERE plan_code = p_new_plan;
    END IF;
    
    -- Update garage subscription
    UPDATE garages
    SET subscription_plan = p_new_plan,
        billing_cycle = p_billing_cycle,
        subscription_start_date = NOW(),
        subscription_end_date = CASE
            WHEN p_billing_cycle = 'annual' THEN NOW() + INTERVAL '1 year'
            ELSE NOW() + INTERVAL '1 month'
        END
    WHERE garage_id = p_garage_id;
    
    -- Log the change
    INSERT INTO subscription_history (
        garage_id, old_plan, new_plan, 
        change_reason, changed_by, price_paid
    ) VALUES (
        p_garage_id, v_old_plan, p_new_plan,
        CASE 
            WHEN v_old_plan = 'starter' AND p_new_plan != 'starter' THEN 'upgrade'
            WHEN v_old_plan != 'starter' AND p_new_plan = 'starter' THEN 'downgrade'
            WHEN v_old_plan = p_new_plan THEN 'renewal'
            ELSE 'change'
        END,
        p_changed_by, v_price
    );
    
    RETURN QUERY SELECT true, 'Subscription updated successfully', v_price;
END;
$$ LANGUAGE plpgsql;

-- 6. Function to get subscription details
CREATE OR REPLACE FUNCTION get_subscription_details(p_garage_id UUID)
RETURNS TABLE (
    current_plan VARCHAR,
    plan_name VARCHAR,
    monthly_price DECIMAL,
    annual_price DECIMAL,
    billing_cycle VARCHAR,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    days_remaining INTEGER,
    analytics_enabled BOOLEAN,
    priority_support BOOLEAN,
    api_access BOOLEAN,
    ad_campaigns_allowed BOOLEAN,
    max_team_members INTEGER,
    features JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.subscription_plan,
        sp.plan_name,
        sp.monthly_price_qar,
        sp.annual_price_qar,
        g.billing_cycle,
        g.subscription_start_date,
        g.subscription_end_date,
        CASE 
            WHEN g.subscription_end_date IS NOT NULL 
            THEN EXTRACT(DAY FROM (g.subscription_end_date - NOW()))::INTEGER
            ELSE NULL
        END as days_remaining,
        sp.analytics_enabled,
        sp.priority_support,
        sp.api_access,
        sp.ad_campaigns_allowed,
        sp.max_team_members,
        sp.features_json
    FROM garages g
    JOIN subscription_plans sp ON g.subscription_plan = sp.plan_code
    WHERE g.garage_id = p_garage_id;
END;
$$ LANGUAGE plpgsql;

-- 7. View for subscription revenue analytics
CREATE OR REPLACE VIEW subscription_revenue_stats AS
SELECT 
    sp.plan_code,
    sp.plan_name,
    COUNT(g.garage_id) as active_subscriptions,
    SUM(CASE 
        WHEN g.billing_cycle = 'monthly' THEN sp.monthly_price_qar
        ELSE sp.annual_price_qar / 12
    END) as monthly_recurring_revenue,
    AVG(CASE 
        WHEN g.billing_cycle = 'monthly' THEN sp.monthly_price_qar
        ELSE sp.annual_price_qar
    END) as avg_subscription_value
FROM subscription_plans sp
LEFT JOIN garages g ON sp.plan_code = g.subscription_plan
WHERE sp.active = true
GROUP BY sp.plan_code, sp.plan_name, sp.display_order
ORDER BY sp.display_order;

COMMENT ON TABLE subscription_plans IS 'Subscription tier definitions with features and pricing';
COMMENT ON TABLE subscription_history IS 'Audit log of subscription changes';
COMMENT ON FUNCTION check_feature_access IS 'Check if garage has access to specific feature';
COMMENT ON FUNCTION change_subscription IS 'Upgrade or downgrade garage subscription';
