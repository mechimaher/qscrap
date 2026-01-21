-- Add POD (Proof of Delivery) support to orders
-- Enables driver completion and auto-completion tracking

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS pod_photo_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS completed_by_driver BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_completed BOOLEAN DEFAULT FALSE;

-- Index for efficient auto-completion queries
CREATE INDEX IF NOT EXISTS idx_orders_auto_complete 
ON orders(order_status, delivered_at) 
WHERE order_status = 'delivered';

-- Comment for documentation
COMMENT ON COLUMN orders.pod_photo_url IS 'URL to proof of delivery photo taken by driver';
COMMENT ON COLUMN orders.completed_by_driver IS 'TRUE if driver completed this order (vs customer or operations)';
COMMENT ON COLUMN orders.auto_completed IS 'TRUE if order was auto-completed after timeout';
