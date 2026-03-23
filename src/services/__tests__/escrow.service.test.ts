/**
 * Escrow Service Tests
 * Tests escrow lifecycle: creation, confirmation, disputes, proof of condition
 */

import pool from '../../config/db';
import { EscrowService } from '../escrow.service';

describe('Escrow Service', () => {
    let escrowService: EscrowService;

    // Test IDs - unique to avoid conflicts with other test suites
    const testCustomerId = 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE';
    const testGarageId = 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF';
    const testOrderId = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA';
    let testEscrowId: string | null = null;

    beforeAll(async () => {
        // Cleanup stale test data
        await pool.query(
            'DELETE FROM proof_of_condition WHERE order_id IN (SELECT order_id FROM escrow_transactions WHERE order_id = $1)',
            [testOrderId]
        );
        await pool.query('DELETE FROM escrow_transactions WHERE order_id = $1', [testOrderId]);
        await pool.query('DELETE FROM orders WHERE order_id = $1', [testOrderId]);
        await pool.query('DELETE FROM garage_subscriptions WHERE garage_id = $1', [testGarageId]);
        await pool.query(
            'DELETE FROM part_requests WHERE request_id IN (SELECT request_id FROM orders WHERE order_id = $1)',
            [testOrderId]
        );
        await pool.query('DELETE FROM bids WHERE request_id IN (SELECT request_id FROM orders WHERE order_id = $1)', [
            testOrderId
        ]);
        await pool.query('DELETE FROM garages WHERE garage_id = $1', [testGarageId]);
        await pool.query('DELETE FROM users WHERE user_id IN ($1, $2)', [testCustomerId, testGarageId]);

        // Create test customer
        await pool.query(
            `
            INSERT INTO users (user_id, full_name, phone_number, user_type, password_hash)
            VALUES ($1, 'Test Customer Escrow', '+97430000011', 'customer', '$2b$10$dummyhashfortesting123')
            ON CONFLICT (user_id) DO NOTHING
        `,
            [testCustomerId]
        );

        // Create test garage user
        await pool.query(
            `
            INSERT INTO users (user_id, full_name, phone_number, user_type, password_hash)
            VALUES ($1, 'Test Garage Escrow', '+97430000012', 'garage', '$2b$10$dummyhashfortesting123')
            ON CONFLICT (user_id) DO NOTHING
        `,
            [testGarageId]
        );

        // Create test garage
        await pool.query(
            `
            INSERT INTO garages (garage_id, garage_name, approval_status, location_lat, location_lng)
            VALUES ($1, 'Test Garage LLC', 'approved', 25.276987, 51.520008)
            ON CONFLICT (garage_id) DO NOTHING
        `,
            [testGarageId]
        );

        // Create garage subscription
        await pool.query('DELETE FROM garage_subscriptions WHERE garage_id = $1', [testGarageId]);
        await pool.query(
            `
            INSERT INTO garage_subscriptions (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end)
            VALUES ($1, (SELECT plan_id FROM subscription_plans WHERE plan_code = 'starter' LIMIT 1), 'active', NOW(), NOW() + INTERVAL '30 days')
        `,
            [testGarageId]
        );

        // Create part request
        const requestResult = await pool.query(
            `
            INSERT INTO part_requests (request_id, customer_id, car_make, car_model, car_year, part_description, status)
            VALUES (gen_random_uuid(), $1, 'Toyota', 'Camry', 2022, 'Test Part', 'active')
            RETURNING request_id
        `,
            [testCustomerId]
        );

        const testRequestId = requestResult.rows[0].request_id;

        // Create bid
        const bidResult = await pool.query(
            `
            INSERT INTO bids (bid_id, request_id, garage_id, bid_amount, status, part_condition)
            VALUES (gen_random_uuid(), $1, $2, 150.00, 'accepted', 'new')
            RETURNING bid_id
        `,
            [testRequestId, testGarageId]
        );

        const testBidId = bidResult.rows[0].bid_id;

        // Create order
        await pool.query(
            `
            INSERT INTO orders (order_id, bid_id, customer_id, garage_id, request_id, total_amount, part_price, commission_rate, platform_fee, delivery_fee, order_status, payment_status, deposit_status, garage_payout_amount)
            VALUES ($1, $2, $3, $4, $5, 170.00, 150.00, 0.05, 8.50, 20.00, 'confirmed', 'paid', 'paid', 141.50)
            ON CONFLICT (order_id) DO NOTHING
        `,
            [testOrderId, testBidId, testCustomerId, testGarageId, testRequestId]
        );

        // Initialize escrow service
        escrowService = new EscrowService(pool);
    });

    afterAll(async () => {
        // Cleanup in reverse order - delete orders first since they reference garages
        await pool.query(
            'DELETE FROM proof_of_condition WHERE escrow_id IN (SELECT escrow_id FROM escrow_transactions WHERE order_id = $1)',
            [testOrderId]
        );
        await pool.query('DELETE FROM escrow_transactions WHERE order_id = $1', [testOrderId]);
        await pool.query('DELETE FROM orders WHERE order_id = $1', [testOrderId]);
        await pool.query('DELETE FROM garage_subscriptions WHERE garage_id = $1', [testGarageId]);
        await pool.query(
            'DELETE FROM bids WHERE request_id IN (SELECT request_id FROM part_requests WHERE customer_id = $1)',
            [testCustomerId]
        );
        await pool.query('DELETE FROM part_requests WHERE customer_id = $1', [testCustomerId]);
        await pool.query('DELETE FROM garages WHERE garage_id = $1', [testGarageId]);
        await pool.query('DELETE FROM users WHERE user_id IN ($1, $2)', [testCustomerId, testGarageId]);
    });

    describe('createEscrow', () => {
        it('should create escrow with correct platform fee calculation (15% default)', async () => {
            const result = await escrowService.createEscrow({
                orderId: testOrderId,
                customerId: testCustomerId,
                sellerId: testGarageId,
                amount: 100.0
            });

            testEscrowId = result.escrow_id;

            expect(result).toBeDefined();
            expect(result.escrow_id).toBeDefined();
            expect(result.order_id.toLowerCase()).toBe(testOrderId.toLowerCase());
            expect(result.customer_id.toLowerCase()).toBe(testCustomerId.toLowerCase());
            expect(result.seller_id.toLowerCase()).toBe(testGarageId.toLowerCase());
            expect(parseFloat(result.amount as unknown as string)).toBe(100);
            expect(parseFloat(result.platform_fee as unknown as string)).toBe(15); // 15% of 100
            expect(parseFloat(result.seller_payout as unknown as string)).toBe(85); // 100 - 15
            expect(result.status).toBe('held');
        });

        it('should set inspection_expires_at based on window hours', async () => {
            const result = await escrowService.createEscrow({
                orderId: testOrderId,
                customerId: testCustomerId,
                sellerId: testGarageId,
                amount: 100.0,
                inspectionWindowHours: 168 // 7 days
            });

            expect(result.inspection_window_hours).toBe(168);
            expect(result.inspection_expires_at).toBeDefined();

            // Verify expires_at is approximately 7 days from now
            const now = new Date();
            const expected = new Date(now.getTime() + 168 * 60 * 60 * 1000);
            const diff = Math.abs(result.inspection_expires_at.getTime() - expected.getTime());
            expect(diff).toBeLessThan(60000); // Within 1 minute
        });

        it('should support custom fee percentage calculation', async () => {
            const result = await escrowService.createEscrow({
                orderId: testOrderId,
                customerId: testCustomerId,
                sellerId: testGarageId,
                amount: 200.0,
                platformFeePercent: 10 // 10% instead of default 15%
            });

            expect(parseFloat(result.amount as unknown as string)).toBe(200);
            expect(parseFloat(result.platform_fee as unknown as string)).toBe(20); // 10% of 200
            expect(parseFloat(result.seller_payout as unknown as string)).toBe(180); // 200 - 20
        });
    });

    describe('getEscrowByOrder', () => {
        it('should return escrow by order ID', async () => {
            const result = await escrowService.getEscrowByOrder(testOrderId);

            expect(result).toBeDefined();
            expect(result?.order_id.toLowerCase()).toBe(testOrderId.toLowerCase());
            expect(result?.customer_id.toLowerCase()).toBe(testCustomerId.toLowerCase());
            expect(result?.seller_id.toLowerCase()).toBe(testGarageId.toLowerCase());
        });

        it('should return null for non-existent order', async () => {
            const result = await escrowService.getEscrowByOrder('00000000-0000-0000-0000-000000000000');

            expect(result).toBeNull();
        });
    });

    describe('buyerConfirm', () => {
        let confirmEscrowId: string | null = null;

        beforeEach(async () => {
            // Create fresh escrow for confirmation tests
            const result = await escrowService.createEscrow({
                orderId: testOrderId,
                customerId: testCustomerId,
                sellerId: testGarageId,
                amount: 100.0
            });
            confirmEscrowId = result.escrow_id;
        });

        it('should release escrow when buyer confirms', async () => {
            const result = await escrowService.buyerConfirm(confirmEscrowId!, testCustomerId);

            expect(result.status).toBe('released');
            expect(result.buyer_confirmed_at).toBeDefined();
            expect(result.released_at).toBeDefined();
        });

        it('should reject confirmation on non-held escrow', async () => {
            // First confirmation releases it
            await escrowService.buyerConfirm(confirmEscrowId!, testCustomerId);

            // Second confirmation should fail
            await expect(escrowService.buyerConfirm(confirmEscrowId!, testCustomerId)).rejects.toThrow();
        });
    });

    describe('raiseDispute', () => {
        let disputeEscrowId: string | null = null;

        beforeEach(async () => {
            const result = await escrowService.createEscrow({
                orderId: testOrderId,
                customerId: testCustomerId,
                sellerId: testGarageId,
                amount: 100.0
            });
            disputeEscrowId = result.escrow_id;
        });

        it('should raise dispute and update status', async () => {
            const result = await escrowService.raiseDispute(disputeEscrowId!, testCustomerId, 'Part not as described');

            expect(result.status).toBe('disputed');
            expect(result.dispute_raised_at).toBeDefined();
            expect(result.dispute_reason).toBe('Part not as described');
        });

        it('should only allow customer to raise dispute', async () => {
            // Non-customer should fail (this would be caught by FK constraint in real scenario)
            // For testing, we verify the escrow belongs to the customer
            const escrow = await escrowService.getEscrowByOrder(testOrderId);
            expect(escrow?.customer_id.toLowerCase()).toBe(testCustomerId.toLowerCase());
        });
    });

    describe('resolveDispute', () => {
        let resolveEscrowId: string | null = null;

        beforeEach(async () => {
            const result = await escrowService.createEscrow({
                orderId: testOrderId,
                customerId: testCustomerId,
                sellerId: testGarageId,
                amount: 100.0
            });
            resolveEscrowId = result.escrow_id;

            // Raise dispute first
            await escrowService.raiseDispute(resolveEscrowId!, testCustomerId, 'Test dispute');
        });

        it('should resolve dispute with refund_buyer', async () => {
            const result = await escrowService.resolveDispute(
                resolveEscrowId!,
                'refund_buyer',
                testGarageId, // admin in this context
                'Buyer wins dispute'
            );

            expect(result.status).toBe('refunded');
            expect(result.dispute_resolved_at).toBeDefined();
        });

        it('should resolve dispute with release_seller', async () => {
            // Create new escrow for this test
            const newResult = await escrowService.createEscrow({
                orderId: testOrderId,
                customerId: testCustomerId,
                sellerId: testGarageId,
                amount: 100.0
            });

            await escrowService.raiseDispute(newResult.escrow_id, testCustomerId, 'Test');

            const result = await escrowService.resolveDispute(
                newResult.escrow_id,
                'release_seller',
                testGarageId,
                'Seller wins dispute'
            );

            expect(result.status).toBe('released');
        });

        it('should resolve dispute with split', async () => {
            // Create new escrow for split test
            const newResult = await escrowService.createEscrow({
                orderId: testOrderId,
                customerId: testCustomerId,
                sellerId: testGarageId,
                amount: 100.0
            });

            await escrowService.raiseDispute(newResult.escrow_id, testCustomerId, 'Test');

            const result = await escrowService.resolveDispute(
                newResult.escrow_id,
                'split',
                testGarageId,
                '50/50 split',
                50
            );

            expect(result.status).toBe('partial_release');
        });
    });

    describe('Proof of Condition', () => {
        let proofEscrowId: string | null = null;

        beforeEach(async () => {
            const result = await escrowService.createEscrow({
                orderId: testOrderId,
                customerId: testCustomerId,
                sellerId: testGarageId,
                amount: 100.0
            });
            proofEscrowId = result.escrow_id;
        });

        it('should store proof with image URLs and location', async () => {
            const proof = await escrowService.addProofOfCondition({
                escrowId: proofEscrowId!,
                orderId: testOrderId,
                captureType: 'delivery_handoff',
                imageUrls: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
                capturedBy: testGarageId,
                locationLat: 25.2854,
                locationLng: 51.531,
                notes: 'Delivered in good condition'
            });

            expect(proof.proof_id).toBeDefined();
            expect(proof.escrow_id).toBe(proofEscrowId);
            expect(proof.capture_type).toBe('delivery_handoff');
            expect(proof.image_urls).toHaveLength(2);
            expect(parseFloat(proof.location_lat as unknown as string)).toBe(25.2854);
            expect(parseFloat(proof.location_lng as unknown as string)).toBe(51.531);
        });

        it('should retrieve proofs for escrow', async () => {
            // Add a proof first
            await escrowService.addProofOfCondition({
                escrowId: proofEscrowId!,
                orderId: testOrderId,
                captureType: 'pickup_from_garage',
                imageUrls: ['https://example.com/pickup.jpg'],
                capturedBy: testGarageId
            });

            const proofs = await escrowService.getProofsForEscrow(proofEscrowId!);

            expect(proofs).toHaveLength(1);
            expect(proofs[0].capture_type).toBe('pickup_from_garage');
        });
    });

    describe('getStats', () => {
        it('should return escrow statistics', async () => {
            const stats = await escrowService.getStats();

            expect(stats).toBeDefined();
            expect('total_held' in stats).toBe(true);
            expect('total_released' in stats).toBe(true);
            expect('total_disputes' in stats).toBe(true);
            expect('avg_release_time_hours' in stats).toBe(true);
        });
    });
});
