-- Insurance Claims Table
-- Required by InsuranceClaimService and insurance analytics
-- Created: 2026-01-18 from full backend audit

CREATE TABLE IF NOT EXISTS insurance_claims (
    claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES insurance_companies(company_id),
    agent_id UUID REFERENCES users(user_id),
    submitted_by_garage_id UUID REFERENCES garages(garage_id),
    
    -- Claim identifiers
    claim_reference_number VARCHAR(50) NOT NULL,
    policy_number VARCHAR(50),
    
    -- Customer info
    customer_name VARCHAR(255) NOT NULL,
    
    -- Vehicle info
    vin_number VARCHAR(20),
    car_make VARCHAR(100),
    car_model VARCHAR(100),
    car_year VARCHAR(10),
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_year VARCHAR(10),
    
    -- Damage/Part info
    part_name VARCHAR(255),
    damage_description TEXT,
    damage_photos TEXT[],
    notes TEXT,
    
    -- Estimates
    agency_estimate DECIMAL(10,2) DEFAULT 0,
    scrapyard_estimate DECIMAL(10,2) DEFAULT 0,
    
    -- Linked request
    part_request_id UUID REFERENCES part_requests(request_id),
    
    -- Status workflow
    status VARCHAR(50) DEFAULT 'draft',
    approval_status VARCHAR(50) DEFAULT 'pending',
    rejection_reason TEXT,
    
    -- Approval tracking
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_insurance_claims_company ON insurance_claims(company_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_agent ON insurance_claims(agent_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_garage ON insurance_claims(submitted_by_garage_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_approval ON insurance_claims(approval_status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_created ON insurance_claims(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_reference ON insurance_claims(claim_reference_number);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_insurance_claims_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS insurance_claims_updated ON insurance_claims;
CREATE TRIGGER insurance_claims_updated
    BEFORE UPDATE ON insurance_claims
    FOR EACH ROW
    EXECUTE FUNCTION update_insurance_claims_timestamp();
