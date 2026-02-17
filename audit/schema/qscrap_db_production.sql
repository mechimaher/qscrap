--
-- PostgreSQL database dump
--

\restrict 7f7UMiSkP0dASGRjRiyNOhUmINK1XF6sVKoXZ8RXUPNHcAbEZHHxp7sEpmrhJ9E

-- Dumped from database version 14.20
-- Dumped by pg_dump version 14.20

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
-- Name: provider_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.provider_type_enum AS ENUM (
    'garage',
    'mobile_mechanic',
    'towing_company',
    'detailer'
);


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
-- Name: service_category_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.service_category_enum AS ENUM (
    'repair',
    'home_wash',
    'home_service',
    'towing'
);


--
-- Name: service_request_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.service_request_status_enum AS ENUM (
    'pending',
    'bidding',
    'accepted',
    'scheduled',
    'in_progress',
    'completed',
    'cancelled',
    'expired'
);


--
-- Name: add_customer_points(uuid, integer, character varying, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_customer_points(p_customer_id uuid, p_points integer, p_transaction_type character varying, p_order_id uuid DEFAULT NULL::uuid, p_description text DEFAULT NULL::text) RETURNS TABLE(new_balance integer, new_tier character varying)
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: FUNCTION add_customer_points(p_customer_id uuid, p_points integer, p_transaction_type character varying, p_order_id uuid, p_description text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.add_customer_points(p_customer_id uuid, p_points integer, p_transaction_type character varying, p_order_id uuid, p_description text) IS 'Add or deduct points with transaction logging';


--
-- Name: auto_record_claim_price(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_record_claim_price() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.part_name IS NOT NULL AND NEW.scrapyard_estimate > 0 THEN
        INSERT INTO part_price_history (
            part_name, vehicle_make, vehicle_model, vehicle_year,
            price, source, source_id, recorded_at
        ) VALUES (
            NEW.part_name, NEW.vehicle_make, NEW.vehicle_model, NEW.vehicle_year,
            NEW.scrapyard_estimate, 'claim', NEW.claim_id, NOW()
        );
    END IF;
    RETURN NEW;
END;
$$;


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
-- Name: check_escrow_expiry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_escrow_expiry() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Auto-refund escrows that are held beyond expiry date
    UPDATE escrow_payments
    SET 
        status = 'refunded',
        refunded_amount = held_amount,
        refund_date = NOW(),
        release_notes = 'Auto-refunded: Work not completed within 30 days'
    WHERE 
        status = 'held' 
        AND expiry_date < NOW()
        AND refunded_amount = 0;
    
    -- Update corresponding claims
    UPDATE insurance_claims
    SET payment_status = 'refunded'
    WHERE escrow_id IN (
        SELECT escrow_id FROM escrow_payments WHERE status = 'refunded'
    );
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
-- Name: detect_price_outlier(character varying, character varying, character varying, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_price_outlier(p_part_name character varying, p_vehicle_make character varying, p_vehicle_model character varying, p_quoted_price numeric) RETURNS TABLE(is_outlier boolean, deviation_percent numeric, avg_market_price numeric, outlier_severity character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_avg_price DECIMAL;
    v_std_dev DECIMAL;
    v_deviation DECIMAL;
    v_deviation_pct DECIMAL;
BEGIN
    -- Get benchmark statistics
    SELECT avg_price, std_dev INTO v_avg_price, v_std_dev
    FROM part_price_benchmarks
    WHERE 
        part_name = p_part_name
        AND vehicle_make = p_vehicle_make
        AND vehicle_model = p_vehicle_model;
    
    -- If no benchmark data, return not outlier
    IF v_avg_price IS NULL THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, 'no_data'::VARCHAR;
        RETURN;
    END IF;
    
    -- Calculate deviation
    v_deviation := p_quoted_price - v_avg_price;
    v_deviation_pct := (v_deviation / v_avg_price) * 100;
    
    -- Determine outlier status and severity
    IF v_deviation_pct > 50 THEN
        RETURN QUERY SELECT TRUE, v_deviation_pct, v_avg_price, 'critical'::VARCHAR;
    ELSIF v_deviation_pct > 30 THEN
        RETURN QUERY SELECT TRUE, v_deviation_pct, v_avg_price, 'high'::VARCHAR;
    ELSIF v_deviation_pct > 15 THEN
        RETURN QUERY SELECT TRUE, v_deviation_pct, v_avg_price, 'medium'::VARCHAR;
    ELSIF v_deviation_pct > 10 THEN
        RETURN QUERY SELECT TRUE, v_deviation_pct, v_avg_price, 'low'::VARCHAR;
    ELSE
        RETURN QUERY SELECT FALSE, v_deviation_pct, v_avg_price, 'normal'::VARCHAR;
    END IF;
END;
$$;


--
-- Name: enforce_subscription_integrity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_subscription_integrity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
        g.name,
        ROUND(ST_Distance(
            g.location,
            ST_SetSRID(ST_Point(customer_lng, customer_lat), 4326)::geography
        ) / 1000, 2) as distance_km,
        g.rating,
        g.average_response_time_minutes,
        ARRAY[
            CASE WHEN g.sells_parts THEN 'parts' END,
            CASE WHEN g.provides_repairs THEN 'repairs' END,
            CASE WHEN g.provides_quick_services THEN 'quick_services' END,
            CASE WHEN g.has_mobile_technicians THEN 'mobile' END
        ]::TEXT[] as capabilities
    FROM garages g
    WHERE g.is_active = true
        AND ST_DWithin(
            g.location,
            ST_SetSRID(ST_Point(customer_lng, customer_lat), 4326)::geography,
            radius_km * 1000
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
    AS $$ BEGIN RETURN QUERY SELECT cr.points_balance, cr.lifetime_points, cr.current_tier, rt.discount_percentage, rt.priority_support, rt.tier_badge_color, CASE WHEN cr.current_tier = 'bronze' THEN 'silver'::varchar WHEN cr.current_tier = 'silver' THEN 'gold'::varchar WHEN cr.current_tier = 'gold' THEN 'platinum'::varchar ELSE 'platinum'::varchar END as next_tier, CASE WHEN cr.current_tier = 'bronze' THEN GREATEST(0, 1000 - cr.lifetime_points) WHEN cr.current_tier = 'silver' THEN GREATEST(0, 3000 - cr.lifetime_points) WHEN cr.current_tier = 'gold' THEN GREATEST(0, 10000 - cr.lifetime_points) ELSE 0 END as points_to_next_tier FROM customer_rewards cr JOIN reward_tiers rt ON cr.current_tier = rt.tier_name WHERE cr.customer_id = p_customer_id; END; $$;


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
-- Name: log_escrow_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_escrow_activity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO escrow_activity_log (escrow_id, activity_type, new_status, amount)
        VALUES (NEW.escrow_id, 'created', NEW.status, NEW.approved_amount);
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            INSERT INTO escrow_activity_log (
                escrow_id, 
                activity_type, 
                previous_status, 
                new_status, 
                amount,
                performed_by
            )
            VALUES (
                NEW.escrow_id, 
                'status_changed', 
                OLD.status, 
                NEW.status,
                NEW.released_amount,
                NEW.release_approved_by
            );
        END IF;
    END IF;
    RETURN NEW;
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
-- Name: refresh_price_benchmarks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_price_benchmarks() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY part_price_benchmarks;
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
-- Name: update_bid_flags_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_bid_flags_updated_at() RETURNS trigger
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
 SELECT c.campaign_id,
    c.garage_id,
    c.campaign_name,
    c.campaign_type,
    c.status,
    c.budget_qar,
    c.spent_amount,
    c.impressions,
    c.clicks,
    c.conversions,
        CASE
            WHEN (c.impressions > 0) THEN round((((c.clicks)::numeric / (c.impressions)::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS ctr_percentage,
        CASE
            WHEN (c.clicks > 0) THEN round((((c.conversions)::numeric / (c.clicks)::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS conversion_rate,
        CASE
            WHEN (c.conversions > 0) THEN round((c.spent_amount / (c.conversions)::numeric), 2)
            ELSE (0)::numeric
        END AS cost_per_conversion,
    date_trunc('day'::text, (c.start_date)::timestamp with time zone) AS start_date,
    date_trunc('day'::text, (c.end_date)::timestamp with time zone) AS end_date
   FROM public.ad_campaigns c
  WITH NO DATA;


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
    superseded_by uuid,
    supersedes_bid_id uuid,
    version_number integer DEFAULT 1,
    CONSTRAINT bids_bid_amount_check CHECK ((bid_amount > (0)::numeric)),
    CONSTRAINT bids_part_condition_check CHECK ((part_condition = ANY (ARRAY['new'::text, 'used_excellent'::text, 'used_good'::text, 'used_fair'::text, 'refurbished'::text]))),
    CONSTRAINT bids_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'withdrawn'::text, 'expired'::text, 'flagged'::text, 'superseded'::text]))),
    CONSTRAINT bids_warranty_days_check CHECK ((warranty_days >= 0))
);


--
-- Name: COLUMN bids.superseded_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bids.superseded_by IS 'Points to the new bid that replaced this one';


--
-- Name: COLUMN bids.supersedes_bid_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bids.supersedes_bid_id IS 'Points to the original bid this one replaces';


--
-- Name: COLUMN bids.version_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bids.version_number IS 'Incremental version for bid corrections';


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
    garage_compensation numeric(10,2) DEFAULT 0,
    pending_compensation numeric(10,2) DEFAULT 0,
    compensation_status character varying(30) DEFAULT 'not_applicable'::character varying,
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
    note_id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    note_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE customer_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customer_notes IS 'Internal agent notes about customers for Support Dashboard';


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
    sender_type character varying(20) NOT NULL,
    sender_id uuid,
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    read_at timestamp without time zone,
    order_id uuid
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
    CONSTRAINT disputes_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('contested'::character varying)::text, ('accepted'::character varying)::text, ('refund_approved'::character varying)::text, ('refund_denied'::character varying)::text, ('resolved'::character varying)::text, ('auto_resolved'::character varying)::text, ('cancelled'::character varying)::text])))
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
    amount numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    processed_at timestamp without time zone,
    assignment_id uuid,
    order_id uuid,
    order_number character varying(50)
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
-- Name: email_otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_otps (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    otp_code character varying(6) NOT NULL,
    purpose character varying(50) DEFAULT 'registration'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL,
    is_used boolean DEFAULT false,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 5,
    user_agent text,
    ip_address inet
);


--
-- Name: TABLE email_otps; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_otps IS 'Stores OTP codes for email verification (registration, password reset, 2FA)';


--
-- Name: COLUMN email_otps.purpose; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_otps.purpose IS 'Purpose of OTP: registration, password_reset, or 2fa';


--
-- Name: COLUMN email_otps.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_otps.expires_at IS 'OTP expires after 10 minutes by default';


--
-- Name: COLUMN email_otps.max_attempts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_otps.max_attempts IS 'Maximum verification attempts allowed (default 5)';


--
-- Name: email_otps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_otps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_otps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_otps_id_seq OWNED BY public.email_otps.id;


--
-- Name: garage_bid_analytics; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.garage_bid_analytics AS
 SELECT b.garage_id,
    date_trunc('month'::text, b.created_at) AS month,
    count(*) AS total_bids,
    count(
        CASE
            WHEN (b.status = 'accepted'::text) THEN 1
            ELSE NULL::integer
        END) AS won_bids,
    count(
        CASE
            WHEN (b.status = 'rejected'::text) THEN 1
            ELSE NULL::integer
        END) AS lost_bids,
    round((((count(
        CASE
            WHEN (b.status = 'accepted'::text) THEN 1
            ELSE NULL::integer
        END))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS win_rate_percentage,
    avg(b.bid_amount) AS avg_bid_amount,
    avg((EXTRACT(epoch FROM (b.updated_at - b.created_at)) / (60)::numeric)) AS avg_response_time_minutes
   FROM public.bids b
  WHERE (b.created_at >= (CURRENT_DATE - '365 days'::interval))
  GROUP BY b.garage_id, (date_trunc('month'::text, b.created_at))
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
    pod_photo_url character varying(500),
    completed_by_driver boolean DEFAULT false,
    auto_completed boolean DEFAULT false,
    deposit_amount numeric(10,2) DEFAULT 0,
    deposit_status character varying(20) DEFAULT 'none'::character varying,
    deposit_intent_id uuid,
    final_payment_intent_id uuid,
    delivered_at timestamp without time zone,
    loyalty_discount numeric(10,2) DEFAULT 0,
    undo_deadline timestamp without time zone,
    undo_used boolean DEFAULT false,
    undo_at timestamp without time zone,
    undo_reason text,
    CONSTRAINT orders_order_status_check CHECK ((order_status = ANY (ARRAY['pending_payment'::text, 'confirmed'::text, 'preparing'::text, 'ready_for_pickup'::text, 'ready_for_collection'::text, 'collected'::text, 'qc_in_progress'::text, 'qc_passed'::text, 'qc_failed'::text, 'returning_to_garage'::text, 'in_transit'::text, 'out_for_delivery'::text, 'delivered'::text, 'completed'::text, 'cancelled_by_customer'::text, 'cancelled_by_garage'::text, 'cancelled_by_ops'::text, 'disputed'::text, 'refunded'::text]))),
    CONSTRAINT orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'wallet'::text, 'card_full'::text]))),
    CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'refunded'::text, 'partially_refunded'::text])))
);


