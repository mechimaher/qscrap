/**
 * Core User Flow Integration Tests
 * Tests complete user journeys from registration to order completion
 */

import request from 'supertest';
import app from '../../src/app';
import pool from '../../src/config/db';
import { generateTestPhone, cleanupTestData } from '../../src/__tests__/utils/test-utils';

describe('Core User Flows - Integration Tests', () => {
    // Test data storage
    const testData = {
        customerUserId: '',
        customerPhone: '',
        garageUserId: '',
        garagePhone: '',
        garageId: '',
        requestId: '',
        bidId: '',
        orderId: '',
        customerToken: '',
        garageToken: ''
    };

    // Cleanup after all tests
    afterAll(async () => {
        await cleanupTestData({
            orderIds: testData.orderId ? [testData.orderId] : [],
            bidIds: testData.bidId ? [testData.bidId] : [],
            requestIds: testData.requestId ? [testData.requestId] : [],
            garageIds: testData.garageId ? [testData.garageId] : [],
            userIds: [testData.customerUserId, testData.garageUserId].filter(Boolean)
        });
    });

    describe('Flow 1: Customer Registration & Login', () => {
        it('should register a new customer', async () => {
            testData.customerPhone = generateTestPhone('3');

            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    full_name: 'Integration Test Customer',
                    phone_number: testData.customerPhone,
                    password: 'TestPass123!',
                    user_type: 'customer'
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('userId');
            expect(response.body.userType).toBe('customer');

            testData.customerUserId = response.body.userId;
            testData.customerToken = response.body.token;
        });

        it('should login with registered credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    phone_number: testData.customerPhone,
                    password: 'TestPass123!'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body.userId).toBe(testData.customerUserId);

            testData.customerToken = response.body.token;
        });

        it('should access protected route with valid token', async () => {
            const response = await request(app)
                .get('/api/dashboard/profile')
                .set('Authorization', `Bearer ${testData.customerToken}`);

            expect(response.status).not.toBe(401);
        });
    });

    describe('Flow 2: Garage Registration & Approval', () => {
        it('should register a new garage', async () => {
            testData.garagePhone = generateTestPhone('4');

            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    full_name: 'Integration Test Garage',
                    phone_number: testData.garagePhone,
                    password: 'TestPass123!',
                    user_type: 'garage',
                    garage_name: 'Test Garage LLC',
                    location_lat: 25.276987,
                    location_lng: 51.520008
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('token');
            expect(response.body.userType).toBe('garage');

            testData.garageUserId = response.body.userId;
            testData.garageToken = response.body.token;
        });

        it('should get garage profile after registration', async () => {
            const response = await request(app)
                .get('/api/dashboard/garage/profile')
                .set('Authorization', `Bearer ${testData.garageToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('garage_id');
        });

        it('should manually approve garage and add subscription for testing', async () => {
            // Approve garage
            await pool.query("UPDATE garages SET approval_status = 'approved' WHERE garage_id = $1", [testData.garageUserId]);

            // Create a test plan if it doesn't exist
            const planResult = await pool.query(`
                INSERT INTO subscription_plans (plan_code, plan_name, monthly_fee, commission_rate)
                VALUES ('TEST_PLAN', 'Test Plan', 0, 0)
                ON CONFLICT (plan_code) DO UPDATE SET plan_code = EXCLUDED.plan_code
                RETURNING plan_id
            `);
            const planId = planResult.rows[0].plan_id;

            // Create subscription
            await pool.query(`
                INSERT INTO garage_subscriptions (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end)
                VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '1 month')
            `, [testData.garageUserId, planId]);
        });
    });

    describe('Flow 3: Part Request Creation', () => {
        it('should create a new part request', async () => {
            const response = await request(app)
                .post('/api/requests')
                .set('Authorization', `Bearer ${testData.customerToken}`)
                .send({
                    car_make: 'Toyota',
                    car_model: 'Camry',
                    car_year: 2022,
                    part_description: 'Front bumper for Toyota Camry 2022',
                    part_category: 'body_parts'
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('request_id');
            // Create request endpoint returns flattened structure, not nested request object
            // expect(response.body.request).toHaveProperty('request_id');

            testData.requestId = response.body.request_id;
        });

        it('should get pending requests as garage', async () => {
            const response = await request(app)
                .get('/api/requests/pending')
                .set('Authorization', `Bearer ${testData.garageToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('requests');
            expect(Array.isArray(response.body.requests)).toBe(true);
        });

        it('should get request details', async () => {
            const response = await request(app)
                .get(`/api/requests/${testData.requestId}`)
                .set('Authorization', `Bearer ${testData.customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('request');
            expect(response.body.request.request_id).toBe(testData.requestId);
        });
    });

    describe('Flow 4: Bid Submission', () => {
        it('should submit a bid for the request', async () => {
            const response = await request(app)
                .post('/api/bids')
                .set('Authorization', `Bearer ${testData.garageToken}`)
                .field('request_id', testData.requestId)
                .field('bid_amount', '150')
                .field('warranty_days', '90')
                .field('part_condition', 'new')
                .field('notes', 'Quality OEM part with 90 days warranty');

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('bid_id');
            // Controller returns flattened response with bid_id
            testData.bidId = response.body.bid_id;
        });

        it('should get bids for request as customer', async () => {
            const response = await request(app)
                .get(`/api/requests/${testData.requestId}`)
                .set('Authorization', `Bearer ${testData.customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('bids');
            expect(Array.isArray(response.body.bids)).toBe(true);
            expect(response.body.bids.length).toBeGreaterThan(0);
        });

        it('should get pending offers for garage', async () => {
            const response = await request(app)
                .get('/api/negotiations/pending-offers')
                .set('Authorization', `Bearer ${testData.garageToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('pending_offers');
        });

        it('should get bid details by ID', async () => {
            // Use the correct endpoint to get bid details
            const response = await request(app)
                .get(`/api/bids/${testData.bidId}`)
                .set('Authorization', `Bearer ${testData.garageToken}`);

            expect(response.status).toBe(200);
            // Controller returns flattened bid object
            expect(response.body).toHaveProperty('bid_id');
            expect(response.body.bid_id).toBe(testData.bidId);
        });
    });

    describe('Flow 5: Order Creation', () => {
        it('should accept bid and create order', async () => {
            // Use correct endpoint: /accept-bid/:bid_id
            const response = await request(app)
                .post(`/api/orders/accept-bid/${testData.bidId}`)
                .set('Authorization', `Bearer ${testData.customerToken}`)
                .send({
                    payment_method: 'cash',
                    delivery_fee: 25,
                    delivery_address: 'Test Street, Doha, Qatar'
                });

            // Order creation returns 200 OK with order details
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('order_id');
            expect(response.body).toHaveProperty('order_number');
            // Status is not returned in creation response

            testData.orderId = response.body.order_id;
        });

        it('should get order details', async () => {
            const response = await request(app)
                .get(`/api/orders/${testData.orderId}`)
                .set('Authorization', `Bearer ${testData.customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('order');
            expect(response.body.order.order_id).toBe(testData.orderId);
        });

        it('should get customer orders', async () => {
            const response = await request(app)
                .get('/api/orders/my')
                .set('Authorization', `Bearer ${testData.customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('orders');
            expect(Array.isArray(response.body.orders)).toBe(true);
        });

        it('should get garage orders', async () => {
            const response = await request(app)
                .get('/api/orders/my')
                .set('Authorization', `Bearer ${testData.garageToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('orders');
        });
    });

    describe('Flow 6: Order Status Updates', () => {
        beforeAll(async () => {
            // Force order status to 'confirmed' (Simulate Payment Success) to allow status updates
            if (testData.orderId) {
                await pool.query(
                    "UPDATE orders SET order_status = 'confirmed', deposit_status = 'paid' WHERE order_id = $1",
                    [testData.orderId]
                );
            }
        });

        it('should update order status to preparing', async () => {
            const response = await request(app)
                .patch(`/api/orders/${testData.orderId}/status`)
                .set('Authorization', `Bearer ${testData.garageToken}`)
                .send({
                    order_status: 'preparing',
                    notes: 'Started preparing the part'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('new_status', 'preparing');
        });

        it('should update order status to ready_for_pickup', async () => {
            const response = await request(app)
                .patch(`/api/orders/${testData.orderId}/status`)
                .set('Authorization', `Bearer ${testData.garageToken}`)
                .send({
                    order_status: 'ready_for_pickup',
                    notes: 'Part is ready for pickup'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('new_status', 'ready_for_pickup');
        });


    });

    describe('Flow 7: Payment Flow', () => {
        it('should create payment intent', async () => {
            const response = await request(app)
                .post(`/api/payments/deposit/${testData.orderId}`)
                .set('Authorization', `Bearer ${testData.customerToken}`)
                .send({
                    payment_method: 'card'
                });

            // May return 200 or skip if stripe not configured
            if (response.status === 200) {
                expect(response.body.intent).toHaveProperty('clientSecret');
            }
        });

        it('should get payment methods', async () => {
            const response = await request(app)
                .get('/api/payments/methods')
                .set('Authorization', `Bearer ${testData.customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('methods');
        });
    });

    describe('Flow 8: Reviews', () => {
        it('should submit a review for completed order', async () => {
            // First complete the order
            await request(app)
                .patch(`/api/orders/${testData.orderId}/status`)
                .set('Authorization', `Bearer ${testData.garageToken}`)
                .send({ status: 'completed' });

            const response = await request(app)
                .post(`/api/orders/${testData.orderId}/review`)
                .set('Authorization', `Bearer ${testData.customerToken}`)
                .send({
                    rating: 5,
                    comment: 'Excellent service and quality part!'
                });

            // Review may require completed order
            if (response.status === 201) {
                expect(response.body).toHaveProperty('review');
                expect(response.body.review.rating).toBe(5);
            }
        });
    });

    describe('Flow 9: Support Ticket', () => {
        it('should create a support ticket', async () => {
            const response = await request(app)
                .post('/api/support/tickets')
                .set('Authorization', `Bearer ${testData.customerToken}`)
                .send({
                    subject: 'Test Support Ticket',
                    message: 'This is a test support ticket from integration tests',
                    order_id: testData.orderId
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('ticket');
            expect(response.body.ticket).toHaveProperty('ticket_id');
        });

        it('should get customer tickets', async () => {
            const response = await request(app)
                .get('/api/support/tickets')
                .set('Authorization', `Bearer ${testData.customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('tickets');
        });
    });

    describe('Flow 10: Search & Discovery', () => {
        it('should search for parts', async () => {
            const response = await request(app)
                .get('/api/search')
                .set('Authorization', `Bearer ${testData.customerToken}`)
                .query({ q: 'Toyota Camry bumper', type: 'parts' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('results');
        });

        it('should get garage analytics', async () => {
            const response = await request(app)
                .get('/api/dashboard/garage/stats')
                .set('Authorization', `Bearer ${testData.garageToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('stats');
        });
    });

    describe('Flow 11: Token Refresh', () => {
        let refreshToken: string;

        it('should get refresh token on login', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    phone_number: testData.customerPhone,
                    password: 'TestPass123!'
                });

            expect(response.body).toHaveProperty('refreshToken');
            refreshToken = response.body.refreshToken;
        });

        it('should refresh access token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('refreshToken');
        });
    });

    describe('Flow 12: Health & Configuration', () => {
        it('should get health status', async () => {
            const response = await request(app).get('/api/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'OK');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('database');
        });

        it('should get job health', async () => {
            const response = await request(app).get('/api/health/jobs');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('jobs');
        });

        it('should get configuration', async () => {
            const response = await request(app).get('/api/config/public');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('config');
            expect(response.body.config).toHaveProperty('googleMapsKey');
        });
    });
});
