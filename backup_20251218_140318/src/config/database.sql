-- ============================================
-- QScrap Complete Database Schema v2.0
-- Enhanced with Subscriptions, Cancellations, Full Order Lifecycle
-- ============================================

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. CORE USER TABLES
-- ============================================

-- 1.1 Users (Customers & Garages)
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'garage', 'driver', 'admin')),
    full_name TEXT,
    email TEXT,
    language_preference VARCHAR(5) DEFAULT 'en',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.2 Garages (Extended profile for garage users)
CREATE TABLE IF NOT EXISTS garages (
    garage_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    garage_name TEXT NOT NULL,
    trade_license_number VARCHAR(50),
    address TEXT,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    rating_average DECIMAL(3,2) DEFAULT 0,
    rating_count INT DEFAULT 0,
    total_transactions INT DEFAULT 0,
    fulfillment_rate DECIMAL(5,2) DEFAULT 100.00,
    response_time_avg_minutes INT DEFAULT 0,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.3 Customer Addresses
CREATE TABLE IF NOT EXISTS customer_addresses (
    address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    label VARCHAR(50) DEFAULT 'Home',
    address_line TEXT NOT NULL,
    area TEXT,
    city TEXT DEFAULT 'Doha',
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    delivery_notes TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 2. SUBSCRIPTION SYSTEM
-- ============================================

-- 2.1 Subscription Plans (Static Reference Data)
CREATE TABLE IF NOT EXISTS subscription_plans (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code VARCHAR(20) UNIQUE NOT NULL,
    plan_name VARCHAR(50) NOT NULL,
    plan_name_ar VARCHAR(50),
    monthly_fee DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(4,3) NOT NULL,
    max_bids_per_month INT,
    features JSONB DEFAULT '{}',
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default plans
INSERT INTO subscription_plans (plan_code, plan_name, plan_name_ar, monthly_fee, commission_rate, max_bids_per_month, features, display_order) VALUES
('starter', 'Starter', 'المبتدئ', 199.00, 0.180, 30, '{"analytics": "basic", "support": "email", "badge": null}', 1),
('professional', 'Professional', 'المحترف', 499.00, 0.150, NULL, '{"analytics": "advanced", "support": "priority", "badge": "pro", "priority_listing": true}', 2),
('enterprise', 'Enterprise', 'المؤسسة', 999.00, 0.120, NULL, '{"analytics": "premium", "support": "dedicated", "badge": "enterprise", "priority_listing": true, "featured": true}', 3)
ON CONFLICT (plan_code) DO NOTHING;

-- 2.2 Garage Subscriptions
CREATE TABLE IF NOT EXISTS garage_subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID REFERENCES garages(garage_id) ON DELETE CASCADE,
    plan_id UUID REFERENCES subscription_plans(plan_id),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'expired', 'suspended')),
    billing_cycle_start DATE NOT NULL,
    billing_cycle_end DATE NOT NULL,
    next_billing_date DATE,
    bids_used_this_cycle INT DEFAULT 0,
    auto_renew BOOLEAN DEFAULT true,
    trial_ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT
);

-- 2.3 Subscription Payment History
CREATE TABLE IF NOT EXISTS subscription_payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES garage_subscriptions(subscription_id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'QAR',
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    payment_reference VARCHAR(100),
    failure_reason TEXT,
    invoice_number VARCHAR(50),
    invoice_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- ============================================
-- 3. PART REQUESTS & BIDDING
-- ============================================

-- 3.1 Part Requests
CREATE TABLE IF NOT EXISTS part_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    car_make TEXT NOT NULL,
    car_model TEXT NOT NULL,
    car_year INT NOT NULL CHECK (car_year >= 1900 AND car_year <= 2030),
    vin_number VARCHAR(17),
    part_description TEXT NOT NULL,
    part_number VARCHAR(50),
    condition_required TEXT DEFAULT 'any' CHECK (condition_required IN ('new', 'used', 'any')),
    image_urls TEXT[],
    delivery_address_id UUID REFERENCES customer_addresses(address_id),
    delivery_address_text TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'accepted', 'expired', 'cancelled_by_customer')),
    cancellation_reason TEXT,
    bid_count INT DEFAULT 0,
    version INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
    cancelled_at TIMESTAMP
);

-- 3.2 Bids
CREATE TABLE IF NOT EXISTS bids (
    bid_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES part_requests(request_id) ON DELETE CASCADE,
    garage_id UUID REFERENCES garages(garage_id) ON DELETE CASCADE,
    part_condition TEXT NOT NULL CHECK (part_condition IN ('new', 'used_excellent', 'used_good', 'used_fair', 'refurbished')),
    brand_name TEXT,
    part_number VARCHAR(50),
    warranty_days INT DEFAULT 0 CHECK (warranty_days >= 0),
    bid_amount DECIMAL(10,2) NOT NULL CHECK (bid_amount > 0),
    image_urls TEXT[],
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired')),
    withdrawal_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    withdrawn_at TIMESTAMP,
    UNIQUE(request_id, garage_id)
);

