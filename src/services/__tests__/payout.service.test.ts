/**
 * Payout Service Tests
 * Tests payout lifecycle: send → confirm → complete, plus disputes and queries
 */

import pool from '../../config/db';
import { PayoutService } from '../finance/payout.service';
import { PayoutLifecycleService } from '../finance/payout-lifecycle.service';
import { PayoutQueryService } from '../finance/payout-query.service';

describe('Payout Service', () => {
    let lifecycleService: PayoutLifecycleService;
    let queryService: PayoutQueryService;

    // Test IDs - lowercase to match PostgreSQL UUID format
    // (lifecycle service uses strict === comparison against DB values)
    const testCustomerId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const testGarageId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    let testOrderId: string | null = null;
    let testPayoutId: string | null = null;

    beforeAll(async () => {
        // Setup base test data (users, garage, subscription) - shared across tests
        await pool.query('DELETE FROM users WHERE user_id IN ($1, $2)', [testCustomerId, testGarageId]);
        await pool.query('DELETE FROM garages WHERE garage_id = $1', [testGarageId]);

        await pool.query(`
            INSERT INTO users (user_id, full_name, phone_number, user_type, password_hash)
            VALUES ($1, 'Test Customer Payout', '+97430000021', 'customer', '$2b$10$dummyhashfortesting123'),
                   ($2, 'Test Garage Payout', '+97430000022', 'garage', '$2b$10$dummyhashfortesting123')
        `, [testCustomerId, testGarageId]);

        await pool.query(`
            INSERT INTO garages (garage_id, garage_name, approval_status, location_lat, location_lng)
            VALUES ($1, 'Test Payout Garage LLC', 'approved', 25.276987, 51.520008)
        `, [testGarageId]);

        await pool.query(`
            INSERT INTO garage_subscriptions (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end)
            VALUES ($1, (SELECT plan_id FROM subscription_plans WHERE plan_code = 'starter' LIMIT 1), 'active', NOW(), NOW() + INTERVAL '30 days')
        `, [testGarageId]);
    });

    afterAll(async () => {
        await pool.query('DELETE FROM garage_payouts WHERE garage_id = $1', [testGarageId]);
        await pool.query('DELETE FROM orders WHERE garage_id = $1 OR customer_id = $2', [testGarageId, testCustomerId]);
        await pool.query('DELETE FROM bids WHERE garage_id = $1', [testGarageId]);
        await pool.query('DELETE FROM part_requests WHERE customer_id = $1', [testCustomerId]);
        await pool.query('DELETE FROM garage_subscriptions WHERE garage_id = $1', [testGarageId]);
        await pool.query('DELETE FROM garages WHERE garage_id = $1', [testGarageId]);
        await pool.query('DELETE FROM users WHERE user_id IN ($1, $2)', [testCustomerId, testGarageId]);
    });

    /**
     * Helper: Create test order and payout for a specific test
     * Each test manages its own transaction via the service methods
     */
    async function createTestOrderAndPayout(warrantyDaysAgo: number = 8) {
        // Create part request
        const requestResult = await pool.query(`
            INSERT INTO part_requests (request_id, customer_id, car_make, car_model, car_year, part_description, status)
            VALUES (gen_random_uuid(), $1, 'Toyota', 'Camry', 2022, 'Test Part for Payout', 'active')
            RETURNING request_id
        `, [testCustomerId]);

        const testRequestId = requestResult.rows[0].request_id;

        // Create bid
        const bidResult = await pool.query(`
            INSERT INTO bids (bid_id, request_id, garage_id, bid_amount, status, part_condition)
            VALUES (gen_random_uuid(), $1, $2, 150.00, 'accepted', 'new')
            RETURNING bid_id
        `, [testRequestId, testGarageId]);

        const testBidId = bidResult.rows[0].bid_id;

        // Create completed order
        const orderResult = await pool.query(`
            INSERT INTO orders (order_id, bid_id, customer_id, garage_id, request_id, total_amount, part_price, commission_rate, platform_fee, delivery_fee, order_status, payment_status, deposit_status, garage_payout_amount, actual_delivery_at, completed_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, 170.00, 150.00, 0.05, 8.50, 20.00, 'completed', 'paid', 'paid', 141.50, NOW() - INTERVAL '${warrantyDaysAgo} days', NOW() - INTERVAL '${warrantyDaysAgo} days')
            RETURNING order_id
        `, [testBidId, testCustomerId, testGarageId, testRequestId]);

        const orderId = orderResult.rows[0].order_id;

        // Create garage payout record
        const payoutResult = await pool.query(`
            INSERT INTO garage_payouts (payout_id, garage_id, order_id, gross_amount, commission_amount, net_amount, payout_status, payout_type)
            VALUES (gen_random_uuid(), $1, $2, 150.00, 8.50, 141.50, 'pending', NULL)
            RETURNING payout_id, order_id
        `, [testGarageId, orderId]);

        return {
            payoutId: payoutResult.rows[0].payout_id,
            orderId: payoutResult.rows[0].order_id
        };
    }

    describe('Payout Query Operations', () => {
        beforeEach(async () => {
            // Initialize services for each test
            lifecycleService = new PayoutLifecycleService(pool);
            queryService = new PayoutQueryService(pool);
        });

        describe('getPayoutSummary', () => {
            it('should return payout summary for garage', async () => {
                const { payoutId } = await createTestOrderAndPayout(8);

                const summary = await queryService.getPayoutSummary(testGarageId, 'garage');

                expect(summary).toBeDefined();
                expect(summary.stats).toBeDefined();
                expect(summary.pending_payouts).toBeDefined();
                expect(parseFloat(summary.stats.total_revenue as unknown as string)).toBeGreaterThanOrEqual(141.50);

                // Cleanup
                await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
            });

            it('should return payout summary for admin', async () => {
                const { payoutId } = await createTestOrderAndPayout(8);

                const summary = await queryService.getPayoutSummary(testGarageId, 'admin');

                expect(summary).toBeDefined();
                expect(summary.stats).toBeDefined();
                expect(parseInt(summary.stats.pending_count as unknown as string)).toBeGreaterThanOrEqual(0);

                // Cleanup
                await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
            });
        });

        describe('getPayoutStatus', () => {
            it('should return payout status detail', async () => {
                const { payoutId } = await createTestOrderAndPayout(8);

                const status = await queryService.getPayoutStatus(payoutId);

                expect(status).toBeDefined();
                expect(status.payout_id.toLowerCase()).toBe(payoutId.toLowerCase());
                expect(status.garage_id.toLowerCase()).toBe(testGarageId.toLowerCase());
                expect(status.payout_status).toBe('pending');

                // Cleanup
                await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
            });

            it('should throw error for non-existent payout', async () => {
                await expect(
                    queryService.getPayoutStatus('00000000-0000-0000-0000-000000000000')
                ).rejects.toThrow();
            });
        });

        describe('getPayouts', () => {
            it('should return paginated payouts for admin', async () => {
                const { payoutId } = await createTestOrderAndPayout(8);

                const result = await queryService.getPayouts({
                    userId: testGarageId,
                    userType: 'admin',
                    page: 1,
                    limit: 10
                });

                expect(result.payouts).toBeDefined();
                expect(result.pagination).toBeDefined();
                expect(result.pagination.page).toBe(1);

                // Cleanup
                await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
            });

            it('should filter payouts by garage_id', async () => {
                const { payoutId } = await createTestOrderAndPayout(8);

                const result = await queryService.getPayouts({
                    userId: testGarageId,
                    userType: 'garage',
                    page: 1,
                    limit: 10
                });

                expect(result.payouts).toBeDefined();
                result.payouts.forEach(payout => {
                    expect(payout.garage_id.toLowerCase()).toBe(testGarageId.toLowerCase());
                });

                // Cleanup
                await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
            });
        });

        describe('getPaymentStats', () => {
            it('should return payment statistics', async () => {
                const { payoutId } = await createTestOrderAndPayout(8);

                const stats = await queryService.getPaymentStats();

                expect(stats).toBeDefined();
                expect('total_payouts' in stats).toBe(true);
                expect('by_status' in stats).toBe(true);
                expect('total_amount' in stats).toBe(true);

                // Cleanup
                await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
            });
        });
    });

    describe('Send Payment (Operations)', () => {
        beforeEach(async () => {
            lifecycleService = new PayoutLifecycleService(pool);
        });

        it('should send payment successfully', async () => {
            const { payoutId } = await createTestOrderAndPayout(8);

            const result = await lifecycleService.sendPayment(payoutId, {
                payout_method: 'bank_transfer',
                payout_reference: 'REF-TEST-001',
                notes: 'Test payout'
            });

            expect(result).toBeDefined();
            expect(result.message).toContain('Payment sent successfully');

            // Verify payout status updated
            const payout = await queryService.getPayoutStatus(payoutId);
            expect(payout.payout_status).toBe('awaiting_confirmation');

            // Cleanup
            await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
        });

        it('should reject sending payout with active dispute', async () => {
            const { payoutId, orderId } = await createTestOrderAndPayout(8);

            // Create dispute on the order (reason must match CHECK constraint enum)
            await pool.query(`
                INSERT INTO disputes (dispute_id, order_id, customer_id, garage_id, reason, description, order_amount, refund_percent, refund_amount, status)
                VALUES (gen_random_uuid(), $1, $2, $3, 'wrong_part', 'Received wrong part', 170.00, 100, 170.00, 'pending')
            `, [orderId, testCustomerId, testGarageId]);

            // Try to send payout - should fail
            await expect(
                lifecycleService.sendPayment(payoutId, {
                    payout_method: 'bank_transfer',
                    payout_reference: 'REF-TEST-002'
                })
            ).rejects.toThrow('Cannot send payout: Order has active dispute');

            // Cleanup
            await pool.query('DELETE FROM disputes WHERE order_id = $1', [orderId]);
            await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
        });

        it('should reject sending payout within 7-day warranty window', async () => {
            const { payoutId } = await createTestOrderAndPayout(1); // 1 day ago (within warranty)

            // Try to send payout - should fail (within 7-day window)
            await expect(
                lifecycleService.sendPayment(payoutId, {
                    payout_method: 'bank_transfer',
                    payout_reference: 'REF-TEST-003'
                })
            ).rejects.toThrow('7-day warranty window');

            // Cleanup
            await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
        });
    });

    describe('Confirm Payment (Garage)', () => {
        beforeEach(async () => {
            lifecycleService = new PayoutLifecycleService(pool);
        });

        it('should confirm payment successfully', async () => {
            // Create payout already in 'awaiting_confirmation' status (sent by ops)
            const { payoutId } = await createTestOrderAndPayout(8);
            await pool.query(`
                UPDATE garage_payouts SET payout_status = 'awaiting_confirmation', sent_at = NOW()
                WHERE payout_id = $1
            `, [payoutId]);

            const result = await lifecycleService.confirmPayment(payoutId, testGarageId, {
                received_at: new Date(),
                received_amount: 141.50,
                confirmation_notes: 'Received in full'
            });

            expect(result).toBeDefined();
            expect(result.message).toContain('Payment confirmed successfully');

            // Verify payout status updated
            const payout = await queryService.getPayoutStatus(payoutId);
            expect(payout.payout_status).toBe('confirmed');

            // Cleanup
            await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
        });

        it('should reject confirmation from wrong garage', async () => {
            const { payoutId } = await createTestOrderAndPayout(8);
            await pool.query(`
                UPDATE garage_payouts SET payout_status = 'awaiting_confirmation', sent_at = NOW()
                WHERE payout_id = $1
            `, [payoutId]);

            const wrongGarageId = '00000000-0000-0000-0000-000000000001';

            await expect(
                lifecycleService.confirmPayment(payoutId, wrongGarageId, {})
            ).rejects.toThrow();

            // Cleanup
            await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
        });

        it('should reject confirmation of already confirmed payout', async () => {
            const { payoutId } = await createTestOrderAndPayout(8);
            await pool.query(`
                UPDATE garage_payouts SET payout_status = 'confirmed', sent_at = NOW(), confirmed_at = NOW()
                WHERE payout_id = $1
            `, [payoutId]);

            // Try to confirm again - should fail
            await expect(
                lifecycleService.confirmPayment(payoutId, testGarageId, {})
            ).rejects.toThrow();

            // Cleanup
            await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
        });
    });

    describe('Dispute Payment (Garage)', () => {
        beforeEach(async () => {
            lifecycleService = new PayoutLifecycleService(pool);
        });

        it('should dispute payment successfully', async () => {
            const { payoutId } = await createTestOrderAndPayout(8);
            await pool.query(`
                UPDATE garage_payouts SET payout_status = 'awaiting_confirmation', sent_at = NOW()
                WHERE payout_id = $1
            `, [payoutId]);

            const result = await lifecycleService.disputePayment(payoutId, testGarageId, {
                issue_type: 'amount_mismatch',
                issue_description: 'Expected 150 QAR, received 141.50 QAR'
            });

            expect(result).toBeDefined();
            expect(result.message).toContain('dispute');

            // Verify payout status updated
            const payout = await queryService.getPayoutStatus(payoutId);
            expect(payout.payout_status).toBe('disputed');

            // Cleanup
            await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
        });

        it('should reject dispute from non-owner', async () => {
            const { payoutId } = await createTestOrderAndPayout(8);
            await pool.query(`
                UPDATE garage_payouts SET payout_status = 'awaiting_confirmation', sent_at = NOW()
                WHERE payout_id = $1
            `, [payoutId]);

            const wrongGarageId = '00000000-0000-0000-0000-000000000001';

            await expect(
                lifecycleService.disputePayment(payoutId, wrongGarageId, {
                    issue_type: 'not_received',
                    issue_description: 'Test'
                })
            ).rejects.toThrow();

            // Cleanup
            await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
        });
    });

    describe('Resolve Dispute (Admin/Ops)', () => {
        beforeEach(async () => {
            lifecycleService = new PayoutLifecycleService(pool);
        });

        it('should resolve dispute with confirmed status', async () => {
            const { payoutId } = await createTestOrderAndPayout(8);
            await pool.query(`
                UPDATE garage_payouts SET payout_status = 'disputed', sent_at = NOW()
                WHERE payout_id = $1
            `, [payoutId]);

            const result = await lifecycleService.resolveDispute(payoutId, {
                resolution: 'confirmed',
                resolution_notes: 'Dispute resolved - original amount correct'
            });

            expect(result).toBeDefined();
            expect(result.message).toContain('Dispute resolved');

            const payout = await queryService.getPayoutStatus(payoutId);
            expect(payout.payout_status).not.toBe('disputed');

            // Cleanup
            await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
        });

        it('should resolve dispute with corrected amount', async () => {
            const { payoutId } = await createTestOrderAndPayout(8);
            await pool.query(`
                UPDATE garage_payouts SET payout_status = 'disputed', sent_at = NOW()
                WHERE payout_id = $1
            `, [payoutId]);

            const result = await lifecycleService.resolveDispute(payoutId, {
                resolution: 'corrected',
                new_amount: 150.00,
                resolution_notes: 'Adjusted to correct amount'
            });

            expect(result).toBeDefined();

            const payout = await queryService.getPayoutStatus(payoutId);
            expect(parseFloat(payout.net_amount as unknown as string)).toBe(150);

            // Cleanup
            await pool.query('DELETE FROM garage_payouts WHERE payout_id = $1', [payoutId]);
        });
    });
});
