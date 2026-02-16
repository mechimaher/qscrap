--
-- PostgreSQL database dump
--

\restrict WfmU3EtPnrVAq3On6P9FGFcCBqLlsmId03iT7o06EqDiZEcn8NXhwq5mohVp8gn

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'QScrap Parts Marketplace - Simplified (Parts Only, No Insurance/Services)';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: request_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.request_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


--
-- Name: TYPE request_status_enum; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.request_status_enum IS 'Status of subscription change requests: pending, approved, rejected, cancelled';


--
-- Name: request_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.request_type_enum AS ENUM (
    'upgrade',
    'downgrade',
    'cancel'
);


--
-- Name: add_customer_points(uuid, integer, character varying, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_customer_points(p_customer_id uuid, p_points integer, p_transaction_type character varying, p_order_id uuid DEFAULT NULL::uuid, p_description text DEFAULT NULL::text) RETURNS TABLE(new_balance integer, new_tier character varying)
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: FUNCTION add_customer_points(p_customer_id uuid, p_points integer, p_transaction_type character varying, p_order_id uuid, p_description text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.add_customer_points(p_customer_id uuid, p_points integer, p_transaction_type character varying, p_order_id uuid, p_description text) IS 'Add or deduct points with transaction logging';


--
-- Name: auto_release_expired_escrow(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_release_expired_escrow() RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: FUNCTION auto_release_expired_escrow(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_release_expired_escrow() IS 'Called by cron to release escrow after inspection window';


--
-- Name: award_points_on_order_completion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_points_on_order_completion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: calculate_garage_summary(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_garage_summary(p_garage_id uuid, p_period character varying) RETURNS TABLE(total_orders integer, total_revenue numeric, total_bids integer, win_rate numeric, avg_rating numeric, unique_customers integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    start_date TIMESTAMPTZ;
BEGIN
    -- Determine date range
    CASE p_period
        WHEN 'today' THEN start_date := CURRENT_DATE;
        WHEN 'week' THEN start_date := CURRENT_DATE - INTERVAL '7 days';
        WHEN 'month' THEN start_date := CURRENT_DATE - INTERVAL '30 days';
        WHEN 'year' THEN start_date := CURRENT_DATE - INTERVAL '365 days';
        ELSE start_date := CURRENT_DATE - INTERVAL '30 days';
    END CASE;

    RETURN QUERY
    SELECT 
        COUNT(DISTINCT o.order_id)::INTEGER as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        (SELECT COUNT(*)::INTEGER FROM bids WHERE garage_id = p_garage_id AND created_at >= start_date) as total_bids,
        COALESCE(
            (SELECT win_rate_percentage 
             FROM garage_bid_analytics 
             WHERE garage_id = p_garage_id 
             ORDER BY month DESC LIMIT 1),
            0
        ) as win_rate,
        COALESCE(AVG(o.customer_rating), 0) as avg_rating,
        COUNT(DISTINCT o.customer_id)::INTEGER as unique_customers
    FROM orders o
    WHERE o.garage_id = p_garage_id 
      AND o.created_at >= start_date
      AND o.status IN ('completed', 'delivered');
END;
$$;


--
-- Name: FUNCTION calculate_garage_summary(p_garage_id uuid, p_period character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.calculate_garage_summary(p_garage_id uuid, p_period character varying) IS 'Calculate real-time summary statistics for a garage';


--
-- Name: calculate_tier(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_tier(p_points integer) RETURNS character varying
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
    IF p_points >= 10000 THEN RETURN 'platinum';
    ELSIF p_points >= 3000 THEN RETURN 'gold';
    ELSIF p_points >= 1000 THEN RETURN 'silver';
    ELSE RETURN 'bronze';
    END IF;
END;
$$;


--
-- Name: change_subscription(uuid, character varying, character varying, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.change_subscription(p_garage_id uuid, p_new_plan character varying, p_billing_cycle character varying, p_changed_by uuid) RETURNS TABLE(success boolean, message text, price numeric)
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: FUNCTION change_subscription(p_garage_id uuid, p_new_plan character varying, p_billing_cycle character varying, p_changed_by uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.change_subscription(p_garage_id uuid, p_new_plan character varying, p_billing_cycle character varying, p_changed_by uuid) IS 'Upgrade or downgrade garage subscription';


--
-- Name: check_daily_budget_exceeded(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_daily_budget_exceeded(p_campaign_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_daily_limit DECIMAL(10,2);
    v_today_spend DECIMAL(10,2);
BEGIN
    SELECT daily_limit_qar INTO v_daily_limit
    FROM ad_campaigns
    WHERE campaign_id = p_campaign_id;
    
    IF v_daily_limit IS NULL THEN
        RETURN false;
    END IF;
    
    SELECT COALESCE(SUM(
        CASE 
            WHEN i.impression_type = 'view' THEN ap.cost_per_impression / 1000
            WHEN i.impression_type = 'click' THEN ap.cost_per_click
            WHEN i.impression_type = 'conversion' THEN ap.cost_per_conversion
            ELSE 0
        END
    ), 0) INTO v_today_spend
    FROM ad_impressions i
    JOIN ad_campaigns c ON i.campaign_id = c.campaign_id
    JOIN ad_pricing ap ON c.campaign_type = ap.campaign_type
    WHERE i.campaign_id = p_campaign_id
      AND DATE(i.timestamp) = CURRENT_DATE;
    
    RETURN v_today_spend >= v_daily_limit;
END;
$$;


--
-- Name: check_feature_access(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_feature_access(p_garage_id uuid, p_feature character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: FUNCTION check_feature_access(p_garage_id uuid, p_feature character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_feature_access(p_garage_id uuid, p_feature character varying) IS 'Check if garage has access to specific feature';


--
-- Name: check_garage_can_bid(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_garage_can_bid() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: check_request_active_for_bid(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_request_active_for_bid() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    request_status TEXT;
BEGIN
    SELECT status INTO request_status FROM part_requests WHERE request_id = NEW.request_id;
    
    IF request_status IS NULL THEN
        RAISE EXCEPTION 'Request not found';
    END IF;
    
    IF request_status != 'active' THEN
        RAISE EXCEPTION 'Cannot bid on inactive request (status: %)', request_status;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: cleanup_expired_idempotency_keys(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_idempotency_keys() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM idempotency_keys
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: find_service_providers(text, numeric, numeric, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_service_providers(request_type text, customer_lat numeric, customer_lng numeric, radius_km integer DEFAULT 15, limit_count integer DEFAULT 5) RETURNS TABLE(garage_id uuid, name character varying, distance_km numeric, rating numeric, response_time integer, capabilities text[])
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.garage_id,
        g.garage_name::VARCHAR(255),
        ROUND((
            SQRT(
                POWER(COALESCE(g.location_lat, customer_lat) - customer_lat, 2) +
                POWER(COALESCE(g.location_lng, customer_lng) - customer_lng, 2)
            ) * 111
        )::numeric, 2) as distance_km,
        g.rating_average::DECIMAL,
        g.average_response_time_minutes,
        ARRAY_REMOVE(ARRAY[
            CASE WHEN g.sells_parts THEN 'parts' END,
            CASE WHEN g.provides_repairs THEN 'repairs' END,
            CASE WHEN g.provides_quick_services THEN 'quick_services' END,
            CASE WHEN g.has_mobile_technicians THEN 'mobile' END
        ]::TEXT[], NULL) as capabilities
    FROM garages g
    WHERE g.deleted_at IS NULL
        AND (
            COALESCE(g.location_lat, customer_lat) BETWEEN customer_lat - (radius_km::DECIMAL / 111) AND customer_lat + (radius_km::DECIMAL / 111)
        )
        AND (
            COALESCE(g.location_lng, customer_lng) BETWEEN customer_lng - (radius_km::DECIMAL / 111) AND customer_lng + (radius_km::DECIMAL / 111)
        )
        AND CASE request_type
            WHEN 'parts' THEN g.sells_parts
            WHEN 'repairs' THEN g.provides_repairs
            WHEN 'quick_service' THEN g.provides_quick_services AND g.has_mobile_technicians
            ELSE true
        END
    ORDER BY 
        g.rating DESC,
        distance_km ASC
    LIMIT limit_count;
END;
$$;


--
-- Name: FUNCTION find_service_providers(request_type text, customer_lat numeric, customer_lng numeric, radius_km integer, limit_count integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.find_service_providers(request_type text, customer_lat numeric, customer_lng numeric, radius_km integer, limit_count integer) IS 'Find nearby garages by service type and location';


--
-- Name: generate_document_number(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_document_number(doc_type character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix VARCHAR(4);
    year_month VARCHAR(4);
    seq_num INTEGER;
BEGIN
    -- Set prefix based on document type
    CASE doc_type
        WHEN 'invoice' THEN prefix := 'INV-';
        WHEN 'receipt' THEN prefix := 'RCP-';
        WHEN 'warranty_card' THEN prefix := 'WRC-';
        WHEN 'delivery_note' THEN prefix := 'DLV-';
        WHEN 'quote' THEN prefix := 'QTE-';
        ELSE prefix := 'DOC-';
    END CASE;
    
    -- Year and month (YYMM format)
    year_month := TO_CHAR(CURRENT_DATE, 'YYMM');
    
    -- Get next sequence number
    CASE doc_type
        WHEN 'invoice' THEN seq_num := nextval('invoice_number_seq');
        WHEN 'warranty_card' THEN seq_num := nextval('warranty_number_seq');
        WHEN 'receipt' THEN seq_num := nextval('receipt_number_seq');
        ELSE seq_num := nextval('invoice_number_seq');
    END CASE;
    
    RETURN prefix || year_month || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$;


--
-- Name: generate_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.order_number := 'QS-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
    RETURN NEW;
END;
$$;


--
-- Name: generate_verification_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_verification_code() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result VARCHAR := 'QS-VRF-';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$;


--
-- Name: get_active_ads_for_placement(character varying, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_ads_for_placement(p_placement_type character varying, p_limit integer DEFAULT 5) RETURNS TABLE(campaign_id uuid, placement_id uuid, garage_id uuid, garage_name character varying, placement_type character varying, banner_image_url text, banner_title character varying, banner_description text, cta_text character varying, priority integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.campaign_id,
        p.placement_id,
        c.garage_id,
        g.garage_name,
        p.placement_type,
        p.banner_image_url,
        p.banner_title,
        p.banner_description,
        p.cta_text,
        p.priority
    FROM ad_campaigns c
    JOIN ad_placements p ON c.campaign_id = p.campaign_id
    JOIN garages g ON c.garage_id = g.garage_id
    WHERE c.status = 'active'
      AND p.placement_type = p_placement_type
      AND p.active = true
      AND CURRENT_DATE BETWEEN c.start_date AND c.end_date
      AND (c.daily_limit_qar IS NULL OR c.spent_amount < c.budget_qar)
    ORDER BY p.priority DESC, RANDOM()
    LIMIT p_limit;
END;
$$;


--
-- Name: get_customer_rewards_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_rewards_summary(p_customer_id uuid) RETURNS TABLE(points_balance integer, lifetime_points integer, current_tier character varying, discount_percentage numeric, priority_support boolean, tier_badge_color character varying, next_tier character varying, points_to_next_tier integer)
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: get_payment_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_payment_summary(p_user_id uuid) RETURNS TABLE(total_transactions bigint, successful_transactions bigint, failed_transactions bigint, total_amount numeric, total_refunded numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS total_transactions,
        COUNT(*) FILTER (WHERE status = 'success')::BIGINT AS successful_transactions,
        COUNT(*) FILTER (WHERE status = 'failed')::BIGINT AS failed_transactions,
        COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0) AS total_amount,
        COALESCE(SUM(refund_amount), 0) AS total_refunded
    FROM payment_transactions
    WHERE user_id = p_user_id;
END;
$$;


--
-- Name: get_subscription_details(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_subscription_details(p_garage_id uuid) RETURNS TABLE(current_plan character varying, plan_name character varying, monthly_price numeric, annual_price numeric, billing_cycle character varying, start_date timestamp with time zone, end_date timestamp with time zone, days_remaining integer, analytics_enabled boolean, priority_support boolean, api_access boolean, ad_campaigns_allowed boolean, max_team_members integer, features jsonb)
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: log_admin_action(uuid, character varying, character varying, uuid, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_admin_action(p_admin_id uuid, p_action_type character varying, p_target_type character varying, p_target_id uuid, p_old_value jsonb DEFAULT NULL::jsonb, p_new_value jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, old_value, new_value)
    VALUES (p_admin_id, p_action_type, p_target_type, p_target_id, p_old_value, p_new_value)
    RETURNING log_id INTO v_log_id;
    RETURN v_log_id;
END;
$$;


--
-- Name: pause_campaign_if_budget_exhausted(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pause_campaign_if_budget_exhausted() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.spent_amount >= NEW.budget_qar THEN
        NEW.status := 'completed';
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: record_ad_interaction(uuid, uuid, uuid, inet, character varying, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_ad_interaction(p_campaign_id uuid, p_placement_id uuid, p_customer_id uuid, p_ip_address inet, p_interaction_type character varying, p_session_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_impression_id UUID;
    v_cost DECIMAL(6,2);
    v_campaign_type VARCHAR(20);
BEGIN
    -- Record impression
    INSERT INTO ad_impressions (
        campaign_id, placement_id, customer_id, 
        ip_address, impression_type, session_id
    ) VALUES (
        p_campaign_id, p_placement_id, p_customer_id,
        p_ip_address, p_interaction_type, p_session_id
    ) RETURNING impression_id INTO v_impression_id;
    
    -- Update campaign counters and spend
    SELECT campaign_type INTO v_campaign_type
    FROM ad_campaigns WHERE campaign_id = p_campaign_id;
    
    -- Calculate cost based on interaction type
    IF p_interaction_type = 'view' THEN
        SELECT cost_per_impression / 1000 INTO v_cost
        FROM ad_pricing WHERE campaign_type = v_campaign_type;
    ELSIF p_interaction_type = 'click' THEN
        SELECT cost_per_click INTO v_cost
        FROM ad_pricing WHERE campaign_type = v_campaign_type;
        
        UPDATE ad_campaigns
        SET clicks = clicks + 1,
            spent_amount = spent_amount + v_cost,
            impressions = impressions + 1
        WHERE campaign_id = p_campaign_id;
    ELSIF p_interaction_type = 'conversion' THEN
        SELECT cost_per_conversion INTO v_cost
        FROM ad_pricing WHERE campaign_type = v_campaign_type;
        
        UPDATE ad_campaigns
        SET conversions = conversions + 1,
            spent_amount = spent_amount + v_cost
        WHERE campaign_id = p_campaign_id;
    ELSE
        -- Just view impression
        UPDATE ad_campaigns
        SET impressions = impressions + 1,
            spent_amount = spent_amount + COALESCE(v_cost, 0)
        WHERE campaign_id = p_campaign_id;
    END IF;
    
    RETURN v_impression_id;
END;
$$;


--
-- Name: redeem_points_for_discount(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_points_for_discount(p_customer_id uuid, p_points_to_redeem integer) RETURNS TABLE(success boolean, discount_amount numeric, new_balance integer, message text)
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: FUNCTION redeem_points_for_discount(p_customer_id uuid, p_points_to_redeem integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.redeem_points_for_discount(p_customer_id uuid, p_points_to_redeem integer) IS 'Redeem points for order discount';


--
-- Name: refresh_garage_analytics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_garage_analytics() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY garage_daily_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY garage_popular_parts;
    REFRESH MATERIALIZED VIEW CONCURRENTLY garage_bid_analytics;
END;
$$;


--
-- Name: set_escrow_inspection_expiry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_escrow_inspection_expiry() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.inspection_expires_at IS NULL THEN
        NEW.inspection_expires_at := NOW() + (NEW.inspection_window_hours || ' hours')::INTERVAL;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: sync_garage_settings_from_garages(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_garage_settings_from_garages() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Only sync on UPDATE (INSERT handled by backfill, DELETE cascades)
    IF TG_OP = 'UPDATE' THEN
        UPDATE garage_settings 
        SET 
            auto_renew = NEW.auto_renew,
            provides_repairs = NEW.provides_repairs,
            provides_quick_services = NEW.provides_quick_services,
            has_mobile_technicians = NEW.has_mobile_technicians,
            mobile_service_radius_km = NEW.mobile_service_radius_km,
            max_concurrent_services = NEW.max_concurrent_services,
            sells_parts = NEW.sells_parts,
            updated_at = NOW()
        WHERE garage_id = NEW.garage_id;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO garage_settings (
            garage_id, auto_renew, provides_repairs, provides_quick_services,
            has_mobile_technicians, mobile_service_radius_km, max_concurrent_services, sells_parts
        ) VALUES (
            NEW.garage_id, NEW.auto_renew, NEW.provides_repairs, NEW.provides_quick_services,
            NEW.has_mobile_technicians, NEW.mobile_service_radius_km, NEW.max_concurrent_services, NEW.sells_parts
        );
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: sync_garage_stats_from_garages(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_garage_stats_from_garages() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        UPDATE garage_stats 
        SET 
            total_services_completed = NEW.total_services_completed,
            quick_service_rating = NEW.quick_service_rating,
            repair_rating = NEW.repair_rating,
            average_response_time_minutes = NEW.average_response_time_minutes,
            updated_at = NOW()
        WHERE garage_id = NEW.garage_id;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO garage_stats (
            garage_id, total_services_completed, quick_service_rating,
            repair_rating, average_response_time_minutes
        ) VALUES (
            NEW.garage_id, NEW.total_services_completed, NEW.quick_service_rating,
            NEW.repair_rating, NEW.average_response_time_minutes
        );
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: update_address_modtime(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_address_modtime() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_customer_tier(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_customer_tier() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: update_document_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_document_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_driver_locations_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_driver_locations_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


--
-- Name: update_garage_capabilities(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_garage_capabilities() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Auto-enable mobile technicians if quick services enabled and techs exist
    IF NEW.provides_quick_services = true THEN
        SELECT EXISTS(
            SELECT 1 FROM technicians 
            WHERE garage_id = NEW.garage_id AND is_active = true
        ) INTO NEW.has_mobile_technicians;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: update_garage_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_garage_rating() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE garages SET
        rating_average = (
            SELECT ROUND(AVG(overall_rating)::NUMERIC, 2)
            FROM order_reviews
            WHERE garage_id = NEW.garage_id AND is_visible = true
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM order_reviews
            WHERE garage_id = NEW.garage_id AND is_visible = true
        ),
        updated_at = NOW()
    WHERE garage_id = NEW.garage_id;
    RETURN NEW;
END;
$$;


--
-- Name: update_payment_transactions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_payment_transactions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_push_tokens_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_push_tokens_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_vehicle_last_used(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_vehicle_last_used() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.saved_vehicle_id IS NOT NULL THEN
        UPDATE customer_vehicles 
        SET last_used_at = NOW(), 
            request_count = request_count + 1,
            updated_at = NOW()
        WHERE vehicle_id = NEW.saved_vehicle_id;
    END IF;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ad_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_campaigns (
    campaign_id uuid DEFAULT gen_random_uuid() NOT NULL,
    garage_id uuid,
    campaign_name character varying(100) NOT NULL,
    campaign_type character varying(20) NOT NULL,
    budget_qar numeric(10,2) NOT NULL,
    daily_limit_qar numeric(10,2),
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    spent_amount numeric(10,2) DEFAULT 0,
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    conversions integer DEFAULT 0,
    target_categories text[],
    target_brands text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    approved_at timestamp with time zone,
    approved_by uuid,
    CONSTRAINT ad_campaigns_budget_qar_check CHECK ((budget_qar > (0)::numeric)),
    CONSTRAINT ad_campaigns_campaign_type_check CHECK (((campaign_type)::text = ANY ((ARRAY['sponsored_listing'::character varying, 'banner'::character varying, 'featured'::character varying, 'priority'::character varying])::text[]))),
    CONSTRAINT ad_campaigns_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'paused'::character varying, 'completed'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT valid_budget CHECK (((daily_limit_qar IS NULL) OR (daily_limit_qar <= budget_qar))),
    CONSTRAINT valid_date_range CHECK ((end_date >= start_date))
);


--
-- Name: TABLE ad_campaigns; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ad_campaigns IS 'Advertising campaigns created by garages for promotion';


--
-- Name: ad_campaign_analytics; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.ad_campaign_analytics AS
 SELECT campaign_id,
    garage_id,
    campaign_name,
    campaign_type,
    status,
    budget_qar,
    spent_amount,
    impressions,
    clicks,
    conversions,
        CASE
            WHEN (impressions > 0) THEN round((((clicks)::numeric / (impressions)::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS ctr_percentage,
        CASE
            WHEN (clicks > 0) THEN round((((conversions)::numeric / (clicks)::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS conversion_rate,
        CASE
            WHEN (conversions > 0) THEN round((spent_amount / (conversions)::numeric), 2)
            ELSE (0)::numeric
        END AS cost_per_conversion,
    date_trunc('day'::text, (start_date)::timestamp with time zone) AS start_date,
    date_trunc('day'::text, (end_date)::timestamp with time zone) AS end_date
   FROM public.ad_campaigns c
  WITH NO DATA;


--
-- Name: ad_impressions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_impressions (
    impression_id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    placement_id uuid,
    customer_id uuid,
    ip_address inet,
    user_agent text,
    impression_type character varying(20) DEFAULT 'view'::character varying,
    "timestamp" timestamp with time zone DEFAULT now(),
    session_id uuid,
    CONSTRAINT ad_impressions_impression_type_check CHECK (((impression_type)::text = ANY ((ARRAY['view'::character varying, 'click'::character varying, 'conversion'::character varying])::text[])))
);


--
-- Name: TABLE ad_impressions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ad_impressions IS 'Tracking table for ad views, clicks, and conversions';


--
-- Name: ad_placements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_placements (
    placement_id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    placement_type character varying(50) NOT NULL,
    "position" integer DEFAULT 1,
    priority integer DEFAULT 0,
    active boolean DEFAULT true,
    banner_image_url text,
    banner_title character varying(100),
    banner_description text,
    cta_text character varying(30),
    cta_url text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ad_placements_placement_type_check CHECK (((placement_type)::text = ANY ((ARRAY['search_top'::character varying, 'search_sidebar'::character varying, 'category_banner'::character varying, 'homepage_featured'::character varying, 'request_detail_banner'::character varying])::text[])))
);


--
-- Name: TABLE ad_placements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ad_placements IS 'Specific ad placement configurations for campaigns';


--
-- Name: ad_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_pricing (
    pricing_id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_type character varying(20) NOT NULL,
    cost_per_impression numeric(6,4) DEFAULT 0.50,
    cost_per_click numeric(6,2) DEFAULT 2.00,
    cost_per_conversion numeric(6,2) DEFAULT 10.00,
    min_daily_budget numeric(8,2) DEFAULT 50.00,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE ad_pricing; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ad_pricing IS 'Pricing model for different campaign types';


--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log (
    log_id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid,
    action_type character varying(50) NOT NULL,
    target_type character varying(50) NOT NULL,
    target_id uuid NOT NULL,
    old_value jsonb,
    new_value jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    log_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action character varying(100) NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    old_data jsonb,
    new_data jsonb,
    ip_address character varying(45),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: bids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bids (
    bid_id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid,
    garage_id uuid,
    part_condition text NOT NULL,
    brand_name text,
    part_number character varying(50),
    warranty_days integer DEFAULT 0,
    bid_amount numeric(10,2) NOT NULL,
    image_urls text[],
    notes text,
    status text DEFAULT 'pending'::text,
    withdrawal_reason text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    withdrawn_at timestamp without time zone,
    deleted_at timestamp without time zone,
    original_bid_amount numeric,
    CONSTRAINT bids_bid_amount_check CHECK ((bid_amount > (0)::numeric)),
    CONSTRAINT bids_part_condition_check CHECK ((part_condition = ANY (ARRAY['new'::text, 'used_excellent'::text, 'used_good'::text, 'used_fair'::text, 'refurbished'::text]))),
    CONSTRAINT bids_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'withdrawn'::text, 'expired'::text]))),
    CONSTRAINT bids_warranty_days_check CHECK ((warranty_days >= 0))
);


--
-- Name: cancellation_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cancellation_requests (
    cancellation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    requested_by uuid,
    requested_by_type character varying(20) NOT NULL,
    reason_code character varying(50) NOT NULL,
    reason_text text,
    order_status_at_cancel character varying(30) NOT NULL,
    time_since_order_minutes integer,
    cancellation_fee_rate numeric(4,3) DEFAULT 0,
    cancellation_fee numeric(10,2) DEFAULT 0,
    refund_amount numeric(10,2),
    status character varying(20) DEFAULT 'pending'::character varying,
    reviewed_by uuid,
    review_notes text,
    reviewed_at timestamp without time zone,
    processed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT cancellation_requests_reason_code_check CHECK (((reason_code)::text = ANY (ARRAY[('changed_mind'::character varying)::text, ('found_elsewhere'::character varying)::text, ('too_expensive'::character varying)::text, ('wrong_part'::character varying)::text, ('taking_too_long'::character varying)::text, ('stock_out'::character varying)::text, ('part_defective'::character varying)::text, ('wrong_part_identified'::character varying)::text, ('customer_unreachable'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT cancellation_requests_requested_by_type_check CHECK (((requested_by_type)::text = ANY (ARRAY[('customer'::character varying)::text, ('garage'::character varying)::text, ('admin'::character varying)::text]))),
    CONSTRAINT cancellation_requests_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('processed'::character varying)::text])))
);


--
-- Name: canned_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canned_responses (
    response_id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    message_text text NOT NULL,
    category text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true
);


--
-- Name: TABLE canned_responses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.canned_responses IS 'Pre-written responses for common support scenarios';


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    message_id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid,
    sender_id uuid,
    sender_type character varying(20) NOT NULL,
    message_text text NOT NULL,
    attachments text[],
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    is_internal boolean DEFAULT false
);


--
-- Name: counter_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counter_offers (
    counter_offer_id uuid DEFAULT gen_random_uuid() NOT NULL,
    bid_id uuid,
    request_id uuid,
    offered_by_type text NOT NULL,
    offered_by_id uuid NOT NULL,
    proposed_amount numeric(10,2) NOT NULL,
    message text,
    status text DEFAULT 'pending'::text,
    response_message text,
    responded_at timestamp without time zone,
    round_number integer DEFAULT 1,
    expires_at timestamp without time zone DEFAULT (now() + '24:00:00'::interval),
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT counter_offers_offered_by_type_check CHECK ((offered_by_type = ANY (ARRAY['customer'::text, 'garage'::text]))),
    CONSTRAINT counter_offers_proposed_amount_check CHECK ((proposed_amount > (0)::numeric)),
    CONSTRAINT counter_offers_round_number_check CHECK (((round_number >= 1) AND (round_number <= 3))),
    CONSTRAINT counter_offers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'countered'::text, 'expired'::text])))
);


--
-- Name: customer_abuse_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_abuse_tracking (
    tracking_id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    month_year character varying(7) NOT NULL,
    returns_count integer DEFAULT 0,
    defective_claims_count integer DEFAULT 0,
    cancellations_count integer DEFAULT 0,
    flag_level character varying(10) DEFAULT 'none'::character varying,
    last_updated timestamp with time zone DEFAULT now(),
    CONSTRAINT abuse_flag_check CHECK (((flag_level)::text = ANY ((ARRAY['none'::character varying, 'yellow'::character varying, 'orange'::character varying, 'red'::character varying, 'black'::character varying])::text[])))
);


--
-- Name: customer_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_addresses (
    address_id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    label character varying(50) DEFAULT 'Home'::character varying,
    address_line text NOT NULL,
    area text,
    city text DEFAULT 'Doha'::text,
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    delivery_notes text,
    is_default boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: customer_credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_credits (
    credit_id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    reason text NOT NULL,
    granted_by uuid,
    ticket_id uuid,
    order_id uuid,
    status text DEFAULT 'active'::text,
    used_amount numeric(10,2) DEFAULT 0,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT customer_credits_status_check CHECK ((status = ANY (ARRAY['active'::text, 'used'::text, 'expired'::text])))
);


--
-- Name: TABLE customer_credits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customer_credits IS 'Goodwill credits granted to customers for service recovery';


--
-- Name: customer_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_notes (
    note_id integer NOT NULL,
    customer_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    note_text text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE customer_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customer_notes IS 'Internal agent notes about customers for Support Dashboard';


--
-- Name: customer_notes_note_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_notes_note_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_notes_note_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_notes_note_id_seq OWNED BY public.customer_notes.note_id;


--
-- Name: customer_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_rewards (
    reward_id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    points_balance integer DEFAULT 0,
    lifetime_points integer DEFAULT 0,
    current_tier character varying(20) DEFAULT 'bronze'::character varying,
    tier_since timestamp with time zone DEFAULT now(),
    last_activity timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT customer_rewards_points_balance_check CHECK ((points_balance >= 0))
);


--
-- Name: TABLE customer_rewards; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customer_rewards IS 'Customer loyalty points and tier tracking';


--
-- Name: customer_vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_vehicles (
    vehicle_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_id uuid NOT NULL,
    car_make character varying(100) NOT NULL,
    car_model character varying(100) NOT NULL,
    car_year integer NOT NULL,
    vin_number character varying(17),
    front_image_url character varying(500),
    rear_image_url character varying(500),
    nickname character varying(50),
    is_primary boolean DEFAULT false,
    last_used_at timestamp with time zone DEFAULT now(),
    request_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    vin_image_url character varying(500),
    CONSTRAINT customer_vehicles_car_year_check CHECK (((car_year >= 1970) AND (car_year <= 2030)))
);


--
-- Name: TABLE customer_vehicles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customer_vehicles IS 'Stores customer saved vehicles for quick selection on repeat orders (My Fleet feature)';


--
-- Name: COLUMN customer_vehicles.nickname; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_vehicles.nickname IS 'User-friendly name like "Dad''s Patrol" or "Family SUV"';


--
-- Name: COLUMN customer_vehicles.is_primary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_vehicles.is_primary IS 'Primary/default vehicle for this customer';


--
-- Name: COLUMN customer_vehicles.vin_image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_vehicles.vin_image_url IS 'Photo of registration card (Istimara) showing VIN number';


--
-- Name: delivery_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_assignments (
    assignment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    driver_id uuid,
    status character varying(20) DEFAULT 'assigned'::character varying,
    pickup_address text,
    pickup_lat numeric(10,8),
    pickup_lng numeric(11,8),
    pickup_at timestamp without time zone,
    delivery_address text,
    delivery_lat numeric(10,8),
    delivery_lng numeric(11,8),
    delivered_at timestamp without time zone,
    signature_url text,
    delivery_photo_url text,
    recipient_name character varying(100),
    driver_notes text,
    failure_reason text,
    estimated_pickup timestamp without time zone,
    estimated_delivery timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    assignment_type character varying(20) DEFAULT 'delivery'::character varying,
    return_reason text,
    current_lat numeric(10,8),
    current_lng numeric(11,8),
    last_location_update timestamp without time zone,
    created_by_user_id uuid,
    previous_driver_id uuid,
    reassignment_reason text,
    reassigned_at timestamp without time zone,
    reassigned_by uuid,
    CONSTRAINT delivery_assignments_assignment_type_check CHECK (((assignment_type)::text = ANY (ARRAY[('delivery'::character varying)::text, ('return_to_garage'::character varying)::text, ('collection'::character varying)::text]))),
    CONSTRAINT delivery_assignments_status_check CHECK (((status)::text = ANY (ARRAY[('assigned'::character varying)::text, ('picked_up'::character varying)::text, ('in_transit'::character varying)::text, ('delivered'::character varying)::text, ('failed'::character varying)::text])))
);


--
-- Name: delivery_chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_chats (
    message_id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid,
    order_id uuid,
    sender_type character varying(20) NOT NULL,
    sender_id uuid,
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    read_at timestamp without time zone
);


--
-- Name: delivery_fee_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_fee_tiers (
    tier_id integer NOT NULL,
    min_order_value numeric(10,2) NOT NULL,
    max_order_value numeric(10,2),
    discount_percent integer DEFAULT 0 NOT NULL,
    description character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT delivery_fee_tiers_discount_percent_check CHECK (((discount_percent >= 0) AND (discount_percent <= 100)))
);


--
-- Name: TABLE delivery_fee_tiers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.delivery_fee_tiers IS 'Order-value based discount tiers for delivery fees';


--
-- Name: COLUMN delivery_fee_tiers.discount_percent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.delivery_fee_tiers.discount_percent IS 'Percentage discount applied to base delivery fee (0-100)';


--
-- Name: delivery_fee_tiers_tier_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_fee_tiers_tier_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: delivery_fee_tiers_tier_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.delivery_fee_tiers_tier_id_seq OWNED BY public.delivery_fee_tiers.tier_id;


--
-- Name: delivery_vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_vouchers (
    voucher_id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    order_id uuid,
    amount numeric(10,2) NOT NULL,
    reason character varying(100),
    code character varying(20),
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    used_on_order_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT voucher_amount_check CHECK (((amount > (0)::numeric) AND (amount <= (50)::numeric)))
);


--
-- Name: delivery_zone_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_zone_history (
    history_id uuid DEFAULT gen_random_uuid() NOT NULL,
    zone_id integer,
    old_fee numeric(10,2),
    new_fee numeric(10,2),
    changed_by uuid,
    reason text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: delivery_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_zones (
    zone_id integer NOT NULL,
    zone_name character varying(50) NOT NULL,
    min_distance_km numeric(6,2) NOT NULL,
    max_distance_km numeric(6,2) NOT NULL,
    delivery_fee numeric(10,2) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: delivery_zones_zone_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_zones_zone_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: delivery_zones_zone_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.delivery_zones_zone_id_seq OWNED BY public.delivery_zones.zone_id;


--
-- Name: disputes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disputes (
    dispute_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    customer_id uuid,
    garage_id uuid,
    reason character varying(50) NOT NULL,
    description text,
    photo_urls text[] DEFAULT '{}'::text[],
    order_amount numeric(10,2) NOT NULL,
    refund_percent integer NOT NULL,
    restocking_fee_percent integer DEFAULT 0,
    refund_amount numeric(10,2) NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying,
    garage_response text,
    garage_responded_at timestamp without time zone,
    resolved_by uuid,
    resolution_notes text,
    resolved_at timestamp without time zone,
    auto_resolve_at timestamp without time zone DEFAULT (now() + '48:00:00'::interval),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    resolution character varying(50),
    CONSTRAINT disputes_reason_check CHECK (((reason)::text = ANY (ARRAY[('wrong_part'::character varying)::text, ('damaged'::character varying)::text, ('not_as_described'::character varying)::text, ('doesnt_fit'::character varying)::text, ('changed_mind'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT disputes_refund_percent_check CHECK (((refund_percent >= 0) AND (refund_percent <= 100))),
    CONSTRAINT disputes_resolution_check CHECK (((resolution)::text = ANY (ARRAY[('refund_approved'::character varying)::text, ('auto_approved'::character varying)::text, ('claim_rejected'::character varying)::text, ('partial_refund'::character varying)::text]))),
    CONSTRAINT disputes_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'contested'::character varying, 'under_review'::character varying, 'accepted'::character varying, 'refund_approved'::character varying, 'refund_denied'::character varying, 'resolved'::character varying, 'auto_resolved'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: COLUMN disputes.photo_urls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.disputes.photo_urls IS 'Array of photo URLs. App enforces limit of 5 photos, 5MB each.';


--
-- Name: document_access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_access_log (
    log_id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid,
    action character varying(50) NOT NULL,
    actor_id uuid,
    actor_type character varying(20),
    ip_address inet,
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE document_access_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_access_log IS 'Complete audit trail for document access - Legal requirement';


--
-- Name: document_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_templates (
    template_id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_name character varying(100) NOT NULL,
    document_type character varying(50) NOT NULL,
    language character varying(10) DEFAULT 'en'::character varying,
    html_template text NOT NULL,
    css_styles text,
    header_html text,
    footer_html text,
    page_size character varying(20) DEFAULT 'A4'::character varying,
    orientation character varying(20) DEFAULT 'portrait'::character varying,
    margins jsonb DEFAULT '{"top": "20mm", "left": "20mm", "right": "20mm", "bottom": "20mm"}'::jsonb,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE document_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_templates IS 'Customizable document templates for invoices, receipts, etc.';


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    document_id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_type character varying(50) NOT NULL,
    document_number character varying(50) NOT NULL,
    order_id uuid,
    customer_id uuid,
    garage_id uuid,
    payout_id uuid,
    document_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    document_data_ar jsonb DEFAULT '{}'::jsonb,
    file_path character varying(500),
    file_path_ar character varying(500),
    file_size_bytes integer,
    file_hash character varying(128),
    commercial_registration character varying(50),
    tax_registration character varying(50),
    digital_signature text,
    signature_timestamp timestamp without time zone,
    verification_code character varying(100) NOT NULL,
    verification_url text,
    qr_code_data text,
    status character varying(30) DEFAULT 'generated'::character varying,
    generated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    sent_at timestamp without time zone,
    viewed_at timestamp without time zone,
    downloaded_at timestamp without time zone,
    expires_at timestamp without time zone,
    archived_at timestamp without time zone,
    created_by uuid,
    created_by_type character varying(20),
    ip_address inet,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT documents_document_type_check CHECK (((document_type)::text = ANY (ARRAY[('invoice'::character varying)::text, ('receipt'::character varying)::text, ('warranty_card'::character varying)::text, ('delivery_note'::character varying)::text, ('quote'::character varying)::text]))),
    CONSTRAINT documents_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('generated'::character varying)::text, ('sent'::character varying)::text, ('viewed'::character varying)::text, ('downloaded'::character varying)::text, ('printed'::character varying)::text, ('archived'::character varying)::text, ('voided'::character varying)::text])))
);


--
-- Name: TABLE documents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.documents IS 'Qatar MOCI Compliant Document Storage - 10 Year Retention';


--
-- Name: driver_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_locations (
    driver_id uuid NOT NULL,
    latitude numeric(10,8) NOT NULL,
    longitude numeric(11,8) NOT NULL,
    heading numeric(5,2),
    speed numeric(5,2),
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: driver_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_payouts (
    payout_id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid,
    assignment_id uuid,
    order_id uuid,
    order_number character varying(50),
    amount numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    processed_at timestamp without time zone
);


--
-- Name: driver_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_transactions (
    transaction_id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    type character varying(50) NOT NULL,
    reference_id character varying(100),
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: driver_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_wallets (
    wallet_id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid NOT NULL,
    balance numeric(10,2) DEFAULT 0.00,
    total_earned numeric(10,2) DEFAULT 0.00,
    cash_collected numeric(10,2) DEFAULT 0.00,
    last_updated timestamp with time zone DEFAULT now()
);


--
-- Name: drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drivers (
    driver_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    full_name character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    email character varying(100),
    vehicle_type character varying(50) DEFAULT 'motorcycle'::character varying,
    vehicle_plate character varying(20),
    vehicle_model character varying(100),
    status character varying(20) DEFAULT 'available'::character varying,
    current_lat numeric(10,8),
    current_lng numeric(11,8),
    last_location_update timestamp without time zone,
    total_deliveries integer DEFAULT 0,
    rating_average numeric(3,2) DEFAULT 0,
    rating_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    total_earnings numeric(10,2) DEFAULT 0,
    bank_name character varying(100),
    bank_account_iban character varying(50),
    bank_account_name character varying(100),
    CONSTRAINT drivers_status_check CHECK (((status)::text = ANY (ARRAY[('available'::character varying)::text, ('busy'::character varying)::text, ('offline'::character varying)::text, ('suspended'::character varying)::text])))
);


--
-- Name: escrow_release_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escrow_release_rules (
    rule_id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_name character varying(100) NOT NULL,
    description text,
    condition_type character varying(50) NOT NULL,
    release_to character varying(20) DEFAULT 'seller'::character varying,
    seller_percentage numeric(5,2) DEFAULT 100,
    delay_hours integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT escrow_release_rules_condition_type_check CHECK (((condition_type)::text = ANY ((ARRAY['buyer_confirmation'::character varying, 'inspection_window_expired'::character varying, 'dispute_resolved'::character varying, 'admin_override'::character varying])::text[]))),
    CONSTRAINT escrow_release_rules_release_to_check CHECK (((release_to)::text = ANY ((ARRAY['seller'::character varying, 'buyer'::character varying, 'split'::character varying])::text[])))
);


--
-- Name: TABLE escrow_release_rules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.escrow_release_rules IS 'Configurable rules for automatic and manual escrow releases';


--
-- Name: escrow_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escrow_transactions (
    escrow_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    platform_fee numeric(10,2) DEFAULT 0 NOT NULL,
    seller_payout numeric(10,2) NOT NULL,
    delivery_fee numeric(10,2) DEFAULT 0,
    status character varying(30) DEFAULT 'held'::character varying NOT NULL,
    inspection_window_hours integer DEFAULT 48,
    inspection_expires_at timestamp with time zone,
    buyer_confirmed_at timestamp with time zone,
    released_at timestamp with time zone,
    released_by uuid,
    release_reason character varying(100),
    dispute_raised_at timestamp with time zone,
    dispute_reason text,
    dispute_resolved_at timestamp with time zone,
    dispute_resolution text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT escrow_transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT escrow_transactions_status_check CHECK (((status)::text = ANY ((ARRAY['held'::character varying, 'released'::character varying, 'refunded'::character varying, 'disputed'::character varying, 'partial_release'::character varying])::text[])))
);


--
-- Name: TABLE escrow_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.escrow_transactions IS 'Holds payment funds until buyer confirmation or inspection window expires';


--
-- Name: garage_analytics_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garage_analytics_summary (
    summary_id uuid DEFAULT gen_random_uuid() NOT NULL,
    garage_id uuid,
    period character varying(20) NOT NULL,
    total_orders integer DEFAULT 0,
    total_revenue numeric(12,2) DEFAULT 0,
    total_bids integer DEFAULT 0,
    win_rate numeric(5,2) DEFAULT 0,
    avg_rating numeric(3,2) DEFAULT 0,
    unique_customers integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: garage_bid_analytics; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.garage_bid_analytics AS
 SELECT garage_id,
    date_trunc('month'::text, created_at) AS month,
    count(*) AS total_bids,
    count(
        CASE
            WHEN (status = 'accepted'::text) THEN 1
            ELSE NULL::integer
        END) AS won_bids,
    count(
        CASE
            WHEN (status = 'rejected'::text) THEN 1
            ELSE NULL::integer
        END) AS lost_bids,
    round((((count(
        CASE
            WHEN (status = 'accepted'::text) THEN 1
            ELSE NULL::integer
        END))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS win_rate_percentage,
    avg(bid_amount) AS avg_bid_amount,
    avg((EXTRACT(epoch FROM (updated_at - created_at)) / (60)::numeric)) AS avg_response_time_minutes
   FROM public.bids b
  WHERE (created_at >= (CURRENT_DATE - '365 days'::interval))
  GROUP BY garage_id, (date_trunc('month'::text, created_at))
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW garage_bid_analytics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON MATERIALIZED VIEW public.garage_bid_analytics IS 'Monthly bid performance metrics including win rates';


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    order_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number character varying(20),
    request_id uuid,
    bid_id uuid,
    customer_id uuid,
    garage_id uuid,
    part_price numeric(10,2) NOT NULL,
    commission_rate numeric(4,3) NOT NULL,
    platform_fee numeric(10,2) NOT NULL,
    delivery_fee numeric(10,2) DEFAULT 25.00,
    total_amount numeric(10,2) NOT NULL,
    garage_payout_amount numeric(10,2) NOT NULL,
    payment_method text DEFAULT 'cash'::text,
    payment_status text DEFAULT 'pending'::text,
    payment_reference character varying(100),
    order_status text DEFAULT 'confirmed'::text,
    delivery_address text,
    delivery_notes text,
    driver_id uuid,
    tracking_code character varying(50),
    estimated_delivery_at timestamp without time zone,
    actual_delivery_at timestamp without time zone,
    delivery_signature_url text,
    delivery_photo_url text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    completed_at timestamp without time zone,
    version integer DEFAULT 1,
    delivery_zone_id integer,
    deleted_at timestamp without time zone,
    deposit_amount numeric(10,2) DEFAULT 0,
    deposit_status character varying(20) DEFAULT 'none'::character varying,
    deposit_intent_id uuid,
    final_payment_intent_id uuid,
    undo_deadline timestamp without time zone,
    undo_used boolean DEFAULT false,
    undo_at timestamp without time zone,
    undo_reason text,
    CONSTRAINT orders_commission_rate_range CHECK (((commission_rate >= (0)::numeric) AND (commission_rate <= 0.15))),
    CONSTRAINT orders_order_status_check CHECK ((order_status = ANY (ARRAY['pending_payment'::text, 'confirmed'::text, 'preparing'::text, 'ready_for_pickup'::text, 'ready_for_collection'::text, 'collected'::text, 'qc_in_progress'::text, 'qc_passed'::text, 'qc_failed'::text, 'returning_to_garage'::text, 'in_transit'::text, 'out_for_delivery'::text, 'delivered'::text, 'completed'::text, 'cancelled_by_customer'::text, 'cancelled_by_garage'::text, 'cancelled_by_ops'::text, 'disputed'::text, 'refunded'::text]))),
    CONSTRAINT orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'wallet'::text]))),
    CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'refunded'::text, 'partially_refunded'::text])))
);


--
-- Name: COLUMN orders.payment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.payment_method IS 'Payment method: cod (Cash on Delivery), card, wallet';


--
-- Name: COLUMN orders.deposit_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.deposit_amount IS 'Upfront deposit amount for order confirmation';


--
-- Name: COLUMN orders.deposit_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.deposit_status IS 'Deposit lifecycle status: none, pending, paid, partially_refunded, refunded';


--
-- Name: COLUMN orders.undo_deadline; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.undo_deadline IS 'Grace window deadline for customer undo action after order creation';


--
-- Name: COLUMN orders.undo_used; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.undo_used IS 'Whether the undo option was exercised';


--
-- Name: COLUMN orders.undo_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.undo_at IS 'Timestamp when undo was executed';


--
-- Name: COLUMN orders.undo_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.undo_reason IS 'User-provided reason for undo';


--
-- Name: garage_daily_analytics; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.garage_daily_analytics AS
 SELECT garage_id,
    date_trunc('day'::text, created_at) AS date,
    count(DISTINCT order_id) AS orders_count,
    sum(total_amount) AS revenue,
    avg(platform_fee) AS avg_platform_fee,
    count(DISTINCT customer_id) AS unique_customers,
    avg((EXTRACT(epoch FROM (updated_at - created_at)) / (3600)::numeric)) AS avg_fulfillment_hours,
    count(
        CASE
            WHEN (order_status = 'completed'::text) THEN 1
            ELSE NULL::integer
        END) AS completed_orders,
    count(
        CASE
            WHEN (order_status = 'cancelled'::text) THEN 1
            ELSE NULL::integer
        END) AS cancelled_orders
   FROM public.orders o
  WHERE (created_at >= (CURRENT_DATE - '365 days'::interval))
  GROUP BY garage_id, (date_trunc('day'::text, created_at))
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW garage_daily_analytics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON MATERIALIZED VIEW public.garage_daily_analytics IS 'Daily aggregated analytics for garage performance tracking';


--
-- Name: garage_ignored_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garage_ignored_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    garage_id uuid,
    request_id uuid,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: garage_parts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garage_parts (
    part_id uuid DEFAULT gen_random_uuid() NOT NULL,
    garage_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    part_description text,
    part_number character varying(100),
    car_make character varying(100) NOT NULL,
    car_model character varying(100),
    car_year_from integer,
    car_year_to integer,
    part_condition character varying(20) NOT NULL,
    price numeric(10,2) NOT NULL,
    price_type character varying(20) DEFAULT 'fixed'::character varying,
    warranty_days integer DEFAULT 0,
    image_urls text[] DEFAULT '{}'::text[],
    quantity integer DEFAULT 1,
    status character varying(20) DEFAULT 'active'::character varying,
    view_count integer DEFAULT 0,
    order_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT garage_parts_part_condition_check CHECK (((part_condition)::text = ANY (ARRAY[('new'::character varying)::text, ('used'::character varying)::text, ('refurbished'::character varying)::text]))),
    CONSTRAINT garage_parts_price_type_check CHECK (((price_type)::text = ANY (ARRAY[('fixed'::character varying)::text, ('negotiable'::character varying)::text]))),
    CONSTRAINT garage_parts_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('sold'::character varying)::text, ('hidden'::character varying)::text])))
);


--
-- Name: garage_payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garage_payment_methods (
    method_id uuid DEFAULT gen_random_uuid() NOT NULL,
    garage_id uuid NOT NULL,
    stripe_payment_method_id character varying(255) NOT NULL,
    stripe_customer_id character varying(255) NOT NULL,
    card_last4 character varying(4),
    card_brand character varying(20),
    card_exp_month integer,
    card_exp_year integer,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE garage_payment_methods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.garage_payment_methods IS 'Saved payment methods (Stripe) for garages';


--
-- Name: garage_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garage_payouts (
    payout_id uuid DEFAULT gen_random_uuid() NOT NULL,
    garage_id uuid,
    order_id uuid,
    gross_amount numeric(10,2) NOT NULL,
    commission_amount numeric(10,2) NOT NULL,
    net_amount numeric(10,2) NOT NULL,
    payout_status character varying(50) DEFAULT 'pending'::character varying,
    payout_method character varying(50),
    payout_reference character varying(100),
    bank_account_last4 character varying(4),
    scheduled_for date,
    processed_at timestamp without time zone,
    failure_reason text,
    created_at timestamp without time zone DEFAULT now(),
    garage_confirmation_notes text,
    sent_at timestamp without time zone,
    confirmed_at timestamp without time zone,
    confirmation_deadline timestamp without time zone,
    auto_confirmed boolean DEFAULT false,
    original_amount numeric(10,2),
    adjustment_reason text,
    adjusted_at timestamp without time zone,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    cancellation_reason text,
    cancelled_at timestamp with time zone,
    payout_type character varying(50) DEFAULT 'normal'::character varying,
    held_reason text,
    held_at timestamp without time zone,
    CONSTRAINT garage_payouts_payout_status_check CHECK (((payout_status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'awaiting_confirmation'::character varying, 'completed'::character varying, 'disputed'::character varying, 'failed'::character varying, 'on_hold'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: COLUMN garage_payouts.original_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.garage_payouts.original_amount IS 'Original payout amount before any adjustments';


--
-- Name: COLUMN garage_payouts.adjustment_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.garage_payouts.adjustment_reason IS 'Reason for payout adjustment (e.g., partial refund)';


--
-- Name: COLUMN garage_payouts.adjusted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.garage_payouts.adjusted_at IS 'Timestamp when payout was adjusted';


--
-- Name: garage_penalties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garage_penalties (
    penalty_id uuid DEFAULT gen_random_uuid() NOT NULL,
    garage_id uuid NOT NULL,
    order_id uuid,
    penalty_type character varying(30) NOT NULL,
    amount numeric(10,2) NOT NULL,
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying,
    deducted_from_payout_id uuid,
    waived_by uuid,
    waived_at timestamp with time zone,
    waiver_reason text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT garage_penalties_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'deducted'::character varying, 'waived'::character varying])::text[]))),
    CONSTRAINT garage_penalties_type_check CHECK (((penalty_type)::text = ANY ((ARRAY['cancellation'::character varying, 'repeat_cancellation'::character varying, 'wrong_part'::character varying, 'damaged_part'::character varying, 'out_of_stock'::character varying])::text[])))
);


--
-- Name: part_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.part_requests (
    request_id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    car_make text NOT NULL,
    car_model text NOT NULL,
    car_year integer NOT NULL,
    vin_number character varying(17),
    part_description text NOT NULL,
    part_number character varying(50),
    condition_required text DEFAULT 'any'::text,
    image_urls text[],
    delivery_address_id uuid,
    delivery_address_text text,
    status text DEFAULT 'active'::text,
    cancellation_reason text,
    bid_count integer DEFAULT 0,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone DEFAULT (now() + '24:00:00'::interval),
    cancelled_at timestamp without time zone,
    delivery_lat numeric(10,8),
    delivery_lng numeric(11,8),
    deleted_at timestamp without time zone,
    part_category character varying(50),
    car_front_image_url character varying(500),
    car_rear_image_url character varying(500),
    saved_vehicle_id uuid,
    part_subcategory character varying(100),
    vin_image_url character varying(500),
    CONSTRAINT part_requests_car_year_dynamic_check CHECK (((car_year >= 1900) AND ((car_year)::numeric <= (EXTRACT(year FROM now()) + (2)::numeric)))),
    CONSTRAINT part_requests_condition_required_check CHECK ((condition_required = ANY (ARRAY['new'::text, 'used'::text, 'any'::text]))),
    CONSTRAINT part_requests_status_check CHECK ((status = ANY (ARRAY['active'::text, 'accepted'::text, 'expired'::text, 'cancelled_by_customer'::text])))
);


--
-- Name: COLUMN part_requests.delivery_lat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.part_requests.delivery_lat IS 'Customer selected delivery latitude';


--
-- Name: COLUMN part_requests.delivery_lng; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.part_requests.delivery_lng IS 'Customer selected delivery longitude';


--
-- Name: COLUMN part_requests.car_front_image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.part_requests.car_front_image_url IS 'Front view of vehicle for identification (license plate, front bumper)';


--
-- Name: COLUMN part_requests.car_rear_image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.part_requests.car_rear_image_url IS 'Rear view of vehicle for identification (model/trim verification)';


--
-- Name: COLUMN part_requests.part_subcategory; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.part_requests.part_subcategory IS 'Subcategory of the part (e.g., Pistons under Engine category)';


--
-- Name: COLUMN part_requests.vin_image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.part_requests.vin_image_url IS 'VIN photo transmitted with request for garage reference';


--
-- Name: garage_popular_parts; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.garage_popular_parts AS
 SELECT o.garage_id,
    pr.part_description AS part_name,
    pr.car_make,
    pr.car_model,
    COALESCE(pr.part_category, 'Other'::character varying) AS category,
    count(*) AS order_count,
    sum(o.total_amount) AS total_revenue,
    avg(o.total_amount) AS avg_price,
    max(o.created_at) AS last_ordered
   FROM (public.orders o
     JOIN public.part_requests pr ON ((o.request_id = pr.request_id)))
  WHERE ((o.created_at >= (CURRENT_DATE - '90 days'::interval)) AND (o.order_status = ANY (ARRAY['completed'::text, 'delivered'::text])))
  GROUP BY o.garage_id, pr.part_description, pr.car_make, pr.car_model, pr.part_category
 HAVING (count(*) >= 2)
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW garage_popular_parts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON MATERIALIZED VIEW public.garage_popular_parts IS 'Most frequently ordered parts by garage for inventory insights';


--
-- Name: garage_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garage_products (
    product_id uuid DEFAULT gen_random_uuid() NOT NULL,
    garage_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    part_number character varying(50),
    brand character varying(100),
    category character varying(50),
    condition character varying(20) DEFAULT 'used_good'::character varying NOT NULL,
    warranty_days integer DEFAULT 0,
    price numeric(10,2) NOT NULL,
    original_price numeric(10,2),
    currency character varying(3) DEFAULT 'QAR'::character varying,
    quantity integer DEFAULT 1,
    compatible_makes text[],
    compatible_models text[],
    year_from integer,
    year_to integer,
    image_urls text[],
    video_url text,
    status character varying(20) DEFAULT 'draft'::character varying,
    is_featured boolean DEFAULT false,
    featured_until timestamp without time zone,
    view_count integer DEFAULT 0,
    inquiry_count integer DEFAULT 0,
    purchase_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT valid_condition CHECK (((condition)::text = ANY (ARRAY[('new'::character varying)::text, ('used_excellent'::character varying)::text, ('used_good'::character varying)::text, ('used_fair'::character varying)::text, ('refurbished'::character varying)::text]))),
    CONSTRAINT valid_status CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('active'::character varying)::text, ('sold'::character varying)::text, ('archived'::character varying)::text])))
);


--
-- Name: garage_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garage_settings (
    garage_id uuid NOT NULL,
    auto_renew boolean DEFAULT true NOT NULL,
    provides_repairs boolean DEFAULT false NOT NULL,
    provides_quick_services boolean DEFAULT false NOT NULL,
    has_mobile_technicians boolean DEFAULT false NOT NULL,
    mobile_service_radius_km integer,
    max_concurrent_services integer DEFAULT 3 NOT NULL,
    service_capabilities uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    quick_services_offered text[] DEFAULT '{}'::text[] NOT NULL,
    repair_specializations text[] DEFAULT '{}'::text[] NOT NULL,
    sells_parts boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: garage_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garage_stats (
    garage_id uuid NOT NULL,
    total_services_completed integer DEFAULT 0 NOT NULL,
    quick_service_rating numeric(2,1),
    repair_rating numeric(2,1),
    average_response_time_minutes integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: garage_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garage_subscriptions (
    subscription_id uuid DEFAULT gen_random_uuid() NOT NULL,
    garage_id uuid,
    plan_id uuid,
    status character varying(20) DEFAULT 'active'::character varying,
    billing_cycle_start date NOT NULL,
    billing_cycle_end date NOT NULL,
    next_billing_date date,
    bids_used_this_cycle integer DEFAULT 0,
    auto_renew boolean DEFAULT true,
    trial_ends_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    cancelled_at timestamp without time zone,
    cancellation_reason text,
    is_admin_granted boolean DEFAULT false,
    admin_notes text,
    next_plan_id uuid,
    locked_until timestamp with time zone,
    renewal_reminder_sent boolean DEFAULT false,
    last_billing_attempt timestamp with time zone,
    billing_retry_count integer DEFAULT 0,
    CONSTRAINT garage_subscriptions_status_check CHECK (((status)::text = ANY (ARRAY[('trial'::character varying)::text, ('active'::character varying)::text, ('past_due'::character varying)::text, ('cancelled'::character varying)::text, ('expired'::character varying)::text, ('suspended'::character varying)::text])))
);


--
-- Name: garages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garages (
    garage_id uuid NOT NULL,
    garage_name text NOT NULL,
    trade_license_number character varying(50),
    address text,
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    rating_average numeric(3,2) DEFAULT 0,
    rating_count integer DEFAULT 0,
    total_transactions integer DEFAULT 0,
    fulfillment_rate numeric(5,2) DEFAULT 100.00,
    response_time_avg_minutes integer DEFAULT 0,
    is_verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    phone_number character varying(20),
    cr_number character varying(50),
    bank_name character varying(100),
    bank_account character varying(50),
    iban character varying(50),
    approval_status character varying(20) DEFAULT 'demo'::character varying,
    approval_date timestamp without time zone,
    approved_by uuid,
    rejection_reason text,
    demo_expires_at timestamp without time zone,
    admin_notes text,
    deleted_at timestamp without time zone,
    supplier_type character varying(10) DEFAULT 'used'::character varying,
    specialized_brands text[] DEFAULT '{}'::text[],
    all_brands boolean DEFAULT true,
    subscription_plan character varying(20) DEFAULT 'starter'::character varying,
    subscription_start_date timestamp with time zone DEFAULT now(),
    subscription_end_date timestamp with time zone,
    billing_cycle character varying(10) DEFAULT 'monthly'::character varying,
    auto_renew boolean DEFAULT true,
    sells_parts boolean DEFAULT true,
    provides_repairs boolean DEFAULT false,
    provides_quick_services boolean DEFAULT false,
    has_mobile_technicians boolean DEFAULT false,
    quick_services_offered text[] DEFAULT '{}'::text[],
    repair_specializations text[] DEFAULT '{}'::text[],
    max_concurrent_services integer DEFAULT 3,
    average_response_time_minutes integer,
    total_services_completed integer DEFAULT 0,
    quick_service_rating numeric(2,1),
    repair_rating numeric(2,1),
    cancellations_this_month integer DEFAULT 0,
    last_cancellation_reset timestamp with time zone DEFAULT now(),
    preferred_plan_code character varying(50),
    current_plan_code character varying(50) DEFAULT 'free'::character varying,
    stripe_customer_id character varying(255),
    CONSTRAINT garages_approval_status_check CHECK (((approval_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('demo'::character varying)::text, ('expired'::character varying)::text]))),
    CONSTRAINT garages_billing_cycle_check CHECK (((billing_cycle)::text = ANY ((ARRAY['monthly'::character varying, 'annual'::character varying])::text[]))),
    CONSTRAINT garages_supplier_type_check CHECK (((supplier_type)::text = ANY (ARRAY[('used'::character varying)::text, ('new'::character varying)::text, ('both'::character varying)::text])))
);


--
-- Name: COLUMN garages.supplier_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.garages.supplier_type IS 'Type of parts: used, new, or both';


--
-- Name: COLUMN garages.specialized_brands; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.garages.specialized_brands IS 'Array of car makes this garage specializes in (e.g., Toyota, Nissan)';


--
-- Name: COLUMN garages.all_brands; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.garages.all_brands IS 'If true, garage deals with all brands (no filtering)';


--
-- Name: COLUMN garages.sells_parts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.garages.sells_parts IS 'Can list and sell spare parts';


--
-- Name: COLUMN garages.provides_repairs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.garages.provides_repairs IS 'Offers workshop repair services';


--
-- Name: COLUMN garages.provides_quick_services; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.garages.provides_quick_services IS 'Provides quick on-site services (battery, oil, etc)';


--
-- Name: COLUMN garages.has_mobile_technicians; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.garages.has_mobile_technicians IS 'Has mobile technicians for on-site service';


--
-- Name: COLUMN garages.preferred_plan_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.garages.preferred_plan_code IS 'Plan tier garage is interested in upgrading to';


--
-- Name: COLUMN garages.current_plan_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.garages.current_plan_code IS 'Current active subscription plan';


--
-- Name: hub_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hub_locations (
    hub_id integer NOT NULL,
    hub_name character varying(100) NOT NULL,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    is_primary boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: hub_locations_hub_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hub_locations_hub_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hub_locations_hub_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hub_locations_hub_id_seq OWNED BY public.hub_locations.hub_id;


--
-- Name: idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_keys (
    key character varying(255) NOT NULL,
    transaction_id uuid,
    response jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp without time zone DEFAULT (CURRENT_TIMESTAMP + '24:00:00'::interval) NOT NULL,
    request_hash character varying(64),
    user_id uuid
);


--
-- Name: TABLE idempotency_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.idempotency_keys IS 'Prevents duplicate payment processing, auto-expires after 24h';


--
-- Name: inspection_criteria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inspection_criteria (
    criteria_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    category character varying(50) DEFAULT 'general'::character varying,
    is_required boolean DEFAULT true,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: invoice_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    checksum character varying(64),
    applied_at timestamp without time zone DEFAULT now()
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    notification_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    notification_type character varying(50) NOT NULL,
    title text NOT NULL,
    title_ar text,
    body text NOT NULL,
    body_ar text,
    data jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: operations_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operations_staff (
    staff_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    full_name character varying(100) NOT NULL,
    role character varying(50) DEFAULT 'operator'::character varying,
    permissions jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_reviews (
    review_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    customer_id uuid,
    garage_id uuid,
    overall_rating integer NOT NULL,
    part_quality_rating integer,
    communication_rating integer,
    delivery_rating integer,
    review_text text,
    review_images text[],
    garage_response text,
    garage_response_at timestamp without time zone,
    is_visible boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    moderation_status character varying(20) DEFAULT 'pending'::character varying,
    moderated_by uuid,
    moderated_at timestamp without time zone,
    rejection_reason text,
    CONSTRAINT order_reviews_communication_rating_check CHECK (((communication_rating >= 1) AND (communication_rating <= 5))),
    CONSTRAINT order_reviews_delivery_rating_check CHECK (((delivery_rating >= 1) AND (delivery_rating <= 5))),
    CONSTRAINT order_reviews_moderation_status_check CHECK (((moderation_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text]))),
    CONSTRAINT order_reviews_overall_rating_check CHECK (((overall_rating >= 1) AND (overall_rating <= 5))),
    CONSTRAINT order_reviews_part_quality_rating_check CHECK (((part_quality_rating >= 1) AND (part_quality_rating <= 5)))
);


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status_history (
    history_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    old_status character varying(30),
    new_status character varying(30) NOT NULL,
    changed_by uuid,
    changed_by_type character varying(20),
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT order_status_history_changed_by_type_check CHECK (((changed_by_type)::text = ANY ((ARRAY['system'::character varying, 'customer'::character varying, 'garage'::character varying, 'driver'::character varying, 'admin'::character varying, 'support'::character varying, 'operations'::character varying])::text[])))
);


--
-- Name: TABLE order_status_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.order_status_history IS 'Complete audit trail of all order status changes';


--
-- Name: partner_service_performance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.partner_service_performance AS
SELECT
    NULL::uuid AS garage_id,
    NULL::text AS partner_name,
    NULL::boolean AS sells_parts,
    NULL::boolean AS provides_repairs,
    NULL::boolean AS provides_quick_services,
    NULL::boolean AS has_mobile_technicians,
    NULL::bigint AS total_part_requests,
    NULL::bigint AS completed_part_orders,
    NULL::bigint AS total_quick_services,
    NULL::bigint AS completed_quick_services,
    NULL::numeric AS avg_quick_service_rating,
    NULL::numeric(3,2) AS overall_rating,
    NULL::integer AS total_services_completed;


--
-- Name: payment_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_audit_logs (
    log_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    transaction_id uuid,
    action character varying(50) NOT NULL,
    ip_address inet,
    user_agent text,
    request_method character varying(10),
    request_path text,
    request_data jsonb,
    response_data jsonb,
    processing_time_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT valid_action CHECK (((action)::text = ANY ((ARRAY['initiated'::character varying, 'validated'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: TABLE payment_audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_audit_logs IS 'Append-only audit trail for compliance and forensics';


--
-- Name: payment_intents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_intents (
    intent_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    customer_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'QAR'::character varying,
    intent_type character varying(20) NOT NULL,
    provider character varying(20) NOT NULL,
    provider_intent_id character varying(255),
    provider_client_secret character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying,
    failure_reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE payment_intents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_intents IS 'Payment transactions - supports multiple providers';


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    method_id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    provider character varying(20) NOT NULL,
    provider_method_id character varying(255) NOT NULL,
    card_last4 character varying(4),
    card_brand character varying(20),
    card_exp_month integer,
    card_exp_year integer,
    cardholder_name character varying(100),
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE payment_methods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_methods IS 'Saved payment methods (cards) for customers';


--
-- Name: payment_refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_refunds (
    refund_id uuid DEFAULT gen_random_uuid() NOT NULL,
    intent_id uuid,
    order_id uuid,
    amount numeric(10,2) NOT NULL,
    reason character varying(50),
    reason_text text,
    provider_refund_id character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE payment_refunds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_refunds IS 'Refund records linked to payment intents';


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    transaction_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id uuid NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'QAR'::character varying NOT NULL,
    payment_method character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    card_last4 character varying(4),
    card_brand character varying(20),
    card_expiry_month integer,
    card_expiry_year integer,
    provider_response jsonb,
    provider_transaction_id character varying(255),
    idempotency_key character varying(255),
    refund_amount numeric(10,2) DEFAULT 0,
    refund_reason text,
    refunded_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp without time zone,
    failed_at timestamp without time zone,
    failure_reason text,
    error_code character varying(50),
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT payment_transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payment_transactions_card_expiry_month_check CHECK (((card_expiry_month >= 1) AND (card_expiry_month <= 12))),
    CONSTRAINT payment_transactions_card_expiry_year_check CHECK (((card_expiry_year)::numeric >= EXTRACT(year FROM CURRENT_DATE))),
    CONSTRAINT payment_transactions_check CHECK (((refund_amount >= (0)::numeric) AND (refund_amount <= amount))),
    CONSTRAINT valid_payment_method CHECK (((payment_method)::text = ANY ((ARRAY['mock_card'::character varying, 'cash'::character varying, 'qpay'::character varying])::text[]))),
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'success'::character varying, 'failed'::character varying, 'refunded'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: TABLE payment_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_transactions IS 'Stores all payment transactions with PCI-DSS compliant card storage (last 4 digits only)';


--
-- Name: COLUMN payment_transactions.card_last4; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_transactions.card_last4 IS 'Last 4 digits of card - PCI-DSS compliant';


--
-- Name: COLUMN payment_transactions.provider_response; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_transactions.provider_response IS 'Encrypted response from payment provider';


--
-- Name: COLUMN payment_transactions.idempotency_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_transactions.idempotency_key IS 'Client-generated UUID to prevent duplicate charges';


--
-- Name: payout_reversals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payout_reversals (
    reversal_id uuid DEFAULT gen_random_uuid() NOT NULL,
    garage_id uuid NOT NULL,
    original_payout_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT now(),
    processed_at timestamp without time zone,
    CONSTRAINT payout_reversals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'processed'::text, 'failed'::text])))
);


--
-- Name: TABLE payout_reversals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payout_reversals IS 'Tracks reversals for garage payouts that were already sent';


--
-- Name: product_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_inquiries (
    inquiry_id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    message text,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    responded_at timestamp without time zone
);


--
-- Name: proof_of_condition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proof_of_condition (
    proof_id uuid DEFAULT gen_random_uuid() NOT NULL,
    escrow_id uuid NOT NULL,
    order_id uuid NOT NULL,
    capture_type character varying(30) NOT NULL,
    image_urls text[] NOT NULL,
    video_url text,
    thumbnail_url text,
    captured_by uuid,
    captured_at timestamp with time zone DEFAULT now(),
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    device_info jsonb,
    hash_signature character varying(64),
    verified boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT proof_of_condition_capture_type_check CHECK (((capture_type)::text = ANY ((ARRAY['pickup_from_garage'::character varying, 'delivery_handoff'::character varying, 'customer_inspection'::character varying, 'dispute_evidence'::character varying])::text[])))
);


--
-- Name: TABLE proof_of_condition; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.proof_of_condition IS 'Timestamped photo/video evidence of part condition at each handoff';


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    platform character varying(10) NOT NULL,
    device_id character varying(100),
    app_type character varying(20) DEFAULT 'customer'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT push_tokens_app_type_check CHECK (((app_type)::text = ANY ((ARRAY['customer'::character varying, 'driver'::character varying])::text[]))),
    CONSTRAINT push_tokens_platform_check CHECK (((platform)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying])::text[])))
);


--
-- Name: quality_inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_inspections (
    inspection_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    inspector_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying,
    checklist_results jsonb DEFAULT '[]'::jsonb,
    notes text,
    failure_reason text,
    photo_urls text[] DEFAULT '{}'::text[],
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    part_grade character varying(10),
    condition_assessment character varying(20),
    item_notes jsonb DEFAULT '{}'::jsonb,
    failure_category character varying(50),
    result character varying(20),
    inspector_remarks text,
    CONSTRAINT quality_inspections_condition_assessment_check CHECK (((condition_assessment)::text = ANY (ARRAY[('excellent'::character varying)::text, ('good'::character varying)::text, ('fair'::character varying)::text, ('poor'::character varying)::text, ('defective'::character varying)::text]))),
    CONSTRAINT quality_inspections_failure_category_check CHECK (((failure_category)::text = ANY (ARRAY[('damaged'::character varying)::text, ('wrong_part'::character varying)::text, ('missing_components'::character varying)::text, ('quality_mismatch'::character varying)::text, ('counterfeit'::character varying)::text, ('rust_corrosion'::character varying)::text, ('non_functional'::character varying)::text, ('packaging_issue'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT quality_inspections_part_grade_check CHECK (((part_grade)::text = ANY (ARRAY[('A'::character varying)::text, ('B'::character varying)::text, ('C'::character varying)::text, ('reject'::character varying)::text]))),
    CONSTRAINT quality_inspections_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('in_progress'::character varying)::text, ('passed'::character varying)::text, ('failed'::character varying)::text])))
);


--
-- Name: quick_service_revenue; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.quick_service_revenue AS
 SELECT NULL::timestamp with time zone AS date,
    NULL::text AS service_type,
    (0)::bigint AS total_requests,
    (0)::bigint AS completed,
    (0)::numeric AS total_revenue,
    (0)::numeric AS platform_commission,
    (0)::numeric AS garage_earnings,
    NULL::numeric AS avg_price,
    NULL::numeric AS avg_completion_minutes
  WHERE false;


--
-- Name: receipt_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.receipt_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    token_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    device_info text,
    ip_address character varying(45),
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    revoked_at timestamp with time zone,
    replaced_by uuid
);


--
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refunds (
    refund_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    processed_by text,
    payment_intent_id text,
    created_at timestamp without time zone DEFAULT now(),
    processed_at timestamp without time zone,
    refund_type character varying(30),
    delivery_fee_retained numeric(10,2) DEFAULT 0,
    stripe_refund_id character varying(100),
    refund_amount numeric(10,2),
    original_amount numeric(10,2),
    refund_reason text,
    refund_status character varying(30) DEFAULT 'pending'::character varying,
    refund_method text DEFAULT 'original_payment'::text,
    initiated_by text,
    idempotency_key character varying(255),
    stripe_refund_status character varying(50),
    last_synced_at timestamp with time zone,
    reconciliation_status character varying(20) DEFAULT 'pending'::character varying,
    CONSTRAINT refunds_reconciliation_status_check CHECK (((reconciliation_status)::text = ANY ((ARRAY['pending'::character varying, 'matched'::character varying, 'mismatch'::character varying, 'manual'::character varying])::text[]))),
    CONSTRAINT refunds_refund_status_check CHECK (((refund_status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: TABLE refunds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.refunds IS 'Customer refund records with race condition protection';


--
-- Name: resolution_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resolution_logs (
    log_id integer NOT NULL,
    order_id uuid,
    customer_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    action_type character varying(50) NOT NULL,
    action_details jsonb,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE resolution_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.resolution_logs IS 'Audit log of all quick actions performed by support agents';


--
-- Name: COLUMN resolution_logs.action_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.resolution_logs.action_type IS 'Type of action: full_refund, partial_refund, goodwill_credit, cancel_order, reassign_driver, rush_delivery, escalate_to_ops';


--
-- Name: COLUMN resolution_logs.action_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.resolution_logs.action_details IS 'JSON data with action-specific details like amount, reason, etc.';


--
-- Name: resolution_logs_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.resolution_logs_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: resolution_logs_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.resolution_logs_log_id_seq OWNED BY public.resolution_logs.log_id;


--
-- Name: return_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.return_requests (
    return_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    reason character varying(50) NOT NULL,
    photo_urls text[],
    condition_description text,
    return_fee numeric(10,2) DEFAULT 0,
    delivery_fee_retained numeric(10,2) DEFAULT 0,
    refund_amount numeric(10,2),
    status character varying(20) DEFAULT 'pending'::character varying,
    pickup_driver_id uuid,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    CONSTRAINT return_requests_reason_check CHECK (((reason)::text = ANY ((ARRAY['unused'::character varying, 'defective'::character varying, 'wrong_part'::character varying])::text[]))),
    CONSTRAINT return_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'pickup_scheduled'::character varying, 'picked_up'::character varying, 'inspected'::character varying, 'completed'::character varying])::text[])))
);


--
-- Name: reward_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reward_tiers (
    tier_name character varying(20) NOT NULL,
    min_points integer NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    priority_support boolean DEFAULT false,
    tier_badge_color character varying(20),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE reward_tiers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reward_tiers IS 'Tier definitions with benefits';


--
-- Name: reward_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reward_transactions (
    transaction_id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    points_change integer NOT NULL,
    transaction_type character varying(50) NOT NULL,
    order_id uuid,
    description text,
    balance_after integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE reward_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reward_transactions IS 'Audit trail for loyalty points accrual and redemption';


--
-- Name: staff_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_profiles (
    staff_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    role character varying(50) NOT NULL,
    department character varying(100),
    employee_id character varying(50),
    hire_date date,
    permissions jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT staff_profiles_role_check CHECK (((role)::text = ANY (ARRAY[('operations'::character varying)::text, ('accounting'::character varying)::text, ('customer_service'::character varying)::text, ('quality_control'::character varying)::text, ('logistics'::character varying)::text, ('hr'::character varying)::text, ('management'::character varying)::text])))
);


--
-- Name: stripe_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    stripe_customer_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE stripe_customers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stripe_customers IS 'Mapping between app customers and Stripe customer IDs';


--
-- Name: stripe_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_webhook_events (
    event_id character varying(255) NOT NULL,
    event_type character varying(100) NOT NULL,
    payload jsonb,
    processed_at timestamp with time zone DEFAULT now(),
    status character varying(20) DEFAULT 'processed'::character varying
);


--
-- Name: TABLE stripe_webhook_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stripe_webhook_events IS 'Log of processed Stripe webhook events';


--
-- Name: subscription_change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_change_requests (
    request_id uuid DEFAULT gen_random_uuid() NOT NULL,
    garage_id uuid NOT NULL,
    from_plan_id uuid,
    to_plan_id uuid NOT NULL,
    request_type public.request_type_enum NOT NULL,
    status public.request_status_enum DEFAULT 'pending'::public.request_status_enum,
    request_reason text,
    admin_notes text,
    processed_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    payment_status character varying(20) DEFAULT 'unpaid'::character varying,
    payment_amount numeric(10,2),
    payment_intent_id character varying(255),
    invoice_number character varying(50),
    bank_reference character varying(100),
    paid_at timestamp with time zone,
    CONSTRAINT subscription_change_requests_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['unpaid'::character varying, 'pending'::character varying, 'paid'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[])))
);


--
-- Name: COLUMN subscription_change_requests.payment_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscription_change_requests.payment_status IS 'unpaid=no payment yet, pending=waiting for Stripe/bank, paid=verified, failed=payment failed, refunded=cancelled';


--
-- Name: COLUMN subscription_change_requests.payment_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscription_change_requests.payment_amount IS 'Amount to pay for upgrade (from subscription_plans.monthly_fee)';


--
-- Name: COLUMN subscription_change_requests.payment_intent_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscription_change_requests.payment_intent_id IS 'Stripe PaymentIntent ID for card payments';


--
-- Name: COLUMN subscription_change_requests.invoice_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscription_change_requests.invoice_number IS 'Invoice number for bank transfer payments';


--
-- Name: COLUMN subscription_change_requests.bank_reference; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscription_change_requests.bank_reference IS 'Bank transfer reference number (admin-verified)';


--
-- Name: COLUMN subscription_change_requests.paid_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscription_change_requests.paid_at IS 'Timestamp when payment was verified';


--
-- Name: subscription_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_history (
    history_id uuid DEFAULT gen_random_uuid() NOT NULL,
    garage_id uuid,
    old_plan character varying(20),
    new_plan character varying(20),
    change_reason character varying(50),
    changed_by uuid,
    price_paid numeric(10,2),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE subscription_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscription_history IS 'Audit log of subscription changes';


--
-- Name: subscription_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_invoices (
    invoice_id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number character varying(50) NOT NULL,
    garage_id uuid NOT NULL,
    subscription_id uuid,
    request_id uuid,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'QAR'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    payment_method character varying(20),
    payment_intent_id character varying(255),
    bank_reference character varying(100),
    plan_name character varying(100),
    plan_name_ar character varying(100),
    billing_period_start date,
    billing_period_end date,
    pdf_path character varying(500),
    issued_at timestamp with time zone DEFAULT now(),
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE subscription_invoices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscription_invoices IS 'Invoice records for subscription payments';


--
-- Name: subscription_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_payments (
    payment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'QAR'::character varying,
    payment_method character varying(50),
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    payment_reference character varying(100),
    failure_reason text,
    invoice_number character varying(50),
    invoice_url text,
    created_at timestamp without time zone DEFAULT now(),
    processed_at timestamp without time zone,
    CONSTRAINT subscription_payments_payment_status_check CHECK (((payment_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('processing'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text, ('refunded'::character varying)::text])))
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    plan_id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_code character varying(20) NOT NULL,
    plan_name character varying(50) NOT NULL,
    plan_name_ar character varying(50),
    monthly_fee numeric(10,2) NOT NULL,
    commission_rate numeric(4,3) NOT NULL,
    max_bids_per_month integer,
    features jsonb DEFAULT '{}'::jsonb,
    is_featured boolean DEFAULT false,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    monthly_price_qar numeric(10,2),
    annual_price_qar numeric(10,2),
    max_monthly_orders integer,
    analytics_enabled boolean DEFAULT false,
    priority_support boolean DEFAULT false,
    api_access boolean DEFAULT false,
    ad_campaigns_allowed boolean DEFAULT false,
    max_team_members integer DEFAULT 1,
    features_json jsonb,
    active boolean DEFAULT true,
    CONSTRAINT subscription_plans_commission_rate_range CHECK (((commission_rate >= (0)::numeric) AND (commission_rate <= 0.15)))
);


--
-- Name: TABLE subscription_plans; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscription_plans IS 'Subscription tier definitions with features and pricing';


--
-- Name: subscription_revenue_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.subscription_revenue_stats AS
 SELECT sp.plan_code,
    sp.plan_name,
    count(g.garage_id) AS active_subscriptions,
    sum(
        CASE
            WHEN ((g.billing_cycle)::text = 'monthly'::text) THEN sp.monthly_price_qar
            ELSE (sp.annual_price_qar / (12)::numeric)
        END) AS monthly_recurring_revenue,
    avg(
        CASE
            WHEN ((g.billing_cycle)::text = 'monthly'::text) THEN sp.monthly_price_qar
            ELSE sp.annual_price_qar
        END) AS avg_subscription_value
   FROM (public.subscription_plans sp
     LEFT JOIN public.garages g ON (((sp.plan_code)::text = (g.subscription_plan)::text)))
  WHERE (sp.active = true)
  GROUP BY sp.plan_code, sp.plan_name, sp.display_order
  ORDER BY sp.display_order;


--
-- Name: support_escalations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_escalations (
    escalation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    customer_id uuid NOT NULL,
    escalated_by uuid NOT NULL,
    reason text NOT NULL,
    priority character varying(20) DEFAULT 'normal'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    resolved_by uuid,
    resolution_notes text,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    resolution_action character varying(50),
    ticket_id uuid,
    assigned_to uuid,
    CONSTRAINT support_escalations_priority_check CHECK (((priority)::text = ANY ((ARRAY['normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT support_escalations_resolution_action_check CHECK (((resolution_action)::text = ANY ((ARRAY['refund'::character varying, 'partial_refund'::character varying, 'no_action'::character varying, 'reassign'::character varying, 'resolved'::character varying, 'approve_refund'::character varying, 'approve_cancellation'::character varying, 'reject'::character varying, 'acknowledge'::character varying])::text[]))),
    CONSTRAINT support_escalations_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'acknowledged'::character varying, 'in_progress'::character varying, 'resolved'::character varying])::text[])))
);


--
-- Name: TABLE support_escalations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.support_escalations IS 'Escalations from support team to operations for complex issues';


--
-- Name: COLUMN support_escalations.resolution_action; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_escalations.resolution_action IS 'Action taken to resolve the escalation';


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    ticket_id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    order_id uuid,
    subject character varying(200),
    status character varying(20) DEFAULT 'open'::character varying,
    priority character varying(20) DEFAULT 'normal'::character varying,
    assigned_to uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    last_message_at timestamp without time zone DEFAULT now(),
    sla_deadline timestamp without time zone DEFAULT (now() + '24:00:00'::interval),
    escalated_at timestamp without time zone,
    escalation_level integer DEFAULT 0,
    first_response_at timestamp without time zone,
    resolution_time_minutes integer,
    reopened_at timestamp without time zone,
    reopened_count integer DEFAULT 0,
    notes text,
    requester_id uuid NOT NULL,
    requester_type text DEFAULT 'customer'::text NOT NULL,
    category text DEFAULT 'general'::text,
    subcategory text,
    CONSTRAINT support_tickets_category_check CHECK ((category = ANY (ARRAY['delivery'::text, 'part_quality'::text, 'billing'::text, 'bid_dispute'::text, 'payout'::text, 'account'::text, 'other'::text, 'general'::text]))),
    CONSTRAINT support_tickets_priority_check CHECK (((priority)::text = ANY (ARRAY[('low'::character varying)::text, ('normal'::character varying)::text, ('high'::character varying)::text, ('urgent'::character varying)::text]))),
    CONSTRAINT support_tickets_requester_type_check CHECK ((requester_type = ANY (ARRAY['customer'::text, 'garage'::text, 'driver'::text, 'admin'::text]))),
    CONSTRAINT support_tickets_status_check CHECK (((status)::text = ANY (ARRAY[('open'::character varying)::text, ('in_progress'::character varying)::text, ('resolved'::character varying)::text, ('closed'::character varying)::text])))
);


--
-- Name: COLUMN support_tickets.sla_deadline; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_tickets.sla_deadline IS 'Deadline for first response (default 24 hours)';


--
-- Name: COLUMN support_tickets.escalated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_tickets.escalated_at IS 'When ticket was auto-escalated due to no response';


--
-- Name: COLUMN support_tickets.escalation_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_tickets.escalation_level IS '0=normal, 1=escalated, 2=urgent, 3=critical';


--
-- Name: COLUMN support_tickets.first_response_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_tickets.first_response_at IS 'When staff first responded';


--
-- Name: COLUMN support_tickets.resolution_time_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_tickets.resolution_time_minutes IS 'Total time to resolution';


--
-- Name: COLUMN support_tickets.reopened_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_tickets.reopened_at IS 'When customer last reopened the ticket';


--
-- Name: COLUMN support_tickets.reopened_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_tickets.reopened_count IS 'Number of times ticket was reopened by customer';


--
-- Name: technicians; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technicians (
    technician_id uuid DEFAULT gen_random_uuid() NOT NULL,
    garage_id uuid,
    name character varying(255) NOT NULL,
    phone character varying(20),
    photo_url text,
    specializations text[] DEFAULT '{}'::text[],
    experience_years integer,
    certification_urls text[],
    is_available boolean DEFAULT true,
    current_lat numeric(10,8),
    current_lng numeric(11,8),
    current_assignment_id uuid,
    total_services_completed integer DEFAULT 0,
    rating numeric(2,1),
    average_service_time_minutes integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE technicians; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.technicians IS 'Mobile technicians for quick services';


--
-- Name: undo_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.undo_audit_log (
    log_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    action character varying(30) NOT NULL,
    actor_id uuid NOT NULL,
    actor_type character varying(20) NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT undo_audit_log_action_check CHECK (((action)::text = ANY ((ARRAY['undo_initiated'::character varying, 'undo_completed'::character varying, 'undo_expired'::character varying, 'undo_failed'::character varying])::text[]))),
    CONSTRAINT undo_audit_log_actor_type_check CHECK (((actor_type)::text = ANY ((ARRAY['customer'::character varying, 'garage'::character varying, 'system'::character varying, 'admin'::character varying])::text[])))
);


--
-- Name: TABLE undo_audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.undo_audit_log IS 'Compliance audit trail for order undo operations';


--
-- Name: user_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_addresses (
    address_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label character varying(50) NOT NULL,
    address_text text NOT NULL,
    latitude numeric(10,8),
    longitude numeric(11,8),
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE user_addresses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_addresses IS 'DEPRECATED (2024-12-31): Use customer_addresses instead. Scheduled for removal Q2 2025. DO NOT USE IN NEW CODE.';


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone_number character varying(20) NOT NULL,
    password_hash text NOT NULL,
    user_type text NOT NULL,
    full_name text,
    email text,
    language_preference character varying(5) DEFAULT 'en'::character varying,
    is_active boolean DEFAULT true,
    last_login_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    is_suspended boolean DEFAULT false,
    suspension_reason text,
    settings jsonb DEFAULT '{"theme": "system", "language": "en", "notifications": {"bid": true, "push": true, "order": true, "delivery": true}}'::jsonb,
    deleted_at timestamp without time zone,
    CONSTRAINT users_user_type_check CHECK ((user_type = ANY (ARRAY['customer'::text, 'garage'::text, 'driver'::text, 'staff'::text, 'admin'::text])))
);


--
-- Name: v_garages_full_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_garages_full_view AS
 SELECT g.garage_id,
    g.garage_name,
    g.cr_number,
    g.location_lat,
    g.location_lng,
    g.approval_status,
    s.auto_renew,
    s.provides_repairs,
    s.provides_quick_services,
    s.mobile_service_radius_km,
    s.max_concurrent_services,
    s.service_capabilities,
    st.total_services_completed,
    st.quick_service_rating,
    st.repair_rating,
    st.average_response_time_minutes
   FROM ((public.garages g
     LEFT JOIN public.garage_settings s ON ((g.garage_id = s.garage_id)))
     LEFT JOIN public.garage_stats st ON ((g.garage_id = st.garage_id)));


--
-- Name: warranty_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warranty_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_notes note_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notes ALTER COLUMN note_id SET DEFAULT nextval('public.customer_notes_note_id_seq'::regclass);


--
-- Name: delivery_fee_tiers tier_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_fee_tiers ALTER COLUMN tier_id SET DEFAULT nextval('public.delivery_fee_tiers_tier_id_seq'::regclass);


--
-- Name: delivery_zones zone_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones ALTER COLUMN zone_id SET DEFAULT nextval('public.delivery_zones_zone_id_seq'::regclass);


--
-- Name: hub_locations hub_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hub_locations ALTER COLUMN hub_id SET DEFAULT nextval('public.hub_locations_hub_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: resolution_logs log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resolution_logs ALTER COLUMN log_id SET DEFAULT nextval('public.resolution_logs_log_id_seq'::regclass);


--
-- Name: ad_campaigns ad_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_pkey PRIMARY KEY (campaign_id);


--
-- Name: ad_impressions ad_impressions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_impressions
    ADD CONSTRAINT ad_impressions_pkey PRIMARY KEY (impression_id);


--
-- Name: ad_placements ad_placements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_placements
    ADD CONSTRAINT ad_placements_pkey PRIMARY KEY (placement_id);


--
-- Name: ad_pricing ad_pricing_campaign_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_pricing
    ADD CONSTRAINT ad_pricing_campaign_type_key UNIQUE (campaign_type);


--
-- Name: ad_pricing ad_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_pricing
    ADD CONSTRAINT ad_pricing_pkey PRIMARY KEY (pricing_id);


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (log_id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (log_id);


--
-- Name: bids bids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bids
    ADD CONSTRAINT bids_pkey PRIMARY KEY (bid_id);


--
-- Name: bids bids_request_id_garage_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bids
    ADD CONSTRAINT bids_request_id_garage_id_key UNIQUE (request_id, garage_id);


--
-- Name: cancellation_requests cancellation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_pkey PRIMARY KEY (cancellation_id);


--
-- Name: canned_responses canned_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canned_responses
    ADD CONSTRAINT canned_responses_pkey PRIMARY KEY (response_id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (message_id);


--
-- Name: counter_offers counter_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counter_offers
    ADD CONSTRAINT counter_offers_pkey PRIMARY KEY (counter_offer_id);


--
-- Name: customer_abuse_tracking customer_abuse_tracking_customer_id_month_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_abuse_tracking
    ADD CONSTRAINT customer_abuse_tracking_customer_id_month_year_key UNIQUE (customer_id, month_year);


--
-- Name: customer_abuse_tracking customer_abuse_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_abuse_tracking
    ADD CONSTRAINT customer_abuse_tracking_pkey PRIMARY KEY (tracking_id);


--
-- Name: customer_addresses customer_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_pkey PRIMARY KEY (address_id);


--
-- Name: customer_credits customer_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_credits
    ADD CONSTRAINT customer_credits_pkey PRIMARY KEY (credit_id);


--
-- Name: customer_notes customer_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notes
    ADD CONSTRAINT customer_notes_pkey PRIMARY KEY (note_id);


--
-- Name: customer_rewards customer_rewards_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_rewards
    ADD CONSTRAINT customer_rewards_customer_id_key UNIQUE (customer_id);


--
-- Name: customer_rewards customer_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_rewards
    ADD CONSTRAINT customer_rewards_pkey PRIMARY KEY (reward_id);


--
-- Name: customer_vehicles customer_vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_vehicles
    ADD CONSTRAINT customer_vehicles_pkey PRIMARY KEY (vehicle_id);


--
-- Name: delivery_assignments delivery_assignments_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_order_id_key UNIQUE (order_id);


--
-- Name: delivery_assignments delivery_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_pkey PRIMARY KEY (assignment_id);


--
-- Name: delivery_chats delivery_chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_chats
    ADD CONSTRAINT delivery_chats_pkey PRIMARY KEY (message_id);


--
-- Name: delivery_fee_tiers delivery_fee_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_fee_tiers
    ADD CONSTRAINT delivery_fee_tiers_pkey PRIMARY KEY (tier_id);


--
-- Name: delivery_vouchers delivery_vouchers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_vouchers
    ADD CONSTRAINT delivery_vouchers_code_key UNIQUE (code);


--
-- Name: delivery_vouchers delivery_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_vouchers
    ADD CONSTRAINT delivery_vouchers_pkey PRIMARY KEY (voucher_id);


--
-- Name: delivery_zone_history delivery_zone_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zone_history
    ADD CONSTRAINT delivery_zone_history_pkey PRIMARY KEY (history_id);


--
-- Name: delivery_zones delivery_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_pkey PRIMARY KEY (zone_id);


--
-- Name: disputes disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_pkey PRIMARY KEY (dispute_id);


--
-- Name: document_access_log document_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_access_log
    ADD CONSTRAINT document_access_log_pkey PRIMARY KEY (log_id);


--
-- Name: document_templates document_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_pkey PRIMARY KEY (template_id);


--
-- Name: documents documents_document_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_document_number_key UNIQUE (document_number);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (document_id);


--
-- Name: documents documents_verification_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_verification_code_key UNIQUE (verification_code);


--
-- Name: driver_locations driver_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_pkey PRIMARY KEY (driver_id);


--
-- Name: driver_payouts driver_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_payouts
    ADD CONSTRAINT driver_payouts_pkey PRIMARY KEY (payout_id);


--
-- Name: driver_transactions driver_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_transactions
    ADD CONSTRAINT driver_transactions_pkey PRIMARY KEY (transaction_id);


--
-- Name: driver_wallets driver_wallets_driver_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_wallets
    ADD CONSTRAINT driver_wallets_driver_id_key UNIQUE (driver_id);


--
-- Name: driver_wallets driver_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_wallets
    ADD CONSTRAINT driver_wallets_pkey PRIMARY KEY (wallet_id);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (driver_id);


--
-- Name: escrow_release_rules escrow_release_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow_release_rules
    ADD CONSTRAINT escrow_release_rules_pkey PRIMARY KEY (rule_id);


--
-- Name: escrow_release_rules escrow_release_rules_rule_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow_release_rules
    ADD CONSTRAINT escrow_release_rules_rule_name_key UNIQUE (rule_name);


--
-- Name: escrow_transactions escrow_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow_transactions
    ADD CONSTRAINT escrow_transactions_pkey PRIMARY KEY (escrow_id);


--
-- Name: garage_analytics_summary garage_analytics_summary_garage_id_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_analytics_summary
    ADD CONSTRAINT garage_analytics_summary_garage_id_period_key UNIQUE (garage_id, period);


--
-- Name: garage_analytics_summary garage_analytics_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_analytics_summary
    ADD CONSTRAINT garage_analytics_summary_pkey PRIMARY KEY (summary_id);


--
-- Name: garage_ignored_requests garage_ignored_requests_garage_id_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_ignored_requests
    ADD CONSTRAINT garage_ignored_requests_garage_id_request_id_key UNIQUE (garage_id, request_id);


--
-- Name: garage_ignored_requests garage_ignored_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_ignored_requests
    ADD CONSTRAINT garage_ignored_requests_pkey PRIMARY KEY (id);


--
-- Name: garage_parts garage_parts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_parts
    ADD CONSTRAINT garage_parts_pkey PRIMARY KEY (part_id);


--
-- Name: garage_payment_methods garage_payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_payment_methods
    ADD CONSTRAINT garage_payment_methods_pkey PRIMARY KEY (method_id);


--
-- Name: garage_payment_methods garage_payment_methods_stripe_payment_method_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_payment_methods
    ADD CONSTRAINT garage_payment_methods_stripe_payment_method_id_key UNIQUE (stripe_payment_method_id);


--
-- Name: garage_payouts garage_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_payouts
    ADD CONSTRAINT garage_payouts_pkey PRIMARY KEY (payout_id);


--
-- Name: garage_penalties garage_penalties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_penalties
    ADD CONSTRAINT garage_penalties_pkey PRIMARY KEY (penalty_id);


--
-- Name: garage_products garage_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_products
    ADD CONSTRAINT garage_products_pkey PRIMARY KEY (product_id);


--
-- Name: garage_settings garage_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_settings
    ADD CONSTRAINT garage_settings_pkey PRIMARY KEY (garage_id);


--
-- Name: garage_stats garage_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_stats
    ADD CONSTRAINT garage_stats_pkey PRIMARY KEY (garage_id);


--
-- Name: garage_subscriptions garage_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_subscriptions
    ADD CONSTRAINT garage_subscriptions_pkey PRIMARY KEY (subscription_id);


--
-- Name: garages garages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garages
    ADD CONSTRAINT garages_pkey PRIMARY KEY (garage_id);


--
-- Name: hub_locations hub_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hub_locations
    ADD CONSTRAINT hub_locations_pkey PRIMARY KEY (hub_id);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (key);


--
-- Name: inspection_criteria inspection_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_criteria
    ADD CONSTRAINT inspection_criteria_pkey PRIMARY KEY (criteria_id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (notification_id);


--
-- Name: operations_staff operations_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operations_staff
    ADD CONSTRAINT operations_staff_pkey PRIMARY KEY (staff_id);


--
-- Name: order_reviews order_reviews_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reviews
    ADD CONSTRAINT order_reviews_order_id_key UNIQUE (order_id);


--
-- Name: order_reviews order_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reviews
    ADD CONSTRAINT order_reviews_pkey PRIMARY KEY (review_id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (history_id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);


--
-- Name: part_requests part_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_pkey PRIMARY KEY (request_id);


--
-- Name: payment_audit_logs payment_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_audit_logs
    ADD CONSTRAINT payment_audit_logs_pkey PRIMARY KEY (log_id);


--
-- Name: payment_intents payment_intents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_pkey PRIMARY KEY (intent_id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (method_id);


--
-- Name: payment_refunds payment_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_pkey PRIMARY KEY (refund_id);


--
-- Name: payment_transactions payment_transactions_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (transaction_id);


--
-- Name: payout_reversals payout_reversals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_reversals
    ADD CONSTRAINT payout_reversals_pkey PRIMARY KEY (reversal_id);


--
-- Name: product_inquiries product_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_inquiries
    ADD CONSTRAINT product_inquiries_pkey PRIMARY KEY (inquiry_id);


--
-- Name: proof_of_condition proof_of_condition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proof_of_condition
    ADD CONSTRAINT proof_of_condition_pkey PRIMARY KEY (proof_id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: quality_inspections quality_inspections_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT quality_inspections_order_id_key UNIQUE (order_id);


--
-- Name: quality_inspections quality_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT quality_inspections_pkey PRIMARY KEY (inspection_id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (token_id);


--
-- Name: refunds refunds_order_type_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_order_type_unique UNIQUE (order_id, refund_type);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (refund_id);


--
-- Name: resolution_logs resolution_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resolution_logs
    ADD CONSTRAINT resolution_logs_pkey PRIMARY KEY (log_id);


--
-- Name: return_requests return_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_pkey PRIMARY KEY (return_id);


--
-- Name: reward_tiers reward_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_tiers
    ADD CONSTRAINT reward_tiers_pkey PRIMARY KEY (tier_name);


--
-- Name: reward_transactions reward_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_transactions
    ADD CONSTRAINT reward_transactions_pkey PRIMARY KEY (transaction_id);


--
-- Name: staff_profiles staff_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_profiles
    ADD CONSTRAINT staff_profiles_pkey PRIMARY KEY (staff_id);


--
-- Name: staff_profiles staff_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_profiles
    ADD CONSTRAINT staff_profiles_user_id_key UNIQUE (user_id);


--
-- Name: stripe_customers stripe_customers_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_customers
    ADD CONSTRAINT stripe_customers_customer_id_key UNIQUE (customer_id);


--
-- Name: stripe_customers stripe_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_customers
    ADD CONSTRAINT stripe_customers_pkey PRIMARY KEY (id);


--
-- Name: stripe_customers stripe_customers_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_customers
    ADD CONSTRAINT stripe_customers_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: stripe_webhook_events stripe_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_pkey PRIMARY KEY (event_id);


--
-- Name: subscription_change_requests subscription_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_change_requests
    ADD CONSTRAINT subscription_change_requests_pkey PRIMARY KEY (request_id);


--
-- Name: subscription_history subscription_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_history
    ADD CONSTRAINT subscription_history_pkey PRIMARY KEY (history_id);


--
-- Name: subscription_invoices subscription_invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_invoices
    ADD CONSTRAINT subscription_invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: subscription_invoices subscription_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_invoices
    ADD CONSTRAINT subscription_invoices_pkey PRIMARY KEY (invoice_id);


--
-- Name: subscription_payments subscription_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_pkey PRIMARY KEY (payment_id);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (plan_id);


--
-- Name: subscription_plans subscription_plans_plan_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_plan_code_key UNIQUE (plan_code);


--
-- Name: support_escalations support_escalations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_escalations
    ADD CONSTRAINT support_escalations_pkey PRIMARY KEY (escalation_id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (ticket_id);


--
-- Name: technicians technicians_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_pkey PRIMARY KEY (technician_id);


--
-- Name: undo_audit_log undo_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.undo_audit_log
    ADD CONSTRAINT undo_audit_log_pkey PRIMARY KEY (log_id);


--
-- Name: refunds unique_order_refund; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT unique_order_refund UNIQUE (order_id);


--
-- Name: user_addresses user_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_addresses
    ADD CONSTRAINT user_addresses_pkey PRIMARY KEY (address_id);


--
-- Name: users users_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_number_key UNIQUE (phone_number);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: idx_abuse_tracking_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abuse_tracking_customer ON public.customer_abuse_tracking USING btree (customer_id);


--
-- Name: idx_abuse_tracking_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abuse_tracking_month ON public.customer_abuse_tracking USING btree (month_year);


--
-- Name: idx_ad_campaign_analytics_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_campaign_analytics_garage ON public.ad_campaign_analytics USING btree (garage_id);


--
-- Name: idx_ad_campaigns_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_campaigns_active ON public.ad_campaigns USING btree (status, start_date, end_date) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_ad_campaigns_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_campaigns_garage ON public.ad_campaigns USING btree (garage_id);


--
-- Name: idx_ad_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_campaigns_status ON public.ad_campaigns USING btree (status, start_date);


--
-- Name: idx_ad_impressions_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_impressions_campaign ON public.ad_impressions USING btree (campaign_id, "timestamp" DESC);


--
-- Name: idx_ad_impressions_timestamp_brin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_impressions_timestamp_brin ON public.ad_impressions USING brin ("timestamp");


--
-- Name: idx_ad_impressions_timestamp_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_impressions_timestamp_desc ON public.ad_impressions USING btree ("timestamp" DESC);


--
-- Name: idx_ad_impressions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_impressions_type ON public.ad_impressions USING btree (impression_type, "timestamp" DESC);


--
-- Name: idx_ad_placements_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_placements_campaign ON public.ad_placements USING btree (campaign_id);


--
-- Name: idx_ad_placements_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_placements_type ON public.ad_placements USING btree (placement_type, active);


--
-- Name: idx_assignments_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_active ON public.delivery_assignments USING btree (status) WHERE ((status)::text = ANY (ARRAY[('assigned'::character varying)::text, ('picked_up'::character varying)::text, ('in_transit'::character varying)::text]));


--
-- Name: idx_assignments_reassigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_reassigned ON public.delivery_assignments USING btree (previous_driver_id) WHERE (previous_driver_id IS NOT NULL);


--
-- Name: idx_assignments_returns; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_returns ON public.delivery_assignments USING btree (assignment_type) WHERE ((assignment_type)::text = 'return_to_garage'::text);


--
-- Name: idx_audit_action_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_action_date ON public.admin_audit_log USING btree (action_type, created_at DESC);


--
-- Name: idx_audit_admin_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_admin_date ON public.admin_audit_log USING btree (admin_id, created_at DESC);


--
-- Name: idx_audit_log_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_admin ON public.admin_audit_log USING btree (admin_id, created_at DESC);


--
-- Name: idx_audit_log_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_target ON public.admin_audit_log USING btree (target_type, target_id);


--
-- Name: idx_audit_logs_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at_desc ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_target ON public.admin_audit_log USING btree (target_type, target_id);


--
-- Name: idx_bids_garage_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bids_garage_created ON public.bids USING btree (garage_id, created_at DESC);


--
-- Name: idx_bids_garage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bids_garage_id ON public.bids USING btree (garage_id);


--
-- Name: idx_bids_garage_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bids_garage_status ON public.bids USING btree (garage_id, status, created_at DESC);


--
-- Name: idx_bids_garage_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bids_garage_status_created ON public.bids USING btree (garage_id, status, created_at DESC);


--
-- Name: idx_bids_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bids_not_deleted ON public.bids USING btree (bid_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_bids_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bids_pending ON public.bids USING btree (status) WHERE (status = 'pending'::text);


--
-- Name: idx_bids_request_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bids_request_created ON public.bids USING btree (request_id, created_at DESC);


--
-- Name: idx_bids_request_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bids_request_status ON public.bids USING btree (request_id, status);


--
-- Name: idx_bids_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bids_status ON public.bids USING btree (status);


--
-- Name: idx_bids_unique_garage_request; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_bids_unique_garage_request ON public.bids USING btree (garage_id, request_id) WHERE (status <> ALL (ARRAY['withdrawn'::text, 'expired'::text]));


--
-- Name: idx_canned_responses_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canned_responses_category ON public.canned_responses USING btree (category) WHERE (is_active = true);


--
-- Name: idx_chat_messages_internal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_internal ON public.chat_messages USING btree (ticket_id, is_internal);


--
-- Name: idx_chat_messages_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_public ON public.chat_messages USING btree (ticket_id, created_at) WHERE (is_internal = false);


--
-- Name: idx_counter_offers_bid_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counter_offers_bid_id ON public.counter_offers USING btree (bid_id);


--
-- Name: idx_counter_offers_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counter_offers_expires ON public.counter_offers USING btree (expires_at) WHERE (status = 'pending'::text);


--
-- Name: idx_counter_offers_pending_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counter_offers_pending_expires ON public.counter_offers USING btree (expires_at) WHERE (status = 'pending'::text);


--
-- Name: idx_counter_offers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counter_offers_status ON public.counter_offers USING btree (status);


--
-- Name: idx_customer_credits_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_credits_customer ON public.customer_credits USING btree (customer_id) WHERE (status = 'active'::text);


--
-- Name: idx_customer_credits_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_credits_ticket ON public.customer_credits USING btree (ticket_id);


--
-- Name: idx_customer_notes_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_notes_created ON public.customer_notes USING btree (created_at DESC);


--
-- Name: idx_customer_notes_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_notes_customer ON public.customer_notes USING btree (customer_id);


--
-- Name: idx_customer_rewards_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_rewards_customer ON public.customer_rewards USING btree (customer_id);


--
-- Name: idx_customer_rewards_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_rewards_tier ON public.customer_rewards USING btree (current_tier);


--
-- Name: idx_customer_vehicles_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_vehicles_customer ON public.customer_vehicles USING btree (customer_id);


--
-- Name: idx_customer_vehicles_last_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_vehicles_last_used ON public.customer_vehicles USING btree (customer_id, last_used_at DESC);


--
-- Name: idx_customer_vehicles_vin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_vehicles_vin ON public.customer_vehicles USING btree (vin_number) WHERE ((vin_number IS NOT NULL) AND ((vin_number)::text <> ''::text));


--
-- Name: idx_customer_vehicles_vin_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_customer_vehicles_vin_unique ON public.customer_vehicles USING btree (customer_id, vin_number) WHERE ((vin_number IS NOT NULL) AND ((vin_number)::text <> ''::text));


--
-- Name: idx_default_template_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_default_template_type ON public.document_templates USING btree (document_type) WHERE (is_default = true);


--
-- Name: idx_delivery_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_active ON public.delivery_assignments USING btree (status, created_at DESC) WHERE ((status)::text = ANY (ARRAY[('assigned'::character varying)::text, ('picked_up'::character varying)::text, ('in_transit'::character varying)::text]));


--
-- Name: idx_delivery_assignments_driver_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_assignments_driver_id ON public.delivery_assignments USING btree (driver_id);


--
-- Name: idx_delivery_assignments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_assignments_order_id ON public.delivery_assignments USING btree (order_id);


--
-- Name: idx_delivery_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_assignments_status ON public.delivery_assignments USING btree (status);


--
-- Name: idx_delivery_chats_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_chats_assignment ON public.delivery_chats USING btree (assignment_id);


--
-- Name: idx_delivery_chats_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_chats_created ON public.delivery_chats USING btree (created_at);


--
-- Name: idx_delivery_chats_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_chats_unread ON public.delivery_chats USING btree (assignment_id) WHERE (read_at IS NULL);


--
-- Name: idx_delivery_driver_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_driver_status ON public.delivery_assignments USING btree (driver_id, status);


--
-- Name: idx_delivery_fee_tiers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_fee_tiers_active ON public.delivery_fee_tiers USING btree (is_active, min_order_value);


--
-- Name: idx_delivery_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_order ON public.delivery_assignments USING btree (order_id);


--
-- Name: idx_delivery_zones_distance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_zones_distance ON public.delivery_zones USING btree (min_distance_km, max_distance_km);


--
-- Name: idx_disputes_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_customer ON public.disputes USING btree (customer_id);


--
-- Name: idx_disputes_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_garage ON public.disputes USING btree (garage_id);


--
-- Name: idx_disputes_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_order_id ON public.disputes USING btree (order_id);


--
-- Name: idx_disputes_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_pending ON public.disputes USING btree (status, auto_resolve_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_disputes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_status ON public.disputes USING btree (status);


--
-- Name: idx_doc_access_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_access_actor ON public.document_access_log USING btree (actor_id);


--
-- Name: idx_doc_access_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_access_document ON public.document_access_log USING btree (document_id);


--
-- Name: idx_documents_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_created ON public.documents USING btree (generated_at);


--
-- Name: idx_documents_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_created_at_desc ON public.documents USING btree (created_at DESC);


--
-- Name: idx_documents_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_customer ON public.documents USING btree (customer_id);


--
-- Name: idx_documents_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_garage ON public.documents USING btree (garage_id);


--
-- Name: idx_documents_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_number ON public.documents USING btree (document_number);


--
-- Name: idx_documents_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_order ON public.documents USING btree (order_id);


--
-- Name: idx_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_status ON public.documents USING btree (status);


--
-- Name: idx_documents_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_type ON public.documents USING btree (document_type);


--
-- Name: idx_documents_verification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_verification ON public.documents USING btree (verification_code);


--
-- Name: idx_driver_payouts_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_payouts_created ON public.driver_payouts USING btree (created_at DESC);


--
-- Name: idx_driver_payouts_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_payouts_driver ON public.driver_payouts USING btree (driver_id);


--
-- Name: idx_driver_payouts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_payouts_status ON public.driver_payouts USING btree (status);


--
-- Name: idx_driver_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_transactions_created_at ON public.driver_transactions USING btree (created_at DESC);


--
-- Name: idx_driver_transactions_wallet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_transactions_wallet_id ON public.driver_transactions USING btree (wallet_id);


--
-- Name: idx_drivers_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drivers_available ON public.drivers USING btree (status) WHERE ((status)::text = 'available'::text);


--
-- Name: idx_drivers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drivers_status ON public.drivers USING btree (status);


--
-- Name: idx_escalations_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escalations_ticket ON public.support_escalations USING btree (ticket_id);


--
-- Name: idx_escrow_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escrow_customer ON public.escrow_transactions USING btree (customer_id);


--
-- Name: idx_escrow_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escrow_expires ON public.escrow_transactions USING btree (inspection_expires_at) WHERE ((status)::text = 'held'::text);


--
-- Name: idx_escrow_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escrow_order ON public.escrow_transactions USING btree (order_id);


--
-- Name: idx_escrow_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escrow_seller ON public.escrow_transactions USING btree (seller_id);


--
-- Name: idx_escrow_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escrow_status ON public.escrow_transactions USING btree (status);


--
-- Name: idx_garage_analytics_summary_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_analytics_summary_garage ON public.garage_analytics_summary USING btree (garage_id);


--
-- Name: idx_garage_bid_analytics_garage_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_bid_analytics_garage_month ON public.garage_bid_analytics USING btree (garage_id, month DESC);


--
-- Name: idx_garage_daily_analytics_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_daily_analytics_date ON public.garage_daily_analytics USING btree (date DESC);


--
-- Name: idx_garage_daily_analytics_garage_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_daily_analytics_garage_date ON public.garage_daily_analytics USING btree (garage_id, date DESC);


--
-- Name: idx_garage_parts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_parts_active ON public.garage_parts USING btree (status) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_garage_parts_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_parts_created ON public.garage_parts USING btree (created_at DESC);


--
-- Name: idx_garage_parts_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_parts_garage ON public.garage_parts USING btree (garage_id);


--
-- Name: idx_garage_parts_make; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_parts_make ON public.garage_parts USING btree (car_make);


--
-- Name: idx_garage_payment_methods_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_payment_methods_garage ON public.garage_payment_methods USING btree (garage_id);


--
-- Name: idx_garage_payouts_garage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_payouts_garage_id ON public.garage_payouts USING btree (garage_id);


--
-- Name: idx_garage_payouts_held; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_payouts_held ON public.garage_payouts USING btree (payout_status) WHERE ((payout_status)::text = 'held'::text);


--
-- Name: idx_garage_payouts_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_payouts_order_id ON public.garage_payouts USING btree (order_id);


--
-- Name: idx_garage_payouts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_payouts_status ON public.garage_payouts USING btree (payout_status);


--
-- Name: idx_garage_payouts_unique_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_garage_payouts_unique_reference ON public.garage_payouts USING btree (payout_reference) WHERE (payout_reference IS NOT NULL);


--
-- Name: idx_garage_penalties_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_penalties_created ON public.garage_penalties USING btree (created_at);


--
-- Name: idx_garage_penalties_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_penalties_garage ON public.garage_penalties USING btree (garage_id);


--
-- Name: idx_garage_penalties_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_penalties_status ON public.garage_penalties USING btree (status);


--
-- Name: idx_garage_popular_parts_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_popular_parts_garage ON public.garage_popular_parts USING btree (garage_id, order_count DESC);


--
-- Name: idx_garage_settings_capabilities; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_settings_capabilities ON public.garage_settings USING gin (service_capabilities);


--
-- Name: idx_garage_stats_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_stats_rating ON public.garage_stats USING btree (quick_service_rating DESC) WHERE (quick_service_rating IS NOT NULL);


--
-- Name: idx_garages_approval_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_approval_pending ON public.garages USING btree (approval_status, created_at) WHERE ((approval_status)::text = 'pending'::text);


--
-- Name: idx_garages_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_approval_status ON public.garages USING btree (approval_status);


--
-- Name: idx_garages_approved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_approved ON public.garages USING btree (approval_status) WHERE ((approval_status)::text = 'approved'::text);


--
-- Name: idx_garages_brands; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_brands ON public.garages USING gin (specialized_brands);


--
-- Name: idx_garages_demo_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_demo_expiry ON public.garages USING btree (demo_expires_at) WHERE ((approval_status)::text = 'demo'::text);


--
-- Name: idx_garages_mobile_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_mobile_location ON public.garages USING btree (location_lat, location_lng) WHERE (has_mobile_technicians = true);


--
-- Name: idx_garages_name_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_name_search ON public.garages USING btree (garage_name);


--
-- Name: idx_garages_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_not_deleted ON public.garages USING btree (garage_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_garages_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_pending ON public.garages USING btree (created_at) WHERE (((approval_status)::text = 'pending'::text) OR (approval_status IS NULL));


--
-- Name: idx_garages_quick_services; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_quick_services ON public.garages USING btree (garage_id) WHERE (provides_quick_services = true);


--
-- Name: idx_garages_quick_services_array; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_quick_services_array ON public.garages USING gin (quick_services_offered);


--
-- Name: idx_garages_repair_specializations_array; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_repair_specializations_array ON public.garages USING gin (repair_specializations);


--
-- Name: idx_garages_repairs; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_repairs ON public.garages USING btree (garage_id) WHERE (provides_repairs = true);


--
-- Name: idx_garages_services_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_services_location ON public.garages USING btree (location_lat, location_lng);


--
-- Name: idx_garages_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_subscription ON public.garages USING btree (subscription_plan, subscription_end_date);


--
-- Name: idx_garages_supplier_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_supplier_type ON public.garages USING btree (supplier_type);


--
-- Name: idx_idempotency_keys_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_keys_expires_at ON public.idempotency_keys USING btree (expires_at);


--
-- Name: idx_idempotency_keys_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_keys_user_id ON public.idempotency_keys USING btree (user_id);


--
-- Name: idx_inquiries_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_customer ON public.product_inquiries USING btree (customer_id);


--
-- Name: idx_inquiries_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_product ON public.product_inquiries USING btree (product_id);


--
-- Name: idx_inspections_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inspections_order ON public.quality_inspections USING btree (order_id);


--
-- Name: idx_inspections_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inspections_pending ON public.quality_inspections USING btree (status) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_inspections_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inspections_status ON public.quality_inspections USING btree (status);


--
-- Name: idx_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created ON public.chat_messages USING btree (created_at);


--
-- Name: idx_messages_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_ticket ON public.chat_messages USING btree (ticket_id);


--
-- Name: idx_notifications_user_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_recent ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);


--
-- Name: idx_order_history_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_history_created ON public.order_status_history USING btree (created_at);


--
-- Name: idx_order_history_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_history_order ON public.order_status_history USING btree (order_id);


--
-- Name: idx_orders_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_active ON public.orders USING btree (order_status, created_at DESC) WHERE (order_status = ANY (ARRAY['confirmed'::text, 'preparing'::text, 'ready_for_pickup'::text, 'in_transit'::text, 'qc_passed'::text, 'out_for_delivery'::text]));


--
-- Name: idx_orders_completed_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_completed_date ON public.orders USING btree (created_at DESC) WHERE (order_status = 'completed'::text);


--
-- Name: idx_orders_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_created_at_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at_date ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at_desc ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_customer_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_created ON public.orders USING btree (customer_id, created_at DESC);


--
-- Name: idx_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_driver_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_driver_status ON public.orders USING btree (driver_id, order_status) WHERE (order_status = ANY (ARRAY['in_transit'::text, 'collected'::text]));


--
-- Name: idx_orders_garage_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_garage_created ON public.orders USING btree (garage_id, created_at DESC);


--
-- Name: idx_orders_garage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_garage_id ON public.orders USING btree (garage_id);


--
-- Name: idx_orders_garage_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_garage_status ON public.orders USING btree (garage_id, order_status, created_at DESC);


--
-- Name: idx_orders_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_not_deleted ON public.orders USING btree (order_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_orders_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_order_number ON public.orders USING btree (order_number);


--
-- Name: idx_orders_qc_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_qc_pending ON public.orders USING btree (order_status) WHERE (order_status = ANY (ARRAY['preparing'::text, 'collected'::text, 'qc_in_progress'::text]));


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (order_status);


--
-- Name: idx_orders_undo_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_undo_deadline ON public.orders USING btree (undo_deadline) WHERE (undo_deadline IS NOT NULL);


--
-- Name: idx_orders_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_zone ON public.orders USING btree (delivery_zone_id);


--
-- Name: idx_part_requests_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_requests_active ON public.part_requests USING btree (status, created_at DESC) WHERE (status = 'active'::text);


--
-- Name: idx_part_requests_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_requests_customer ON public.part_requests USING btree (customer_id, created_at DESC);


--
-- Name: idx_part_requests_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_requests_customer_id ON public.part_requests USING btree (customer_id);


--
-- Name: idx_part_requests_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_requests_not_deleted ON public.part_requests USING btree (request_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_part_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_requests_status ON public.part_requests USING btree (status);


--
-- Name: idx_part_requests_subcategory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_requests_subcategory ON public.part_requests USING btree (part_category, part_subcategory) WHERE (part_subcategory IS NOT NULL);


--
-- Name: idx_payment_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_audit_logs_action ON public.payment_audit_logs USING btree (action);


--
-- Name: idx_payment_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_audit_logs_created_at ON public.payment_audit_logs USING btree (created_at DESC);


--
-- Name: idx_payment_audit_logs_ip_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_audit_logs_ip_address ON public.payment_audit_logs USING btree (ip_address);


--
-- Name: idx_payment_audit_logs_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_audit_logs_transaction_id ON public.payment_audit_logs USING btree (transaction_id);


--
-- Name: idx_payment_intents_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_intents_customer ON public.payment_intents USING btree (customer_id);


--
-- Name: idx_payment_intents_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_intents_order ON public.payment_intents USING btree (order_id);


--
-- Name: idx_payment_intents_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_intents_provider ON public.payment_intents USING btree (provider, provider_intent_id);


--
-- Name: idx_payment_intents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_intents_status ON public.payment_intents USING btree (status);


--
-- Name: idx_payment_methods_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_customer ON public.payment_methods USING btree (customer_id);


--
-- Name: idx_payment_methods_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_default ON public.payment_methods USING btree (customer_id, is_default) WHERE (is_active = true);


--
-- Name: idx_payment_refunds_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_refunds_order ON public.payment_refunds USING btree (order_id);


--
-- Name: idx_payment_refunds_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_refunds_status ON public.payment_refunds USING btree (status);


--
-- Name: idx_payment_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_created_at ON public.payment_transactions USING btree (created_at DESC);


--
-- Name: idx_payment_transactions_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_idempotency_key ON public.payment_transactions USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_payment_transactions_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_order_id ON public.payment_transactions USING btree (order_id);


--
-- Name: idx_payment_transactions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_status ON public.payment_transactions USING btree (status);


--
-- Name: idx_payment_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_user_id ON public.payment_transactions USING btree (user_id);


--
-- Name: idx_payment_transactions_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_user_status ON public.payment_transactions USING btree (user_id, status);


--
-- Name: idx_payout_reversals_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_reversals_garage ON public.payout_reversals USING btree (garage_id);


--
-- Name: idx_payout_reversals_payout; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_reversals_payout ON public.payout_reversals USING btree (original_payout_id);


--
-- Name: idx_payouts_awaiting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_awaiting ON public.garage_payouts USING btree (payout_status) WHERE ((payout_status)::text = 'awaiting_confirmation'::text);


--
-- Name: idx_payouts_disputed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_disputed ON public.garage_payouts USING btree (payout_status) WHERE ((payout_status)::text = 'disputed'::text);


--
-- Name: idx_payouts_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_garage ON public.garage_payouts USING btree (garage_id);


--
-- Name: idx_payouts_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_pending ON public.garage_payouts USING btree (payout_status) WHERE ((payout_status)::text = 'pending'::text);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.garage_products USING btree (category);


--
-- Name: idx_products_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_featured ON public.garage_products USING btree (is_featured) WHERE (is_featured = true);


--
-- Name: idx_products_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_garage ON public.garage_products USING btree (garage_id);


--
-- Name: idx_products_makes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_makes ON public.garage_products USING gin (compatible_makes);


--
-- Name: idx_products_models; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_models ON public.garage_products USING gin (compatible_models);


--
-- Name: idx_products_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_price ON public.garage_products USING btree (price);


--
-- Name: idx_products_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_status ON public.garage_products USING btree (status);


--
-- Name: idx_proof_escrow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proof_escrow ON public.proof_of_condition USING btree (escrow_id);


--
-- Name: idx_proof_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proof_order ON public.proof_of_condition USING btree (order_id);


--
-- Name: idx_push_tokens_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_tokens_active ON public.push_tokens USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_push_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_tokens_user ON public.push_tokens USING btree (user_id);


--
-- Name: idx_push_tokens_user_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_push_tokens_user_token ON public.push_tokens USING btree (user_id, token);


--
-- Name: idx_qc_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qc_order ON public.quality_inspections USING btree (order_id);


--
-- Name: idx_qc_passed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qc_passed ON public.quality_inspections USING btree (result, created_at DESC);


--
-- Name: idx_refresh_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_expires ON public.refresh_tokens USING btree (expires_at) WHERE (revoked_at IS NULL);


--
-- Name: idx_refresh_tokens_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_hash ON public.refresh_tokens USING btree (token_hash) WHERE (revoked_at IS NULL);


--
-- Name: idx_refresh_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user ON public.refresh_tokens USING btree (user_id) WHERE (revoked_at IS NULL);


--
-- Name: idx_refunds_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_created_at ON public.refunds USING btree (created_at);


--
-- Name: idx_refunds_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_customer ON public.refunds USING btree (customer_id);


--
-- Name: idx_refunds_failed_only; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_failed_only ON public.refunds USING btree (created_at DESC) WHERE ((refund_status)::text = 'failed'::text);


--
-- Name: idx_refunds_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_refunds_idempotency_key ON public.refunds USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_refunds_pending_only; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_pending_only ON public.refunds USING btree (created_at DESC) WHERE ((refund_status)::text = 'pending'::text);


--
-- Name: idx_refunds_refund_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_refund_status ON public.refunds USING btree (refund_status);


--
-- Name: idx_requests_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_active ON public.part_requests USING btree (status, expires_at) WHERE (status = 'active'::text);


--
-- Name: idx_requests_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_customer ON public.part_requests USING btree (customer_id);


--
-- Name: idx_requests_customer_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_customer_created ON public.part_requests USING btree (customer_id, created_at DESC);


--
-- Name: idx_requests_customer_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_customer_status ON public.part_requests USING btree (customer_id, status, created_at DESC);


--
-- Name: idx_requests_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_expires ON public.part_requests USING btree (expires_at) WHERE (status = 'active'::text);


--
-- Name: idx_requests_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_location ON public.part_requests USING btree (delivery_lat, delivery_lng) WHERE ((delivery_lat IS NOT NULL) AND (delivery_lng IS NOT NULL));


--
-- Name: idx_requests_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_open ON public.part_requests USING btree (status, created_at DESC) WHERE (status = ANY (ARRAY['pending'::text, 'bidding'::text]));


--
-- Name: idx_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_status ON public.part_requests USING btree (status);


--
-- Name: idx_resolution_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resolution_logs_created ON public.resolution_logs USING btree (created_at DESC);


--
-- Name: idx_resolution_logs_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resolution_logs_customer ON public.resolution_logs USING btree (customer_id);


--
-- Name: idx_resolution_logs_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resolution_logs_order ON public.resolution_logs USING btree (order_id);


--
-- Name: idx_return_requests_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_requests_customer ON public.return_requests USING btree (customer_id);


--
-- Name: idx_return_requests_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_requests_order ON public.return_requests USING btree (order_id);


--
-- Name: idx_return_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_requests_status ON public.return_requests USING btree (status);


--
-- Name: idx_reward_transactions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reward_transactions_created ON public.reward_transactions USING btree (created_at DESC);


--
-- Name: idx_reward_transactions_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reward_transactions_customer ON public.reward_transactions USING btree (customer_id, created_at DESC);


--
-- Name: idx_reward_transactions_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reward_transactions_order ON public.reward_transactions USING btree (order_id);


--
-- Name: idx_reward_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reward_transactions_type ON public.reward_transactions USING btree (transaction_type);


--
-- Name: idx_staff_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_role ON public.staff_profiles USING btree (role);


--
-- Name: idx_staff_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_user ON public.staff_profiles USING btree (user_id);


--
-- Name: idx_stripe_customers_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_customers_customer ON public.stripe_customers USING btree (customer_id);


--
-- Name: idx_sub_requests_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_requests_garage ON public.subscription_change_requests USING btree (garage_id);


--
-- Name: idx_sub_requests_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_requests_payment_status ON public.subscription_change_requests USING btree (payment_status) WHERE ((payment_status)::text = ANY ((ARRAY['unpaid'::character varying, 'pending'::character varying])::text[]));


--
-- Name: idx_sub_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_requests_status ON public.subscription_change_requests USING btree (status);


--
-- Name: idx_subscription_history_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_history_garage ON public.subscription_history USING btree (garage_id, created_at DESC);


--
-- Name: idx_subscription_invoices_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_invoices_garage ON public.subscription_invoices USING btree (garage_id);


--
-- Name: idx_subscription_invoices_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_invoices_number ON public.subscription_invoices USING btree (invoice_number);


--
-- Name: idx_subscriptions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_active ON public.garage_subscriptions USING btree (status, billing_cycle_end) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_subscriptions_billing_cycle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_billing_cycle ON public.garage_subscriptions USING btree (billing_cycle_end, status) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_subscriptions_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_expiry ON public.garage_subscriptions USING btree (billing_cycle_end) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_subscriptions_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_garage ON public.garage_subscriptions USING btree (garage_id);


--
-- Name: idx_support_escalations_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_escalations_order ON public.support_escalations USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: idx_support_escalations_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_escalations_priority ON public.support_escalations USING btree (priority) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_support_escalations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_escalations_status ON public.support_escalations USING btree (status);


--
-- Name: idx_support_tickets_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_assigned ON public.support_tickets USING btree (assigned_to) WHERE ((status)::text = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying])::text[]));


--
-- Name: idx_support_tickets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_category ON public.support_tickets USING btree (category) WHERE ((status)::text = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying])::text[]));


--
-- Name: idx_support_tickets_escalation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_escalation ON public.support_tickets USING btree (escalation_level) WHERE ((status)::text <> ALL (ARRAY[('resolved'::character varying)::text, ('closed'::character varying)::text]));


--
-- Name: idx_support_tickets_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_requester ON public.support_tickets USING btree (requester_id, requester_type);


--
-- Name: idx_support_tickets_sla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_sla ON public.support_tickets USING btree (sla_deadline) WHERE ((status)::text <> ALL (ARRAY[('resolved'::character varying)::text, ('closed'::character varying)::text]));


--
-- Name: idx_support_tickets_stale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_stale ON public.support_tickets USING btree (created_at, status, first_response_at) WHERE (((status)::text = 'open'::text) AND (first_response_at IS NULL));


--
-- Name: idx_technicians_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_technicians_available ON public.technicians USING btree (technician_id) WHERE ((is_available = true) AND (is_active = true));


--
-- Name: idx_technicians_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_technicians_garage ON public.technicians USING btree (garage_id);


--
-- Name: idx_technicians_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_technicians_location ON public.technicians USING btree (current_lat, current_lng) WHERE (is_available = true);


--
-- Name: idx_tickets_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_customer ON public.support_tickets USING btree (customer_id);


--
-- Name: idx_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_status ON public.support_tickets USING btree (status);


--
-- Name: idx_tickets_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_user ON public.support_tickets USING btree (customer_id, created_at DESC);


--
-- Name: idx_undo_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_undo_audit_created ON public.undo_audit_log USING btree (created_at DESC);


--
-- Name: idx_undo_audit_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_undo_audit_order ON public.undo_audit_log USING btree (order_id);


--
-- Name: idx_user_addresses_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_addresses_user_id ON public.user_addresses USING btree (user_id);


--
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_active ON public.users USING btree (is_active, user_type);


--
-- Name: idx_users_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_not_deleted ON public.users USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_users_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_phone ON public.users USING btree (phone_number);


--
-- Name: idx_users_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_settings ON public.users USING gin (settings);


--
-- Name: idx_users_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_type ON public.users USING btree (user_type);


--
-- Name: idx_vouchers_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_customer ON public.delivery_vouchers USING btree (customer_id);


--
-- Name: idx_vouchers_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_expires ON public.delivery_vouchers USING btree (expires_at);


--
-- Name: partner_service_performance _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.partner_service_performance AS
 SELECT g.garage_id,
    g.garage_name AS partner_name,
    g.sells_parts,
    g.provides_repairs,
    g.provides_quick_services,
    g.has_mobile_technicians,
    count(DISTINCT b.request_id) AS total_part_requests,
    count(DISTINCT
        CASE
            WHEN (o.order_status = 'completed'::text) THEN o.order_id
            ELSE NULL::uuid
        END) AS completed_part_orders,
    (0)::bigint AS total_quick_services,
    (0)::bigint AS completed_quick_services,
    NULL::numeric AS avg_quick_service_rating,
    g.rating_average AS overall_rating,
    g.total_services_completed
   FROM ((public.garages g
     LEFT JOIN public.bids b ON ((g.garage_id = b.garage_id)))
     LEFT JOIN public.orders o ON ((b.bid_id = o.bid_id)))
  GROUP BY g.garage_id, g.garage_name, g.rating_average, g.total_services_completed;


--
-- Name: bids enforce_active_request_for_bid; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_active_request_for_bid BEFORE INSERT ON public.bids FOR EACH ROW EXECUTE FUNCTION public.check_request_active_for_bid();


--
-- Name: bids enforce_subscription_for_bid; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_subscription_for_bid BEFORE INSERT ON public.bids FOR EACH ROW EXECUTE FUNCTION public.check_garage_can_bid();


--
-- Name: garages garage_capabilities_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER garage_capabilities_trigger BEFORE UPDATE ON public.garages FOR EACH ROW EXECUTE FUNCTION public.update_garage_capabilities();


--
-- Name: payment_transactions payment_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payment_transactions_updated_at BEFORE UPDATE ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.update_payment_transactions_updated_at();


--
-- Name: orders set_order_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders FOR EACH ROW WHEN ((new.order_number IS NULL)) EXECUTE FUNCTION public.generate_order_number();


--
-- Name: documents trg_documents_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_document_timestamp();


--
-- Name: user_addresses trg_update_address_modtime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_address_modtime BEFORE UPDATE ON public.user_addresses FOR EACH ROW EXECUTE FUNCTION public.update_address_modtime();


--
-- Name: part_requests trg_update_vehicle_last_used; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_vehicle_last_used AFTER INSERT ON public.part_requests FOR EACH ROW EXECUTE FUNCTION public.update_vehicle_last_used();


--
-- Name: orders trigger_award_points_on_completion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_award_points_on_completion AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.award_points_on_order_completion();


--
-- Name: ad_campaigns trigger_pause_on_budget; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_pause_on_budget BEFORE UPDATE ON public.ad_campaigns FOR EACH ROW WHEN ((old.spent_amount IS DISTINCT FROM new.spent_amount)) EXECUTE FUNCTION public.pause_campaign_if_budget_exhausted();


--
-- Name: push_tokens trigger_push_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_push_tokens_updated_at BEFORE UPDATE ON public.push_tokens FOR EACH ROW EXECUTE FUNCTION public.update_push_tokens_updated_at();


--
-- Name: escrow_transactions trigger_set_escrow_expiry; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_escrow_expiry BEFORE INSERT ON public.escrow_transactions FOR EACH ROW EXECUTE FUNCTION public.set_escrow_inspection_expiry();


--
-- Name: order_reviews trigger_update_garage_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_garage_rating AFTER INSERT OR UPDATE ON public.order_reviews FOR EACH ROW EXECUTE FUNCTION public.update_garage_rating();


--
-- Name: customer_rewards trigger_update_tier; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_tier BEFORE UPDATE ON public.customer_rewards FOR EACH ROW WHEN ((old.lifetime_points IS DISTINCT FROM new.lifetime_points)) EXECUTE FUNCTION public.update_customer_tier();


--
-- Name: driver_locations update_driver_locations_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_driver_locations_timestamp BEFORE UPDATE ON public.driver_locations FOR EACH ROW EXECUTE FUNCTION public.update_driver_locations_timestamp();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: part_requests update_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.part_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: ad_campaigns ad_campaigns_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(user_id);


--
-- Name: ad_campaigns ad_campaigns_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: ad_impressions ad_impressions_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_impressions
    ADD CONSTRAINT ad_impressions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(campaign_id) ON DELETE CASCADE;


--
-- Name: ad_impressions ad_impressions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_impressions
    ADD CONSTRAINT ad_impressions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: ad_impressions ad_impressions_placement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_impressions
    ADD CONSTRAINT ad_impressions_placement_id_fkey FOREIGN KEY (placement_id) REFERENCES public.ad_placements(placement_id) ON DELETE SET NULL;


--
-- Name: ad_placements ad_placements_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_placements
    ADD CONSTRAINT ad_placements_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(campaign_id) ON DELETE CASCADE;


--
-- Name: admin_audit_log admin_audit_log_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(user_id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: bids bids_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bids
    ADD CONSTRAINT bids_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: bids bids_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bids
    ADD CONSTRAINT bids_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.part_requests(request_id) ON DELETE CASCADE;


--
-- Name: cancellation_requests cancellation_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- Name: cancellation_requests cancellation_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(user_id);


--
-- Name: cancellation_requests cancellation_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(user_id);


--
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(user_id);


--
-- Name: chat_messages chat_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(ticket_id) ON DELETE CASCADE;


--
-- Name: counter_offers counter_offers_bid_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counter_offers
    ADD CONSTRAINT counter_offers_bid_id_fkey FOREIGN KEY (bid_id) REFERENCES public.bids(bid_id) ON DELETE CASCADE;


--
-- Name: counter_offers counter_offers_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counter_offers
    ADD CONSTRAINT counter_offers_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.part_requests(request_id) ON DELETE CASCADE;


--
-- Name: customer_abuse_tracking customer_abuse_tracking_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_abuse_tracking
    ADD CONSTRAINT customer_abuse_tracking_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id);


--
-- Name: customer_addresses customer_addresses_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: customer_notes customer_notes_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notes
    ADD CONSTRAINT customer_notes_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.users(user_id);


--
-- Name: customer_notes customer_notes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notes
    ADD CONSTRAINT customer_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: customer_rewards customer_rewards_current_tier_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_rewards
    ADD CONSTRAINT customer_rewards_current_tier_fkey FOREIGN KEY (current_tier) REFERENCES public.reward_tiers(tier_name);


--
-- Name: customer_rewards customer_rewards_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_rewards
    ADD CONSTRAINT customer_rewards_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: customer_vehicles customer_vehicles_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_vehicles
    ADD CONSTRAINT customer_vehicles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: delivery_assignments delivery_assignments_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(driver_id) ON DELETE SET NULL;


--
-- Name: delivery_assignments delivery_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- Name: delivery_assignments delivery_assignments_previous_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_previous_driver_id_fkey FOREIGN KEY (previous_driver_id) REFERENCES public.drivers(driver_id);


--
-- Name: delivery_assignments delivery_assignments_reassigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_reassigned_by_fkey FOREIGN KEY (reassigned_by) REFERENCES public.users(user_id);


--
-- Name: delivery_chats delivery_chats_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_chats
    ADD CONSTRAINT delivery_chats_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.delivery_assignments(assignment_id) ON DELETE CASCADE;


--
-- Name: delivery_vouchers delivery_vouchers_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_vouchers
    ADD CONSTRAINT delivery_vouchers_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id);


--
-- Name: delivery_vouchers delivery_vouchers_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_vouchers
    ADD CONSTRAINT delivery_vouchers_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: delivery_vouchers delivery_vouchers_used_on_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_vouchers
    ADD CONSTRAINT delivery_vouchers_used_on_order_id_fkey FOREIGN KEY (used_on_order_id) REFERENCES public.orders(order_id);


--
-- Name: delivery_zone_history delivery_zone_history_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zone_history
    ADD CONSTRAINT delivery_zone_history_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(zone_id);


--
-- Name: disputes disputes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id);


--
-- Name: disputes disputes_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id);


--
-- Name: disputes disputes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- Name: disputes disputes_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(user_id);


--
-- Name: document_access_log document_access_log_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_access_log
    ADD CONSTRAINT document_access_log_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(document_id) ON DELETE CASCADE;


--
-- Name: documents documents_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE SET NULL;


--
-- Name: documents documents_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE SET NULL;


--
-- Name: driver_locations driver_locations_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(driver_id) ON DELETE CASCADE;


--
-- Name: driver_payouts driver_payouts_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_payouts
    ADD CONSTRAINT driver_payouts_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(driver_id) ON DELETE CASCADE;


--
-- Name: driver_transactions driver_transactions_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_transactions
    ADD CONSTRAINT driver_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.driver_wallets(wallet_id) ON DELETE CASCADE;


--
-- Name: driver_wallets driver_wallets_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_wallets
    ADD CONSTRAINT driver_wallets_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(driver_id) ON DELETE CASCADE;


--
-- Name: drivers drivers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: escrow_transactions escrow_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow_transactions
    ADD CONSTRAINT escrow_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id);


--
-- Name: escrow_transactions escrow_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow_transactions
    ADD CONSTRAINT escrow_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- Name: escrow_transactions escrow_transactions_released_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow_transactions
    ADD CONSTRAINT escrow_transactions_released_by_fkey FOREIGN KEY (released_by) REFERENCES public.users(user_id);


--
-- Name: escrow_transactions escrow_transactions_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow_transactions
    ADD CONSTRAINT escrow_transactions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(user_id);


--
-- Name: support_escalations fk_escalations_ticket; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_escalations
    ADD CONSTRAINT fk_escalations_ticket FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(ticket_id) ON DELETE SET NULL;


--
-- Name: garage_analytics_summary garage_analytics_summary_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_analytics_summary
    ADD CONSTRAINT garage_analytics_summary_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: garage_ignored_requests garage_ignored_requests_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_ignored_requests
    ADD CONSTRAINT garage_ignored_requests_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: garage_ignored_requests garage_ignored_requests_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_ignored_requests
    ADD CONSTRAINT garage_ignored_requests_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.part_requests(request_id) ON DELETE CASCADE;


--
-- Name: garage_parts garage_parts_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_parts
    ADD CONSTRAINT garage_parts_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: garage_payment_methods garage_payment_methods_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_payment_methods
    ADD CONSTRAINT garage_payment_methods_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: garage_payouts garage_payouts_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_payouts
    ADD CONSTRAINT garage_payouts_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: garage_payouts garage_payouts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_payouts
    ADD CONSTRAINT garage_payouts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: garage_payouts garage_payouts_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_payouts
    ADD CONSTRAINT garage_payouts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(user_id);


--
-- Name: garage_penalties garage_penalties_deducted_from_payout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_penalties
    ADD CONSTRAINT garage_penalties_deducted_from_payout_id_fkey FOREIGN KEY (deducted_from_payout_id) REFERENCES public.garage_payouts(payout_id);


--
-- Name: garage_penalties garage_penalties_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_penalties
    ADD CONSTRAINT garage_penalties_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id);


--
-- Name: garage_penalties garage_penalties_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_penalties
    ADD CONSTRAINT garage_penalties_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: garage_penalties garage_penalties_waived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_penalties
    ADD CONSTRAINT garage_penalties_waived_by_fkey FOREIGN KEY (waived_by) REFERENCES public.users(user_id);


--
-- Name: garage_products garage_products_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_products
    ADD CONSTRAINT garage_products_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: garage_settings garage_settings_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_settings
    ADD CONSTRAINT garage_settings_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: garage_stats garage_stats_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_stats
    ADD CONSTRAINT garage_stats_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: garage_subscriptions garage_subscriptions_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_subscriptions
    ADD CONSTRAINT garage_subscriptions_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: garage_subscriptions garage_subscriptions_next_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_subscriptions
    ADD CONSTRAINT garage_subscriptions_next_plan_id_fkey FOREIGN KEY (next_plan_id) REFERENCES public.subscription_plans(plan_id);


--
-- Name: garage_subscriptions garage_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_subscriptions
    ADD CONSTRAINT garage_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(plan_id);


--
-- Name: garages garages_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garages
    ADD CONSTRAINT garages_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(user_id);


--
-- Name: garages garages_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garages
    ADD CONSTRAINT garages_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: garages garages_subscription_plan_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garages
    ADD CONSTRAINT garages_subscription_plan_fkey FOREIGN KEY (subscription_plan) REFERENCES public.subscription_plans(plan_code);


--
-- Name: idempotency_keys idempotency_keys_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.payment_transactions(transaction_id) ON DELETE CASCADE;


--
-- Name: idempotency_keys idempotency_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: operations_staff operations_staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operations_staff
    ADD CONSTRAINT operations_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: order_reviews order_reviews_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reviews
    ADD CONSTRAINT order_reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id);


--
-- Name: order_reviews order_reviews_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reviews
    ADD CONSTRAINT order_reviews_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id);


--
-- Name: order_reviews order_reviews_moderated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reviews
    ADD CONSTRAINT order_reviews_moderated_by_fkey FOREIGN KEY (moderated_by) REFERENCES public.users(user_id);


--
-- Name: order_reviews order_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reviews
    ADD CONSTRAINT order_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- Name: order_status_history order_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(user_id);


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- Name: orders orders_bid_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_bid_id_fkey FOREIGN KEY (bid_id) REFERENCES public.bids(bid_id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id);


--
-- Name: orders orders_delivery_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_delivery_zone_id_fkey FOREIGN KEY (delivery_zone_id) REFERENCES public.delivery_zones(zone_id);


--
-- Name: orders orders_deposit_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_deposit_intent_id_fkey FOREIGN KEY (deposit_intent_id) REFERENCES public.payment_intents(intent_id);


--
-- Name: orders orders_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(user_id);


--
-- Name: orders orders_final_payment_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_final_payment_intent_id_fkey FOREIGN KEY (final_payment_intent_id) REFERENCES public.payment_intents(intent_id);


--
-- Name: orders orders_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id);


--
-- Name: orders orders_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.part_requests(request_id);


--
-- Name: part_requests part_requests_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: part_requests part_requests_delivery_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_delivery_address_id_fkey FOREIGN KEY (delivery_address_id) REFERENCES public.customer_addresses(address_id);


--
-- Name: part_requests part_requests_saved_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_saved_vehicle_id_fkey FOREIGN KEY (saved_vehicle_id) REFERENCES public.customer_vehicles(vehicle_id);


--
-- Name: payment_audit_logs payment_audit_logs_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_audit_logs
    ADD CONSTRAINT payment_audit_logs_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.payment_transactions(transaction_id) ON DELETE CASCADE;


--
-- Name: payment_intents payment_intents_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: payment_refunds payment_refunds_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES public.payment_intents(intent_id);


--
-- Name: payment_refunds payment_refunds_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: payment_transactions payment_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- Name: payment_transactions payment_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: product_inquiries product_inquiries_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_inquiries
    ADD CONSTRAINT product_inquiries_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id);


--
-- Name: product_inquiries product_inquiries_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_inquiries
    ADD CONSTRAINT product_inquiries_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.garage_products(product_id) ON DELETE CASCADE;


--
-- Name: proof_of_condition proof_of_condition_captured_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proof_of_condition
    ADD CONSTRAINT proof_of_condition_captured_by_fkey FOREIGN KEY (captured_by) REFERENCES public.users(user_id);


--
-- Name: proof_of_condition proof_of_condition_escrow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proof_of_condition
    ADD CONSTRAINT proof_of_condition_escrow_id_fkey FOREIGN KEY (escrow_id) REFERENCES public.escrow_transactions(escrow_id) ON DELETE CASCADE;


--
-- Name: proof_of_condition proof_of_condition_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proof_of_condition
    ADD CONSTRAINT proof_of_condition_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: push_tokens push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: quality_inspections quality_inspections_inspector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT quality_inspections_inspector_id_fkey FOREIGN KEY (inspector_id) REFERENCES public.users(user_id);


--
-- Name: quality_inspections quality_inspections_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT quality_inspections_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_replaced_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_replaced_by_fkey FOREIGN KEY (replaced_by) REFERENCES public.refresh_tokens(token_id);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: refunds refunds_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: resolution_logs resolution_logs_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resolution_logs
    ADD CONSTRAINT resolution_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.users(user_id);


--
-- Name: resolution_logs resolution_logs_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resolution_logs
    ADD CONSTRAINT resolution_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: resolution_logs resolution_logs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resolution_logs
    ADD CONSTRAINT resolution_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- Name: return_requests return_requests_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id);


--
-- Name: return_requests return_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: return_requests return_requests_pickup_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_pickup_driver_id_fkey FOREIGN KEY (pickup_driver_id) REFERENCES public.drivers(driver_id);


--
-- Name: reward_transactions reward_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_transactions
    ADD CONSTRAINT reward_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: reward_transactions reward_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_transactions
    ADD CONSTRAINT reward_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: staff_profiles staff_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_profiles
    ADD CONSTRAINT staff_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: subscription_change_requests subscription_change_requests_from_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_change_requests
    ADD CONSTRAINT subscription_change_requests_from_plan_id_fkey FOREIGN KEY (from_plan_id) REFERENCES public.subscription_plans(plan_id);


--
-- Name: subscription_change_requests subscription_change_requests_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_change_requests
    ADD CONSTRAINT subscription_change_requests_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: subscription_change_requests subscription_change_requests_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_change_requests
    ADD CONSTRAINT subscription_change_requests_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(user_id);


--
-- Name: subscription_change_requests subscription_change_requests_to_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_change_requests
    ADD CONSTRAINT subscription_change_requests_to_plan_id_fkey FOREIGN KEY (to_plan_id) REFERENCES public.subscription_plans(plan_id);


--
-- Name: subscription_history subscription_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_history
    ADD CONSTRAINT subscription_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(user_id);


--
-- Name: subscription_history subscription_history_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_history
    ADD CONSTRAINT subscription_history_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: subscription_history subscription_history_new_plan_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_history
    ADD CONSTRAINT subscription_history_new_plan_fkey FOREIGN KEY (new_plan) REFERENCES public.subscription_plans(plan_code);


--
-- Name: subscription_history subscription_history_old_plan_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_history
    ADD CONSTRAINT subscription_history_old_plan_fkey FOREIGN KEY (old_plan) REFERENCES public.subscription_plans(plan_code);


--
-- Name: subscription_invoices subscription_invoices_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_invoices
    ADD CONSTRAINT subscription_invoices_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id);


--
-- Name: subscription_invoices subscription_invoices_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_invoices
    ADD CONSTRAINT subscription_invoices_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.subscription_change_requests(request_id);


--
-- Name: subscription_invoices subscription_invoices_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_invoices
    ADD CONSTRAINT subscription_invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.garage_subscriptions(subscription_id);


--
-- Name: subscription_payments subscription_payments_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.garage_subscriptions(subscription_id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(user_id);


--
-- Name: support_tickets support_tickets_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id);


--
-- Name: support_tickets support_tickets_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: technicians technicians_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: undo_audit_log undo_audit_log_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.undo_audit_log
    ADD CONSTRAINT undo_audit_log_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE SET NULL;


--
-- Name: user_addresses user_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_addresses
    ADD CONSTRAINT user_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


--
-- PostgreSQL database dump
--

\restrict m6dmwoKOlhavXwe31QLFea3QwNfln84ue5HUUeSrCumcWjdDtg3iFwsRx4cBakg

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: subscription_plans; Type: TABLE DATA; Schema: public; Owner: sammil_admin
--

INSERT INTO public.subscription_plans (plan_id, plan_code, plan_name, plan_name_ar, monthly_fee, commission_rate, max_bids_per_month, features, is_featured, is_active, display_order, created_at, monthly_price_qar, annual_price_qar, max_monthly_orders, analytics_enabled, priority_support, api_access, ad_campaigns_allowed, max_team_members, features_json, active) VALUES ('61c9e184-0213-4f78-855d-829e40021c6b', 'professional', 'Professional', 'المحترف', 299.00, 0.150, 200, '{"featured_listing": true, "bid_limit_per_day": 100, "showcase_products": 50, "analytics_retention_days": 90}', false, true, 2, '2026-02-15 20:21:33.861741', 299.00, 2990.00, 200, true, false, false, true, 3, '{"featured_listing": true, "bid_limit_per_day": 100, "showcase_products": 50, "analytics_retention_days": 90}', true);
INSERT INTO public.subscription_plans (plan_id, plan_code, plan_name, plan_name_ar, monthly_fee, commission_rate, max_bids_per_month, features, is_featured, is_active, display_order, created_at, monthly_price_qar, annual_price_qar, max_monthly_orders, analytics_enabled, priority_support, api_access, ad_campaigns_allowed, max_team_members, features_json, active) VALUES ('7412f176-1c13-4391-8eae-f9e8bc6786a9', 'enterprise', 'Enterprise', 'المؤسسة', 799.00, 0.120, NULL, '{"custom_branding": true, "featured_listing": true, "bid_limit_per_day": -1, "dedicated_support": true, "showcase_products": -1, "analytics_retention_days": 365}', false, true, 3, '2026-02-15 20:21:33.861741', 799.00, 7990.00, -1, true, true, true, true, 10, '{"custom_branding": true, "featured_listing": true, "bid_limit_per_day": -1, "dedicated_support": true, "showcase_products": -1, "analytics_retention_days": 365}', true);
INSERT INTO public.subscription_plans (plan_id, plan_code, plan_name, plan_name_ar, monthly_fee, commission_rate, max_bids_per_month, features, is_featured, is_active, display_order, created_at, monthly_price_qar, annual_price_qar, max_monthly_orders, analytics_enabled, priority_support, api_access, ad_campaigns_allowed, max_team_members, features_json, active) VALUES ('8196dc87-8837-45bc-adaf-91cff76ab186', 'demo', 'Demo Trial', NULL, 0.00, 0.000, NULL, '{"trial_days": 30, "full_access": true, "no_monthly_fee": true, "unlimited_bids": true}', false, true, 0, '2026-02-16 03:08:04.883864', NULL, NULL, NULL, false, false, false, false, 1, NULL, true);
INSERT INTO public.subscription_plans (plan_id, plan_code, plan_name, plan_name_ar, monthly_fee, commission_rate, max_bids_per_month, features, is_featured, is_active, display_order, created_at, monthly_price_qar, annual_price_qar, max_monthly_orders, analytics_enabled, priority_support, api_access, ad_campaigns_allowed, max_team_members, features_json, active) VALUES ('d4ccb550-e450-4a31-b08b-252bafbd349a', 'free', 'Pay-Per-Sale', NULL, 0.00, 0.150, NULL, '{"7_day_payout": true, "zero_monthly": true, "all_customers": true, "email_support": true, "standard_dashboard": true}', false, true, 0, '2026-02-16 03:08:04.883864', NULL, NULL, NULL, false, false, false, false, 1, NULL, true);
INSERT INTO public.subscription_plans (plan_id, plan_code, plan_name, plan_name_ar, monthly_fee, commission_rate, max_bids_per_month, features, is_featured, is_active, display_order, created_at, monthly_price_qar, annual_price_qar, max_monthly_orders, analytics_enabled, priority_support, api_access, ad_campaigns_allowed, max_team_members, features_json, active) VALUES ('755d669a-59fe-473d-88c9-8a9553b2afdc', 'starter', 'Starter', 'المبتدئ', 299.00, 0.080, 50, '{"monthly_fee": 299, "7_day_payout": true, "basic_analytics": true, "priority_listing": true, "email_chat_support": true, "showcase_20_products": true}', false, true, 1, '2026-02-15 20:21:33.861741', 0.00, 0.00, 50, false, false, false, false, 1, '{"featured_listing": false, "bid_limit_per_day": 20, "showcase_products": 5}', true);
INSERT INTO public.subscription_plans (plan_id, plan_code, plan_name, plan_name_ar, monthly_fee, commission_rate, max_bids_per_month, features, is_featured, is_active, display_order, created_at, monthly_price_qar, annual_price_qar, max_monthly_orders, analytics_enabled, priority_support, api_access, ad_campaigns_allowed, max_team_members, features_json, active) VALUES ('3a5bdec2-3a99-4908-ae98-a357bced70a3', 'gold', 'Gold Partner', NULL, 999.00, 0.050, NULL, '{"monthly_fee": 999, "priority_payout": true, "priority_listing": true, "advanced_analytics": true, "promotional_features": true, "priority_phone_support": true}', false, true, 0, '2026-02-16 03:08:04.883864', NULL, NULL, NULL, false, false, false, false, 1, NULL, true);
INSERT INTO public.subscription_plans (plan_id, plan_code, plan_name, plan_name_ar, monthly_fee, commission_rate, max_bids_per_month, features, is_featured, is_active, display_order, created_at, monthly_price_qar, annual_price_qar, max_monthly_orders, analytics_enabled, priority_support, api_access, ad_campaigns_allowed, max_team_members, features_json, active) VALUES ('7ccdf303-e4b7-4791-81be-a0bf84a44162', 'platinum', 'Platinum Partner', NULL, 2499.00, 0.030, NULL, '{"monthly_fee": 2499, "custom_reports": true, "express_payout": true, "dedicated_manager": true, "featured_placement": true, "marketing_coinvest": true}', false, true, 0, '2026-02-16 03:08:04.883864', NULL, NULL, NULL, false, false, false, false, 1, NULL, true);


--
-- PostgreSQL database dump complete
--


--
-- PostgreSQL database dump
--

\restrict MyBJsYUpkBNRUspzKEQgv8k6NdtSj9EguWjtYwGN8aKLKdNAo3moRaNsw8eFe4G

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: sammil_admin
--

INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (1, '081_cleanup_orphan_objects.sql', '01846604a61f9119', '2026-02-15 20:15:15.712809');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (2, '20241212_enhanced_qc.sql', 'c687e34c9bd0a274', '2026-02-15 20:16:08.557783');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (3, '20241212_qc_delivery_flow.sql', '077436743b2e806c', '2026-02-15 20:16:08.573638');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (4, '20241213_comprehensive_audit.sql', 'd6bbd229ec3b8832', '2026-02-15 20:16:08.585364');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (5, '20241213_support_chat.sql', '978548dcf77b49ff', '2026-02-15 20:16:08.682344');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (6, '20241216_documents_module.sql', 'a4ad82685a845bb7', '2026-02-15 20:16:08.687149');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (7, '20241216_payout_confirmation.sql', '6ab3a32bad980962', '2026-02-15 20:16:08.699468');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (8, '20241217_fix_delivery_assignments.sql', 'f2806ce915375e43', '2026-02-15 20:16:08.723419');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (9, '20241217_fix_missing_columns.sql', '8c2f9952da4fc0d3', '2026-02-15 20:16:08.759688');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (10, '20241217_review_moderation.sql', '8b4084a584dff269', '2026-02-15 20:16:08.771217');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (11, '20241219_delivery_location.sql', 'e03bcf4b5ffade58', '2026-02-15 20:16:08.777094');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (12, '20241219_driver_payouts_chat.sql', 'becdc0fcb70a59c8', '2026-02-15 20:16:08.783096');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (13, '20241220_driver_reassignment.sql', 'ca4e4fdcf1a54182', '2026-02-15 20:16:08.789111');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (14, '20241222_refunds_columns.sql', '839acc260243e788', '2026-02-15 20:16:08.795104');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (15, '20241223_admin_module.sql', 'd12b8eacd808f279', '2026-02-15 20:16:08.801085');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (16, '20241224_delivery_zones.sql', '097b50cc897ecbc4', '2026-02-15 20:16:08.807295');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (17, '20241224_demo_bid_fix.sql', 'e10605ba42e6ec8f', '2026-02-15 20:16:08.819218');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (18, '20241224_performance_indexes.sql', 'db1fc4d64f6d2e85', '2026-02-15 20:16:08.831304');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (19, '20241227_staff_profiles.sql', 'f8b7cb5da2f6b17d', '2026-02-15 20:16:08.861536');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (20, '20241228_fix_payout_status_length.sql', 'f93144d7427d0b42', '2026-02-15 20:16:08.873143');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (21, '20241229_garage_specialization.sql', '231de597b663b9ba', '2026-02-15 20:16:08.94577');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (22, '20241229_indexes_constraints_cleanup.sql', 'd115b133578e46fc', '2026-02-15 20:20:46.530594');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (23, '20241229_payout_adjustments', NULL, '2026-02-15 20:20:46.544078');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (24, '20241229_payout_adjustments.sql', '3dba780996dbbc11', '2026-02-15 20:20:46.556083');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (25, '20241229_support_ticket_sla', NULL, '2026-02-15 20:20:46.562328');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (26, '20241229_support_ticket_sla.sql', 'b5b8a23bf10c6d26', '2026-02-15 20:20:46.574264');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (27, '20241231_cleanup_duplicates', NULL, '2026-02-15 20:20:46.580757');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (28, '20241231_cleanup_duplicates.sql', '1cd09f22d8aad584', '2026-02-15 20:20:46.592845');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (29, '20241231_parts_showcase.sql', 'cca4ee54e9401001', '2026-02-15 20:20:46.603103');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (30, '20251224_address_module.sql', 'fc46411453853f7c', '2026-02-15 20:20:46.616539');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (31, '20251226_user_settings.sql', 'b41f242e1a705fd2', '2026-02-15 20:20:46.628538');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (32, '20251231_add_original_bid_amount.sql', '73fd4f7d1773e3a2', '2026-02-15 20:20:46.64066');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (33, '20260108_driver_locations.sql', '9f9468ec0548dbe4', '2026-02-15 20:20:46.648325');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (34, '20260111_add_driver_bank_details.sql', '85857854afb96eda', '2026-02-15 20:20:46.658597');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (35, '20260111_add_part_category.sql', 'b9c609cc49647bfb', '2026-02-15 20:20:46.67094');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (36, '20260113_add_resolved_by_to_payouts.sql', '45cf0b07fa45b9f3', '2026-02-15 20:20:46.70213');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (37, '20260113_create_driver_wallets.sql', 'e4efb098a18f8a5e', '2026-02-15 20:20:46.710425');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (38, '20260114_customer_vehicles.sql', '242be30ad048b3dc', '2026-02-15 20:20:46.8463');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (39, '20260115_performance_indexes_scale.sql', '501892a1bf4f33c2', '2026-02-15 20:20:46.978662');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (40, '20260115_service_expansion.sql', '6002f70b7730b9e5', '2026-02-15 20:20:47.208417');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (41, '20260116_ad_marketplace.sql', 'ed969d3930b15458', '2026-02-15 20:20:47.839857');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (42, '20260116_customer_loyalty.sql', 'edf80284f43a2b4d', '2026-02-15 20:20:48.080344');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (43, '20260116_garage_analytics.sql', '0abfd8a6ff9b1733', '2026-02-15 20:20:48.279168');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (44, '20260116_performance_optimization.sql', '3d77f6b9ad8b2f80', '2026-02-15 20:20:48.447976');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (45, '20260116_price_benchmarking.sql', '01ff8db4e96bf03e', '2026-02-15 20:27:09.299887');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (46, '20260204_undo_grace_window', NULL, '2026-02-15 20:31:35.212661');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (47, '20260116_subscription_tiers.sql', 'fc3769073490a693', '2026-02-16 03:07:20.864211');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (48, '20260116_unified_partner_model.sql', '1cf600109d9f631c', '2026-02-16 03:07:20.988479');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (49, '20260118_certified_schema_optimization.sql', '27caea0b6a1d94d9', '2026-02-16 03:07:21.217081');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (50, '20260118_escrow_system.sql', 'a8c2f0e36d7604f9', '2026-02-16 03:07:21.451694');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (51, '20260118_loyalty_functions.sql', '8d3f57a49391fedd', '2026-02-16 03:07:21.752263');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (52, '20260118_payment_system.sql', '834911d8107f3800', '2026-02-16 03:07:21.78847');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (53, '20260118_schema_optimization.sql', 'b52b2df22f787775', '2026-02-16 03:07:22.235098');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (54, '20260119_remove_services.sql', '14935a1f79b4b691', '2026-02-16 03:07:22.288593');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (55, '20260119_vehicle_id_photos.sql', '2276e6660301a535', '2026-02-16 03:07:22.299935');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (56, '20260120_vin_capture.sql', '6d383d1f70a7c74f', '2026-02-16 03:08:01.86649');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (57, '20260122_delivery_fee_tiers.sql', '17c749f6a1260950', '2026-02-16 03:08:01.943911');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (58, '20260122_drop_insurance_tables.sql', '6eb45e0be2707838', '2026-02-16 03:08:02.045516');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (59, '20260122_fix_dispute_status.sql', 'e41fb54196d5ef11', '2026-02-16 03:08:02.063764');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (60, '20260122_fix_payout_cancellation_columns.sql', '5323ca04a5f258f2', '2026-02-16 03:08:02.081574');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (61, '20260122_fix_payout_type_column.sql', '4d3ad172a1bafeb6', '2026-02-16 03:08:02.093366');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (62, '20260122_fix_refunds_initiated_by.sql', 'ce46ee829261285f', '2026-02-16 03:08:02.105965');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (63, '20260122_remove_insurance_services.sql', '7ff51ea4e6be9013', '2026-02-16 03:08:02.123271');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (64, '20260123_payout_reversals.sql', 'f04626830a3cfb64', '2026-02-16 03:08:02.162366');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (65, '20260123_ticket_escalation.sql', '83a365fe4bf9953d', '2026-02-16 03:08:02.341447');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (66, '20260124_add_payment_tables.sql', '664104e4b4674a16', '2026-02-16 03:08:02.425614');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (67, '20260126_support_actions_tables.sql', '38f4acca46ac18a3', '2026-02-16 03:08:02.437449');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (68, '20260126_support_phase3_enhancements.sql', 'd7374a668156eec5', '2026-02-16 03:08:02.66001');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (69, '20260127_add_resolution_action_column.sql', '27b812b6c3e84dd8', '2026-02-16 03:08:03.074699');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (70, '20260127_add_ticket_id_to_escalations.sql', '294fd9b3feca13fa', '2026-02-16 03:08:03.092361');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (71, '20260127_comprehensive_constraint_audit.sql', '0d84fa3793b02243', '2026-02-16 03:08:03.140435');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (72, '20260127_fix_order_status_history_constraint.sql', '9860e3ccea2a0b4c', '2026-02-16 03:08:03.266852');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (73, '20260127_fix_refunds_schema_alignment.sql', '3c4ac181dddf847b', '2026-02-16 03:08:03.272424');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (74, '20260127_support_audit_fixes.sql', '58b5e37e7484a7ab', '2026-02-16 03:08:03.368635');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (75, '20260128_add_customer_notes_resolution_logs.sql', '0b7ed469b86bedff', '2026-02-16 03:08:04.001394');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (76, '20260128_cancellation_compliance', NULL, '2026-02-16 03:08:04.192624');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (77, '20260128_cancellation_compliance.sql', '7aee9f7d2d442253', '2026-02-16 03:08:04.192624');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (78, '20260128_drop_legacy_reviews_table.sql', 'e015a1c0c6336d68', '2026-02-16 03:08:04.631659');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (79, '20260129_complete_refunds_schema.sql', '709761b2e74b2f57', '2026-02-16 03:08:04.650008');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (80, '20260129b_fix_refunds_data.sql', 'dc2281d2b3a38e08', '2026-02-16 03:08:04.764011');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (81, '20260130_refund_system_hardening.sql', 'd6525a11b75157a3', '2026-02-16 03:08:04.769227');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (82, '20260202_auto_demo_registration.sql', '877279f0f12929d8', '2026-02-16 03:08:04.883864');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (83, '20260202_enterprise_infrastructure.sql', '43cb389fe0c160e4', '2026-02-16 03:08:04.907506');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (84, '20260202_moci_delivery_fee_compliance.sql', '122adddc98ce7e9d', '2026-02-16 03:08:05.154271');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (85, '20260202_subscription_upgrade_payments.sql', '1b654fa5461ea8e3', '2026-02-16 03:08:05.159913');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (86, '20260203_add_cancelled_to_request_status.sql', 'e5cfb8d429c4d57e', '2026-02-16 03:08:05.1965');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (87, '20260208_commission_rate_check.sql', '16158734c24488c8', '2026-02-16 03:08:05.203691');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (88, '20260208_refresh_tokens.sql', '9c4f55f381d4836e', '2026-02-16 03:08:05.2153');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (89, '20260213_update_escalation_resolution_actions.sql', 'dceea8a762d82349', '2026-02-16 03:08:05.22653');
INSERT INTO public.migrations (id, name, checksum, applied_at) VALUES (90, '20260215_schema_alignment_push_tokens_part_subcategory.sql', '720fe6f3b8e5b99c', '2026-02-16 03:08:05.238618');


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sammil_admin
--

SELECT pg_catalog.setval('public.migrations_id_seq', 90, true);


--
-- PostgreSQL database dump complete
--