--
-- Name: COLUMN orders.payment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.payment_method IS 'Payment method: cod (Cash on Delivery), card, wallet';


--
-- Name: COLUMN orders.pod_photo_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.pod_photo_url IS 'URL to proof of delivery photo taken by driver';


--
-- Name: COLUMN orders.completed_by_driver; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.completed_by_driver IS 'TRUE if driver completed this order (vs customer or operations)';


--
-- Name: COLUMN orders.auto_completed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.auto_completed IS 'TRUE if order was auto-completed after timeout';


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
 SELECT o.garage_id,
    date_trunc('day'::text, o.created_at) AS date,
    count(DISTINCT o.order_id) AS orders_count,
    sum(o.total_amount) AS revenue,
    avg(o.platform_fee) AS avg_platform_fee,
    count(DISTINCT o.customer_id) AS unique_customers,
    avg((EXTRACT(epoch FROM (o.updated_at - o.created_at)) / (3600)::numeric)) AS avg_fulfillment_hours,
    count(
        CASE
            WHEN (o.order_status = 'completed'::text) THEN 1
            ELSE NULL::integer
        END) AS completed_orders,
    count(
        CASE
            WHEN (o.order_status = 'cancelled'::text) THEN 1
            ELSE NULL::integer
        END) AS cancelled_orders
   FROM public.orders o
  WHERE (o.created_at >= (CURRENT_DATE - '365 days'::interval))
  GROUP BY o.garage_id, (date_trunc('day'::text, o.created_at))
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
    notes text,
    updated_at timestamp without time zone DEFAULT now(),
    received_amount numeric(10,2),
    confirmation_notes text,
    dispute_reason character varying(100),
    dispute_description text,
    disputed_at timestamp without time zone,
    cancellation_reason text,
    cancelled_at timestamp with time zone,
    payout_type character varying(50) DEFAULT 'normal'::character varying,
    held_reason text,
    held_at timestamp without time zone,
    potential_compensation numeric(10,2) DEFAULT 0,
    review_reason character varying(100),
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    review_notes text,
    sent_by uuid,
    CONSTRAINT garage_payouts_payout_status_check CHECK (((payout_status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'awaiting_confirmation'::character varying, 'confirmed'::character varying, 'completed'::character varying, 'disputed'::character varying, 'failed'::character varying, 'on_hold'::character varying, 'cancelled'::character varying])::text[])))
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
-- Name: COLUMN part_requests.part_subcategory; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.part_requests.part_subcategory IS 'Subcategory of the part (e.g., Pistons under Engine category)';


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
    locked_until timestamp with time zone,
    next_plan_id uuid,
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
    supplier_type character varying(20) DEFAULT 'used'::character varying,
    specialized_brands text[],
    all_brands boolean DEFAULT false,
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
    mobile_service_radius_km integer DEFAULT 10,
    max_concurrent_services integer DEFAULT 3,
    average_response_time_minutes integer,
    total_services_completed integer DEFAULT 0,
    quick_service_rating numeric(2,1),
    repair_rating numeric(2,1),
    provider_type public.provider_type_enum DEFAULT 'garage'::public.provider_type_enum,
    service_capabilities uuid[] DEFAULT '{}'::uuid[],
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
-- Name: COLUMN garages.approval_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.garages.approval_status IS 'AUTHORITATIVE status: pending|demo|approved|rejected. Demo takes precedence over subscription for plan display.';


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

