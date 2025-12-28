-- ============================================
-- QScrap Data Integrity Audit Queries
-- Run these to identify potential data issues
-- Date: 2024-12-22
-- ============================================

-- ============================================
-- 1. ORPHANED RECORDS
-- ============================================

-- 1.1 Orders without valid customers
SELECT o.order_id, o.order_number, o.customer_id
FROM orders o
LEFT JOIN users u ON o.customer_id = u.user_id
WHERE u.user_id IS NULL;

-- 1.2 Orders without valid garages
SELECT o.order_id, o.order_number, o.garage_id
FROM orders o
LEFT JOIN garages g ON o.garage_id = g.garage_id
WHERE g.garage_id IS NULL;

-- 1.3 Bids on non-existent requests
SELECT b.bid_id, b.request_id, b.garage_id
FROM bids b
LEFT JOIN part_requests pr ON b.request_id = pr.request_id
WHERE pr.request_id IS NULL;

-- 1.4 Payouts without valid orders
SELECT gp.payout_id, gp.order_id, gp.garage_id
FROM garage_payouts gp
LEFT JOIN orders o ON gp.order_id = o.order_id
WHERE o.order_id IS NULL;

-- ============================================
-- 2. STATUS INCONSISTENCIES
-- ============================================

-- 2.1 Orders marked 'completed' but no payout record
SELECT o.order_id, o.order_number, o.order_status, o.created_at
FROM orders o
LEFT JOIN garage_payouts gp ON o.order_id = gp.order_id
WHERE o.order_status = 'completed'
  AND o.payment_status = 'paid'
  AND gp.payout_id IS NULL;

-- 2.2 Disputed orders without dispute record
SELECT o.order_id, o.order_number, o.order_status
FROM orders o
LEFT JOIN disputes d ON o.order_id = d.order_id
WHERE o.order_status = 'disputed'
  AND d.dispute_id IS NULL;

-- 2.3 Refunded orders without refund record
SELECT o.order_id, o.order_number, o.order_status
FROM orders o
LEFT JOIN refunds r ON o.order_id = r.order_id
WHERE o.order_status = 'refunded'
  AND r.refund_id IS NULL;

-- 2.4 Active requests with expired timestamp
SELECT request_id, status, expires_at, created_at
FROM part_requests
WHERE status = 'active'
  AND expires_at < NOW();

-- 2.5 Active subscriptions past billing_cycle_end
SELECT gs.subscription_id, gs.garage_id, gs.status, gs.billing_cycle_end
FROM garage_subscriptions gs
WHERE gs.status = 'active'
  AND gs.billing_cycle_end < CURRENT_DATE;

-- ============================================
-- 3. DATA QUALITY ISSUES
-- ============================================

-- 3.1 Orders with mismatched amounts (part_price + delivery_fee != total - platform_fee)
SELECT order_id, order_number, part_price, delivery_fee, platform_fee, total_amount,
       (part_price + delivery_fee) as calculated_subtotal,
       (total_amount - platform_fee) as expected_subtotal
FROM orders
WHERE ABS((part_price + delivery_fee) - (total_amount - platform_fee)) > 0.01;

-- 3.2 Negative payout amounts
SELECT payout_id, order_id, gross_amount, commission_amount, net_amount
FROM garage_payouts
WHERE net_amount < 0 OR gross_amount < 0 OR commission_amount < 0;

-- 3.3 Reviews with ratings out of range (should be 1-5)
SELECT review_id, order_id, overall_rating, part_quality_rating, communication_rating, delivery_rating
FROM order_reviews
WHERE overall_rating NOT BETWEEN 1 AND 5
   OR (part_quality_rating IS NOT NULL AND part_quality_rating NOT BETWEEN 1 AND 5)
   OR (communication_rating IS NOT NULL AND communication_rating NOT BETWEEN 1 AND 5)
   OR (delivery_rating IS NOT NULL AND delivery_rating NOT BETWEEN 1 AND 5);

-- 3.4 Bids higher than 100,000 QAR (suspicious)
SELECT b.bid_id, b.request_id, b.garage_id, b.bid_amount, pr.part_description
FROM bids b
JOIN part_requests pr ON b.request_id = pr.request_id
WHERE b.bid_amount > 100000;

