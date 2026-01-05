--
-- PostgreSQL database dump
--

\restrict cwQSragatKM8lQl9esMX1re8nVYU939xnnWsUwyDraImM31YYe2WPXZ21gVgPJA

-- Dumped from database version 14.20
-- Dumped by pg_dump version 17.7 (Ubuntu 17.7-0ubuntu0.25.10.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


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


SET default_tablespace = '';

SET default_table_access_method = heap;

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
    CONSTRAINT cancellation_requests_reason_code_check CHECK (((reason_code)::text = ANY ((ARRAY['changed_mind'::character varying, 'found_elsewhere'::character varying, 'too_expensive'::character varying, 'wrong_part'::character varying, 'taking_too_long'::character varying, 'stock_out'::character varying, 'part_defective'::character varying, 'wrong_part_identified'::character varying, 'customer_unreachable'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT cancellation_requests_requested_by_type_check CHECK (((requested_by_type)::text = ANY ((ARRAY['customer'::character varying, 'garage'::character varying, 'admin'::character varying])::text[]))),
    CONSTRAINT cancellation_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'processed'::character varying])::text[])))
);


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
    created_at timestamp without time zone DEFAULT now()
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
    CONSTRAINT delivery_assignments_assignment_type_check CHECK (((assignment_type)::text = ANY ((ARRAY['delivery'::character varying, 'return_to_garage'::character varying, 'collection'::character varying])::text[]))),
    CONSTRAINT delivery_assignments_status_check CHECK (((status)::text = ANY ((ARRAY['assigned'::character varying, 'picked_up'::character varying, 'in_transit'::character varying, 'delivered'::character varying, 'failed'::character varying])::text[])))
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
    CONSTRAINT disputes_reason_check CHECK (((reason)::text = ANY ((ARRAY['wrong_part'::character varying, 'damaged'::character varying, 'not_as_described'::character varying, 'doesnt_fit'::character varying, 'changed_mind'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT disputes_refund_percent_check CHECK (((refund_percent >= 0) AND (refund_percent <= 100))),
    CONSTRAINT disputes_resolution_check CHECK (((resolution)::text = ANY ((ARRAY['refund_approved'::character varying, 'auto_approved'::character varying, 'claim_rejected'::character varying, 'partial_refund'::character varying])::text[]))),
    CONSTRAINT disputes_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'contested'::character varying, 'accepted'::character varying, 'refund_approved'::character varying, 'refund_denied'::character varying, 'resolved'::character varying, 'auto_resolved'::character varying, 'cancelled'::character varying])::text[])))
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
    CONSTRAINT documents_document_type_check CHECK (((document_type)::text = ANY ((ARRAY['invoice'::character varying, 'receipt'::character varying, 'warranty_card'::character varying, 'delivery_note'::character varying, 'quote'::character varying])::text[]))),
    CONSTRAINT documents_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'generated'::character varying, 'sent'::character varying, 'viewed'::character varying, 'downloaded'::character varying, 'printed'::character varying, 'archived'::character varying, 'voided'::character varying])::text[])))
);