COMMENT ON COLUMN public.garages.current_plan_code IS 'Current subscription plan code. Must be "free" when approval_status is demo/pending/rejected.';


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
    applied_at timestamp without time zone DEFAULT now(),
    checksum character varying(64)
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
-- Name: part_price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.part_price_history (
    price_record_id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_name character varying(255) NOT NULL,
    part_category character varying(100),
    part_number character varying(100),
    vehicle_make character varying(100),
    vehicle_model character varying(100),
    vehicle_year integer,
    price numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'QAR'::character varying,
    source character varying(50) NOT NULL,
    source_id uuid,
    garage_id uuid,
    recorded_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: part_price_benchmarks; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.part_price_benchmarks AS
 SELECT part_price_history.part_name,
    part_price_history.vehicle_make,
    part_price_history.vehicle_model,
    count(*) AS sample_size,
    avg(part_price_history.price) AS avg_price,
    min(part_price_history.price) AS min_price,
    max(part_price_history.price) AS max_price,
    percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((part_price_history.price)::double precision)) AS median_price,
    stddev(part_price_history.price) AS std_dev,
    percentile_cont((0.25)::double precision) WITHIN GROUP (ORDER BY ((part_price_history.price)::double precision)) AS p25,
    percentile_cont((0.75)::double precision) WITHIN GROUP (ORDER BY ((part_price_history.price)::double precision)) AS p75,
    max(part_price_history.recorded_at) AS last_updated
   FROM public.part_price_history
  WHERE (part_price_history.recorded_at > (now() - '180 days'::interval))
  GROUP BY part_price_history.part_name, part_price_history.vehicle_make, part_price_history.vehicle_model
 HAVING (count(*) >= 3)
  WITH NO DATA;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    token_type character varying(50) DEFAULT 'password_reset'::character varying,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


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
    status character varying(50) DEFAULT 'pending'::character varying,
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
    order_id uuid,
    CONSTRAINT payout_reversals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'processed'::text, 'failed'::text])))
);


