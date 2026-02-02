-- ============================================
-- Unified Pricing Model Migration (SAFE)
-- Feb 2, 2026 - Updates existing plans in-place
-- ============================================

-- 1. Update existing starter plan to match unified pricing
UPDATE subscription_plans SET 
    plan_name = 'Starter',
    monthly_price_qar = 299,
    annual_price_qar = 2990,
    max_monthly_orders = 100,
    features_json = '{"commission_rate": 0.08, "bid_limit_per_day": 50, "showcase_products": 20, "featured_listing": false, "priority_listing": true}'::jsonb
WHERE plan_code = 'starter';

-- 2. Update professional to Gold (or create if not exists)
UPDATE subscription_plans SET 
    plan_code = 'gold',
    plan_name = 'Gold Partner',
    monthly_price_qar = 999,
    annual_price_qar = 9990,
    max_monthly_orders = 500,
    analytics_enabled = true,
    priority_support = true,
    features_json = '{"commission_rate": 0.05, "bid_limit_per_day": 200, "showcase_products": 100, "featured_listing": true, "analytics_retention_days": 180}'::jsonb
WHERE plan_code = 'professional';

-- If no professional exists, insert Gold
INSERT INTO subscription_plans (
    plan_code, plan_name, monthly_price_qar, annual_price_qar,
    max_monthly_orders, analytics_enabled, priority_support,
    features_json, display_order
) VALUES (
    'gold', 'Gold Partner', 999, 9990, 500, true, true,
    '{"commission_rate": 0.05, "bid_limit_per_day": 200, "showcase_products": 100, "featured_listing": true}'::jsonb, 2
) ON CONFLICT (plan_code) DO NOTHING;

-- 3. Update enterprise to Platinum (or create if not exists)
UPDATE subscription_plans SET 
    plan_code = 'platinum',
    plan_name = 'Platinum Partner',
    monthly_price_qar = 2499,
    annual_price_qar = 24990,
    max_monthly_orders = -1,
    analytics_enabled = true,
    priority_support = true,
    api_access = true,
    features_json = '{"commission_rate": 0.03, "bid_limit_per_day": -1, "showcase_products": -1, "featured_listing": true, "dedicated_account_manager": true}'::jsonb
WHERE plan_code = 'enterprise';

-- If no enterprise exists, insert Platinum
INSERT INTO subscription_plans (
    plan_code, plan_name, monthly_price_qar, annual_price_qar,
    max_monthly_orders, analytics_enabled, priority_support, api_access,
    features_json, display_order
) VALUES (
    'platinum', 'Platinum Partner', 2499, 24990, -1, true, true, true,
    '{"commission_rate": 0.03, "bid_limit_per_day": -1, "showcase_products": -1, "featured_listing": true, "dedicated_account_manager": true}'::jsonb, 3
) ON CONFLICT (plan_code) DO NOTHING;

-- 4. Verify the update
SELECT plan_code, plan_name, monthly_price_qar, 
       (features_json->>'commission_rate')::decimal as commission_rate
FROM subscription_plans 
ORDER BY display_order;
