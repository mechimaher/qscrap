-- ============================================
-- Demo Trial Bid Permission Fix
-- Allows demo garages to bid without subscription
-- Created: 2024-12-24
-- ============================================

-- Update the check_garage_can_bid function to support demo trial from garages table
CREATE OR REPLACE FUNCTION check_garage_can_bid()
RETURNS TRIGGER AS $$
DECLARE
    sub_record RECORD;
    garage_record RECORD;
BEGIN
    -- First check garage approval status for demo/expired
    SELECT approval_status, demo_expires_at
    INTO garage_record
    FROM garages
    WHERE garage_id = NEW.garage_id;
    
    -- Block expired garages
    IF garage_record.approval_status = 'expired' THEN
        RAISE EXCEPTION 'Your demo trial has expired. Please upgrade to a subscription to continue bidding.';
    END IF;
    
    -- Allow demo garages with valid demo period (unlimited bids)
    IF garage_record.approval_status = 'demo' THEN
        IF garage_record.demo_expires_at IS NOT NULL AND garage_record.demo_expires_at > NOW() THEN
            RETURN NEW;  -- Demo is valid, allow bid without subscription check
        ELSE
            -- Demo expired, update status and block
            UPDATE garages SET approval_status = 'expired' WHERE garage_id = NEW.garage_id;
            RAISE EXCEPTION 'Your demo trial has expired. Please upgrade to a subscription to continue bidding.';
        END IF;
    END IF;
    
    -- For non-demo garages, check subscription
    SELECT gs.*, sp.max_bids_per_month, COALESCE(sp.plan_name, 'Free Trial') as plan_name
    INTO sub_record
    FROM garage_subscriptions gs
    LEFT JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
    WHERE gs.garage_id = NEW.garage_id
    AND gs.status IN ('active', 'trial')
    AND gs.billing_cycle_end >= CURRENT_DATE
    ORDER BY gs.created_at DESC
    LIMIT 1;
    
    IF sub_record.subscription_id IS NULL THEN
        RAISE EXCEPTION 'No active subscription. Please subscribe to bid on requests.';
    END IF;
    
    -- Check bid limits (NULL = unlimited)
    IF sub_record.max_bids_per_month IS NOT NULL THEN
        IF sub_record.bids_used_this_cycle >= sub_record.max_bids_per_month THEN
            RAISE EXCEPTION 'Bid limit reached (% bids/month on % plan). Please upgrade your subscription.', 
                sub_record.max_bids_per_month, sub_record.plan_name;
        END IF;
        
        -- Increment bid counter
        UPDATE garage_subscriptions 
        SET bids_used_this_cycle = bids_used_this_cycle + 1,
            updated_at = NOW()
        WHERE subscription_id = sub_record.subscription_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
