-- ============================================================================
-- FREEMIUM REGISTRATION MODEL
-- New garages get Pay-Per-Sale (15% commission, $0/month) automatically
-- Garages can request plan upgrades anytime, admin approves
-- Feb 2, 2026
-- ============================================================================

-- Add preferred_plan_code column for plan requests
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'garages' AND column_name = 'preferred_plan_code'
    ) THEN
        ALTER TABLE garages ADD COLUMN preferred_plan_code VARCHAR(50);
        COMMENT ON COLUMN garages.preferred_plan_code IS 'Plan tier garage is interested in upgrading to';
    END IF;
END $$;

-- Add current_plan_code for active subscription  
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'garages' AND column_name = 'current_plan_code'
    ) THEN
        ALTER TABLE garages ADD COLUMN current_plan_code VARCHAR(50) DEFAULT 'free';
        COMMENT ON COLUMN garages.current_plan_code IS 'Current active subscription plan';
    END IF;
END $$;

-- Ensure all 4 subscription tiers exist with correct pricing
-- Note: commission_rate is decimal (0.15 = 15%)
INSERT INTO subscription_plans (plan_code, plan_name, monthly_fee, commission_rate, max_bids_per_month, features, is_active)
VALUES 
    ('free', 'Pay-Per-Sale', 0, 0.15, NULL, 
     '{"zero_monthly": true, "all_customers": true, "standard_dashboard": true, "email_support": true, "7_day_payout": true}', true),
    ('starter', 'Starter', 299, 0.08, NULL, 
     '{"monthly_fee": 299, "priority_listing": true, "basic_analytics": true, "email_chat_support": true, "7_day_payout": true, "showcase_20_products": true}', true),
    ('gold', 'Gold Partner', 999, 0.05, NULL, 
     '{"monthly_fee": 999, "priority_listing": true, "advanced_analytics": true, "priority_phone_support": true, "priority_payout": true, "promotional_features": true}', true),
    ('platinum', 'Platinum Partner', 2499, 0.03, NULL, 
     '{"monthly_fee": 2499, "featured_placement": true, "dedicated_manager": true, "custom_reports": true, "express_payout": true, "marketing_coinvest": true}', true)
ON CONFLICT (plan_code) DO UPDATE SET
    plan_name = EXCLUDED.plan_name,
    monthly_fee = EXCLUDED.monthly_fee,
    commission_rate = EXCLUDED.commission_rate,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active;

-- Set default plan for existing approved garages without a plan
UPDATE garages 
SET current_plan_code = 'free' 
WHERE current_plan_code IS NULL 
  AND approval_status IN ('approved', 'demo');

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Migration complete: Freemium model enabled - Pay-Per-Sale as permanent free tier';
END $$;
