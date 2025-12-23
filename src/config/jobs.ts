// QScrap Automated Jobs System
// Handles scheduled tasks: expiration, renewal, payouts

import pool from './db';

// ============================================
// 1. REQUEST EXPIRATION
// Marks expired requests as 'expired' and notifies customers
// ============================================
export async function expireOldRequests(): Promise<number> {
    const client = await pool.connect();
    try {
        // Find and expire requests past their expiration time
        const result = await client.query(`
            UPDATE part_requests 
            SET status = 'expired', updated_at = NOW()
            WHERE status = 'active' 
              AND expires_at < NOW()
            RETURNING request_id, customer_id
        `);

        const expiredCount = result.rowCount || 0;

        if (expiredCount > 0) {
            console.log(`[CRON] Expired ${expiredCount} part request(s)`);

            // Also expire any pending bids on these requests
            const requestIds = result.rows.map(r => r.request_id);
            await client.query(`
                UPDATE bids SET status = 'expired', updated_at = NOW()
                WHERE request_id = ANY($1) AND status = 'pending'
            `, [requestIds]);

            // Emit socket notifications (if io is available)
            const io = (global as any).io;
            if (io) {
                result.rows.forEach(row => {
                    io.to(`user_${row.customer_id}`).emit('request_expired', {
                        request_id: row.request_id,
                        notification: 'Your part request has expired. Create a new one to continue.'
                    });
                });
            }
        }

        return expiredCount;
    } catch (err) {
        console.error('[CRON] expireOldRequests error:', err);
        return 0;
    } finally {
        client.release();
    }
}

// ============================================
// 2. COUNTER-OFFER EXPIRATION
// Expires counter-offers after 24 hours of no response
// ============================================
export async function expireCounterOffers(): Promise<number> {
    try {
        // Expire and get full details including customer_id (from part_requests) and garage_id (from bids)
        const result = await pool.query(`
            UPDATE counter_offers co
            SET status = 'expired', responded_at = NOW()
            FROM bids b
            JOIN part_requests pr ON b.request_id = pr.request_id
            WHERE co.bid_id = b.bid_id
              AND co.status = 'pending' 
              AND co.expires_at < NOW()
            RETURNING co.counter_offer_id, co.bid_id, co.offered_by_id, co.offered_by_type,
                      pr.customer_id, b.garage_id, co.proposed_amount
        `);

        const expiredCount = result.rowCount || 0;

        if (expiredCount > 0) {
            console.log(`[CRON] Expired ${expiredCount} counter-offer(s)`);

            // Emit socket events to both parties
            const io = (global as any).io;
            if (io) {
                for (const co of result.rows) {
                    // Notify customer
                    io.to(`user_${co.customer_id}`).emit('counter_offer_expired', {
                        counter_offer_id: co.counter_offer_id,
                        bid_id: co.bid_id,
                        offered_by_type: co.offered_by_type,
                        proposed_amount: co.proposed_amount,
                        message: 'Counter offer has expired without response'
                    });
                    // Notify garage
                    io.to(`garage_${co.garage_id}`).emit('counter_offer_expired', {
                        counter_offer_id: co.counter_offer_id,
                        bid_id: co.bid_id,
                        offered_by_type: co.offered_by_type,
                        proposed_amount: co.proposed_amount,
                        message: 'Counter offer has expired without response'
                    });
                }
            }
        }

        return expiredCount;
    } catch (err) {
        console.error('[CRON] expireCounterOffers error:', err);
        return 0;
    }
}

