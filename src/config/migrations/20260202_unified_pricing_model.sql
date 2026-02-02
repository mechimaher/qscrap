-- ============================================
-- Unified Pricing Model Migration
-- Feb 2, 2026 - Aligns DB with QScrap Brain
-- ============================================

-- 1. Update subscription_plans to match unified pricing
-- Note: This creates/updates the authoritative tier structure

-- Delete old plans and recreate with unified structure
DELETE FROM subscription_plans WHERE plan_code IN ('starter', 'professional', 'enterprise');

-- Insert unified pricing tiers
INSERT INTO subscription_plans (
    plan_code, plan_name, monthly_price_qar, annual_price_qar,
    max_monthly_orders, analytics_enabled, priority_support,
    api_access, ad_campaigns_allowed, max_team_members,
    features_json, display_order
) VALUES
-- Starter Tier: 299 QR/month, 8% commission
('starter', 'Starter', 299, 2990, 100, false, false, false, true, 2,
 '{"commission_rate": 0.08, "bid_limit_per_day": 50, "showcase_products": 20, "featured_listing": false, "priority_listing": true}'::jsonb, 1),

-- Gold Tier: 999 QR/month, 5% commission  
('gold', 'Gold Partner', 999, 9990, 500, true, true, false, true, 5,
 '{"commission_rate": 0.05, "bid_limit_per_day": 200, "showcase_products": 100, "featured_listing": true, "analytics_retention_days": 180}'::jsonb, 2),

-- Platinum Tier: 2499 QR/month, 3% commission
('platinum', 'Platinum Partner', 2499, 24990, -1, true, true, true, true, 15,
 '{"commission_rate": 0.03, "bid_limit_per_day": -1, "showcase_products": -1, "featured_listing": true, "analytics_retention_days": 365, "dedicated_account_manager": true, "marketing_co_investment": true}'::jsonb, 3)
ON CONFLICT (plan_code) DO UPDATE SET
    plan_name = EXCLUDED.plan_name,
    monthly_price_qar = EXCLUDED.monthly_price_qar,
    annual_price_qar = EXCLUDED.annual_price_qar,
    max_monthly_orders = EXCLUDED.max_monthly_orders,
    analytics_enabled = EXCLUDED.analytics_enabled,
    priority_support = EXCLUDED.priority_support,
    api_access = EXCLUDED.api_access,
    ad_campaigns_allowed = EXCLUDED.ad_campaigns_allowed,
    max_team_members = EXCLUDED.max_team_members,
    features_json = EXCLUDED.features_json;

-- 2. Verify the update
SELECT plan_code, plan_name, monthly_price_qar, 
       (features_json->>'commission_rate')::decimal as commission_rate
FROM subscription_plans 
ORDER BY display_order;
