--
-- PostgreSQL database dump
--

\restrict fpqutzxvTUu7Tk2ETUANfz2Kdd6HyDvMk0eirEGSzPgb3YvJ4eVp4PMPyKS0rPp

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
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log (
    log_id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid,
    action_type character varying(50),
    target_type character varying(50),
    target_id uuid,
    old_value jsonb,
    new_value jsonb,
    details text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    log_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action character varying(100),
    entity_type character varying(50),
    entity_id uuid,
    old_data jsonb,
    new_data jsonb,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bid_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bid_flags (
    flag_id uuid DEFAULT gen_random_uuid() NOT NULL,
    bid_id uuid,
    flagged_by uuid,
    reason character varying(50),
    details text,
    is_urgent boolean DEFAULT false,
    status character varying(20) DEFAULT 'pending'::character varying,
    event_id uuid DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: bids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bids (
    bid_id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid,
    garage_id uuid,
    part_condition text,
    brand_name text,
    part_number character varying(50),
    warranty_days integer DEFAULT 0,
    bid_amount numeric(10,2),
    original_bid_amount numeric(10,2),
    status text DEFAULT 'pending'::text,
    image_urls text[],
    notes text,
    superseded_by uuid,
    supersedes_bid_id uuid,
    version_number integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: cancellation_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cancellation_requests (
    cancellation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    requested_by uuid,
    requested_by_type character varying(20),
    reason_code character varying(50),
    reason_details text,
    cancellation_fee numeric(10,2) DEFAULT 0,
    refund_amount numeric(10,2) DEFAULT 0,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    message_id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid,
    sender_id uuid,
    sender_type character varying(20),
    message_text text,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: counter_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counter_offers (
    counter_offer_id uuid DEFAULT gen_random_uuid() NOT NULL,
    bid_id uuid,
    offered_by_type text,
    proposed_amount numeric(10,2),
    round_number integer DEFAULT 1,
    status text DEFAULT 'pending'::text,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: customer_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_addresses (
    address_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    label character varying(50),
    full_address text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: customer_vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_vehicles (
    vehicle_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    make character varying(50) NOT NULL,
    model character varying(50) NOT NULL,
    year integer,
    vin_number character varying(17),
    nickname character varying(50),
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: delivery_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_assignments (
    assignment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    driver_id uuid,
    status character varying(20) DEFAULT 'assigned'::character varying,
    pickup_lat numeric(10,8),
    pickup_lng numeric(11,8),
    delivery_lat numeric(10,8),
    delivery_lng numeric(11,8),
    signature_url text,
    delivery_photo_url text,
    picked_up_at timestamp with time zone,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: delivery_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_zones (
    zone_id integer NOT NULL,
    zone_name character varying(50),
    min_distance_km numeric(6,2),
    max_distance_km numeric(6,2),
    delivery_fee numeric(10,2),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
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
    reason character varying(50),
    description text,
    evidence_urls text[],
    refund_amount numeric(10,2),
    status character varying(30) DEFAULT 'pending'::character varying,
    resolution_notes text,
    auto_resolve_at timestamp with time zone DEFAULT (now() + '48:00:00'::interval),
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    document_id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_type character varying(50),
    document_number character varying(50),
    order_id uuid,
    garage_id uuid,
    customer_id uuid,
    file_path character varying(500),
    verification_code character varying(100),
    status character varying(30) DEFAULT 'draft'::character varying,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: driver_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_locations (
    driver_id uuid NOT NULL,
    latitude numeric(10,8),
    longitude numeric(11,8),
    heading numeric(5,2),
    speed numeric(5,2),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: driver_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_payouts (
    payout_id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid,
    assignment_id uuid,
    amount numeric(10,2),
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: driver_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_wallets (
    wallet_id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid,
    balance numeric(10,2) DEFAULT 0,
    total_earned numeric(10,2) DEFAULT 0,
    cash_collected numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drivers (
    driver_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    full_name character varying(100),
    phone character varying(20),
    vehicle_type character varying(50) DEFAULT 'motorcycle'::character varying,
    vehicle_plate character varying(20),
    license_number character varying(50),
    status character varying(20) DEFAULT 'offline'::character varying,
    current_lat numeric(10,8),
    current_lng numeric(11,8),
    total_deliveries integer DEFAULT 0,
    rating_average numeric(3,2) DEFAULT 0,
    bank_account_iban character varying(50),
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
    gross_amount numeric(10,2),
    commission_amount numeric(10,2),
    net_amount numeric(10,2),
    payout_status character varying(50) DEFAULT 'pending'::character varying,
    sent_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    auto_confirmed boolean DEFAULT false,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: garage_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garage_subscriptions (
    subscription_id uuid DEFAULT gen_random_uuid() NOT NULL,
    garage_id uuid,
    plan_id uuid,
    status character varying(20) DEFAULT 'trial'::character varying,
    billing_cycle_start date,
    billing_cycle_end date,
    bids_used_this_cycle integer DEFAULT 0,
    auto_renew boolean DEFAULT true,
    is_admin_granted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: garages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garages (
    garage_id uuid NOT NULL,
    garage_name text NOT NULL,
    trade_license_number character varying(50),
    cr_number character varying(50),
    phone_number character varying(20),
    address text,
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    approval_status character varying(20) DEFAULT 'pending'::character varying,
    supplier_type character varying(10) DEFAULT 'used'::character varying,
    specialized_brands text[],
    all_brands boolean DEFAULT false,
    rating_average numeric(3,2) DEFAULT 0,
    bank_name character varying(100),
    iban character varying(50),
    demo_expires_at timestamp with time zone,
    profile_photo_url text,
    working_hours jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


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
    title character varying(200),
    body text,
    type character varying(50),
    reference_id uuid,
    reference_type character varying(50),
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: operations_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operations_staff (
    staff_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    role character varying(50) DEFAULT 'operator'::character varying,
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: order_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_reviews (
    review_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    customer_id uuid,
    garage_id uuid,
    overall_rating integer,
    part_quality_rating integer,
    communication_rating integer,
    delivery_rating integer,
    review_text text,
    moderation_status character varying(20) DEFAULT 'pending'::character varying,
    is_visible boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status_history (
    history_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    old_status character varying(30),
    new_status character varying(30),
    changed_by uuid,
    changed_by_type character varying(20),
    reason text,
    created_at timestamp with time zone DEFAULT now()
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
    driver_id uuid,
    part_price numeric(10,2),
    commission_rate numeric(4,3),
    platform_fee numeric(10,2),
    delivery_fee numeric(10,2),
    total_amount numeric(10,2),
    garage_payout_amount numeric(10,2),
    payment_method text DEFAULT 'cash'::text,
    payment_status text DEFAULT 'pending'::text,
    order_status text DEFAULT 'pending_payment'::text,
    delivery_address text,
    delivery_lat numeric(10,8),
    delivery_lng numeric(11,8),
    customer_notes text,
    undo_deadline timestamp with time zone,
    undo_used boolean DEFAULT false,
    undo_at timestamp with time zone,
    undo_reason text,
    loyalty_discount numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deposit_amount numeric(10,2) DEFAULT 0,
    deposit_status character varying(20) DEFAULT 'none'::character varying
);


--
-- Name: part_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.part_requests (
    request_id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    car_make text NOT NULL,
    car_model text NOT NULL,
    car_year integer,
    vin_number character varying(17),
    part_description text NOT NULL,
    part_category character varying(50),
    part_subcategory character varying(100),
    condition_required text DEFAULT 'any'::text,
    status text DEFAULT 'active'::text,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval),
    delivery_lat numeric(10,8),
    delivery_lng numeric(11,8),
    delivery_address text,
    photo_urls text[],
    vehicle_id_photos jsonb,
    quantity integer DEFAULT 1,
    part_side character varying(20),
    part_position character varying(50),
    part_number character varying(50),
    customer_vehicle_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id uuid,
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
    inspection_status character varying(20) DEFAULT 'pending'::character varying,
    overall_score integer,
    notes text,
    photo_urls text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refunds (
    refund_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    cancellation_id uuid,
    original_amount numeric(10,2),
    refund_amount numeric(10,2),
    fee_retained numeric(10,2) DEFAULT 0,
    refund_method character varying(50) DEFAULT 'original_payment'::character varying,
    refund_status character varying(20) DEFAULT 'pending'::character varying,
    initiated_by uuid,
    initiated_by_type character varying(20),
    stripe_refund_id character varying(100),
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


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
-- Name: staff_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_profiles (
    staff_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    role character varying(50) DEFAULT 'operator'::character varying,
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: subscription_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_payments (
    payment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid,
    amount numeric(10,2),
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    invoice_number character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    plan_id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_code character varying(20),
    plan_name character varying(50),
    monthly_fee numeric(10,2) DEFAULT 0,
    commission_rate numeric(4,3) DEFAULT 0.12,
    max_bids_per_month integer,
    features jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    ticket_id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    order_id uuid,
    subject character varying(200),
    description text,
    status character varying(20) DEFAULT 'open'::character varying,
    priority character varying(20) DEFAULT 'normal'::character varying,
    sla_deadline timestamp with time zone DEFAULT (now() + '24:00:00'::interval),
    escalation_level integer DEFAULT 0,
    assigned_to uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: undo_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.undo_audit_log (
    log_id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    action character varying(30),
    actor_id uuid,
    actor_type character varying(20),
    reason text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone_number character varying(20),
    password_hash text,
    user_type text DEFAULT 'customer'::text,
    full_name text,
    email text,
    language_preference character varying(10) DEFAULT 'en'::character varying,
    is_active boolean DEFAULT true,
    is_suspended boolean DEFAULT false,
    email_verified boolean DEFAULT false,
    profile_photo_url text,
    push_token text,
    loyalty_points integer DEFAULT 0,
    loyalty_tier character varying(20) DEFAULT 'bronze'::character varying,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: delivery_zones zone_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones ALTER COLUMN zone_id SET DEFAULT nextval('public.delivery_zones_zone_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


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
-- Name: bid_flags bid_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_flags
    ADD CONSTRAINT bid_flags_pkey PRIMARY KEY (flag_id);


--
-- Name: bids bids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bids
    ADD CONSTRAINT bids_pkey PRIMARY KEY (bid_id);


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
-- Name: customer_vehicles customer_vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_vehicles
    ADD CONSTRAINT customer_vehicles_pkey PRIMARY KEY (vehicle_id);


--
-- Name: delivery_assignments delivery_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_pkey PRIMARY KEY (assignment_id);


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
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (document_id);


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
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


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
-- Name: undo_audit_log undo_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.undo_audit_log
    ADD CONSTRAINT undo_audit_log_pkey PRIMARY KEY (log_id);


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
-- Name: idx_orders_undo_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_undo_deadline ON public.orders USING btree (undo_deadline) WHERE (undo_deadline IS NOT NULL);


--
-- Name: idx_part_requests_subcategory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_requests_subcategory ON public.part_requests USING btree (part_category, part_subcategory) WHERE (part_subcategory IS NOT NULL);


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
-- Name: push_tokens trigger_push_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_push_tokens_updated_at BEFORE UPDATE ON public.push_tokens FOR EACH ROW EXECUTE FUNCTION public.update_push_tokens_updated_at();


--
-- Name: bid_flags bid_flags_bid_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_flags
    ADD CONSTRAINT bid_flags_bid_id_fkey FOREIGN KEY (bid_id) REFERENCES public.bids(bid_id);


--
-- Name: bid_flags bid_flags_flagged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_flags
    ADD CONSTRAINT bid_flags_flagged_by_fkey FOREIGN KEY (flagged_by) REFERENCES public.users(user_id);


--
-- Name: bids bids_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bids
    ADD CONSTRAINT bids_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id);


--
-- Name: bids bids_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bids
    ADD CONSTRAINT bids_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.part_requests(request_id);


--
-- Name: cancellation_requests cancellation_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: chat_messages chat_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(ticket_id);


--
-- Name: counter_offers counter_offers_bid_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counter_offers
    ADD CONSTRAINT counter_offers_bid_id_fkey FOREIGN KEY (bid_id) REFERENCES public.bids(bid_id);


--
-- Name: customer_addresses customer_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: customer_vehicles customer_vehicles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_vehicles
    ADD CONSTRAINT customer_vehicles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: delivery_assignments delivery_assignments_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(driver_id);


--
-- Name: delivery_assignments delivery_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: disputes disputes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: driver_payouts driver_payouts_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_payouts
    ADD CONSTRAINT driver_payouts_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(driver_id);


--
-- Name: driver_wallets driver_wallets_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_wallets
    ADD CONSTRAINT driver_wallets_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(driver_id);


--
-- Name: drivers drivers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: garage_payouts garage_payouts_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_payouts
    ADD CONSTRAINT garage_payouts_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id);


--
-- Name: garage_payouts garage_payouts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_payouts
    ADD CONSTRAINT garage_payouts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: garage_subscriptions garage_subscriptions_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_subscriptions
    ADD CONSTRAINT garage_subscriptions_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(garage_id);


--
-- Name: garage_subscriptions garage_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_subscriptions
    ADD CONSTRAINT garage_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(plan_id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: operations_staff operations_staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operations_staff
    ADD CONSTRAINT operations_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: order_reviews order_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reviews
    ADD CONSTRAINT order_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


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
    ADD CONSTRAINT part_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: push_tokens push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: quality_inspections quality_inspections_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT quality_inspections_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: refunds refunds_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


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
    ADD CONSTRAINT staff_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: subscription_payments subscription_payments_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.garage_subscriptions(subscription_id);


--
-- Name: undo_audit_log undo_audit_log_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.undo_audit_log
    ADD CONSTRAINT undo_audit_log_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- PostgreSQL database dump complete
--

\unrestrict fpqutzxvTUu7Tk2ETUANfz2Kdd6HyDvMk0eirEGSzPgb3YvJ4eVp4PMPyKS0rPp

--
-- PostgreSQL database dump
--

\restrict 9S2uvEbIllN2pjwdaGd3TDcBgVP1dL8uPNq7Ppe51zh0FGJOOm2uCyrPsEqef4n

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
-- Data for Name: subscription_plans; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.subscription_plans (plan_id, plan_code, plan_name, monthly_fee, commission_rate, max_bids_per_month, features, is_active, created_at, updated_at) VALUES ('bd3230ee-cc74-4ebd-aa12-e602c28f9d37', 'starter', 'Starter', 0.00, 0.180, 50, '{"featured_listing": false, "bid_limit_per_day": 20, "showcase_products": 5}', true, '2026-02-16 15:11:43.264483+00', '2026-02-16 15:11:43.264483+00');
INSERT INTO public.subscription_plans (plan_id, plan_code, plan_name, monthly_fee, commission_rate, max_bids_per_month, features, is_active, created_at, updated_at) VALUES ('5ffdf6db-5a1c-4157-84e2-ad5ad0689659', 'professional', 'Professional', 299.00, 0.150, 200, '{"featured_listing": true, "bid_limit_per_day": 100, "showcase_products": 50, "analytics_retention_days": 90}', true, '2026-02-16 15:11:43.264483+00', '2026-02-16 15:11:43.264483+00');
INSERT INTO public.subscription_plans (plan_id, plan_code, plan_name, monthly_fee, commission_rate, max_bids_per_month, features, is_active, created_at, updated_at) VALUES ('73bf0b8c-a692-4214-bf20-7f4d5b761114', 'enterprise', 'Enterprise', 799.00, 0.120, NULL, '{"custom_branding": true, "featured_listing": true, "bid_limit_per_day": -1, "dedicated_support": true, "showcase_products": -1, "analytics_retention_days": 365}', true, '2026-02-16 15:11:43.264483+00', '2026-02-16 15:11:43.264483+00');


--
-- PostgreSQL database dump complete
--

\unrestrict 9S2uvEbIllN2pjwdaGd3TDcBgVP1dL8uPNq7Ppe51zh0FGJOOm2uCyrPsEqef4n

