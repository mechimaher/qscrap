-- Migration: Insurance & History (20260115)
-- Description: Adds Insurance Companies, Claims, and Vehicle History functionality.

-- 1. Update User Types
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_user_type_check;
ALTER TABLE public.users ADD CONSTRAINT users_user_type_check 
CHECK (user_type IN ('customer', 'garage', 'driver', 'staff', 'admin', 'insurance_agent'));

-- 2. Insurance Companies
CREATE TABLE public.insurance_companies (
    company_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    billing_address text,
    contact_email text,
    company_code text UNIQUE, -- e.g., 'QIC', 'DOHA'
    api_key text, -- For future integration
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);

-- Link Users (Agents) to Companies
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS insurance_company_id uuid REFERENCES public.insurance_companies(company_id);

-- 3. Insurance Claims
CREATE TABLE public.insurance_claims (
    claim_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.insurance_companies(company_id),
    agent_id uuid REFERENCES public.users(user_id), -- The surveyor who opened it
    
    claim_reference_number text NOT NULL, -- Their internal claim #
    policy_number text,
    
    -- Vehicle
    vin_number character varying(17),
    car_make text,
    car_model text,
    car_year integer,
    
    status text DEFAULT 'draft', -- draft, processing, parts_ordered, repair_in_progress, completed, closed
    
    -- Linked Requests
    part_request_id uuid REFERENCES public.part_requests(request_id),
    service_request_id uuid REFERENCES public.service_requests(request_id),
    
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- 4. Vehicle History (The "Blue Check" Log)
-- This table is designed to be APPEND ONLY (mostly) for auditability.
CREATE TABLE public.vehicle_history_events (
    event_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    vin_number character varying(17) NOT NULL,
    
    event_type text NOT NULL, -- 'maintenance', 'repair', 'part_replacement', 'accident_claim', 'inspection'
    event_date timestamp without time zone DEFAULT now(),
    
    -- Source of truth
    order_id uuid REFERENCES public.orders(order_id), -- If it came from a QScrap part order
    service_request_id uuid REFERENCES public.service_requests(request_id), -- If it came from a Motar service
    garage_id uuid REFERENCES public.garages(garage_id), -- Who did the work
    
    description text NOT NULL, -- e.g., "Oil Change", "Bumper Replaced"
    mileage_km integer, -- Optional if captured
    
    is_verified_by_motar boolean DEFAULT true, -- True if transaction happened on our platform
    
    created_at timestamp without time zone DEFAULT now()
);

CREATE INDEX idx_vehicle_history_vin ON public.vehicle_history_events(vin_number);
CREATE INDEX idx_insurance_claims_company ON public.insurance_claims(company_id);
