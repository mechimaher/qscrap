-- ============================================================================
-- MIGRATION: Add delivery_fee to part_requests table
-- Date: 2024-12-30
-- Purpose: Store calculated delivery fee at request creation time
--          Ensures fee is preserved even if zone pricing changes later
-- ============================================================================

-- Add delivery_fee column to part_requests
ALTER TABLE part_requests
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN part_requests.delivery_fee IS 'Delivery fee in QAR calculated at request creation time';

-- Create index for filtering requests by delivery fee (future analytics)
CREATE INDEX IF NOT EXISTS idx_requests_delivery_fee
ON part_requests(delivery_fee)
WHERE delivery_fee > 0;
