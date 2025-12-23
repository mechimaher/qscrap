-- ============================================
-- Enhanced QC Module Migration
-- Adds professional inspection fields and return assignment support
-- ============================================

-- Add enhanced fields to quality_inspections
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS part_grade VARCHAR(10) 
  CHECK (part_grade IN ('A', 'B', 'C', 'reject'));

ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS condition_assessment VARCHAR(20)
  CHECK (condition_assessment IN ('excellent', 'good', 'fair', 'poor', 'defective'));

-- Store per-item notes as {"criteria_id": "notes text"}
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS item_notes JSONB DEFAULT '{}';

-- Failure category for structured failure tracking
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS failure_category VARCHAR(50)
  CHECK (failure_category IN (
    'damaged', 'wrong_part', 'missing_components', 'quality_mismatch',
    'counterfeit', 'rust_corrosion', 'non_functional', 'packaging_issue', 'other'
  ));

-- Add assignment type to delivery_assignments for return support
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(20) 
  DEFAULT 'delivery' CHECK (assignment_type IN ('delivery', 'return_to_garage', 'collection'));

-- Add original order reference for returns
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS return_reason TEXT;

-- Create index for pending QC inspections
CREATE INDEX IF NOT EXISTS idx_orders_qc_pending ON orders(order_status) 
  WHERE order_status IN ('preparing', 'collected', 'qc_in_progress');

-- Create index for return assignments
CREATE INDEX IF NOT EXISTS idx_assignments_returns ON delivery_assignments(assignment_type) 
  WHERE assignment_type = 'return_to_garage';