// ============================================
// 3. SUBSCRIPTION RENEWAL CHECK
// Marks subscriptions as expired or sends renewal reminders
// ============================================
export async function checkSubscriptions(): Promise<{ expired: number; warnings: number }> {
    const client = await pool.connect();
    try {
        // 1. Expire subscriptions past billing_cycle_end
        const expiredResult = await client.query(`
            UPDATE garage_subscriptions 
            SET status = 'expired', updated_at = NOW()
            WHERE status = 'active' 
              AND billing_cycle_end < CURRENT_DATE
              AND auto_renew = false
            RETURNING subscription_id, garage_id
        `);

        const expiredCount = expiredResult.rowCount || 0;
        if (expiredCount > 0) {
            console.log(`[CRON] Expired ${expiredCount} subscription(s)`);
        }

        // 2. Find subscriptions expiring in 3 days (for warning)
        const warningResult = await client.query(`
            SELECT gs.subscription_id, gs.garage_id, gs.billing_cycle_end,
                   sp.plan_name, g.garage_name
            FROM garage_subscriptions gs
            JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
            JOIN garages g ON gs.garage_id = g.garage_id
            WHERE gs.status = 'active'
              AND gs.billing_cycle_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
              AND gs.auto_renew = false
        `);

        const warningCount = warningResult.rowCount || 0;
        if (warningCount > 0) {
            console.log(`[CRON] ${warningCount} subscription(s) expiring in 3 days`);

            // Send socket notifications
            const io = (global as any).io;
            if (io) {
                warningResult.rows.forEach(row => {
                    io.to(`garage_${row.garage_id}`).emit('subscription_warning', {
                        message: `Your ${row.plan_name} subscription expires on ${new Date(row.billing_cycle_end).toLocaleDateString()}. Please renew to continue bidding.`,
                        expires_at: row.billing_cycle_end
                    });
                });
            }
        }

        // 3. Auto-renew subscriptions (where auto_renew = true)
        // In production, this would trigger a payment
        const renewResult = await client.query(`
            UPDATE garage_subscriptions 
            SET billing_cycle_start = billing_cycle_end,
                billing_cycle_end = billing_cycle_end + INTERVAL '30 days',
                bids_used_this_cycle = 0,
                updated_at = NOW()
            WHERE status = 'active'
              AND billing_cycle_end <= CURRENT_DATE
              AND auto_renew = true
            RETURNING subscription_id, garage_id
        `);

        if ((renewResult.rowCount || 0) > 0) {
            console.log(`[CRON] Auto-renewed ${renewResult.rowCount} subscription(s)`);
        }

        return { expired: expiredCount, warnings: warningCount };
    } catch (err) {
        console.error('[CRON] checkSubscriptions error:', err);
        return { expired: 0, warnings: 0 };
    } finally {
        client.release();
    }
}

// ============================================
// 4. DISPUTE AUTO-RESOLUTION
// Auto-resolves disputes after 48 hours if garage doesn't respond
// ============================================
export async function autoResolveDisputes(): Promise<number> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find disputes pending for more than 48 hours
        const result = await client.query(`
            SELECT d.dispute_id, d.order_id, d.customer_id, d.refund_amount,
                   o.garage_id, o.order_number
            FROM disputes d
            JOIN orders o ON d.order_id = o.order_id
            WHERE d.status = 'pending'
              AND d.created_at < NOW() - INTERVAL '48 hours'
        `);

        let resolvedCount = 0;

        for (const dispute of result.rows) {
            // Auto-approve in favor of customer
            await client.query(`
                UPDATE disputes 
                SET status = 'resolved',
                    resolution = 'auto_approved',
                    resolution_notes = 'Auto-resolved: No garage response within 48 hours',
                    resolved_at = NOW(),
                    resolved_by = NULL
                WHERE dispute_id = $1
            `, [dispute.dispute_id]);

            // Update order to refunded
            await client.query(`
                UPDATE orders SET order_status = 'refunded', updated_at = NOW()
                WHERE order_id = $1
            `, [dispute.order_id]);

            // Add to order history
            await client.query(`
                INSERT INTO order_status_history 
                (order_id, old_status, new_status, changed_by_type, reason)
                VALUES ($1, 'disputed', 'refunded', 'system', 'Auto-resolved dispute - no garage response')
            `, [dispute.order_id]);

            resolvedCount++;

            // Notify customer
            const io = (global as any).io;
            if (io) {
                io.to(`user_${dispute.customer_id}`).emit('dispute_resolved', {
                    order_id: dispute.order_id,
                    order_number: dispute.order_number,
                    notification: '✅ Your dispute has been auto-approved. Refund will be processed.',
                    refund_amount: dispute.refund_amount
                });
            }
        }

        await client.query('COMMIT');

        if (resolvedCount > 0) {
            console.log(`[CRON] Auto-resolved ${resolvedCount} dispute(s)`);
        }

        return resolvedCount;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[CRON] autoResolveDisputes error:', err);
        return 0;
    } finally {
        client.release();
    }
}