--
-- Name: TABLE payout_reversals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payout_reversals IS 'Tracks reversals for garage payouts that were already sent';


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
    cancellation_id uuid,
    original_amount numeric(10,2),
    refund_amount numeric(10,2),
    fee_retained numeric(10,2) DEFAULT 0,
    delivery_fee_retained numeric(10,2) DEFAULT 0,
    refund_status text DEFAULT 'pending'::text,
    stripe_refund_id text,
    refund_reason text,
    initiated_by text,
    refund_type text DEFAULT 'support_refund'::text,
    refund_method text DEFAULT 'original_payment'::text,
    idempotency_key character varying(255),
    stripe_refund_status character varying(50),
    last_synced_at timestamp with time zone,
    reconciliation_status character varying(20) DEFAULT 'pending'::character varying,
    garage_compensation numeric(10,2) DEFAULT 0,
    CONSTRAINT refunds_reconciliation_status_check CHECK (((reconciliation_status)::text = ANY ((ARRAY['pending'::character varying, 'matched'::character varying, 'mismatch'::character varying, 'manual'::character varying])::text[]))),
    CONSTRAINT refunds_refund_status_check CHECK ((refund_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'rejected'::text])))
);


--
-- Name: TABLE refunds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.refunds IS 'Customer refund records with race condition protection';


