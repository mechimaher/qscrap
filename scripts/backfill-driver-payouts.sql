-- ============================================================
-- BACKFILL: Driver Payouts - Flat 5 QAR per delivery
-- ============================================================
-- Qatar market calibration:
--   Base salary: 1,300 QAR/month (payroll)
--   Per-delivery bonus: 5 QAR flat (in-app)
--   MOCI delivery fee cap: 20 QAR to customer
-- ============================================================

-- 1. Delete old incorrect payouts (from the 15% formula)
DELETE FROM driver_payouts;

-- 2. Insert correct flat 5 QAR payouts for all delivered assignments
INSERT INTO driver_payouts (driver_id, assignment_id, order_id, order_number, amount, status, created_at)
SELECT 
    da.driver_id,
    da.assignment_id,
    da.order_id,
    o.order_number,
    5.00,  -- Flat 5 QAR per delivery
    'pending',
    COALESCE(da.delivered_at, NOW())
FROM delivery_assignments da
JOIN orders o ON da.order_id = o.order_id
WHERE da.status = 'delivered';

-- 3. Recalculate drivers.total_earnings and total_deliveries
UPDATE drivers d
SET 
    total_earnings = sub.total_earned,
    total_deliveries = sub.delivery_count,
    updated_at = NOW()
FROM (
    SELECT 
        dp.driver_id,
        SUM(dp.amount) as total_earned,
        COUNT(*) as delivery_count
    FROM driver_payouts dp
    GROUP BY dp.driver_id
) sub
WHERE d.driver_id = sub.driver_id;

-- 4. Reset drivers with no payouts
UPDATE drivers d
SET total_earnings = 0, total_deliveries = 0, updated_at = NOW()
WHERE NOT EXISTS (SELECT 1 FROM driver_payouts dp WHERE dp.driver_id = d.driver_id)
AND (total_earnings > 0 OR total_deliveries > 0);

-- 5. Verify results
SELECT 
    d.driver_id, d.full_name, d.phone,
    d.total_deliveries, d.total_earnings,
    (SELECT COUNT(*) FROM driver_payouts dp WHERE dp.driver_id = d.driver_id) as payout_count,
    (SELECT COALESCE(SUM(amount), 0) FROM driver_payouts dp WHERE dp.driver_id = d.driver_id) as payout_total
FROM drivers d
ORDER BY d.total_deliveries DESC;