// ============================================
// 5. PAYOUT SCHEDULING
// Creates payout records for completed orders with 7-day processing delay
// ============================================
export async function schedulePendingPayouts(): Promise<number> {
    try {
        // Find completed orders without payout records
        const result = await pool.query(`
            INSERT INTO garage_payouts (garage_id, order_id, gross_amount, commission_amount, net_amount, scheduled_for)
            SELECT 
                o.garage_id,
                o.order_id,
                o.part_price as gross_amount,
                o.platform_fee as commission_amount,
                o.garage_payout_amount as net_amount,
                CURRENT_DATE + INTERVAL '7 days' as scheduled_for
            FROM orders o
            LEFT JOIN garage_payouts gp ON o.order_id = gp.order_id
            WHERE o.order_status = 'completed'
              AND o.payment_status = 'paid'
              AND gp.payout_id IS NULL
            RETURNING payout_id, garage_id, order_id, net_amount
        `);

        const scheduledCount = result.rowCount || 0;

        if (scheduledCount > 0) {
            console.log(`[CRON] Scheduled ${scheduledCount} new payout(s) for processing in 7 days`);

            // Notify garages about scheduled payouts
            const io = (global as any).io;
            if (io) {
                for (const payout of result.rows) {
                    io.to(`garage_${payout.garage_id}`).emit('payout_scheduled', {
                        payout_id: payout.payout_id,
                        order_id: payout.order_id,
                        amount: payout.net_amount,
                        scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        notification: `💰 Payout of ${payout.net_amount} QAR scheduled. Processing in 7 days.`
                    });
                }
            }
        }

        return scheduledCount;
    } catch (err) {
        console.error('[CRON] schedulePendingPayouts error:', err);
        return 0;
    }
}