--
-- Name: TABLE documents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.documents IS 'Qatar MOCI Compliant Document Storage - 10 Year Retention';


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
    CONSTRAINT drivers_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'busy'::character varying, 'offline'::character varying, 'suspended'::character varying])::text[])))
);


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
    CONSTRAINT garage_parts_part_condition_check CHECK (((part_condition)::text = ANY ((ARRAY['new'::character varying, 'used'::character varying, 'refurbished'::character varying])::text[]))),
    CONSTRAINT garage_parts_price_type_check CHECK (((price_type)::text = ANY ((ARRAY['fixed'::character varying, 'negotiable'::character varying])::text[]))),
    CONSTRAINT garage_parts_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'sold'::character varying, 'hidden'::character varying])::text[])))
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
    CONSTRAINT garage_payouts_payout_status_check CHECK (((payout_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('processing'::character varying)::text, ('awaiting_confirmation'::character varying)::text, ('completed'::character varying)::text, ('disputed'::character varying)::text, ('failed'::character varying)::text, ('on_hold'::character varying)::text, ('cancelled'::character varying)::text])))
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
    CONSTRAINT garage_subscriptions_status_check CHECK (((status)::text = ANY ((ARRAY['trial'::character varying, 'active'::character varying, 'past_due'::character varying, 'cancelled'::character varying, 'expired'::character varying, 'suspended'::character varying])::text[])))
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
    CONSTRAINT garages_approval_status_check CHECK (((approval_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'demo'::character varying, 'expired'::character varying])::text[]))),
    CONSTRAINT garages_supplier_type_check CHECK (((supplier_type)::text = ANY ((ARRAY['used'::character varying, 'new'::character varying, 'both'::character varying])::text[])))
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
    CONSTRAINT order_reviews_moderation_status_check CHECK (((moderation_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
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
    CONSTRAINT order_status_history_changed_by_type_check CHECK (((changed_by_type)::text = ANY ((ARRAY['customer'::character varying, 'garage'::character varying, 'driver'::character varying, 'system'::character varying, 'admin'::character varying, 'operations'::character varying])::text[])))
);


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
    CONSTRAINT orders_order_status_check CHECK ((order_status = ANY (ARRAY['confirmed'::text, 'preparing'::text, 'ready_for_pickup'::text, 'ready_for_collection'::text, 'collected'::text, 'qc_in_progress'::text, 'qc_passed'::text, 'qc_failed'::text, 'returning_to_garage'::text, 'in_transit'::text, 'delivered'::text, 'completed'::text, 'cancelled_by_customer'::text, 'cancelled_by_garage'::text, 'cancelled_by_ops'::text, 'disputed'::text, 'refunded'::text]))),
    CONSTRAINT orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'wallet'::text]))),
    CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'refunded'::text, 'partially_refunded'::text])))
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
    CONSTRAINT quality_inspections_condition_assessment_check CHECK (((condition_assessment)::text = ANY ((ARRAY['excellent'::character varying, 'good'::character varying, 'fair'::character varying, 'poor'::character varying, 'defective'::character varying])::text[]))),
    CONSTRAINT quality_inspections_failure_category_check CHECK (((failure_category)::text = ANY ((ARRAY['damaged'::character varying, 'wrong_part'::character varying, 'missing_components'::character varying, 'quality_mismatch'::character varying, 'counterfeit'::character varying, 'rust_corrosion'::character varying, 'non_functional'::character varying, 'packaging_issue'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT quality_inspections_part_grade_check CHECK (((part_grade)::text = ANY ((ARRAY['A'::character varying, 'B'::character varying, 'C'::character varying, 'reject'::character varying])::text[]))),
    CONSTRAINT quality_inspections_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'passed'::character varying, 'failed'::character varying])::text[])))
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
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refunds (
    refund_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    cancellation_id uuid,
    original_amount numeric(10,2) NOT NULL,
    refund_amount numeric(10,2) NOT NULL,
    fee_retained numeric(10,2) DEFAULT 0,
    refund_method character varying(50),
    refund_status character varying(20) DEFAULT 'pending'::character varying,
    refund_reference character varying(100),
    failure_reason text,
    created_at timestamp without time zone DEFAULT now(),
    processed_at timestamp without time zone,
    refund_reason text,
    processed_by uuid,
    CONSTRAINT refunds_refund_method_check CHECK (((refund_method)::text = ANY ((ARRAY['original_payment'::character varying, 'wallet_credit'::character varying, 'bank_transfer'::character varying, 'cash'::character varying])::text[]))),
    CONSTRAINT refunds_refund_status_check CHECK (((refund_status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    review_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    customer_id uuid,
    garage_id uuid,
    overall_rating integer NOT NULL,
    quality_rating integer,
    communication_rating integer,
    review_text text,
    is_published boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT reviews_communication_rating_check CHECK (((communication_rating >= 1) AND (communication_rating <= 5))),
    CONSTRAINT reviews_overall_rating_check CHECK (((overall_rating >= 1) AND (overall_rating <= 5))),
    CONSTRAINT reviews_quality_rating_check CHECK (((quality_rating >= 1) AND (quality_rating <= 5)))
);


--
-- Name: TABLE reviews; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reviews IS 'DEPRECATED (2024-12-31): Use order_reviews instead. Scheduled for removal Q2 2025. DO NOT USE IN NEW CODE.';


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
    CONSTRAINT staff_profiles_role_check CHECK (((role)::text = ANY ((ARRAY['operations'::character varying, 'accounting'::character varying, 'customer_service'::character varying, 'quality_control'::character varying, 'logistics'::character varying, 'hr'::character varying, 'management'::character varying])::text[])))
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
    CONSTRAINT subscription_payments_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[])))
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
    CONSTRAINT support_tickets_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT support_tickets_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying, 'resolved'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: COLUMN support_tickets.sla_deadline; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.support_tickets.sla_deadline IS 'Deadline for first response (default 24 hours)';


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
-- Name: warranty_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warranty_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


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
-- Name: customer_addresses customer_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_pkey PRIMARY KEY (address_id);


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
-- Name: driver_payouts driver_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_payouts
    ADD CONSTRAINT driver_payouts_pkey PRIMARY KEY (payout_id);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (driver_id);


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
-- Name: garage_payouts garage_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_payouts
    ADD CONSTRAINT garage_payouts_pkey PRIMARY KEY (payout_id);


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
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (refund_id);


