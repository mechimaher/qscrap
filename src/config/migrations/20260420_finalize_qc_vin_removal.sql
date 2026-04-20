-- Migration: Finalize QC and VIN Implementation Removal
-- Date: 2026-04-20
-- Purpose: Remove software-based Quality Control (QC) remnants and ensure architectural alignment.

-- 1. Drop Legacy QC Tables
DROP TABLE IF EXISTS quality_inspections CASCADE;
DROP TABLE IF EXISTS inspection_criteria CASCADE;

-- 2. Clean up QC-related Indexes (if they survived DROP TABLE CASCADE)
DROP INDEX IF EXISTS idx_inspections_order;
DROP INDEX IF EXISTS idx_inspections_pending;
DROP INDEX IF EXISTS idx_inspections_status;
DROP INDEX IF EXISTS idx_qc_order;
DROP INDEX IF EXISTS idx_qc_passed;
DROP INDEX IF EXISTS idx_inspection_criteria_active;

-- 3. Update Order Status Constraint
-- Note: PostgreSQL doesn't support easy "removal" of array elements in check constraints.
-- We must drop and recreate the constraint.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_order_status_check 
CHECK (order_status = ANY (ARRAY[
    'confirmed'::text, 
    'preparing'::text, 
    'ready_for_pickup'::text, 
    'ready_for_collection'::text, 
    'collected'::text, 
    'returning_to_garage'::text, 
    'in_transit'::text, 
    'delivered'::text, 
    'completed'::text, 
    'cancelled_by_customer'::text, 
    'cancelled_by_garage'::text, 
    'cancelled_by_ops'::text, 
    'disputed'::text, 
    'refunded'::text
]));

-- 4. Cleanup any orphan types (if specific enums were created)
-- No custom enums were used for QC status (they were text + check constraints).

COMMIT;
