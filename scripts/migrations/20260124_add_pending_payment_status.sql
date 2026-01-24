-- QScrap Payment Migration: Add pending_payment to order_status
-- Date: 2026-01-24
-- Purpose: Fix CHECK constraint to allow pending_payment status for delivery fee upfront model

BEGIN;

-- Step 1: Drop the old CHECK constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;

-- Step 2: Add updated CHECK constraint with pending_payment
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check 
CHECK (order_status = ANY (ARRAY[
    'pending_payment',           -- NEW: Order created, awaiting delivery fee payment
    'confirmed',                 -- Payment received, order confirmed
    'preparing',                 -- Garage preparing part
    'ready_for_pickup',          -- Part ready for driver pickup
    'ready_for_collection',      -- Legacy alias
    'collected',                 -- Driver collected from garage
    'qc_in_progress',            -- QC inspection happening
    'qc_passed',                 -- Passed QC
    'qc_failed',                 -- Failed QC
    'returning_to_garage',       -- Returning failed QC item
    'in_transit',                -- Driver en route to customer
    'delivered',                 -- Driver completed POD
    'completed',                 -- Customer confirmed receipt
    'cancelled_by_customer',     -- Customer cancelled
    'cancelled_by_garage',       -- Garage cancelled
    'cancelled_by_ops',          -- Operations cancelled
    'disputed',                  -- Under dispute
    'refunded'                   -- Full refund processed
]));

-- Step 3: Add index for pending_payment orders (for cleanup job)
CREATE INDEX IF NOT EXISTS idx_orders_pending_payment 
ON orders(order_status, created_at) 
WHERE order_status = 'pending_payment';

COMMIT;

-- Verification
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'orders_order_status_check';