-- 3.3 Counter-Offers (Bid Negotiation)
CREATE TABLE IF NOT EXISTS counter_offers (
    counter_offer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id UUID REFERENCES bids(bid_id) ON DELETE CASCADE,
    request_id UUID REFERENCES part_requests(request_id) ON DELETE CASCADE,
    
    -- Who made this offer
    offered_by_type TEXT NOT NULL CHECK (offered_by_type IN ('customer', 'garage')),
    offered_by_id UUID NOT NULL,
    
    -- Offer details
    proposed_amount DECIMAL(10,2) NOT NULL CHECK (proposed_amount > 0),
    message TEXT,
    
    -- Response
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered', 'expired')),
    response_message TEXT,
    responded_at TIMESTAMP,
    
    -- Tracking
    round_number INT DEFAULT 1 CHECK (round_number >= 1 AND round_number <= 3),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counter_offers_bid ON counter_offers(bid_id);
CREATE INDEX IF NOT EXISTS idx_counter_offers_status ON counter_offers(status);

-- ============================================
-- 4. ORDERS & FULFILLMENT
-- ============================================

-- 4.1 Orders
CREATE TABLE IF NOT EXISTS orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(20) UNIQUE,
    request_id UUID REFERENCES part_requests(request_id),
    bid_id UUID REFERENCES bids(bid_id),
    customer_id UUID REFERENCES users(user_id),
    garage_id UUID REFERENCES garages(garage_id),
    
    -- Pricing
    part_price DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(4,3) NOT NULL,
    platform_fee DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 25.00,
    total_amount DECIMAL(10,2) NOT NULL,
    garage_payout_amount DECIMAL(10,2) NOT NULL,
    
    -- Payment
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'wallet')),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'partially_refunded')),
    payment_reference VARCHAR(100),
    
    -- Order Status (Enhanced with QC flow)
    order_status TEXT DEFAULT 'confirmed' CHECK (order_status IN (
        'confirmed', 'preparing', 'ready_for_collection', 'collected', 
        'qc_in_progress', 'qc_passed', 'qc_failed', 'returning_to_garage',
        'ready_for_pickup', 'in_transit', 'delivered', 'completed',
        'cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops', 
        'disputed', 'refunded'
    )),
    
    -- Delivery
    delivery_address TEXT,
    delivery_notes TEXT,
    driver_id UUID REFERENCES users(user_id),
    tracking_code VARCHAR(50),
    estimated_delivery_at TIMESTAMP,
    actual_delivery_at TIMESTAMP,
    delivery_signature_url TEXT,
    delivery_photo_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    
    -- Optimistic locking
    version INT DEFAULT 1
);

-- Generate order number trigger
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number := 'QS-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

DROP TRIGGER IF EXISTS set_order_number ON orders;
CREATE TRIGGER set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    WHEN (NEW.order_number IS NULL)
    EXECUTE FUNCTION generate_order_number();

-- 4.2 Order Status History (Audit Trail)
CREATE TABLE IF NOT EXISTS order_status_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by UUID REFERENCES users(user_id),
    changed_by_type VARCHAR(20) CHECK (changed_by_type IN ('customer', 'garage', 'driver', 'system', 'admin')),
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 5. CANCELLATIONS & REFUNDS
-- ============================================

