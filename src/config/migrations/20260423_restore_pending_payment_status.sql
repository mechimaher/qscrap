-- Migration: Restore pending_payment status to orders
-- Date: 2026-04-23
-- Purpose: Resolve check constraint violation (23514) occurring during order creation.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_order_status_check 
CHECK (order_status = ANY (ARRAY[
    'pending_payment'::text,
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

COMMIT;
