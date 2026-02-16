-- ============================================
-- QScrap Base Schema
-- This file creates the core tables required by incremental migrations.
-- Generated from production schema reference (Feb 2026).
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. Identity & Access
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE,
    password_hash TEXT,
    user_type TEXT DEFAULT 'customer',
    full_name TEXT,
    email TEXT,
    language_preference VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT true,
    is_suspended BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    profile_photo_url TEXT,
    push_token TEXT,
    loyalty_points INTEGER DEFAULT 0,
    loyalty_tier VARCHAR(20) DEFAULT 'bronze',
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(user_id),
    token_hash VARCHAR(64) NOT NULL,
    token_type VARCHAR(50) DEFAULT 'password_reset',
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_profiles (
    staff_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    role VARCHAR(50) DEFAULT 'operator',
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operations_staff (
    staff_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    role VARCHAR(50) DEFAULT 'operator',
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Garage Partners
-- ============================================

CREATE TABLE IF NOT EXISTS garages (
    garage_id UUID PRIMARY KEY,
    garage_name TEXT NOT NULL,
    trade_license_number VARCHAR(50),
    cr_number VARCHAR(50),
    phone_number VARCHAR(20),
    address TEXT,
    location_lat NUMERIC(10,8),
    location_lng NUMERIC(11,8),
    approval_status VARCHAR(20) DEFAULT 'pending',
    supplier_type VARCHAR(10) DEFAULT 'used',
    specialized_brands TEXT[],
    all_brands BOOLEAN DEFAULT false,
    rating_average NUMERIC(3,2) DEFAULT 0,
    bank_name VARCHAR(100),
    iban VARCHAR(50),
    demo_expires_at TIMESTAMPTZ,
    profile_photo_url TEXT,
    working_hours JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_plans (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code VARCHAR(20) UNIQUE,
    plan_name VARCHAR(50),
    monthly_fee NUMERIC(10,2) DEFAULT 0,
    commission_rate NUMERIC(4,3) DEFAULT 0.12,
    max_bids_per_month INTEGER,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS garage_subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID REFERENCES garages(garage_id),
    plan_id UUID REFERENCES subscription_plans(plan_id),
    status VARCHAR(20) DEFAULT 'trial',
    billing_cycle_start DATE,
    billing_cycle_end DATE,
    bids_used_this_cycle INTEGER DEFAULT 0,
    auto_renew BOOLEAN DEFAULT true,
    is_admin_granted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Part Requests & Bidding
-- ============================================

CREATE TABLE IF NOT EXISTS part_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES users(user_id),
    car_make TEXT NOT NULL,
    car_model TEXT NOT NULL,
    car_year INTEGER,
    vin_number VARCHAR(17),
    part_description TEXT NOT NULL,
    part_category VARCHAR(50),
    part_subcategory VARCHAR(100),
    condition_required TEXT DEFAULT 'any',
    status TEXT DEFAULT 'active',
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    delivery_lat NUMERIC(10,8),
    delivery_lng NUMERIC(11,8),
    delivery_address TEXT,
    photo_urls TEXT[],
    vehicle_id_photos JSONB,
    quantity INTEGER DEFAULT 1,
    part_side VARCHAR(20),
    part_position VARCHAR(50),
    part_number VARCHAR(50),
    customer_vehicle_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bids (
    bid_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES part_requests(request_id),
    garage_id UUID REFERENCES garages(garage_id),
    part_condition TEXT,
    brand_name TEXT,
    part_number VARCHAR(50),
    warranty_days INTEGER DEFAULT 0,
    bid_amount NUMERIC(10,2),
    original_bid_amount NUMERIC(10,2),
    status TEXT DEFAULT 'pending',
    image_urls TEXT[],
    notes TEXT,
    superseded_by UUID,
    supersedes_bid_id UUID,
    version_number INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bid_flags (
    flag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id UUID REFERENCES bids(bid_id),
    flagged_by UUID REFERENCES users(user_id),
    reason VARCHAR(50),
    details TEXT,
    is_urgent BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'pending',
    event_id UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS counter_offers (
    counter_offer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id UUID REFERENCES bids(bid_id),
    offered_by_type TEXT,
    proposed_amount NUMERIC(10,2),
    round_number INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Orders & Fulfillment
-- ============================================

CREATE TABLE IF NOT EXISTS drivers (
    driver_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    full_name VARCHAR(100),
    phone VARCHAR(20),
    vehicle_type VARCHAR(50) DEFAULT 'motorcycle',
    vehicle_plate VARCHAR(20),
    license_number VARCHAR(50),
    status VARCHAR(20) DEFAULT 'offline',
    current_lat NUMERIC(10,8),
    current_lng NUMERIC(11,8),
    total_deliveries INTEGER DEFAULT 0,
    rating_average NUMERIC(3,2) DEFAULT 0,
    bank_account_iban VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(20),
    request_id UUID REFERENCES part_requests(request_id),
    bid_id UUID REFERENCES bids(bid_id),
    customer_id UUID REFERENCES users(user_id),
    garage_id UUID REFERENCES garages(garage_id),
    driver_id UUID,
    part_price NUMERIC(10,2),
    commission_rate NUMERIC(4,3),
    platform_fee NUMERIC(10,2),
    delivery_fee NUMERIC(10,2),
    total_amount NUMERIC(10,2),
    garage_payout_amount NUMERIC(10,2),
    payment_method TEXT DEFAULT 'cash',
    payment_status TEXT DEFAULT 'pending',
    order_status TEXT DEFAULT 'pending_payment',
    delivery_address TEXT,
    delivery_lat NUMERIC(10,8),
    delivery_lng NUMERIC(11,8),
    customer_notes TEXT,
    undo_deadline TIMESTAMPTZ,
    undo_used BOOLEAN DEFAULT false,
    undo_at TIMESTAMPTZ,
    undo_reason TEXT,
    loyalty_discount NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_status_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id),
    old_status VARCHAR(30),
    new_status VARCHAR(30),
    changed_by UUID,
    changed_by_type VARCHAR(20),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS undo_audit_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id),
    action VARCHAR(30),
    actor_id UUID,
    actor_type VARCHAR(20),
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. Delivery & Logistics
-- ============================================

CREATE TABLE IF NOT EXISTS delivery_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id),
    driver_id UUID REFERENCES drivers(driver_id),
    status VARCHAR(20) DEFAULT 'assigned',
    pickup_lat NUMERIC(10,8),
    pickup_lng NUMERIC(11,8),
    delivery_lat NUMERIC(10,8),
    delivery_lng NUMERIC(11,8),
    signature_url TEXT,
    delivery_photo_url TEXT,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_zones (
    zone_id SERIAL PRIMARY KEY,
    zone_name VARCHAR(50),
    min_distance_km NUMERIC(6,2),
    max_distance_km NUMERIC(6,2),
    delivery_fee NUMERIC(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_locations (
    driver_id UUID PRIMARY KEY,
    latitude NUMERIC(10,8),
    longitude NUMERIC(11,8),
    heading NUMERIC(5,2),
    speed NUMERIC(5,2),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_wallets (
    wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES drivers(driver_id),
    balance NUMERIC(10,2) DEFAULT 0,
    total_earned NUMERIC(10,2) DEFAULT 0,
    cash_collected NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. Finance & Payments
-- ============================================

CREATE TABLE IF NOT EXISTS garage_payouts (
    payout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID REFERENCES garages(garage_id),
    order_id UUID REFERENCES orders(order_id),
    gross_amount NUMERIC(10,2),
    commission_amount NUMERIC(10,2),
    net_amount NUMERIC(10,2),
    payout_status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    auto_confirmed BOOLEAN DEFAULT false,
    resolved_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_payouts (
    payout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES drivers(driver_id),
    assignment_id UUID,
    amount NUMERIC(10,2),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES garage_subscriptions(subscription_id),
    amount NUMERIC(10,2),
    payment_status VARCHAR(20) DEFAULT 'pending',
    invoice_number VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. Cancellations & Disputes
-- ============================================

CREATE TABLE IF NOT EXISTS cancellation_requests (
    cancellation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id),
    requested_by UUID,
    requested_by_type VARCHAR(20),
    reason_code VARCHAR(50),
    reason_details TEXT,
    cancellation_fee NUMERIC(10,2) DEFAULT 0,
    refund_amount NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disputes (
    dispute_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id),
    customer_id UUID,
    garage_id UUID,
    reason VARCHAR(50),
    description TEXT,
    evidence_urls TEXT[],
    refund_amount NUMERIC(10,2),
    status VARCHAR(30) DEFAULT 'pending',
    resolution_notes TEXT,
    auto_resolve_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refunds (
    refund_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id),
    cancellation_id UUID,
    original_amount NUMERIC(10,2),
    refund_amount NUMERIC(10,2),
    fee_retained NUMERIC(10,2) DEFAULT 0,
    refund_method VARCHAR(50) DEFAULT 'original_payment',
    refund_status VARCHAR(20) DEFAULT 'pending',
    initiated_by UUID,
    initiated_by_type VARCHAR(20),
    stripe_refund_id VARCHAR(100),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. Quality Control
-- ============================================

CREATE TABLE IF NOT EXISTS quality_inspections (
    inspection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id),
    inspector_id UUID,
    inspection_status VARCHAR(20) DEFAULT 'pending',
    overall_score INTEGER,
    notes TEXT,
    photo_urls TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. Reviews & Support
-- ============================================

CREATE TABLE IF NOT EXISTS order_reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id),
    customer_id UUID,
    garage_id UUID,
    overall_rating INTEGER,
    part_quality_rating INTEGER,
    communication_rating INTEGER,
    delivery_rating INTEGER,
    review_text TEXT,
    moderation_status VARCHAR(20) DEFAULT 'pending',
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID,
    order_id UUID,
    subject VARCHAR(200),
    description TEXT,
    status VARCHAR(20) DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'normal',
    sla_deadline TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    escalation_level INTEGER DEFAULT 0,
    assigned_to UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES support_tickets(ticket_id),
    sender_id UUID,
    sender_type VARCHAR(20),
    message_text TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. Documents & Audit
-- ============================================

CREATE TABLE IF NOT EXISTS documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(50),
    document_number VARCHAR(50),
    order_id UUID,
    garage_id UUID,
    customer_id UUID,
    file_path VARCHAR(500),
    verification_code VARCHAR(100),
    status VARCHAR(30) DEFAULT 'draft',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(100),
    entity_type VARCHAR(50),
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID,
    action_type VARCHAR(50),
    target_type VARCHAR(50),
    target_id UUID,
    old_value JSONB,
    new_value JSONB,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. Customer Features
-- ============================================

CREATE TABLE IF NOT EXISTS customer_addresses (
    address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    label VARCHAR(50),
    full_address TEXT,
    latitude NUMERIC(10,8),
    longitude NUMERIC(11,8),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_vehicles (
    vehicle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INTEGER,
    vin_number VARCHAR(17),
    nickname VARCHAR(50),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    title VARCHAR(200),
    body TEXT,
    type VARCHAR(50),
    reference_id UUID,
    reference_type VARCHAR(50),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. Migrations Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    checksum VARCHAR(64),
    applied_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 13. Pre-mark Migrations as Applied
-- ============================================

INSERT INTO migrations (name, applied_at) VALUES
    ('20241212_enhanced_qc.sql', NOW()),
    ('20241212_qc_delivery_flow.sql', NOW()),
    ('20241213_comprehensive_audit.sql', NOW()),
    ('20241213_support_chat.sql', NOW()),
    ('20241216_documents_module.sql', NOW()),
    ('20241216_payout_confirmation.sql', NOW()),
    ('20241217_fix_delivery_assignments.sql', NOW()),
    ('20241217_fix_missing_columns.sql', NOW()),
    ('20241217_review_moderation.sql', NOW()),
    ('20241219_delivery_location.sql', NOW()),
    ('20241219_driver_payouts_chat.sql', NOW()),
    ('20241220_driver_reassignment.sql', NOW()),
    ('20241222_refunds_columns.sql', NOW()),
    ('20241223_admin_module.sql', NOW()),
    ('20241224_delivery_zones.sql', NOW()),
    ('20241224_demo_bid_fix.sql', NOW()),
    ('20241224_performance_indexes.sql', NOW()),
    ('20241227_staff_profiles.sql', NOW()),
    ('20241228_fix_payout_status_length.sql', NOW()),
    ('20241229_garage_specialization.sql', NOW()),
    ('20241229_indexes_constraints_cleanup.sql', NOW()),
    ('20241229_payout_adjustments.sql', NOW()),
    ('20241229_support_ticket_sla.sql', NOW()),
    ('20241231_cleanup_duplicates.sql', NOW()),
    ('20241231_parts_showcase.sql', NOW()),
    ('20251224_address_module.sql', NOW()),
    ('20251226_user_settings.sql', NOW()),
    ('20251231_add_original_bid_amount.sql', NOW()),
    ('20260108_driver_locations.sql', NOW()),
    ('20260111_add_driver_bank_details.sql', NOW()),
    ('20260111_add_part_category.sql', NOW()),
    ('20260113_add_resolved_by_to_payouts.sql', NOW()),
    ('20260113_create_driver_wallets.sql', NOW()),
    ('20260114_customer_vehicles.sql', NOW()),
    ('20260115_performance_indexes_scale.sql', NOW()),
    ('20260115_service_expansion.sql', NOW()),
    ('20260116_ad_marketplace.sql', NOW()),
    ('20260116_customer_loyalty.sql', NOW()),
    ('20260116_garage_analytics.sql', NOW()),
    ('20260116_performance_optimization.sql', NOW()),
    ('20260116_price_benchmarking.sql', NOW()),
    ('20260116_subscription_tiers.sql', NOW()),
    ('20260116_unified_partner_model.sql', NOW()),
    ('20260118_certified_schema_optimization.sql', NOW()),
    ('20260118_escrow_system.sql', NOW()),
    ('20260118_loyalty_functions.sql', NOW()),
    ('20260118_payment_system.sql', NOW()),
    ('20260118_schema_optimization.sql', NOW()),
    ('20260119_remove_services.sql', NOW()),
    ('20260119_vehicle_id_photos.sql', NOW()),
    ('20260120_vin_capture.sql', NOW()),
    ('20260122_delivery_fee_tiers.sql', NOW()),
    ('20260122_drop_insurance_tables.sql', NOW()),
    ('20260122_fix_dispute_status.sql', NOW()),
    ('20260122_fix_payout_cancellation_columns.sql', NOW()),
    ('20260122_fix_payout_type_column.sql', NOW()),
    ('20260122_fix_refunds_initiated_by.sql', NOW()),
    ('20260122_remove_insurance_services.sql', NOW()),
    ('20260123_payout_reversals.sql', NOW()),
    ('20260123_ticket_escalation.sql', NOW()),
    ('20260124_add_payment_tables.sql', NOW()),
    ('20260126_support_actions_tables.sql', NOW()),
    ('20260126_support_phase3_enhancements.sql', NOW()),
    ('20260127_add_resolution_action_column.sql', NOW()),
    ('20260127_add_ticket_id_to_escalations.sql', NOW()),
    ('20260127_comprehensive_constraint_audit.sql', NOW()),
    ('20260127_fix_order_status_history_constraint.sql', NOW()),
    ('20260127_fix_refunds_schema_alignment.sql', NOW()),
    ('20260127_support_audit_fixes.sql', NOW()),
    ('20260128_add_customer_notes_resolution_logs.sql', NOW()),
    ('20260128_cancellation_compliance.sql', NOW()),
    ('20260128_drop_legacy_reviews_table.sql', NOW()),
    ('20260129_complete_refunds_schema.sql', NOW()),
    ('20260129b_fix_refunds_data.sql', NOW()),
    ('20260130_refund_system_hardening.sql', NOW()),
    ('20260202_auto_demo_registration.sql', NOW()),
    ('20260202_enterprise_infrastructure.sql', NOW()),
    ('20260202_moci_delivery_fee_compliance.sql', NOW()),
    ('20260202_subscription_upgrade_payments.sql', NOW()),
    ('20260203_add_cancelled_to_request_status.sql', NOW()),
    ('20260208_commission_rate_check.sql', NOW()),
    ('20260208_refresh_tokens.sql', NOW()),
    ('20260213_update_escalation_resolution_actions.sql', NOW()),
    ('20260215_schema_alignment_push_tokens_part_subcategory.sql', NOW()),
    ('20260216_cleanup_orphan_objects.sql', NOW())
ON CONFLICT (name) DO NOTHING;