-- 5.1 Cancellation Requests
CREATE TABLE IF NOT EXISTS cancellation_requests (
    cancellation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
    requested_by UUID REFERENCES users(user_id),
    requested_by_type VARCHAR(20) NOT NULL CHECK (requested_by_type IN ('customer', 'garage', 'admin')),
    reason_code VARCHAR(50) NOT NULL CHECK (reason_code IN (
        'changed_mind', 'found_elsewhere', 'too_expensive', 'wrong_part', 'taking_too_long',
        'stock_out', 'part_defective', 'wrong_part_identified', 'customer_unreachable', 'other'
    )),
    reason_text TEXT,
    order_status_at_cancel VARCHAR(30) NOT NULL,
    time_since_order_minutes INT,
    
    -- Fees & Refunds
    cancellation_fee_rate DECIMAL(4,3) DEFAULT 0,
    cancellation_fee DECIMAL(10,2) DEFAULT 0,
    refund_amount DECIMAL(10,2),
    
    -- Processing
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
    reviewed_by UUID REFERENCES users(user_id),
    review_notes TEXT,
    reviewed_at TIMESTAMP,
    processed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5.2 Refunds
CREATE TABLE IF NOT EXISTS refunds (
    refund_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
    cancellation_id UUID REFERENCES cancellation_requests(cancellation_id),
    original_amount DECIMAL(10,2) NOT NULL,
    refund_amount DECIMAL(10,2) NOT NULL,
    fee_retained DECIMAL(10,2) DEFAULT 0,
    refund_method VARCHAR(50) CHECK (refund_method IN ('original_payment', 'wallet_credit', 'bank_transfer', 'cash')),
    refund_status VARCHAR(20) DEFAULT 'pending' CHECK (refund_status IN ('pending', 'processing', 'completed', 'failed')),
    refund_reference VARCHAR(100),
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- ============================================
-- 6. REVIEWS & RATINGS
-- ============================================

CREATE TABLE IF NOT EXISTS order_reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE REFERENCES orders(order_id) ON DELETE CASCADE,
    customer_id UUID REFERENCES users(user_id),
    garage_id UUID REFERENCES garages(garage_id),
    overall_rating INT NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    part_quality_rating INT CHECK (part_quality_rating >= 1 AND part_quality_rating <= 5),
    communication_rating INT CHECK (communication_rating >= 1 AND communication_rating <= 5),
    delivery_rating INT CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
    review_text TEXT,
    review_images TEXT[],
    garage_response TEXT,
    garage_response_at TIMESTAMP,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Update garage rating on new review
CREATE OR REPLACE FUNCTION update_garage_rating()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_garage_rating ON order_reviews;
CREATE TRIGGER trigger_update_garage_rating
    AFTER INSERT OR UPDATE ON order_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_garage_rating();

-- ============================================
-- 7. PAYOUTS
-- ============================================

CREATE TABLE IF NOT EXISTS garage_payouts (
    payout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID REFERENCES garages(garage_id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(order_id),
    gross_amount DECIMAL(10,2) NOT NULL,
    commission_amount DECIMAL(10,2) NOT NULL,
    net_amount DECIMAL(10,2) NOT NULL,
    payout_status VARCHAR(20) DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'completed', 'failed', 'on_hold')),
    payout_method VARCHAR(50),
    payout_reference VARCHAR(100),
    bank_account_last4 VARCHAR(4),
    scheduled_for DATE,
    processed_at TIMESTAMP,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 8. NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    title_ar TEXT,
    body TEXT NOT NULL,
    body_ar TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 9. BUSINESS RULE TRIGGERS
-- ============================================

-- 9.1 Prevent bidding on inactive requests
CREATE OR REPLACE FUNCTION check_request_active_for_bid()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_active_request_for_bid ON bids;
CREATE TRIGGER enforce_active_request_for_bid
    BEFORE INSERT ON bids
    FOR EACH ROW
    EXECUTE FUNCTION check_request_active_for_bid();

-- 9.2 Check subscription and bid limits
CREATE OR REPLACE FUNCTION check_garage_can_bid()
RETURNS TRIGGER AS $$
DECLARE
    sub_record RECORD;
    plan_record RECORD;
BEGIN
    -- Get active subscription (LEFT JOIN to allow trial without plan)
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

DROP TRIGGER IF EXISTS enforce_subscription_for_bid ON bids;
CREATE TRIGGER enforce_subscription_for_bid
    BEFORE INSERT ON bids
    FOR EACH ROW
    EXECUTE FUNCTION check_garage_can_bid();

-- 9.3 Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_requests_updated_at ON part_requests;
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON part_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 10. INDEXES FOR PERFORMANCE
-- ============================================

-- Requests
CREATE INDEX IF NOT EXISTS idx_requests_active ON part_requests(status, expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_requests_customer ON part_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_requests_expires ON part_requests(expires_at) WHERE status = 'active';

-- Bids
CREATE INDEX IF NOT EXISTS idx_bids_request_status ON bids(request_id, status);
CREATE INDEX IF NOT EXISTS idx_bids_garage ON bids(garage_id);
CREATE INDEX IF NOT EXISTS idx_bids_pending ON bids(status) WHERE status = 'pending';

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_garage ON orders(garage_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_garage ON garage_subscriptions(garage_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON garage_subscriptions(status, billing_cycle_end) WHERE status = 'active';

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Payouts
CREATE INDEX IF NOT EXISTS idx_payouts_garage ON garage_payouts(garage_id);
CREATE INDEX IF NOT EXISTS idx_payouts_pending ON garage_payouts(payout_status) WHERE payout_status = 'pending';

-- ============================================
-- 11. QUALITY CONTROL
-- ============================================

-- 11.1 Inspection Criteria (Checklist items)
CREATE TABLE IF NOT EXISTS inspection_criteria (
    criteria_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    is_required BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed default inspection criteria
INSERT INTO inspection_criteria (name, description, category, is_required, sort_order) VALUES
('Part Matches Description', 'Verify part matches the description in the order', 'identification', true, 1),
('Correct Part Number', 'Confirm OEM/aftermarket part number is correct', 'identification', true, 2),
('No Physical Damage', 'Check for cracks, dents, scratches or other damage', 'condition', true, 3),
('No Rust/Corrosion', 'Inspect for rust, corrosion, or oxidation', 'condition', true, 4),
('Complete with All Components', 'Verify all mounting hardware and components included', 'completeness', true, 5),
('Properly Packaged', 'Part is packaged safely for delivery', 'packaging', true, 6),
('Clean Condition', 'Part is clean and presentable', 'condition', false, 7),
('Functional Test Passed', 'For electrical/mechanical parts - test if applicable', 'function', false, 8)
ON CONFLICT DO NOTHING;

-- 11.2 Quality Inspections
CREATE TABLE IF NOT EXISTS quality_inspections (
    inspection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
    inspector_id UUID REFERENCES users(user_id),
    
    -- Status: pending, in_progress, passed, failed
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'passed', 'failed')),
    
    -- Checklist results as JSONB: [{criteria_id, passed, notes}]
    checklist_results JSONB DEFAULT '[]',
    
    -- Overall notes and rejection reason
    notes TEXT,
    failure_reason TEXT,
    
    -- Photos taken during inspection
    photo_urls TEXT[] DEFAULT '{}',
    
    -- Timestamps
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for QC
CREATE INDEX IF NOT EXISTS idx_inspections_order ON quality_inspections(order_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON quality_inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_pending ON quality_inspections(status) WHERE status = 'pending';

-- ============================================
-- 12. DELIVERY MANAGEMENT
-- ============================================

-- 12.1 Drivers
CREATE TABLE IF NOT EXISTS drivers (
    driver_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    
    -- Vehicle info
    vehicle_type VARCHAR(50) DEFAULT 'motorcycle',
    vehicle_plate VARCHAR(20),
    vehicle_model VARCHAR(100),
    
    -- Status: available, busy, offline, suspended
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'busy', 'offline', 'suspended')),
    
    -- Current location (for tracking)
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(11, 8),
    last_location_update TIMESTAMP,
    
    -- Stats
    total_deliveries INT DEFAULT 0,
    rating_average DECIMAL(3, 2) DEFAULT 0,
    rating_count INT DEFAULT 0,
    
    -- Timestamps
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 12.2 Delivery Assignments
CREATE TABLE IF NOT EXISTS delivery_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(driver_id) ON DELETE SET NULL,
    
    -- Status: assigned, picked_up, in_transit, delivered, failed
    status VARCHAR(20) DEFAULT 'assigned' CHECK (status IN ('assigned', 'picked_up', 'in_transit', 'delivered', 'failed')),
    
    -- Pickup details
    pickup_address TEXT,
    pickup_lat DECIMAL(10, 8),
    pickup_lng DECIMAL(11, 8),
    pickup_at TIMESTAMP,
    
    -- Delivery details
    delivery_address TEXT,
    delivery_lat DECIMAL(10, 8),
    delivery_lng DECIMAL(11, 8),
    delivered_at TIMESTAMP,
    
    -- Proof of delivery
    signature_url TEXT,
    delivery_photo_url TEXT,
    recipient_name VARCHAR(100),
    
    -- Notes
    driver_notes TEXT,
    failure_reason TEXT,
    
    -- ETA
    estimated_pickup TIMESTAMP,
    estimated_delivery TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for Delivery
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_available ON drivers(status) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_assignments_order ON delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_assignments_driver ON delivery_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON delivery_assignments(status);

-- ============================================
-- 11. REVIEWS & RATINGS
-- ============================================

CREATE TABLE IF NOT EXISTS reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
    customer_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    garage_id UUID REFERENCES garages(garage_id) ON DELETE CASCADE,
    
    -- Ratings (1-5 scale)
    overall_rating INT NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    quality_rating INT CHECK (quality_rating >= 1 AND quality_rating <= 5),
    communication_rating INT CHECK (communication_rating >= 1 AND communication_rating <= 5),
    
    -- Review text
    review_text TEXT,
    
    -- Status
    is_published BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- One review per order
    UNIQUE(order_id)
);

-- Index for reviews
CREATE INDEX IF NOT EXISTS idx_reviews_garage ON reviews(garage_id);

-- ============================================
-- 12. SUPPORT CHAT (Customer <-> Operations)
-- ============================================

-- 12.1 Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES users(user_id),
    order_id UUID REFERENCES orders(order_id),
    subject VARCHAR(200),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assigned_to UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP DEFAULT NOW()
);

-- 12.2 Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES support_tickets(ticket_id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(user_id),
    sender_type VARCHAR(20) NOT NULL,
    message_text TEXT NOT NULL,
    attachments TEXT[],
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON chat_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON chat_messages(created_at);
