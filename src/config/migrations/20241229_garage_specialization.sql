-- ============================================
-- Garage Specialization Migration
-- Adds supplier type and brand specialization
-- ============================================

-- Add supplier type: 'used', 'new', 'both'
ALTER TABLE garages ADD COLUMN IF NOT EXISTS supplier_type VARCHAR(10) 
    DEFAULT 'used' CHECK (supplier_type IN ('used', 'new', 'both'));

-- Add specialized brands (array of car makes)
ALTER TABLE garages ADD COLUMN IF NOT EXISTS specialized_brands TEXT[] DEFAULT '{}';

-- Flag for "all brands" (no filtering)
ALTER TABLE garages ADD COLUMN IF NOT EXISTS all_brands BOOLEAN DEFAULT true;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_garages_supplier_type ON garages(supplier_type);
CREATE INDEX IF NOT EXISTS idx_garages_brands ON garages USING GIN(specialized_brands);

-- Comment for documentation
COMMENT ON COLUMN garages.supplier_type IS 'Type of parts: used, new, or both';
COMMENT ON COLUMN garages.specialized_brands IS 'Array of car makes this garage specializes in (e.g., Toyota, Nissan)';
COMMENT ON COLUMN garages.all_brands IS 'If true, garage deals with all brands (no filtering)';

SELECT 'Garage specialization migration completed' as status;
