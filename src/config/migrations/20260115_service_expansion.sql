-- Migration: Service Expansion (20260115)
-- Description: Adds tables for Service Requests (Repair, Wash, Battery, etc) and updates Garages.

-- 1. ENUMS
CREATE TYPE public.service_category_enum AS ENUM (
    'repair',           -- Mechanical/Body repair (in garage)
    'home_wash',        -- Car wash at home
    'home_service',     -- Battery, Oil, Tires at home
    'towing'            -- Breakdown/Towing
);

CREATE TYPE public.provider_type_enum AS ENUM (
    'garage',           -- Fixed location garage
    'mobile_mechanic',  -- Individual or Van
    'towing_company',   -- Recovery truck
    'detailer'          -- Washer/Detailer
);

CREATE TYPE public.service_request_status_enum AS ENUM (
    'pending',          -- Waiting for bids
    'bidding',          -- Bids received
    'accepted',         -- Provider selected
    'scheduled',        -- Appointment confirmed
    'in_progress',      -- Job started
    'completed',        -- Job done
    'cancelled',
    'expired'
);

-- 2. Service Definitions (The Catalog)
CREATE TABLE public.service_definitions (
    service_def_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    category public.service_category_enum NOT NULL,
    description text,
    icon_url text,
    is_active boolean DEFAULT true,
    base_price_estimate numeric(10,2), -- Optional guideline
    created_at timestamp without time zone DEFAULT now()
);

-- Seed basic services
INSERT INTO public.service_definitions (name, category, description) VALUES
('General Repair', 'repair', 'Engine, Transmission, or Body work at a garage'),
('Premium Home Wash', 'home_wash', 'Full exterior and interior clean at your location'),
('Battery Replacement', 'home_service', 'Battery delivery and installation at home'),
('Tire Change', 'home_service', 'Flat tire repair or replacement at home'),
('Emergency Towing', 'towing', 'Recovery service for broken down vehicle');

-- 3. Update Garages table
ALTER TABLE public.garages 
ADD COLUMN IF NOT EXISTS provider_type public.provider_type_enum DEFAULT 'garage',
ADD COLUMN IF NOT EXISTS service_capabilities uuid[] DEFAULT '{}', -- Array of service_def_ids
ADD COLUMN IF NOT EXISTS mobile_service_radius_km integer; -- How far they travel (if mobile)

-- 4. Service Requests (Customer side)
CREATE TABLE public.service_requests (
    request_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id uuid REFERENCES public.users(user_id),
    service_def_id uuid REFERENCES public.service_definitions(service_def_id),
    
    -- Vehicle Info (Optional, as some services might not need full VIN)
    car_make text,
    car_model text,
    car_year integer,
    vin_number character varying(17),
    
    -- Location (Critical for Home Services/Towing)
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    address_text text,
    
    -- Details
    description text,
    image_urls text[],
    preferred_schedule timestamp without time zone, -- When they want it
    
    status public.service_request_status_enum DEFAULT 'pending',
    
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    completed_at timestamp without time zone
);

-- 5. Service Bids (Provider side)
CREATE TABLE public.service_bids (
    bid_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id uuid REFERENCES public.service_requests(request_id),
    garage_id uuid REFERENCES public.garages(garage_id),
    
    bid_amount numeric(10,2) NOT NULL,
    proposed_schedule timestamp without time zone, -- When they can do it
    notes text,
    
    status text DEFAULT 'pending', -- pending, accepted, rejected
    
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Indexes
CREATE INDEX idx_service_requests_status ON public.service_requests(status);
CREATE INDEX idx_service_requests_customer ON public.service_requests(customer_id);
CREATE INDEX idx_service_bids_request ON public.service_bids(request_id);
