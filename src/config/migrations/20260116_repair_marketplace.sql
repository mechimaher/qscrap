-- ============================================
-- REPAIR MARKETPLACE SCHEMA
-- Phase 2: Car Repair Requests, Bids, Bookings
-- ============================================

-- 1. Repair Requests (from customers)
CREATE TABLE IF NOT EXISTS repair_requests (
    request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
    
    -- Vehicle Info
    car_make text NOT NULL,
    car_model text NOT NULL,
    car_year integer,
    vin_number varchar(17),
    saved_vehicle_id uuid,
    
    -- Problem Description
    problem_type text NOT NULL DEFAULT 'general',
    -- Types: engine, brakes, suspension, electrical, ac, body, transmission, exhaust, general
    problem_description text NOT NULL,
    urgency text DEFAULT 'normal', -- low, normal, high, emergency
    
    -- Media (photos, videos, audio recordings)
    image_urls text[],
    video_urls text[],
    audio_urls text[],
    
    -- Customer Location/Preference
    customer_lat numeric(10,8),
    customer_lng numeric(11,8),
    customer_address text,
    service_location text DEFAULT 'workshop', -- workshop, pickup, mobile
    
    -- Status
    status text DEFAULT 'active',
    -- Statuses: active, bidding, booked, in_progress, completed, cancelled
    bid_count integer DEFAULT 0,
    
    -- Timestamps
    expires_at timestamp DEFAULT now() + interval '7 days',
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    cancelled_at timestamp,
    deleted_at timestamp
);

-- Indexes for repair_requests
CREATE INDEX IF NOT EXISTS idx_repair_requests_customer ON repair_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_requests_status ON repair_requests(status);
CREATE INDEX IF NOT EXISTS idx_repair_requests_active ON repair_requests(status, expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_repair_requests_location ON repair_requests(customer_lat, customer_lng) WHERE customer_lat IS NOT NULL;

-- 2. Repair Bids (from workshops)
CREATE TABLE IF NOT EXISTS repair_bids (
    bid_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid REFERENCES repair_requests(request_id) ON DELETE CASCADE,
    garage_id uuid REFERENCES garages(garage_id) ON DELETE CASCADE,
    
    -- Quote Details
    estimated_cost decimal(10,2) NOT NULL,
    labor_cost decimal(10,2),
    parts_cost decimal(10,2),
    diagnosis_fee decimal(10,2) DEFAULT 0,
    
    -- Work Details
    estimated_duration text, -- e.g., '2-3 hours', '1 day', '2-3 days'
    notes text,
    warranty_days integer DEFAULT 0,
    includes_parts boolean DEFAULT false,
    
    -- Availability (workshop can offer multiple slots)
    available_slots jsonb, -- [{date: '2026-01-20', time_start: '09:00', time_end: '12:00'}]
    earliest_date date,
    
    -- Status
    status text DEFAULT 'pending',
    -- Statuses: pending, accepted, rejected, expired, withdrawn
    
    -- Timestamps
    created_at timestamp DEFAULT now(),
    accepted_at timestamp,
    rejected_at timestamp
);

-- Indexes for repair_bids
CREATE INDEX IF NOT EXISTS idx_repair_bids_request ON repair_bids(request_id);
CREATE INDEX IF NOT EXISTS idx_repair_bids_garage ON repair_bids(garage_id);
CREATE INDEX IF NOT EXISTS idx_repair_bids_status ON repair_bids(status);

-- 3. Repair Bookings (confirmed appointments)
CREATE TABLE IF NOT EXISTS repair_bookings (
    booking_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid REFERENCES repair_requests(request_id) ON DELETE SET NULL,
    bid_id uuid REFERENCES repair_bids(bid_id) ON DELETE SET NULL,
    garage_id uuid REFERENCES garages(garage_id) ON DELETE SET NULL,
    customer_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
    
    -- Schedule
    scheduled_date date NOT NULL,
    scheduled_time time,
    estimated_duration text,
    
    -- Status
    status text DEFAULT 'confirmed',
    -- Statuses: confirmed, checked_in, in_progress, completed, cancelled, no_show
    
    -- Timestamps for tracking
    checked_in_at timestamp,
    work_started_at timestamp,
    completed_at timestamp,
    cancelled_at timestamp,
    
    -- Final billing
    final_cost decimal(10,2),
    payment_status text DEFAULT 'pending', -- pending, paid, refunded
    payment_method text,
    
    -- Notes
    customer_notes text,
    workshop_notes text,
    completion_notes text,
    
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- Indexes for repair_bookings
CREATE INDEX IF NOT EXISTS idx_repair_bookings_garage ON repair_bookings(garage_id);
CREATE INDEX IF NOT EXISTS idx_repair_bookings_customer ON repair_bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_bookings_date ON repair_bookings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_repair_bookings_status ON repair_bookings(status);

-- 4. Workshop availability (optional - for slot management)
CREATE TABLE IF NOT EXISTS workshop_availability (
    slot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id uuid REFERENCES garages(garage_id) ON DELETE CASCADE,
    day_of_week integer, -- 0=Sunday, 1=Monday, etc.
    time_start time NOT NULL,
    time_end time NOT NULL,
    max_bookings integer DEFAULT 1,
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workshop_availability_garage ON workshop_availability(garage_id);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE repair_requests IS 'Customer requests for car repairs/checkups';
COMMENT ON TABLE repair_bids IS 'Workshop quotes/bids on repair requests';
COMMENT ON TABLE repair_bookings IS 'Confirmed repair appointments';
COMMENT ON TABLE workshop_availability IS 'Workshop weekly availability slots';
