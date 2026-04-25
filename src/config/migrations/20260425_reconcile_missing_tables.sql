-- 20260425_reconcile_missing_tables.sql
-- Re-adds tables that were referenced in code but missing from production

CREATE TABLE public.idempotency_keys (
    key character varying(255) NOT NULL,
    transaction_id uuid,
    response jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp without time zone DEFAULT (CURRENT_TIMESTAMP + '24:00:00'::interval) NOT NULL,
    request_hash character varying(64),
    user_id uuid
);




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



