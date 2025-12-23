-- Documents Module Migration
-- Qatar Legal Compliant Invoice & Document System
-- Created: 2025-12-16

-- ============================================
-- DOCUMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Document Type & Number
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('invoice', 'receipt', 'warranty_card', 'delivery_note', 'quote')),
    document_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Relationships
    order_id UUID REFERENCES orders(order_id) ON DELETE SET NULL,
    customer_id UUID, -- References users table (no foreign key for flexibility)
    garage_id UUID REFERENCES garages(garage_id) ON DELETE SET NULL,
    payout_id UUID, -- References garage_payouts (no FK to avoid circular deps)
    
    -- Document Content (Bilingual Arabic/English)
    document_data JSONB NOT NULL DEFAULT '{}',
    document_data_ar JSONB DEFAULT '{}', -- Arabic version data
    
    -- File Storage
    file_path VARCHAR(500),
    file_path_ar VARCHAR(500), -- Arabic version file
    file_size_bytes INTEGER,
    file_hash VARCHAR(128), -- SHA-256 for integrity verification
    
    -- Qatar Legal Requirements
    commercial_registration VARCHAR(50), -- CR Number
    tax_registration VARCHAR(50), -- Future VAT registration
    digital_signature TEXT, -- E-signature for authenticity
    signature_timestamp TIMESTAMP,
    
    -- Verification (QR Code)
    verification_code VARCHAR(100) UNIQUE NOT NULL,
    verification_url TEXT,
    qr_code_data TEXT,
    
    -- Status Tracking
    status VARCHAR(30) DEFAULT 'generated' CHECK (status IN (
        'draft', 'generated', 'sent', 'viewed', 'downloaded', 'printed', 'archived', 'voided'
    )),
    
    -- Timestamps (10-year retention requirement)
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    viewed_at TIMESTAMP,
    downloaded_at TIMESTAMP,
    expires_at TIMESTAMP,
    archived_at TIMESTAMP,
    
    -- Audit Trail
    created_by UUID,
    created_by_type VARCHAR(20), -- 'system', 'customer', 'garage', 'operations'
    ip_address INET,
    user_agent TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DOCUMENT SEQUENCE FOR NUMBERING
-- ============================================

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS warranty_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_documents_order ON documents(order_id);
CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_garage ON documents(garage_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_number ON documents(document_number);
CREATE INDEX IF NOT EXISTS idx_documents_verification ON documents(verification_code);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(generated_at);

-- ============================================
-- DOCUMENT TEMPLATES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS document_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    language VARCHAR(10) DEFAULT 'en', -- 'en', 'ar', 'both'
    
    -- Template Content
    html_template TEXT NOT NULL,
    css_styles TEXT,
    header_html TEXT,
    footer_html TEXT,
    
    -- Settings
    page_size VARCHAR(20) DEFAULT 'A4', -- 'A4', 'Letter', 'Legal'
    orientation VARCHAR(20) DEFAULT 'portrait', -- 'portrait', 'landscape'
    margins JSONB DEFAULT '{"top": "20mm", "right": "20mm", "bottom": "20mm", "left": "20mm"}',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DOCUMENT ACCESS LOG (Audit Trail)
-- ============================================

CREATE TABLE IF NOT EXISTS document_access_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(document_id) ON DELETE CASCADE,
    
    action VARCHAR(50) NOT NULL, -- 'view', 'download', 'print', 'email', 'verify'
    actor_id UUID,
    actor_type VARCHAR(20), -- 'customer', 'garage', 'operations', 'public'
    
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_access_document ON document_access_log(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_actor ON document_access_log(actor_id);

-- ============================================
-- HELPER FUNCTION: Generate Document Number
-- ============================================

CREATE OR REPLACE FUNCTION generate_document_number(doc_type VARCHAR)
RETURNS VARCHAR AS $$
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
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER FUNCTION: Generate Verification Code
-- ============================================

CREATE OR REPLACE FUNCTION generate_verification_code()
RETURNS VARCHAR AS $$
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
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Update timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_document_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_documents_updated ON documents;
CREATE TRIGGER trg_documents_updated
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_document_timestamp();

-- ============================================
-- INSERT DEFAULT INVOICE TEMPLATE
-- ============================================

INSERT INTO document_templates (template_name, document_type, language, is_default, html_template, css_styles)
VALUES (
    'Qatar Legal Invoice',
    'invoice',
    'both',
    TRUE,
    '<!-- Template loaded from file system -->',
    '/* Styles loaded from file system */'
) ON CONFLICT DO NOTHING;

COMMENT ON TABLE documents IS 'Qatar MOCI Compliant Document Storage - 10 Year Retention';
COMMENT ON TABLE document_templates IS 'Customizable document templates for invoices, receipts, etc.';
COMMENT ON TABLE document_access_log IS 'Complete audit trail for document access - Legal requirement';
