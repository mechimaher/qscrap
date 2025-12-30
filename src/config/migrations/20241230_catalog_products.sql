-- Premium Marketplace Catalog - Database Schema
-- Phase 4: Tiered Plan Differentiation

-- Create garage_products table
CREATE TABLE IF NOT EXISTS garage_products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID NOT NULL REFERENCES garages(garage_id) ON DELETE CASCADE,
    
    -- Product Info
    title VARCHAR(200) NOT NULL,
    description TEXT,
    part_number VARCHAR(50),
    brand VARCHAR(100),
    category VARCHAR(50),
    
    -- Condition & Warranty
    condition VARCHAR(20) NOT NULL DEFAULT 'used_good',
    warranty_days INTEGER DEFAULT 0,
    
    -- Pricing
    price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'QAR',
    
    -- Stock
    quantity INTEGER DEFAULT 1,
    
    -- Compatibility
    compatible_makes TEXT[],
    compatible_models TEXT[],
    year_from INTEGER,
    year_to INTEGER,
    
    -- Media
    image_urls TEXT[],
    video_url TEXT,
    
    -- Status & Visibility
    status VARCHAR(20) DEFAULT 'draft',
    is_featured BOOLEAN DEFAULT false,
    featured_until TIMESTAMP,
    
    -- Metrics
    view_count INTEGER DEFAULT 0,
    inquiry_count INTEGER DEFAULT 0,
    purchase_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_garage ON garage_products(garage_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON garage_products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured ON garage_products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_makes ON garage_products USING GIN(compatible_makes);
CREATE INDEX IF NOT EXISTS idx_products_models ON garage_products USING GIN(compatible_models);
CREATE INDEX IF NOT EXISTS idx_products_category ON garage_products(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON garage_products(price);

-- Add constraint for valid conditions
ALTER TABLE garage_products ADD CONSTRAINT valid_condition 
    CHECK (condition IN ('new', 'used_excellent', 'used_good', 'used_fair', 'refurbished'));

-- Add constraint for valid status
ALTER TABLE garage_products ADD CONSTRAINT valid_status 
    CHECK (status IN ('draft', 'active', 'sold', 'archived'));

-- Product inquiries table (for tracking customer interest)
CREATE TABLE IF NOT EXISTS product_inquiries (
    inquiry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES garage_products(product_id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(user_id),
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    responded_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inquiries_product ON product_inquiries(product_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_customer ON product_inquiries(customer_id);
