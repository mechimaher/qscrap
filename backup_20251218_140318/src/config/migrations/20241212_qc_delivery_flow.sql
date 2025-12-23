-- ============================================
-- QScrap Migration: Enhanced QC & Delivery Flow
-- Run this migration to update existing database
-- ============================================

-- Step 1: Drop existing order_status constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;

-- Step 2: Add new constraint with enhanced statuses
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check 
    CHECK (order_status IN (
        'confirmed', 'preparing', 'ready_for_collection', 'collected', 
        'qc_in_progress', 'qc_passed', 'qc_failed', 'returning_to_garage',
        'ready_for_pickup', 'in_transit', 'delivered', 'completed',
        'cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops', 
        'disputed', 'refunded'
    ));

-- Step 3: Add current driver location to delivery_assignments if not exists
ALTER TABLE delivery_assignments 
    ADD COLUMN IF NOT EXISTS current_lat DECIMAL(10, 8),
    ADD COLUMN IF NOT EXISTS current_lng DECIMAL(11, 8),
    ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP;

-- Step 4: Create index for active deliveries
CREATE INDEX IF NOT EXISTS idx_assignments_active 
    ON delivery_assignments(status) 
    WHERE status IN ('assigned', 'picked_up', 'in_transit');

-- Done!
SELECT 'Migration completed successfully' as status;
