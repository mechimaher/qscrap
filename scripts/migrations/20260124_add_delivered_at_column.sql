-- Add delivered_at timestamp column to orders table
-- This tracks when driver delivered order to customer (POD)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;

-- Add index for querying delivered orders awaiting customer confirmation
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders (delivered_at) 
WHERE order_status = 'delivered';