-- 3.5 Part requests with bid_count mismatch
SELECT pr.request_id, pr.bid_count as stored_count,
       (SELECT COUNT(*) FROM bids WHERE request_id = pr.request_id) as actual_count
FROM part_requests pr
WHERE pr.bid_count != (SELECT COUNT(*) FROM bids WHERE request_id = pr.request_id);

-- ============================================
-- 4. TIMELINE ISSUES
-- ============================================

-- 4.1 Orders delivered before creation
SELECT order_id, order_number, created_at, actual_delivery_at
FROM orders
WHERE actual_delivery_at IS NOT NULL
  AND actual_delivery_at < created_at;

-- 4.2 Orders completed without delivery timestamp
SELECT order_id, order_number, order_status, actual_delivery_at
FROM orders
WHERE order_status = 'completed'
  AND actual_delivery_at IS NULL;

-- 4.3 Payouts processed before order completion
SELECT gp.payout_id, gp.order_id, gp.processed_at, o.updated_at as order_updated
FROM garage_payouts gp
JOIN orders o ON gp.order_id = o.order_id
WHERE gp.processed_at IS NOT NULL
  AND gp.processed_at < o.created_at;

-- ============================================
-- 5. SUBSCRIPTION ISSUES
-- ============================================

-- 5.1 Garages without any subscription record
SELECT g.garage_id, g.garage_name, g.created_at
FROM garages g
LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id
WHERE gs.subscription_id IS NULL;

-- 5.2 Multiple active subscriptions per garage
SELECT garage_id, COUNT(*) as active_count
FROM garage_subscriptions
WHERE status IN ('active', 'trial')
GROUP BY garage_id
HAVING COUNT(*) > 1;

-- 5.3 Bids from garages with no active subscription (potential bypass)
SELECT b.bid_id, b.garage_id, b.created_at, g.garage_name
FROM bids b
JOIN garages g ON b.garage_id = g.garage_id
LEFT JOIN garage_subscriptions gs ON b.garage_id = gs.garage_id 
    AND gs.status IN ('active', 'trial')
    AND b.created_at BETWEEN gs.billing_cycle_start AND gs.billing_cycle_end
WHERE gs.subscription_id IS NULL
  AND b.created_at > NOW() - INTERVAL '30 days';

-- ============================================
-- 6. USER INTEGRITY
-- ============================================

-- 6.1 Garages without user record
SELECT g.garage_id, g.garage_name
FROM garages g
LEFT JOIN users u ON g.garage_id = u.user_id
WHERE u.user_id IS NULL;

-- 6.2 Users with garage type but no garage profile
SELECT u.user_id, u.phone_number, u.full_name
FROM users u
LEFT JOIN garages g ON u.user_id = g.garage_id
WHERE u.user_type = 'garage'
  AND g.garage_id IS NULL;

-- 6.3 Suspended users with active orders (should be monitored)
SELECT u.user_id, u.phone_number, u.is_suspended, COUNT(o.order_id) as active_orders
FROM users u
JOIN orders o ON u.user_id = o.customer_id
WHERE u.is_suspended = true
  AND o.order_status NOT IN ('completed', 'cancelled_by_customer', 'cancelled_by_garage', 'refunded')
GROUP BY u.user_id, u.phone_number, u.is_suspended;

-- ============================================
-- 7. SUMMARY STATS
-- ============================================

-- 7.1 Overall data health summary
SELECT 
    'Total Orders' as metric, COUNT(*)::TEXT as value FROM orders
UNION ALL
SELECT 'Completed Orders', COUNT(*)::TEXT FROM orders WHERE order_status = 'completed'
UNION ALL
SELECT 'Active Disputes', COUNT(*)::TEXT FROM disputes WHERE status = 'pending'
UNION ALL
SELECT 'Pending Payouts', COUNT(*)::TEXT FROM garage_payouts WHERE payout_status = 'pending'
UNION ALL
SELECT 'Active Garages', COUNT(*)::TEXT FROM garages g JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id WHERE gs.status IN ('active', 'trial')
UNION ALL
SELECT 'Suspended Users', COUNT(*)::TEXT FROM users WHERE is_suspended = true;

-- Done!
SELECT '=== Audit queries completed ===' as status;