// ============================================
// 6. AUTO-PROCESS PAYOUTS
// Automatically completes payouts after 7-day waiting period
// Holds payouts if there's an active dispute
// ============================================
export async function autoProcessPayouts(): Promise<{ processed: number; held: number }> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // First, hold payouts for orders with active disputes
        const holdResult = await client.query(`
            UPDATE garage_payouts gp
            SET payout_status = 'on_hold',
                failure_reason = 'Order has an active dispute - payout held pending resolution'
            FROM disputes d
            WHERE gp.order_id = d.order_id
              AND gp.payout_status = 'pending'
              AND d.status IN ('pending', 'under_review', 'contested')
            RETURNING gp.payout_id, gp.garage_id, gp.order_id
        `);

        const heldCount = holdResult.rowCount || 0;
        if (heldCount > 0) {
            console.log(`[CRON] Held ${heldCount} payout(s) due to active disputes`);

            // Notify garages
            const io = (global as any).io;
            if (io) {
                for (const payout of holdResult.rows) {
                    io.to(`garage_${payout.garage_id}`).emit('payout_held', {
                        payout_id: payout.payout_id,
                        order_id: payout.order_id,
                        reason: 'Active dispute on order',
                        notification: '⚠️ Payout held: Order has an active dispute pending resolution.'
                    });
                }
            }
        }

        // Now, auto-process payouts that:
        // 1. Are still 'pending' (not held)
        // 2. Have passed the scheduled_for date (7-day wait complete)
        // 3. Don't have active disputes
        const processResult = await client.query(`
            UPDATE garage_payouts gp
            SET payout_status = 'completed',
                payout_method = 'auto_transfer',
                payout_reference = 'AUTO-' || EXTRACT(EPOCH FROM NOW())::TEXT,
                processed_at = NOW()
            WHERE gp.payout_status = 'pending'
              AND gp.scheduled_for <= CURRENT_DATE
              AND NOT EXISTS (
                  SELECT 1 FROM disputes d 
                  WHERE d.order_id = gp.order_id 
                  AND d.status IN ('pending', 'under_review', 'contested')
              )
            RETURNING gp.payout_id, gp.garage_id, gp.order_id, gp.net_amount, gp.payout_reference
        `);

        const processedCount = processResult.rowCount || 0;

        if (processedCount > 0) {
            console.log(`[CRON] Auto-processed ${processedCount} payout(s)`);

            // Notify garages about completed payouts
            const io = (global as any).io;
            if (io) {
                for (const payout of processResult.rows) {
                    io.to(`garage_${payout.garage_id}`).emit('payout_completed', {
                        payout_id: payout.payout_id,
                        order_id: payout.order_id,
                        amount: payout.net_amount,
                        reference: payout.payout_reference,
                        notification: `✅ Payment of ${payout.net_amount} QAR has been processed! Reference: ${payout.payout_reference}`
                    });
                }
            }
        }

        // Release payouts that were on hold but dispute is now resolved
        const releaseResult = await client.query(`
            UPDATE garage_payouts gp
            SET payout_status = 'pending',
                failure_reason = NULL,
                scheduled_for = CURRENT_DATE + INTERVAL '1 day'
            WHERE gp.payout_status = 'on_hold'
              AND NOT EXISTS (
                  SELECT 1 FROM disputes d 
                  WHERE d.order_id = gp.order_id 
                  AND d.status IN ('pending', 'under_review', 'contested')
              )
              AND EXISTS (
                  SELECT 1 FROM disputes d 
                  WHERE d.order_id = gp.order_id 
                  AND d.status = 'resolved' 
                  AND d.resolution NOT IN ('refund_approved', 'auto_approved')
              )
            RETURNING gp.payout_id, gp.garage_id
        `);

        if ((releaseResult.rowCount || 0) > 0) {
            console.log(`[CRON] Released ${releaseResult.rowCount} payout(s) after dispute resolution`);

            const io = (global as any).io;
            if (io) {
                for (const payout of releaseResult.rows) {
                    io.to(`garage_${payout.garage_id}`).emit('payout_released', {
                        payout_id: payout.payout_id,
                        notification: '🔓 Payout released! Dispute resolved in your favor. Payment processing tomorrow.'
                    });
                }
            }
        }

        await client.query('COMMIT');

        return { processed: processedCount, held: heldCount };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[CRON] autoProcessPayouts error:', err);
        return { processed: 0, held: 0 };
    } finally {
        client.release();
    }
}

// ============================================
// 7. CLEANUP OLD DATA
// Removes old notifications and expired data
// ============================================
export async function cleanupOldData(): Promise<void> {
    try {
        // Delete read notifications older than 30 days
        const notifResult = await pool.query(`
            DELETE FROM notifications 
            WHERE is_read = true 
              AND created_at < NOW() - INTERVAL '30 days'
        `);

        // Delete old order status history (keep last 90 days)
        const historyResult = await pool.query(`
            DELETE FROM order_status_history 
            WHERE created_at < NOW() - INTERVAL '90 days'
              AND order_id IN (
                  SELECT order_id FROM orders 
                  WHERE order_status IN ('completed', 'refunded', 'cancelled_by_customer', 'cancelled_by_garage')
              )
        `);

        console.log(`[CRON] Cleanup: ${notifResult.rowCount || 0} notifications, ${historyResult.rowCount || 0} history records`);
    } catch (err) {
        console.error('[CRON] cleanupOldData error:', err);
    }
}

