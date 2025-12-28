-- ============================================
-- QScrap Migration: Comprehensive Audit Fixes
-- Run this to fix all identified schema issues
-- ============================================

-- 1. Fix users table - add 'operations' user type
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;
ALTER TABLE users ADD CONSTRAINT users_user_type_check 
    CHECK (user_type IN ('customer', 'garage', 'driver', 'admin', 'operations', 'staff'));

-- 2. Fix order_status_history - add 'operations' to changed_by_type
ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_changed_by_type_check;
ALTER TABLE order_status_history ADD CONSTRAINT order_status_history_changed_by_type_check 
    CHECK (changed_by_type IN ('customer', 'garage', 'driver', 'system', 'admin', 'operations'));

-- 3. Add UNIQUE constraint to quality_inspections.order_id
ALTER TABLE quality_inspections DROP CONSTRAINT IF EXISTS quality_inspections_order_id_key;
ALTER TABLE quality_inspections ADD CONSTRAINT quality_inspections_order_id_key UNIQUE (order_id);

-- 4. Add columns to quality_inspections if missing
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS result VARCHAR(20);
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS part_grade VARCHAR(5);
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS condition_assessment VARCHAR(50);
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS item_notes JSONB DEFAULT '[]';
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS failure_category VARCHAR(50);
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS inspector_remarks TEXT;

-- 5. Add UNIQUE constraint to delivery_assignments.order_id
ALTER TABLE delivery_assignments DROP CONSTRAINT IF EXISTS delivery_assignments_order_id_key;
ALTER TABLE delivery_assignments ADD CONSTRAINT delivery_assignments_order_id_key UNIQUE (order_id);

-- 6. Add columns to delivery_assignments if missing
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(30) DEFAULT 'delivery';
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS return_reason TEXT;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS created_by_user_id UUID;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS current_lat DECIMAL(10, 8);
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS current_lng DECIMAL(11, 8);
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP;

-- 7. Create disputes table if not exists
CREATE TABLE IF NOT EXISTS disputes (
    dispute_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
    customer_id UUID REFERENCES users(user_id),
    garage_id UUID REFERENCES garages(garage_id),
    
    -- Dispute details
    reason VARCHAR(50) NOT NULL CHECK (reason IN (
        'wrong_part', 'damaged', 'not_as_described', 'doesnt_fit', 'changed_mind', 'other'
    )),
    description TEXT,
    photo_urls TEXT[] DEFAULT '{}',
    
    -- Refund calculation
    order_amount DECIMAL(10,2) NOT NULL,
    refund_percent INT NOT NULL CHECK (refund_percent >= 0 AND refund_percent <= 100),
    restocking_fee_percent INT DEFAULT 0,
    refund_amount DECIMAL(10,2) NOT NULL,
    
    -- Status flow: pending -> (contested/accepted) -> (refund_approved/refund_denied) -> (resolved)
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending', 'contested', 'accepted', 'refund_approved', 'refund_denied', 
        'resolved', 'auto_resolved', 'cancelled'
    )),
    
    -- Garage response
    garage_response TEXT,
    garage_responded_at TIMESTAMP,
    
    -- Resolution
    resolved_by UUID REFERENCES users(user_id),
    resolution_notes TEXT,
    resolved_at TIMESTAMP,
    
    -- Auto-resolution timer (48 hours)
    auto_resolve_at TIMESTAMP DEFAULT NOW() + INTERVAL '48 hours',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for disputes
CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_customer ON disputes(customer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_garage ON disputes(garage_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_pending ON disputes(status, auto_resolve_at) WHERE status = 'pending';

-- 8. Fix orders table - ensure order_status has all values including ready_for_pickup
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check 
    CHECK (order_status IN (
        'confirmed', 'preparing', 'ready_for_pickup', 'ready_for_collection', 'collected', 
        'qc_in_progress', 'qc_passed', 'qc_failed', 'returning_to_garage',
        'in_transit', 'delivered', 'completed',
        'cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops', 
        'disputed', 'refunded'
    ));

-- 9. Add phone_number column to garages if missing
ALTER TABLE garages ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- 10. Add is_suspended column to users if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Done!
SELECT 'Comprehensive audit migration completed successfully!' as status;
