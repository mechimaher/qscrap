-- ============================================
-- INSURANCE B2B INTEGRATION - MOI & ESCROW
-- Week 1-2: MOI Accident Reports + Escrow Payments
-- ============================================

-- 1. MOI Accident Reports Table
CREATE TABLE IF NOT EXISTS IF NOT EXISTS moi_accident_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL,
    
    -- Ministry of Interior Data
    report_number VARCHAR(100),
    accident_date DATE,
    police_station VARCHAR(255),
    
    -- Vehicle Information
    vehicle_vin VARCHAR(17),
    vehicle_registration VARCHAR(50),
    driver_name VARCHAR(255),
    driver_id_number VARCHAR(50),
    
    -- Document Storage
    report_document_url VARCHAR(500), -- PDF/image URL
    parsed_data JSONB, -- OCR or manual extraction
    
    -- Verification
    verification_status VARCHAR(50) DEFAULT 'pending', -- pending, verified, rejected
    verified_by UUID, -- user_id of insurance adjuster
    verified_at TIMESTAMP,
    verification_notes TEXT,
    
    -- Metadata
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign Keys
    FOREIGN KEY (claim_id) REFERENCES insurance_claims(claim_id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Indexes for MOI reports
CREATE INDEX IF NOT EXISTS idx_moi_claim ON moi_accident_reports(claim_id);
CREATE INDEX IF NOT EXISTS idx_moi_verification ON moi_accident_reports(verification_status);
CREATE INDEX IF NOT EXISTS idx_moi_report_number ON moi_accident_reports(report_number);
CREATE INDEX IF NOT EXISTS idx_moi_vin ON moi_accident_reports(vehicle_vin);

-- ============================================
-- 2. Escrow Payments Table
-- ============================================

CREATE TABLE IF NOT EXISTS IF NOT EXISTS escrow_payments (
    escrow_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL UNIQUE,
    
    -- Parties
    insurance_company_id UUID,
    garage_id UUID NOT NULL,
    
    -- Amounts (in QAR)
    approved_amount DECIMAL(10, 2) NOT NULL,
    held_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    released_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    refunded_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Status Tracking
    status VARCHAR(50) DEFAULT 'pending', -- pending, held, released, refunded, cancelled
    
    -- Dates
    hold_date TIMESTAMP,
    release_date TIMESTAMP,
    refund_date TIMESTAMP,
    expiry_date TIMESTAMP, -- Auto-refund if not released
    
    -- Approval
    release_approved_by UUID, -- adjuster user_id
    release_notes TEXT,
    
    -- Work Verification
    work_completed_at TIMESTAMP,
    completion_photos JSONB, -- Array of image URLs
    completion_verified_by UUID,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign Keys
    FOREIGN KEY (claim_id) REFERENCES insurance_claims(claim_id) ON DELETE CASCADE,
    FOREIGN KEY (insurance_company_id) REFERENCES insurance_companies(company_id) ON DELETE SET NULL,
    FOREIGN KEY (garage_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (release_approved_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (completion_verified_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Indexes for escrow
CREATE INDEX IF NOT EXISTS idx_escrow_claim ON escrow_payments(claim_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_payments(status);
CREATE INDEX IF NOT EXISTS idx_escrow_garage ON escrow_payments(garage_id);
CREATE INDEX IF NOT EXISTS idx_escrow_insurance ON escrow_payments(insurance_company_id);
CREATE INDEX IF NOT EXISTS idx_escrow_expiry ON escrow_payments(expiry_date) WHERE status = 'held';

-- ============================================
-- 3. Update insurance_claims table
-- ============================================

ALTER TABLE insurance_claims 
ADD COLUMN IF NOT EXISTS escrow_id UUID REFERENCES escrow_payments(escrow_id),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS has_moi_report BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_claims_payment_status ON insurance_claims(payment_status);

-- ============================================
-- 4. Escrow Auto-Refund Function
-- ============================================

CREATE OR REPLACE FUNCTION check_escrow_expiry()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Escrow Activity Log
-- ============================================

CREATE TABLE IF NOT EXISTS IF NOT EXISTS escrow_activity_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_id UUID NOT NULL,
    activity_type VARCHAR(50) NOT NULL, -- created, held, released, refunded, verified
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    amount DECIMAL(10, 2),
    performed_by UUID,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (escrow_id) REFERENCES escrow_payments(escrow_id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_escrow_log ON escrow_activity_log(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_log_date ON escrow_activity_log(created_at);

-- ============================================
-- 6. Triggers for Auto-Logging
-- ============================================

CREATE OR REPLACE FUNCTION log_escrow_activity()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER escrow_activity_trigger
AFTER INSERT OR UPDATE ON escrow_payments
FOR EACH ROW
EXECUTE FUNCTION log_escrow_activity();

-- ============================================
-- 7. Grant Permissions
-- ============================================

GRANT SELECT, INSERT, UPDATE ON moi_accident_reports TO qscrap_app;
GRANT SELECT, INSERT, UPDATE ON escrow_payments TO qscrap_app;
GRANT SELECT, INSERT ON escrow_activity_log TO qscrap_app;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