--
-- Name: reviews reviews_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_order_id_key UNIQUE (order_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (review_id);


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
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (ticket_id);


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
-- Name: idx_assignments_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_active ON public.delivery_assignments USING btree (status) WHERE ((status)::text = ANY ((ARRAY['assigned'::character varying, 'picked_up'::character varying, 'in_transit'::character varying])::text[]));


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
-- Name: idx_bids_garage_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bids_garage_created ON public.bids USING btree (garage_id, created_at DESC);


--
-- Name: idx_bids_garage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bids_garage_id ON public.bids USING btree (garage_id);


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
-- Name: idx_counter_offers_bid_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counter_offers_bid_id ON public.counter_offers USING btree (bid_id);


--
-- Name: idx_counter_offers_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counter_offers_expires ON public.counter_offers USING btree (expires_at) WHERE (status = 'pending'::text);


--
-- Name: idx_counter_offers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counter_offers_status ON public.counter_offers USING btree (status);


--
-- Name: idx_delivery_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_active ON public.delivery_assignments USING btree (status, created_at DESC) WHERE ((status)::text = ANY ((ARRAY['assigned'::character varying, 'picked_up'::character varying, 'in_transit'::character varying])::text[]));


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
-- Name: idx_drivers_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drivers_available ON public.drivers USING btree (status) WHERE ((status)::text = 'available'::text);


--
-- Name: idx_drivers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drivers_status ON public.drivers USING btree (status);


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
-- Name: idx_garage_payouts_garage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garage_payouts_garage_id ON public.garage_payouts USING btree (garage_id);


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
-- Name: idx_garages_approval_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_approval_pending ON public.garages USING btree (approval_status, created_at) WHERE ((approval_status)::text = 'pending'::text);


--
-- Name: idx_garages_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_approval_status ON public.garages USING btree (approval_status);


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
-- Name: idx_garages_supplier_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garages_supplier_type ON public.garages USING btree (supplier_type);


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
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);


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
-- Name: idx_orders_customer_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_created ON public.orders USING btree (customer_id, created_at DESC);


--
-- Name: idx_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_garage_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_garage_created ON public.orders USING btree (garage_id, created_at DESC);


--
-- Name: idx_orders_garage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_garage_id ON public.orders USING btree (garage_id);


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
-- Name: idx_orders_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_zone ON public.orders USING btree (delivery_zone_id);


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
-- Name: idx_qc_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qc_order ON public.quality_inspections USING btree (order_id);


--
-- Name: idx_qc_passed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qc_passed ON public.quality_inspections USING btree (result, created_at DESC);


--
-- Name: idx_refunds_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_order_id ON public.refunds USING btree (order_id);


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
-- Name: idx_reviews_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_garage ON public.reviews USING btree (garage_id);


--
-- Name: idx_reviews_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_order ON public.reviews USING btree (order_id);


--
-- Name: idx_staff_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_role ON public.staff_profiles USING btree (role);


--
-- Name: idx_staff_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_user ON public.staff_profiles USING btree (user_id);


--
-- Name: idx_subscriptions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_active ON public.garage_subscriptions USING btree (status, billing_cycle_end) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_subscriptions_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_expiry ON public.garage_subscriptions USING btree (billing_cycle_end) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_subscriptions_garage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_garage ON public.garage_subscriptions USING btree (garage_id);


--
-- Name: idx_support_tickets_escalation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_escalation ON public.support_tickets USING btree (escalation_level) WHERE ((status)::text <> ALL ((ARRAY['resolved'::character varying, 'closed'::character varying])::text[]));


--
-- Name: idx_support_tickets_sla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_sla ON public.support_tickets USING btree (sla_deadline) WHERE ((status)::text <> ALL ((ARRAY['resolved'::character varying, 'closed'::character varying])::text[]));


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
-- Name: bids enforce_active_request_for_bid; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_active_request_for_bid BEFORE INSERT ON public.bids FOR EACH ROW EXECUTE FUNCTION public.check_request_active_for_bid();


--
-- Name: bids enforce_subscription_for_bid; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_subscription_for_bid BEFORE INSERT ON public.bids FOR EACH ROW EXECUTE FUNCTION public.check_garage_can_bid();


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
-- Name: order_reviews trigger_update_garage_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_garage_rating AFTER INSERT OR UPDATE ON public.order_reviews FOR EACH ROW EXECUTE FUNCTION public.update_garage_rating();


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
-- Name: customer_addresses customer_addresses_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


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
-- Name: drivers drivers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


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
-- Name: garage_subscriptions garage_subscriptions_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_subscriptions
    ADD CONSTRAINT garage_subscriptions_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


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
-- Name: orders orders_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(user_id);


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
-- Name: refunds refunds_cancellation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_cancellation_id_fkey FOREIGN KEY (cancellation_id) REFERENCES public.cancellation_requests(cancellation_id);


--
-- Name: refunds refunds_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- Name: refunds refunds_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(user_id);


--
-- Name: reviews reviews_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: reviews reviews_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id) ON DELETE CASCADE;


--
-- Name: reviews reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- Name: staff_profiles staff_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_profiles
    ADD CONSTRAINT staff_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


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
-- Name: user_addresses user_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_addresses
    ADD CONSTRAINT user_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict cwQSragatKM8lQl9esMX1re8nVYU939xnnWsUwyDraImM31YYe2WPXZ21gVgPJA