// ============================================
// 8. AUTO-CONFIRM DELIVERIES
// Auto-confirms deliveries after 24 hours if customer doesn't respond
// Follows e-commerce best practice: delivered → auto-complete → trigger payout
// ============================================
export async function autoConfirmDeliveries(): Promise<number> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find orders that have been in 'delivered' status for more than 24 hours
        // Grace period: 24 hours for customer to confirm or raise dispute
        const result = await client.query(`
            UPDATE orders 
            SET order_status = 'completed', 
                updated_at = NOW()
            WHERE order_status = 'delivered'
              AND updated_at < NOW() - INTERVAL '24 hours'
            RETURNING order_id, order_number, customer_id, garage_id, 
                      total_amount, garage_payout_amount
        `);

        const confirmedCount = result.rowCount || 0;

        if (confirmedCount > 0) {
            console.log(`[CRON] Auto-confirmed ${confirmedCount} delivered order(s) after 24h grace period`);

            // Record in order status history for each auto-confirmed order
            for (const order of result.rows) {
                await client.query(`
                    INSERT INTO order_status_history 
                    (order_id, old_status, new_status, changed_by_type, reason)
                    VALUES ($1, 'delivered', 'completed', 'system', 
                            'Auto-confirmed after 24-hour grace period. Customer did not respond.')
                `, [order.order_id]);
            }

            await client.query('COMMIT');

            // Socket.IO notifications
            const io = (global as any).io;
            if (io) {
                for (const order of result.rows) {
                    // Notify customer - order auto-completed
                    io.to(`user_${order.customer_id}`).emit('order_auto_confirmed', {
                        order_id: order.order_id,
                        order_number: order.order_number,
                        notification: `✅ Order #${order.order_number} was auto-confirmed after 24 hours. Thank you for your purchase!`
                    });

                    // Notify garage - payout being processed
                    io.to(`garage_${order.garage_id}`).emit('order_auto_confirmed', {
                        order_id: order.order_id,
                        order_number: order.order_number,
                        payout_amount: order.garage_payout_amount,
                        notification: `✅ Order #${order.order_number} auto-confirmed. Payout of ${order.garage_payout_amount} QAR will be scheduled.`
                    });

                    // Notify operations for tracking
                    io.to('operations').emit('order_auto_confirmed', {
                        order_id: order.order_id,
                        order_number: order.order_number,
                        notification: `📦 Order #${order.order_number} auto-confirmed (24h grace period expired)`
                    });
                }
            }

            // Note: schedulePendingPayouts() will pick these up in the next run
            // since they are now 'completed' status
        } else {
            await client.query('COMMIT');
        }

        return confirmedCount;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[CRON] autoConfirmDeliveries error:', err);
        return 0;
    } finally {
        client.release();
    }
}

// ============================================
// MASTER JOB RUNNER
// Runs all jobs in sequence
// ============================================
export async function runAllJobs(): Promise<void> {
    console.log('[CRON] Starting scheduled jobs run...');
    const startTime = Date.now();

    try {
        await expireOldRequests();
        await expireCounterOffers();
        await checkSubscriptions();
        await autoResolveDisputes();
        await autoConfirmDeliveries();  // NEW: Auto-confirm deliveries after 24h
        await schedulePendingPayouts();
        await autoProcessPayouts();  // Auto-process mature payouts
        await cleanupOldData();

        const duration = Date.now() - startTime;
        console.log(`[CRON] All jobs completed in ${duration}ms`);
    } catch (err) {
        console.error('[CRON] Error running jobs:', err);
    }
}

// Export individual jobs for testing
export default {
    expireOldRequests,
    expireCounterOffers,
    checkSubscriptions,
    autoResolveDisputes,
    autoConfirmDeliveries,  // NEW: Auto-confirm deliveries after 24h
    schedulePendingPayouts,
    autoProcessPayouts,
    cleanupOldData,
    runAllJobs
};
