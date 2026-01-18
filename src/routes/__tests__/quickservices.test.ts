import request from 'supertest';
import app from '../../app';
import pool from '../../config/db';

/**
 * Quick Services API Integration Tests
 * Tests the complete quick service request flow
 */

describe('Quick Services API', () => {
    let authToken: string;
    let customerId: string;

    beforeAll(async () => {
        // Login as test customer
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                phone_number: '+97412345678',
                password: 'test123'
            });

        authToken = loginRes.body.token;
        customerId = loginRes.body.user.user_id;
    });

    afterAll(async () => {
        // Cleanup test data
        await pool.query('DELETE FROM quick_service_requests WHERE customer_id = $1', [customerId]);
    });

    describe('POST /api/services/quick/request', () => {
        it('should create a battery service request', async () => {
            const response = await request(app)
                .post('/api/services/quick/request')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    service_type: 'battery',
                    location_lat: 25.2854,
                    location_lng: 51.5310,
                    location_address: 'Al Sadd, Doha, Qatar',
                    vehicle_make: 'Toyota',
                    vehicle_model: 'Camry',
                    vehicle_year: 2020,
                    notes: 'Battery died this morning'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.request).toHaveProperty('request_id');
            expect(response.body.request.service_type).toBe('battery');
            expect(response.body.request.status).toBe('pending');
        });

        it('should reject invalid service type', async () => {
            const response = await request(app)
                .post('/api/services/quick/request')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    service_type: 'invalid_service',
                    location_lat: 25.2854,
                    location_lng: 51.5310,
                    location_address: 'Al Sadd, Doha'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should reject invalid coordinates', async () => {
            const response = await request(app)
                .post('/api/services/quick/request')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    service_type: 'battery',
                    location_lat: 999, // Invalid
                    location_lng: 51.5310,
                    location_address: 'Al Sadd, Doha'
                });

            expect(response.status).toBe(400);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/services/quick/request')
                .send({
                    service_type: 'battery',
                    location_lat: 25.2854,
                    location_lng: 51.5310,
                    location_address: 'Al Sadd, Doha'
                });

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/services/quick/my-requests', () => {
        let requestId: string;

        beforeEach(async () => {
            // Create a test request
            const response = await request(app)
                .post('/api/services/quick/request')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    service_type: 'oil',
                    location_lat: 25.2854,
                    location_lng: 51.5310,
                    location_address: 'Test Address'
                });

            requestId = response.body.request.request_id;
        });

        it('should retrieve customer requests', async () => {
            const response = await request(app)
                .get('/api/services/quick/my-requests')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.requests).toBeInstanceOf(Array);
            expect(response.body.requests.length).toBeGreaterThan(0);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/api/services/quick/my-requests');

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/services/quick/pricing', () => {
        it('should return pricing for all services', async () => {
            const response = await request(app)
                .get('/api/services/quick/pricing');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.pricing).toHaveProperty('battery');
            expect(response.body.pricing).toHaveProperty('oil');
            expect(response.body.pricing).toHaveProperty('wash');
            expect(response.body.pricing).toHaveProperty('tire');
            expect(response.body.pricing).toHaveProperty('ac');
            expect(response.body.pricing).toHaveProperty('breakdown');
        });

        it('should include price ranges and durations', async () => {
            const response = await request(app)
                .get('/api/services/quick/pricing');

            const batteryPricing = response.body.pricing.battery;
            expect(batteryPricing).toHaveProperty('min');
            expect(batteryPricing).toHaveProperty('max');
            expect(batteryPricing).toHaveProperty('currency', 'QAR');
            expect(batteryPricing).toHaveProperty('duration');
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limits on quick service requests', async () => {
            // Make multiple requests rapidly
            const promises = Array(15).fill(null).map(() =>
                request(app)
                    .post('/api/services/quick/request')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        service_type: 'battery',
                        location_lat: 25.2854,
                        location_lng: 51.5310,
                        location_address: 'Test'
                    })
            );

            const responses = await Promise.all(promises);

            // Some requests should be rate limited (429)
            const rateLimited = responses.filter(r => r.status === 429);
            expect(rateLimited.length).toBeGreaterThan(0);
        }, 30000); // Extended timeout for rate limit tests
    });
});
