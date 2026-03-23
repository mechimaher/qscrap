import { randomUUID } from 'crypto';
import pool from '../../config/db';
import { CancellationService } from '../cancellation/cancellation.service';
import {
    createOrderFromBid,
    updateOrderStatus,
    getOrderWithDetails,
    getOrderHistory,
    undoOrder,
    CreateOrderParams,
    OrderStatusUpdate
} from '../order.service';

interface OrderFixture {
    orderId: string;
    bidId: string;
    requestId: string;
}

interface DriverFixture {
    driverId: string;
    userId: string;
}

interface OrderHistoryEntry {
    old_status: string | null;
    status: string;
    changed_by: string;
    reason: string;
}

const cancellationService = new CancellationService(pool);

/**
 * Order Service integration tests
 * Tests order creation, status transitions, undo flow, cancellations, and completion side-effects.
 */

describe('Order Service', () => {
    const testCustomerId = '11111111-1111-1111-1111-111111111111';
    const testGarageId = '22222222-2222-2222-2222-222222222222';
    const testRequestId = '33333333-3333-3333-3333-333333333333';
    const testBidId = '44444444-4444-4444-4444-444444444444';

    let createdOrderId: string | null = null;

    const testPasswordHash = '$2b$10$dummyhashfortesting123456789012345';

    const createUniquePhone = (): string => `+974${`${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8)}`;

    async function cleanupOrderFixture(
        fixture?: Partial<OrderFixture & DriverFixture> & { extraBidIds?: string[] }
    ): Promise<void> {
        if (!fixture) {
            return;
        }

        if (fixture.orderId) {
            await pool.query('DELETE FROM refunds WHERE order_id = $1', [fixture.orderId]);
            await pool.query('DELETE FROM payment_intents WHERE order_id = $1', [fixture.orderId]);
            await pool.query('DELETE FROM delivery_assignments WHERE order_id = $1', [fixture.orderId]);
            await pool.query('DELETE FROM cancellation_requests WHERE order_id = $1', [fixture.orderId]);
            await pool.query('DELETE FROM garage_payouts WHERE order_id = $1', [fixture.orderId]);
            await pool.query('DELETE FROM reward_transactions WHERE order_id = $1', [fixture.orderId]);
            await pool.query('DELETE FROM order_status_history WHERE order_id = $1', [fixture.orderId]);
            await pool.query('DELETE FROM undo_audit_log WHERE order_id = $1', [fixture.orderId]);
            await pool.query('DELETE FROM orders WHERE order_id = $1', [fixture.orderId]);
        }

        if (fixture.extraBidIds && fixture.extraBidIds.length > 0) {
            await pool.query('DELETE FROM bids WHERE bid_id = ANY($1::uuid[])', [fixture.extraBidIds]);
        }

        if (fixture.bidId) {
            await pool.query('DELETE FROM bids WHERE bid_id = $1', [fixture.bidId]);
        }

        if (fixture.requestId) {
            await pool.query('DELETE FROM part_requests WHERE request_id = $1', [fixture.requestId]);
        }

        if (fixture.driverId) {
            await pool.query('DELETE FROM drivers WHERE driver_id = $1', [fixture.driverId]);
        }

        if (fixture.userId) {
            await pool.query('DELETE FROM users WHERE user_id = $1', [fixture.userId]);
        }
    }

    async function createFreshOrder(
        options: {
            bidAmount?: number;
            deliveryFee?: number;
            paymentMethod?: string;
            deliveryAddress?: string;
            carMake?: string;
            carModel?: string;
            carYear?: number;
            partDescription?: string;
            partCondition?: string;
        } = {}
    ): Promise<OrderFixture> {
        const requestId = randomUUID();
        const bidId = randomUUID();

        // Ensure test customer exists (in case another test deleted it)
        await pool.query(
            `
            INSERT INTO users (user_id, full_name, phone_number, user_type, password_hash)
            VALUES ($1, 'Test Customer', '+97430000001', 'customer', $2)
            ON CONFLICT (user_id) DO UPDATE SET user_type = 'customer'
        `,
            [testCustomerId, testPasswordHash]
        );

        // Ensure customer_rewards exists
        await pool.query(
            `
            INSERT INTO customer_rewards (customer_id, points_balance, lifetime_points, current_tier)
            VALUES ($1, 0, 0, 'bronze')
            ON CONFLICT (customer_id) DO UPDATE SET
                points_balance = 0,
                lifetime_points = 0,
                current_tier = 'bronze'
        `,
            [testCustomerId]
        );

        // Ensure test garage exists
        await pool.query(
            `
            INSERT INTO users (user_id, full_name, phone_number, user_type, password_hash)
            VALUES ($1, 'Test Garage', '+97430000002', 'garage', $2)
            ON CONFLICT (user_id) DO UPDATE SET user_type = 'garage'
        `,
            [testGarageId, testPasswordHash]
        );

        await pool.query(
            `
            INSERT INTO garages (garage_id, garage_name, approval_status, location_lat, location_lng)
            VALUES ($1, 'Test Garage LLC', 'approved', 25.276987, 51.520008)
            ON CONFLICT (garage_id) DO UPDATE SET approval_status = 'approved'
        `,
            [testGarageId]
        );

        // Ensure garage has active subscription
        await pool.query('DELETE FROM garage_subscriptions WHERE garage_id = $1', [testGarageId]);
        await pool.query(
            `
            INSERT INTO garage_subscriptions (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end)
            VALUES ($1, (SELECT plan_id FROM subscription_plans WHERE plan_code = 'starter' LIMIT 1), 'active', NOW(), NOW() + INTERVAL '30 days')
        `,
            [testGarageId]
        );

        await pool.query(
            `
            INSERT INTO part_requests (request_id, customer_id, car_make, car_model, car_year, part_description, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'active')
        `,
            [
                requestId,
                testCustomerId,
                options.carMake || 'Toyota',
                options.carModel || 'Camry',
                options.carYear || 2022,
                options.partDescription || 'Order service test part'
            ]
        );

        await pool.query(
            `
            INSERT INTO bids (bid_id, request_id, garage_id, bid_amount, status, part_condition)
            VALUES ($1, $2, $3, $4, 'pending', $5)
        `,
            [bidId, requestId, testGarageId, options.bidAmount || 200, options.partCondition || 'used_good']
        );

        const params: CreateOrderParams = {
            bidId,
            customerId: testCustomerId,
            paymentMethod: options.paymentMethod || 'card',
            deliveryFee: options.deliveryFee || 30,
            deliveryZoneId: null,
            deliveryAddress: options.deliveryAddress || 'Test Address, Doha, Qatar'
        };

        const result = await createOrderFromBid(params);

        return {
            orderId: result.order.order_id,
            bidId,
            requestId
        };
    }

    async function createReadyForPickupOrder(
        options: {
            bidAmount?: number;
            deliveryFee?: number;
            partDescription?: string;
        } = {}
    ): Promise<OrderFixture> {
        const fixture = await createFreshOrder(options);

        const preparingResult = await updateOrderStatus({
            orderId: fixture.orderId,
            newStatus: 'preparing',
            changedBy: testGarageId,
            changedByType: 'garage',
            reason: 'Started preparation'
        });

        if (!preparingResult.success) {
            throw new Error(`Failed to move order to preparing: ${preparingResult.error}`);
        }

        const readyResult = await updateOrderStatus({
            orderId: fixture.orderId,
            newStatus: 'ready_for_pickup',
            changedBy: testGarageId,
            changedByType: 'garage',
            reason: 'Ready for pickup'
        });

        if (!readyResult.success) {
            throw new Error(`Failed to move order to ready_for_pickup: ${readyResult.error}`);
        }

        return fixture;
    }

    async function attachDriverToOrder(orderId: string): Promise<DriverFixture> {
        const driverId = randomUUID();
        const driverPhone = createUniquePhone();

        await pool.query(
            `
            INSERT INTO users (user_id, full_name, phone_number, user_type, password_hash)
            VALUES ($1, 'Test Driver', $2, 'driver', $3)
        `,
            [driverId, driverPhone, testPasswordHash]
        );

        await pool.query(
            `
            INSERT INTO drivers (
                driver_id, user_id, full_name, phone, email, vehicle_type, vehicle_plate, vehicle_model, status
            )
            VALUES ($1, $1, 'Test Driver', $2, $3, 'motorcycle', 'TST-123', 'Honda Wave', 'busy')
        `,
            [driverId, driverPhone, `driver.${driverId}@test.qscrap.qa`]
        );

        await pool.query('UPDATE orders SET driver_id = $2, updated_at = NOW() WHERE order_id = $1', [
            orderId,
            driverId
        ]);

        await pool.query(
            `
            INSERT INTO delivery_assignments (order_id, driver_id, status, pickup_address, delivery_address)
            VALUES ($1, $2, 'assigned', 'Garage Pickup Address', 'Customer Delivery Address')
        `,
            [orderId, driverId]
        );

        return { driverId, userId: driverId };
    }

    async function cleanupSharedTestData(): Promise<void> {
        const orderIdsResult = await pool.query(
            'SELECT order_id FROM orders WHERE customer_id = $1 OR garage_id = $2',
            [testCustomerId, testGarageId]
        );
        const orderIds = orderIdsResult.rows.map((row) => row.order_id);

        if (orderIds.length > 0) {
            await pool.query('DELETE FROM refunds WHERE order_id = ANY($1::uuid[])', [orderIds]);
            await pool.query('DELETE FROM payment_intents WHERE order_id = ANY($1::uuid[])', [orderIds]);
            await pool.query('DELETE FROM delivery_assignments WHERE order_id = ANY($1::uuid[])', [orderIds]);
            await pool.query('DELETE FROM cancellation_requests WHERE order_id = ANY($1::uuid[])', [orderIds]);
            await pool.query('DELETE FROM garage_payouts WHERE order_id = ANY($1::uuid[])', [orderIds]);
            await pool.query('DELETE FROM reward_transactions WHERE order_id = ANY($1::uuid[])', [orderIds]);
            await pool.query('DELETE FROM order_status_history WHERE order_id = ANY($1::uuid[])', [orderIds]);
            await pool.query('DELETE FROM undo_audit_log WHERE order_id = ANY($1::uuid[])', [orderIds]);
            await pool.query('DELETE FROM orders WHERE order_id = ANY($1::uuid[])', [orderIds]);
        }

        const requestIdsResult = await pool.query('SELECT request_id FROM part_requests WHERE customer_id = $1', [
            testCustomerId
        ]);
        const requestIds = requestIdsResult.rows.map((row) => row.request_id);

        if (requestIds.length > 0) {
            await pool.query('DELETE FROM bids WHERE request_id = ANY($1::uuid[])', [requestIds]);
            await pool.query('DELETE FROM part_requests WHERE request_id = ANY($1::uuid[])', [requestIds]);
        }

        await pool.query('DELETE FROM bids WHERE garage_id = $1', [testGarageId]);
        await pool.query('DELETE FROM garage_subscriptions WHERE garage_id = $1', [testGarageId]);
        await pool.query('DELETE FROM reward_transactions WHERE customer_id = $1', [testCustomerId]);
        await pool.query('DELETE FROM customer_rewards WHERE customer_id = $1', [testCustomerId]);
        await pool.query('DELETE FROM garages WHERE garage_id = $1', [testGarageId]);
        await pool.query('DELETE FROM users WHERE user_id IN ($1, $2)', [testCustomerId, testGarageId]);
    }

    async function ensureUndoStatusConstraint(): Promise<void> {
        const constraintResult = await pool.query(`
            SELECT pg_get_constraintdef(oid) AS definition
            FROM pg_constraint
            WHERE conname = 'orders_order_status_check'
        `);

        const definition = constraintResult.rows[0]?.definition || '';
        if (definition.includes('cancelled_by_undo')) {
            return;
        }

        await pool.query('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check');
        await pool.query(`
            ALTER TABLE orders
            ADD CONSTRAINT orders_order_status_check CHECK (
                order_status IN (
                    'pending_payment',
                    'confirmed',
                    'preparing',
                    'ready_for_pickup',
                    'ready_for_collection',
                    'collected',
                    'qc_in_progress',
                    'qc_passed',
                    'qc_failed',
                    'returning_to_garage',
                    'in_transit',
                    'out_for_delivery',
                    'delivered',
                    'completed',
                    'cancelled_by_customer',
                    'cancelled_by_garage',
                    'cancelled_by_ops',
                    'cancelled_by_undo',
                    'disputed',
                    'refunded'
                )
            )
        `);
    }

    beforeAll(async () => {
        await ensureUndoStatusConstraint();

        await pool.query(`
            INSERT INTO reward_tiers (tier_name, min_points, discount_percentage, priority_support, tier_badge_color)
            VALUES
                ('bronze', 0, 0, false, '#CD7F32'),
                ('silver', 1000, 5.00, false, '#C0C0C0'),
                ('gold', 3000, 10.00, true, '#FFD700'),
                ('platinum', 10000, 15.00, true, '#E5E4E2')
            ON CONFLICT (tier_name) DO NOTHING
        `);

        await cleanupSharedTestData();

        await pool.query(
            `
            INSERT INTO users (user_id, full_name, phone_number, user_type, password_hash)
            VALUES ($1, 'Test Customer', '+97430000001', 'customer', $2)
            ON CONFLICT (user_id) DO NOTHING
        `,
            [testCustomerId, testPasswordHash]
        );

        await pool.query(
            `
            INSERT INTO users (user_id, full_name, phone_number, user_type, password_hash)
            VALUES ($1, 'Test Garage', '+97430000002', 'garage', $2)
            ON CONFLICT (user_id) DO NOTHING
        `,
            [testGarageId, testPasswordHash]
        );

        await pool.query(
            `
            INSERT INTO customer_rewards (customer_id, points_balance, lifetime_points, current_tier)
            VALUES ($1, 0, 0, 'bronze')
            ON CONFLICT (customer_id) DO UPDATE SET
                points_balance = 0,
                lifetime_points = 0,
                current_tier = 'bronze',
                updated_at = NOW()
        `,
            [testCustomerId]
        );

        await pool.query(
            `
            INSERT INTO garages (garage_id, garage_name, approval_status, location_lat, location_lng)
            VALUES ($1, 'Test Garage LLC', 'approved', 25.276987, 51.520008)
            ON CONFLICT (garage_id) DO NOTHING
        `,
            [testGarageId]
        );

        await pool.query('DELETE FROM garage_subscriptions WHERE garage_id = $1', [testGarageId]);
        await pool.query(
            `
            INSERT INTO garage_subscriptions (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end)
            VALUES ($1, (SELECT plan_id FROM subscription_plans WHERE plan_code = 'starter' LIMIT 1), 'active', NOW(), NOW() + INTERVAL '30 days')
        `,
            [testGarageId]
        );

        await pool.query(
            `
            INSERT INTO part_requests (request_id, customer_id, car_make, car_model, car_year, part_description, status)
            VALUES ($1, $2, 'Toyota', 'Camry', 2022, 'Test Part', 'active')
            ON CONFLICT (request_id) DO NOTHING
        `,
            [testRequestId, testCustomerId]
        );

        await pool.query(
            `
            INSERT INTO bids (bid_id, request_id, garage_id, bid_amount, status, part_condition)
            VALUES ($1, $2, $3, 150.00, 'pending', 'new')
            ON CONFLICT (bid_id) DO NOTHING
        `,
            [testBidId, testRequestId, testGarageId]
        );
    });

    afterAll(async () => {
        await cleanupSharedTestData();
    });

    describe('createOrderFromBid', () => {
        it('should create an order from a valid bid', async () => {
            const params: CreateOrderParams = {
                bidId: testBidId,
                customerId: testCustomerId,
                paymentMethod: 'cash',
                deliveryFee: 25,
                deliveryZoneId: null,
                deliveryAddress: 'Test Address, Doha, Qatar'
            };

            const result = await createOrderFromBid(params);

            expect(result).toHaveProperty('order');
            expect(result).toHaveProperty('totalAmount');
            expect(result.order).toHaveProperty('order_id');
            expect(result.order).toHaveProperty('order_number');
            expect(result.totalAmount).toBe(175);

            createdOrderId = result.order.order_id;
        });

        it('should reject duplicate bid acceptance', async () => {
            const params: CreateOrderParams = {
                bidId: testBidId,
                customerId: testCustomerId,
                paymentMethod: 'cash',
                deliveryFee: 25,
                deliveryZoneId: null,
                deliveryAddress: 'Test Address'
            };

            await expect(createOrderFromBid(params)).rejects.toThrow('Bid no longer available');
        });
    });

    describe('updateOrderStatus', () => {
        it('should update order status successfully', async () => {
            if (!createdOrderId) {
                throw new Error('No order created for status update test');
            }

            const update: OrderStatusUpdate = {
                orderId: createdOrderId,
                newStatus: 'preparing',
                changedBy: testGarageId,
                changedByType: 'garage',
                reason: 'Garage started preparing'
            };

            const result = await updateOrderStatus(update);

            expect(result.success).toBe(true);
        });

        it('should record status change in history', async () => {
            if (!createdOrderId) {
                throw new Error('No order created for history test');
            }

            const history = (await getOrderHistory(createdOrderId)) as OrderHistoryEntry[];

            expect(history).toBeInstanceOf(Array);
            expect(history.length).toBeGreaterThan(0);
            expect(history[history.length - 1]).toMatchObject({
                old_status: 'pending_payment',
                status: 'preparing',
                changed_by: testGarageId,
                reason: 'Garage started preparing'
            });
        });
    });

    describe('getOrderWithDetails', () => {
        it('should return order with all related data', async () => {
            if (!createdOrderId) {
                throw new Error('No order created for details test');
            }

            const order = await getOrderWithDetails(createdOrderId);

            expect(order).not.toBeNull();
            expect(order).toHaveProperty('order_id', createdOrderId);
            expect(order).toHaveProperty('customer_name');
            expect(order).toHaveProperty('garage_name');
            expect(order).toHaveProperty('part_description');
        });

        it('should return null for non-existent order', async () => {
            const order = await getOrderWithDetails('99999999-9999-9999-9999-999999999999');
            expect(order).toBeNull();
        });
    });

    describe('Order Status Transitions', () => {
        it('should allow full lifecycle: preparing -> ready -> completed', async () => {
            if (!createdOrderId) {
                throw new Error('No order created for lifecycle test');
            }

            const readyResult = await updateOrderStatus({
                orderId: createdOrderId,
                newStatus: 'ready_for_pickup',
                changedBy: testGarageId,
                changedByType: 'garage'
            });
            expect(readyResult.success).toBe(true);

            const completeResult = await updateOrderStatus({
                orderId: createdOrderId,
                newStatus: 'completed',
                changedBy: testCustomerId,
                changedByType: 'customer',
                reason: 'Customer confirmed delivery'
            });

            expect(completeResult.success).toBe(true);
            expect(completeResult.payoutCreated).toBe(true);
        });

        it('should transition pending_payment to cancelled_by_customer via cancellation service', async () => {
            let fixture: OrderFixture | undefined;

            try {
                fixture = await createFreshOrder({
                    bidAmount: 210,
                    deliveryFee: 25,
                    partDescription: 'Customer cancellation integration test'
                });

                const result = await cancellationService.cancelOrderByCustomer(
                    fixture.orderId,
                    testCustomerId,
                    'changed_mind',
                    'Changed my mind'
                );

                expect(result.message).toBe('Order cancelled successfully');

                const orderResult = await pool.query('SELECT order_status FROM orders WHERE order_id = $1', [
                    fixture.orderId
                ]);
                expect(orderResult.rows[0].order_status).toBe('cancelled_by_customer');

                const requestResult = await pool.query(
                    'SELECT requested_by_type, status FROM cancellation_requests WHERE order_id = $1',
                    [fixture.orderId]
                );
                expect(requestResult.rows).toHaveLength(1);
                expect(requestResult.rows[0]).toMatchObject({
                    requested_by_type: 'customer',
                    status: 'processed'
                });

                const history = (await getOrderHistory(fixture.orderId)) as OrderHistoryEntry[];
                expect(history[history.length - 1]).toMatchObject({
                    old_status: 'pending_payment',
                    status: 'cancelled_by_customer',
                    changed_by: testCustomerId,
                    reason: 'Changed my mind'
                });
            } finally {
                await cleanupOrderFixture(fixture);
            }
        });

        it('should transition confirmed to cancelled_by_garage via cancellation service', async () => {
            let fixture: OrderFixture | undefined;

            try {
                fixture = await createFreshOrder({
                    bidAmount: 240,
                    deliveryFee: 35,
                    partDescription: 'Garage cancellation integration test'
                });

                const confirmResult = await updateOrderStatus({
                    orderId: fixture.orderId,
                    newStatus: 'confirmed',
                    changedBy: testGarageId,
                    changedByType: 'garage',
                    reason: 'Payment confirmed for cancellation test'
                });

                expect(confirmResult.success).toBe(true);

                const result = await cancellationService.cancelOrderByGarage(
                    fixture.orderId,
                    testGarageId,
                    'stock_out',
                    'Out of stock'
                );

                expect(result.message).toContain('Order cancelled');

                const orderResult = await pool.query('SELECT order_status FROM orders WHERE order_id = $1', [
                    fixture.orderId
                ]);
                expect(orderResult.rows[0].order_status).toBe('cancelled_by_garage');

                const requestResult = await pool.query(
                    'SELECT requested_by_type, status FROM cancellation_requests WHERE order_id = $1',
                    [fixture.orderId]
                );
                expect(requestResult.rows).toHaveLength(1);
                expect(requestResult.rows[0]).toMatchObject({
                    requested_by_type: 'garage',
                    status: 'processed'
                });

                const history = (await getOrderHistory(fixture.orderId)) as OrderHistoryEntry[];
                expect(history[history.length - 1]).toMatchObject({
                    old_status: 'confirmed',
                    status: 'cancelled_by_garage',
                    changed_by: testGarageId,
                    reason: 'Out of stock'
                });
            } finally {
                await cleanupOrderFixture(fixture);
            }
        });
    });

    describe('Undo Order (30-second grace window)', () => {
        let fixture: OrderFixture;

        async function createUndoEligibleOrder(): Promise<OrderFixture> {
            const undoFixture = await createFreshOrder({
                bidAmount: 200,
                deliveryFee: 30,
                partDescription: 'Undo test part'
            });

            // Keep the deadline safely ahead of the app clock for this integration test.
            await pool.query("UPDATE orders SET undo_deadline = NOW() + INTERVAL '4 hours' WHERE order_id = $1", [
                undoFixture.orderId
            ]);

            return undoFixture;
        }

        beforeEach(async () => {
            fixture = await createUndoEligibleOrder();
        });

        afterEach(async () => {
            await cleanupOrderFixture(fixture);
        });

        it('should undo order within grace window and set status to cancelled_by_undo', async () => {
            const result = await undoOrder(fixture.orderId, testCustomerId, 'customer', 'Changed my mind');

            expect(result.success).toBe(true);
            expect(result.order_status).toBe('cancelled_by_undo');

            const orderResult = await pool.query(
                'SELECT order_status, undo_used, undo_reason FROM orders WHERE order_id = $1',
                [fixture.orderId]
            );
            expect(orderResult.rows[0]).toMatchObject({
                order_status: 'cancelled_by_undo',
                undo_used: true,
                undo_reason: 'Changed my mind'
            });
        });

        it('should revert bid status back to pending after undo', async () => {
            await undoOrder(fixture.orderId, testCustomerId, 'customer');

            const bidResult = await pool.query('SELECT status FROM bids WHERE bid_id = $1', [fixture.bidId]);
            expect(bidResult.rows[0].status).toBe('pending');
        });

        it('should revert request status back to active after undo', async () => {
            await undoOrder(fixture.orderId, testCustomerId, 'customer');

            const requestResult = await pool.query('SELECT status FROM part_requests WHERE request_id = $1', [
                fixture.requestId
            ]);
            expect(requestResult.rows[0].status).toBe('active');
        });

        it('should revert other rejected bids back to pending after undo', async () => {
            const extraBidId = randomUUID();
            const extraGarageId = randomUUID();
            const extraGaragePhone = createUniquePhone();

            try {
                await pool.query(
                    `
                    INSERT INTO users (user_id, full_name, phone_number, user_type, password_hash)
                    VALUES ($1, 'Undo Test Garage', $2, 'garage', $3)
                `,
                    [extraGarageId, extraGaragePhone, testPasswordHash]
                );

                await pool.query(
                    `
                    INSERT INTO garages (garage_id, garage_name, approval_status, location_lat, location_lng)
                    VALUES ($1, 'Undo Test Garage LLC', 'approved', 25.276987, 51.520008)
                `,
                    [extraGarageId]
                );

                await pool.query(
                    `
                    INSERT INTO garage_subscriptions (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end)
                    VALUES ($1, (SELECT plan_id FROM subscription_plans WHERE plan_code = 'starter' LIMIT 1), 'active', NOW(), NOW() + INTERVAL '30 days')
                `,
                    [extraGarageId]
                );

                await pool.query(
                    "UPDATE part_requests SET status = 'active', updated_at = NOW() WHERE request_id = $1",
                    [fixture.requestId]
                );

                await pool.query(
                    `
                    INSERT INTO bids (bid_id, request_id, garage_id, bid_amount, status, part_condition)
                    VALUES ($1, $2, $3, 180.00, 'rejected', 'new')
                `,
                    [extraBidId, fixture.requestId, extraGarageId]
                );

                await pool.query(
                    "UPDATE part_requests SET status = 'accepted', updated_at = NOW() WHERE request_id = $1",
                    [fixture.requestId]
                );

                await undoOrder(fixture.orderId, testCustomerId, 'customer');

                const extraBidResult = await pool.query('SELECT status FROM bids WHERE bid_id = $1', [extraBidId]);
                expect(extraBidResult.rows[0].status).toBe('pending');
            } finally {
                await pool.query('DELETE FROM bids WHERE bid_id = $1', [extraBidId]);
                await pool.query('DELETE FROM garage_subscriptions WHERE garage_id = $1', [extraGarageId]);
                await pool.query('DELETE FROM garages WHERE garage_id = $1', [extraGarageId]);
                await pool.query('DELETE FROM users WHERE user_id = $1', [extraGarageId]);
            }
        });

        it('should return UNDO_EXPIRED when grace window has expired', async () => {
            await pool.query("UPDATE orders SET undo_deadline = NOW() - INTERVAL '1 minute' WHERE order_id = $1", [
                fixture.orderId
            ]);

            const result = await undoOrder(fixture.orderId, testCustomerId, 'customer');

            expect(result).toMatchObject({
                success: false,
                error: 'UNDO_EXPIRED',
                expired: true
            });

            const orderResult = await pool.query('SELECT order_status, undo_used FROM orders WHERE order_id = $1', [
                fixture.orderId
            ]);
            expect(orderResult.rows[0]).toMatchObject({
                order_status: 'pending_payment',
                undo_used: false
            });
        });

        it('should return ACCESS_DENIED when wrong customer attempts undo', async () => {
            const result = await undoOrder(fixture.orderId, '88888888-8888-8888-8888-888888888888', 'customer');

            expect(result).toMatchObject({
                success: false,
                error: 'ACCESS_DENIED',
                message: 'Access denied'
            });
        });

        it('should be idempotent when called twice', async () => {
            const firstResult = await undoOrder(fixture.orderId, testCustomerId, 'customer');
            const secondResult = await undoOrder(fixture.orderId, testCustomerId, 'customer');

            expect(firstResult).toMatchObject({
                success: true,
                order_status: 'cancelled_by_undo'
            });
            expect(secondResult).toMatchObject({
                success: true,
                message: 'Order already undone',
                order_status: 'cancelled_by_undo'
            });
        });

        it('should create audit trail entry in undo_audit_log', async () => {
            await undoOrder(fixture.orderId, testCustomerId, 'customer', 'Audit test');

            const auditResult = await pool.query(
                'SELECT action, actor_id, actor_type FROM undo_audit_log WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
                [fixture.orderId]
            );

            expect(auditResult.rows).toHaveLength(1);
            expect(auditResult.rows[0]).toMatchObject({
                action: 'undo_completed',
                actor_id: testCustomerId,
                actor_type: 'customer'
            });
        });

        it('should record undo in order_status_history', async () => {
            await undoOrder(fixture.orderId, testCustomerId, 'customer', 'History test');

            const history = (await getOrderHistory(fixture.orderId)) as OrderHistoryEntry[];

            expect(history).toHaveLength(2);
            expect(history[1]).toMatchObject({
                old_status: 'pending_payment',
                status: 'cancelled_by_undo',
                changed_by: testCustomerId,
                reason: 'History test'
            });
        });
    });

    describe('Order Completion Side-Effects', () => {
        let fixture: OrderFixture;
        let driverFixture: DriverFixture | undefined;

        beforeEach(async () => {
            fixture = await createReadyForPickupOrder({
                bidAmount: 250,
                deliveryFee: 40,
                partDescription: 'Completion test part'
            });
        });

        afterEach(async () => {
            await cleanupOrderFixture({ ...fixture, ...driverFixture });
            driverFixture = undefined;
        });

        it('should create a garage_payouts row with correct amounts and release the driver on completion', async () => {
            driverFixture = await attachDriverToOrder(fixture.orderId);

            const completeResult = await updateOrderStatus({
                orderId: fixture.orderId,
                newStatus: 'completed',
                changedBy: testCustomerId,
                changedByType: 'customer',
                reason: 'Order completed'
            });

            expect(completeResult).toMatchObject({
                success: true,
                payoutCreated: true,
                driverReleased: true
            });

            const payoutResult = await pool.query(
                'SELECT garage_id, gross_amount, commission_amount, net_amount, scheduled_for FROM garage_payouts WHERE order_id = $1',
                [fixture.orderId]
            );
            expect(payoutResult.rows).toHaveLength(1);

            const orderFinancials = await pool.query(
                'SELECT garage_id, part_price, platform_fee, garage_payout_amount FROM orders WHERE order_id = $1',
                [fixture.orderId]
            );

            expect(Number(payoutResult.rows[0].gross_amount)).toBe(Number(orderFinancials.rows[0].part_price));
            expect(Number(payoutResult.rows[0].commission_amount)).toBe(Number(orderFinancials.rows[0].platform_fee));
            expect(Number(payoutResult.rows[0].net_amount)).toBe(Number(orderFinancials.rows[0].garage_payout_amount));
            expect(payoutResult.rows[0].garage_id).toBe(orderFinancials.rows[0].garage_id);
            expect(payoutResult.rows[0].scheduled_for).not.toBeNull();

            const driverResult = await pool.query('SELECT status FROM drivers WHERE driver_id = $1', [
                driverFixture.driverId
            ]);
            expect(driverResult.rows[0].status).toBe('available');
        });

        it('should set payment_status to paid and completed_at timestamp on completion', async () => {
            const beforeResult = await pool.query(
                'SELECT payment_status, completed_at FROM orders WHERE order_id = $1',
                [fixture.orderId]
            );
            expect(beforeResult.rows[0]).toMatchObject({
                payment_status: 'pending',
                completed_at: null
            });

            const completeResult = await updateOrderStatus({
                orderId: fixture.orderId,
                newStatus: 'completed',
                changedBy: testCustomerId,
                changedByType: 'customer',
                reason: 'Order completed'
            });
            expect(completeResult.success).toBe(true);

            const afterResult = await pool.query(
                'SELECT payment_status, completed_at FROM orders WHERE order_id = $1',
                [fixture.orderId]
            );
            expect(afterResult.rows[0].payment_status).toBe('paid');
            expect(afterResult.rows[0].completed_at).not.toBeNull();
        });

        it('should keep a complete status history audit trail from creation to completion', async () => {
            const completeResult = await updateOrderStatus({
                orderId: fixture.orderId,
                newStatus: 'completed',
                changedBy: testCustomerId,
                changedByType: 'customer',
                reason: 'Final delivery confirmed'
            });
            expect(completeResult.success).toBe(true);

            const history = (await getOrderHistory(fixture.orderId)) as OrderHistoryEntry[];

            expect(history).toHaveLength(4);
            expect(
                history.map(({ old_status, status, changed_by, reason }) => ({
                    old_status,
                    status,
                    changed_by,
                    reason
                }))
            ).toEqual([
                {
                    old_status: null,
                    status: 'pending_payment',
                    changed_by: testCustomerId,
                    reason: 'Order created - awaiting delivery fee payment'
                },
                {
                    old_status: 'pending_payment',
                    status: 'preparing',
                    changed_by: testGarageId,
                    reason: 'Started preparation'
                },
                {
                    old_status: 'preparing',
                    status: 'ready_for_pickup',
                    changed_by: testGarageId,
                    reason: 'Ready for pickup'
                },
                {
                    old_status: 'ready_for_pickup',
                    status: 'completed',
                    changed_by: testCustomerId,
                    reason: 'Final delivery confirmed'
                }
            ]);
        });
    });

    describe('Error Handling', () => {
        it('should return success: false for updateOrderStatus with non-existent order ID', async () => {
            const result = await updateOrderStatus({
                orderId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
                newStatus: 'completed',
                changedBy: testCustomerId,
                changedByType: 'customer'
            });

            expect(result).toMatchObject({
                success: false,
                payoutCreated: false,
                driverReleased: false,
                error: 'Order not found'
            });
        });

        it('should return ORDER_NOT_FOUND for undoOrder with non-existent order ID', async () => {
            const result = await undoOrder('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', testCustomerId, 'customer');

            expect(result).toMatchObject({
                success: false,
                error: 'ORDER_NOT_FOUND',
                message: 'Order not found'
            });
        });
    });
});
