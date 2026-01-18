import pool from '../../config/db';
import {
    createOrderFromBid,
    updateOrderStatus,
    getOrderWithDetails,
    getOrderHistory,
    CreateOrderParams,
    OrderStatusUpdate
} from '../order.service';

/**
 * Order Service Unit Tests
 * Tests order creation, status transitions, and queries
 */

describe('Order Service', () => {
    // Test IDs - use valid UUIDs that won't conflict with real data
    const testCustomerId = '11111111-1111-1111-1111-111111111111';
    const testGarageId = '22222222-2222-2222-2222-222222222222';
    const testRequestId = '33333333-3333-3333-3333-333333333333';
    const testBidId = '44444444-4444-4444-4444-444444444444';
    let createdOrderId: string | null = null;

    beforeAll(async () => {
        // Setup test data in correct order (respecting FK constraints)

        // 1. Create test customer user
        await pool.query(`
            INSERT INTO users (user_id, full_name, phone_number, user_type, password_hash)
            VALUES ($1, 'Test Customer', '+97430000001', 'customer', '$2b$10$dummyhashfortesting123456789012345')
            ON CONFLICT (user_id) DO NOTHING
        `, [testCustomerId]);

        // 2. Create test garage user
        await pool.query(`
            INSERT INTO users (user_id, full_name, phone_number, user_type, password_hash)
            VALUES ($1, 'Test Garage', '+97430000002', 'garage', '$2b$10$dummyhashfortesting123456789012345')
            ON CONFLICT (user_id) DO NOTHING
        `, [testGarageId]);

        // 3. Create test garage
        await pool.query(`
            INSERT INTO garages (garage_id, garage_name, approval_status, location_lat, location_lng)
            VALUES ($1, 'Test Garage LLC', 'approved', 25.276987, 51.520008)
            ON CONFLICT (garage_id) DO NOTHING
        `, [testGarageId]);

        // 3.5. Create test garage subscription (required for bidding)
        // Delete any existing subscription first, then insert
        await pool.query('DELETE FROM garage_subscriptions WHERE garage_id = $1', [testGarageId]);
        await pool.query(`
            INSERT INTO garage_subscriptions (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end)
            VALUES ($1, '1af9e120-e679-43d5-9c47-895ceadfe48e', 'active', NOW(), NOW() + INTERVAL '30 days')
        `, [testGarageId]);

        // 4. Create test part request
        await pool.query(`
            INSERT INTO part_requests (request_id, customer_id, car_make, car_model, car_year, part_description, status)
            VALUES ($1, $2, 'Toyota', 'Camry', 2022, 'Test Part', 'active')
            ON CONFLICT (request_id) DO NOTHING
        `, [testRequestId, testCustomerId]);

        // 5. Create test bid
        await pool.query(`
            INSERT INTO bids (bid_id, request_id, garage_id, bid_amount, status, part_condition)
            VALUES ($1, $2, $3, 150.00, 'pending', 'new')
            ON CONFLICT (bid_id) DO NOTHING
        `, [testBidId, testRequestId, testGarageId]);
    });

    afterAll(async () => {
        // Cleanup in reverse order of creation
        if (createdOrderId) {
            await pool.query('DELETE FROM order_status_history WHERE order_id = $1', [createdOrderId]);
            await pool.query('DELETE FROM orders WHERE order_id = $1', [createdOrderId]);
        }
        await pool.query('DELETE FROM bids WHERE bid_id = $1', [testBidId]);
        await pool.query('DELETE FROM part_requests WHERE request_id = $1', [testRequestId]);
        await pool.query('DELETE FROM garages WHERE garage_id = $1', [testGarageId]);
        await pool.query('DELETE FROM users WHERE user_id IN ($1, $2)', [testCustomerId, testGarageId]);
    });

    describe('createOrderFromBid', () => {
        it('should create an order from a valid bid', async () => {
            const params: CreateOrderParams = {
                bidId: testBidId,
                customerId: testCustomerId,
                paymentMethod: 'cash',
                deliveryFee: 25.00,
                deliveryZoneId: null,
                deliveryAddress: 'Test Address, Doha, Qatar'
            };

            const result = await createOrderFromBid(params);

            expect(result).toHaveProperty('order');
            expect(result).toHaveProperty('totalAmount');
            expect(result.order).toHaveProperty('order_id');
            expect(result.order).toHaveProperty('order_number');
            expect(result.totalAmount).toBe(175.00); // 150 part + 25 delivery

            createdOrderId = result.order.order_id;
        });

        it('should reject duplicate bid acceptance', async () => {
            // The bid was already accepted in the previous test
            const params: CreateOrderParams = {
                bidId: testBidId,
                customerId: testCustomerId,
                paymentMethod: 'cash',
                deliveryFee: 25.00,
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

            const history = await getOrderHistory(createdOrderId);

            expect(history).toBeInstanceOf(Array);
            expect(history.length).toBeGreaterThan(0);
            expect(history[history.length - 1]).toHaveProperty('status', 'preparing');
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
            const order = await getOrderWithDetails('non-existent-order-id');
            expect(order).toBeNull();
        });
    });

    describe('Order Status Transitions', () => {
        it('should allow full lifecycle: preparing -> ready -> completed', async () => {
            if (!createdOrderId) {
                throw new Error('No order created for lifecycle test');
            }

            // Already at 'preparing', move to 'ready_for_pickup'
            const readyResult = await updateOrderStatus({
                orderId: createdOrderId,
                newStatus: 'ready_for_pickup',
                changedBy: testGarageId,
                changedByType: 'garage'
            });
            expect(readyResult.success).toBe(true);

            // Complete the order
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
    });
});
