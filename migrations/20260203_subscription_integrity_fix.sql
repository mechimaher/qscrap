-- ============================================
-- SUBSCRIPTION STATUS INTEGRITY FIX
-- Enterprise-grade data cleanup and constraints
-- ============================================

-- Step 1: Clean up stale/conflicting subscription records
-- When a garage is in 'demo' status, any active paid subscriptions should be cancelled

BEGIN;

-- Cancel any active subscriptions for demo garages (stale data cleanup)
UPDATE garage_subscriptions gs
SET 
    status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = 'Data integrity fix: Garage was in demo status with conflicting subscription',
    updated_at = NOW()
FROM garages g
WHERE 
    gs.garage_id = g.garage_id
    AND g.approval_status = 'demo'
    AND gs.status IN ('active', 'trial', 'past_due');

-- Cancel any active subscriptions for pending/rejected garages
UPDATE garage_subscriptions gs
SET 
    status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = 'Data integrity fix: Garage was pending/rejected with conflicting subscription',
    updated_at = NOW()
FROM garages g
WHERE 
    gs.garage_id = g.garage_id
    AND g.approval_status IN ('pending', 'rejected')
    AND gs.status IN ('active', 'trial', 'past_due');

-- Step 2: Ensure current_plan_code matches approval_status for demo garages
UPDATE garages
SET 
    current_plan_code = 'free',
    updated_at = NOW()
WHERE 
    approval_status = 'demo'
    AND current_plan_code != 'free';

-- Step 3: Ensure current_plan_code matches approval_status for pending/rejected garages
UPDATE garages
SET 
    current_plan_code = 'free',
    updated_at = NOW()
WHERE 
    approval_status IN ('pending', 'rejected')
    AND current_plan_code IS DISTINCT FROM 'free';

COMMIT;

-- Step 4: Add comment documenting the subscription status hierarchy
COMMENT ON COLUMN garages.approval_status IS 'AUTHORITATIVE status: pending|demo|approved|rejected. Demo takes precedence over subscription for plan display.';
COMMENT ON COLUMN garages.current_plan_code IS 'Current subscription plan code. Must be "free" when approval_status is demo/pending/rejected.';

-- Step 5: Create a function to enforce subscription integrity
CREATE OR REPLACE FUNCTION enforce_subscription_integrity()
RETURNS TRIGGER AS $$
BEGIN
    -- When garage status changes to demo, pending, or rejected, cancel active subscriptions
    IF NEW.approval_status IN ('demo', 'pending', 'rejected') AND 
       (OLD.approval_status IS NULL OR OLD.approval_status NOT IN ('demo', 'pending', 'rejected')) THEN
        
        -- Cancel any active subscriptions
        UPDATE garage_subscriptions 
        SET 
            status = 'cancelled',
            cancelled_at = NOW(),
            cancellation_reason = 'Auto-cancelled: Garage status changed to ' || NEW.approval_status,
            updated_at = NOW()
        WHERE 
            garage_id = NEW.garage_id 
            AND status IN ('active', 'trial', 'past_due');
        
        -- Force current_plan_code to 'free'
        NEW.current_plan_code := 'free';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create the trigger (drop if exists first)
DROP TRIGGER IF EXISTS trg_enforce_subscription_integrity ON garages;

CREATE TRIGGER trg_enforce_subscription_integrity
BEFORE UPDATE ON garages
FOR EACH ROW
EXECUTE FUNCTION enforce_subscription_integrity();

-- Log this fix in admin_audit_log
INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, new_value)
SELECT 
    (SELECT user_id FROM users WHERE user_type = 'staff' LIMIT 1),
    'data_integrity_fix',
    'system',
    'subscription_status_cleanup',
    jsonb_build_object(
        'description', 'Enterprise subscription integrity fix',
        'fixed_at', NOW(),
        'changes', 'Cancelled stale subscriptions for demo/pending garages, added trigger for future integrity'
    )::text
WHERE EXISTS (SELECT 1 FROM users WHERE user_type = 'staff');
