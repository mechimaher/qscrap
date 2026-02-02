-- ============================================
-- MOCI Compliance Fix: Delivery Zone Fees
-- Ministerial Decision No. 8/2013: Max 20 QR
-- ============================================

-- Update all zones exceeding MOCI 20 QR cap
UPDATE delivery_zones 
SET 
    delivery_fee = 20.00,
    updated_at = NOW()
WHERE delivery_fee > 20;

-- Log the change in zone history
INSERT INTO delivery_zone_history (zone_id, old_fee, new_fee, changed_by, reason)
SELECT 
    zone_id, 
    delivery_fee as old_fee,
    20.00 as new_fee,
    NULL,
    'MOCI Compliance: Ministerial Decision No. 8/2013 - Max 20 QR for vehicle delivery'
FROM delivery_zones 
WHERE delivery_fee > 20;

-- Verify the update
SELECT zone_id, zone_name, delivery_fee FROM delivery_zones ORDER BY zone_id;