--
-- Name: resolution_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resolution_logs (
    log_id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    order_id uuid,
    agent_id uuid NOT NULL,
    action_type character varying(50) NOT NULL,
    action_details jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    ticket_id uuid
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
-- Name: service_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_definitions (
    service_def_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category public.service_category_enum NOT NULL,
    description text,
    icon_url text,
    is_active boolean DEFAULT true,
    base_price_estimate numeric(10,2),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: slow_queries; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.slow_queries AS
 SELECT pg_stat_statements.query,
    pg_stat_statements.calls,
    pg_stat_statements.total_exec_time,
    pg_stat_statements.mean_exec_time,
    pg_stat_statements.max_exec_time,
    pg_stat_statements.stddev_exec_time
   FROM public.pg_stat_statements
  WHERE (pg_stat_statements.mean_exec_time > (100)::double precision)
  ORDER BY pg_stat_statements.mean_exec_time DESC
 LIMIT 20;


--
-- Name: VIEW slow_queries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.slow_queries IS 'Monitor queries with average execution time > 100ms';


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
    CONSTRAINT staff_profiles_role_check CHECK (((role)::text = ANY ((ARRAY['operations'::character varying, 'finance'::character varying, 'customer_service'::character varying, 'quality_control'::character varying, 'logistics'::character varying, 'hr'::character varying, 'management'::character varying])::text[])))
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
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE subscription_plans; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscription_plans IS 'Subscription tier definitions with features and pricing';


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
    ticket_id uuid,
    assigned_to uuid,
    resolution_action character varying(50),
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
    insurance_company_id uuid,
    email_verified boolean DEFAULT false,
    CONSTRAINT users_user_type_check CHECK ((user_type = ANY (ARRAY['customer'::text, 'garage'::text, 'driver'::text, 'staff'::text, 'admin'::text, 'insurance_agent'::text])))
);


--
-- Name: vehicle_history_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_history_events (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    vin_number character varying(17) NOT NULL,
    event_type text NOT NULL,
    event_date timestamp without time zone DEFAULT now(),
    order_id uuid,
    service_request_id uuid,
    garage_id uuid,
    description text NOT NULL,
    mileage_km integer,
    is_verified_by_motar boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


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
-- Name: delivery_fee_tiers tier_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_fee_tiers ALTER COLUMN tier_id SET DEFAULT nextval('public.delivery_fee_tiers_tier_id_seq'::regclass);


--
-- Name: delivery_zones zone_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones ALTER COLUMN zone_id SET DEFAULT nextval('public.delivery_zones_zone_id_seq'::regclass);


--
-- Name: email_otps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_otps ALTER COLUMN id SET DEFAULT nextval('public.email_otps_id_seq'::regclass);


--
-- Name: hub_locations hub_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hub_locations ALTER COLUMN hub_id SET DEFAULT nextval('public.hub_locations_hub_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: ad_campaigns ad_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_pkey PRIMARY KEY (campaign_id);


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
-- Name: email_otps email_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_otps
    ADD CONSTRAINT email_otps_pkey PRIMARY KEY (id);


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
-- Name: part_price_history part_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_price_history
    ADD CONSTRAINT part_price_history_pkey PRIMARY KEY (price_record_id);


--
-- Name: part_requests part_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_pkey PRIMARY KEY (request_id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_key UNIQUE (user_id);


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
-- Name: payout_reversals payout_reversals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_reversals
    ADD CONSTRAINT payout_reversals_pkey PRIMARY KEY (reversal_id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


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
-- Name: service_definitions service_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_definitions
    ADD CONSTRAINT service_definitions_pkey PRIMARY KEY (service_def_id);


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
-- Name: refunds unique_order_refund_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT unique_order_refund_type UNIQUE (order_id, refund_type);


--
-- Name: CONSTRAINT unique_order_refund_type ON refunds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT unique_order_refund_type ON public.refunds IS 'Prevents double refunds - CR-01 fix from Jan 30 2026 audit';


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
-- Name: vehicle_history_events vehicle_history_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_history_events
    ADD CONSTRAINT vehicle_history_events_pkey PRIMARY KEY (event_id);


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
-- Name: idx_audit_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_target ON public.admin_audit_log USING btree (target_type, target_id);


--
-- Name: idx_benchmark_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_benchmark_lookup ON public.part_price_benchmarks USING btree (part_name, vehicle_make, vehicle_model);


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
-- Name: idx_bids_status_flagged; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bids_status_flagged ON public.bids USING btree (garage_id, status) WHERE (status = 'flagged'::text);


--
-- Name: idx_bids_superseded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bids_superseded_by ON public.bids USING btree (superseded_by) WHERE (superseded_by IS NOT NULL);


--
-- Name: idx_bids_supersedes_bid_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bids_supersedes_bid_id ON public.bids USING btree (supersedes_bid_id) WHERE (supersedes_bid_id IS NOT NULL);


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
-- Name: idx_customer_vehicles_vin_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_customer_vehicles_vin_unique ON public.customer_vehicles USING btree (customer_id, vin_number) WHERE ((vin_number IS NOT NULL) AND ((vin_number)::text <> ''::text));


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
-- Name: idx_driver_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_transactions_type ON public.driver_transactions USING btree (type);


--
-- Name: idx_driver_transactions_wallet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_transactions_wallet_id ON public.driver_transactions USING btree (wallet_id);


--
-- Name: idx_driver_wallets_driver_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_wallets_driver_id ON public.driver_wallets USING btree (driver_id);


--
-- Name: idx_drivers_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drivers_available ON public.drivers USING btree (status) WHERE ((status)::text = 'available'::text);


--
-- Name: idx_drivers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drivers_status ON public.drivers USING btree (status);


--
-- Name: idx_email_otps_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_otps_email ON public.email_otps USING btree (email);


--
-- Name: idx_email_otps_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_otps_expiry ON public.email_otps USING btree (expires_at);


--
-- Name: idx_email_otps_purpose; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_otps_purpose ON public.email_otps USING btree (purpose);


--
-- Name: idx_escalations_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escalations_ticket ON public.support_escalations USING btree (ticket_id);


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
-- Name: idx_garage_subs_next_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_subs_next_plan ON public.garage_subscriptions USING btree (next_plan_id);


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

CREATE INDEX idx_garages_approved ON public.garages USING btree (approval_status, rating_average DESC) WHERE ((approval_status)::text = 'approved'::text);


--
-- Name: idx_garages_brands; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_brands ON public.garages USING gin (specialized_brands);


--
-- Name: idx_garages_demo_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_demo_expiry ON public.garages USING btree (demo_expires_at) WHERE ((approval_status)::text = 'demo'::text);


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
-- Name: idx_garages_specialized_brands; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_specialized_brands ON public.garages USING gin (specialized_brands);


--
-- Name: idx_garages_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_subscription ON public.garages USING btree (subscription_plan, subscription_end_date);


--
-- Name: idx_garages_supplier_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_supplier_type ON public.garages USING btree (supplier_type);


--
-- Name: idx_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created ON public.chat_messages USING btree (created_at);


--
-- Name: idx_messages_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_ticket ON public.chat_messages USING btree (ticket_id);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


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
-- Name: idx_orders_active_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_active_status ON public.orders USING btree (order_status, created_at DESC) WHERE (order_status = ANY (ARRAY['confirmed'::text, 'preparing'::text, 'ready_for_pickup'::text, 'in_transit'::text, 'out_for_delivery'::text]));


--
-- Name: idx_orders_completed_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_completed_date ON public.orders USING btree (created_at DESC) WHERE (order_status = 'completed'::text);


--
-- Name: idx_orders_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created ON public.orders USING btree (created_at DESC);


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
-- Name: idx_orders_garage_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_garage_performance ON public.orders USING btree (garage_id, order_status, completed_at);


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
-- Name: idx_orders_pending_payment_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_pending_payment_created ON public.orders USING btree (created_at) WHERE (order_status = 'pending_payment'::text);


--
-- Name: idx_orders_preparing_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_preparing_updated ON public.orders USING btree (updated_at) WHERE (order_status = 'preparing'::text);


--
-- Name: idx_orders_qc_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_qc_pending ON public.orders USING btree (order_status) WHERE (order_status = ANY (ARRAY['preparing'::text, 'collected'::text, 'qc_in_progress'::text]));


--
-- Name: idx_orders_revenue_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_revenue_date ON public.orders USING btree (created_at, total_amount) WHERE (order_status = 'completed'::text);


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
-- Name: idx_part_price_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_price_category ON public.part_price_history USING btree (part_category, recorded_at);


--
-- Name: idx_part_price_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_price_lookup ON public.part_price_history USING btree (part_name, vehicle_make, vehicle_model);


--
-- Name: idx_part_price_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_price_source ON public.part_price_history USING btree (source, source_id);


--
-- Name: idx_part_price_stats; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_price_stats ON public.part_price_history USING btree (part_name, recorded_at);


--
-- Name: idx_part_price_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_price_vehicle ON public.part_price_history USING btree (vehicle_make, vehicle_model, vehicle_year);


--
-- Name: idx_part_requests_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_requests_active ON public.part_requests USING btree (status, created_at DESC) WHERE (status = 'active'::text);


--
-- Name: idx_part_requests_car_make; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_requests_car_make ON public.part_requests USING btree (car_make, car_model, status);


--
-- Name: idx_part_requests_category_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_requests_category_status ON public.part_requests USING btree (part_category, status, created_at DESC);


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
-- Name: idx_password_reset_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_expires ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: idx_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


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
-- Name: idx_refunds_cancellation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_cancellation ON public.refunds USING btree (cancellation_id);


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

CREATE INDEX idx_refunds_failed_only ON public.refunds USING btree (created_at DESC) WHERE (refund_status = 'failed'::text);


--
-- Name: idx_refunds_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_refunds_idempotency_key ON public.refunds USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_refunds_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_order ON public.refunds USING btree (order_id);


--
-- Name: idx_refunds_pending_only; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_pending_only ON public.refunds USING btree (created_at DESC) WHERE (refund_status = 'pending'::text);


--
-- Name: idx_refunds_refund_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_refund_status ON public.refunds USING btree (refund_status);


--
-- Name: idx_refunds_stripe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_stripe ON public.refunds USING btree (stripe_refund_id) WHERE (stripe_refund_id IS NOT NULL);


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
-- Name: idx_users_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_email_unique ON public.users USING btree (lower(email)) WHERE (email IS NOT NULL);


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
-- Name: idx_vehicle_history_vin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_history_vin ON public.vehicle_history_events USING btree (vin_number);


--
-- Name: idx_vouchers_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_customer ON public.delivery_vouchers USING btree (customer_id);


--
-- Name: idx_vouchers_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_expires ON public.delivery_vouchers USING btree (expires_at);


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
-- Name: orders set_order_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders FOR EACH ROW WHEN ((new.order_number IS NULL)) EXECUTE FUNCTION public.generate_order_number();


--
-- Name: documents trg_documents_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_document_timestamp();


--
-- Name: garages trg_enforce_subscription_integrity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_subscription_integrity BEFORE UPDATE ON public.garages FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_integrity();


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
-- Name: bids bids_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bids
    ADD CONSTRAINT bids_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.bids(bid_id);


--
-- Name: bids bids_supersedes_bid_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bids
    ADD CONSTRAINT bids_supersedes_bid_id_fkey FOREIGN KEY (supersedes_bid_id) REFERENCES public.bids(bid_id);


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
    ADD CONSTRAINT customer_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id);


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
-- Name: delivery_chats delivery_chats_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_chats
    ADD CONSTRAINT delivery_chats_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


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
-- Name: driver_payouts driver_payouts_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_payouts
    ADD CONSTRAINT driver_payouts_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.delivery_assignments(assignment_id);


--
-- Name: driver_payouts driver_payouts_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_payouts
    ADD CONSTRAINT driver_payouts_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(driver_id) ON DELETE CASCADE;


--
-- Name: driver_payouts driver_payouts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_payouts
    ADD CONSTRAINT driver_payouts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


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
-- Name: support_escalations fk_escalations_ticket; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_escalations
    ADD CONSTRAINT fk_escalations_ticket FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(ticket_id) ON DELETE SET NULL;


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
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


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
-- Name: part_price_history part_price_history_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_price_history
    ADD CONSTRAINT part_price_history_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


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
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


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
-- Name: push_tokens push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


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
    ADD CONSTRAINT resolution_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id);


--
-- Name: resolution_logs resolution_logs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resolution_logs
    ADD CONSTRAINT resolution_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: resolution_logs resolution_logs_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resolution_logs
    ADD CONSTRAINT resolution_logs_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(ticket_id);


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

\unrestrict 7f7UMiSkP0dASGRjRiyNOhUmINK1XF6sVKoXZ8RXUPNHcAbEZHHxp7sEpmrhJ9E

