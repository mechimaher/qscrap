-- ============================================================
-- BACKFILL: Driver Payouts for Completed Deliveries
-- ============================================================
-- Root Cause: completeOrderByDriver() in lifecycle.service.ts
-- was NOT creating driver_payouts, NOT updating total_earnings,
-- and NOT incrementing total_deliveries.
--
-- This script retroactively creates payouts for all delivered
-- assignments that are missing payout records.
-- ============================================================

-- 1. Insert missing driver_payouts for delivered assignments
INSERT INTO driver_payouts (driver_id, assignment_id, order_id, order_number, amount, status, created_at)
SELECT 
    da.driver_id,
    da.assignment_id,
    da.order_id,
    o.order_number,
    GREATEST(20, COALESCE(o.total_amount, 0) * 0.15)::NUMERIC(10,2),
    'pending',
    COALESCE(da.delivered_at, NOW())
FROM delivery_assignments da
JOIN orders o ON da.order_id = o.order_id
WHERE da.status = 'delivered'
  AND NOT EXISTS (
      SELECT 1 FROM driver_payouts dp 
      WHERE dp.assignment_id = da.assignment_id
  );

-- 2. Update drivers.total_earnings and total_deliveries from actual payout data
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

-- 3. Verify results
SELECT 
    d.driver_id,
    d.full_name,
    d.phone,
    d.total_deliveries,
    d.total_earnings,
    (SELECT COUNT(*) FROM driver_payouts dp WHERE dp.driver_id = d.driver_id) as payout_count,
    (SELECT COALESCE(SUM(amount), 0) FROM driver_payouts dp WHERE dp.driver_id = d.driver_id) as payout_total
FROM drivers d
ORDER BY d.total_deliveries DESC;
