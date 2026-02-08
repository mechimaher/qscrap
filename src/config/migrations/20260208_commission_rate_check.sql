-- Migration: Add CHECK constraint for commission_rate (MOCI 15% cap)
-- Date: 2026-02-08
-- Finding: P-3 from Expert Review — defense-in-depth for MOCI compliance

-- Orders table: commission_rate must be between 0% and 15%
ALTER TABLE orders
    ADD CONSTRAINT orders_commission_rate_range
    CHECK (commission_rate >= 0 AND commission_rate <= 0.15);

-- Subscription plans table: commission_rate must be between 0% and 15%
ALTER TABLE subscription_plans
    ADD CONSTRAINT subscription_plans_commission_rate_range
    CHECK (commission_rate >= 0 AND commission_rate <= 0.15);

-- Note: Migration tracking handled automatically by scripts/migrate.js
