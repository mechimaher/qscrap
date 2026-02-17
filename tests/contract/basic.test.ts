import request from 'supertest';
import app from '../../src/app';

/**
 * Base Contract Test Setup
 * Verifies critical API endpoints return JSON structure matching expectations
 */

describe('Contract Testing - Public Endpoints', () => {

    // 1. Health Check
    it('GET /api/health should return valid health status', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status', 'OK');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('database'); // New field
        expect(res.body).toHaveProperty('uptime');
    });

    // 2. Swagger Docs
    it('GET /api/docs.json should return valid OpenAPI spec', async () => {
        const res = await request(app).get('/api/docs.json');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('openapi', '3.0.0');
        expect(res.body).toHaveProperty('info');
        expect(res.body).toHaveProperty('paths');
        // Verify we have paths (should be > 200 based on our generation)
        expect(Object.keys(res.body.paths).length).toBeGreaterThan(200);
    });
});

describe('Contract Testing - Authentication Schema', () => {
    // 3. Invalid Login (Schema Verification)
    it('POST /api/auth/login with invalid data should return standard error schema', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ phone: '00000000', password: 'wrong' });

        expect([400, 401]).toContain(res.status);

        // Error validation
        expect(res.body).toHaveProperty('error');
    });

    // 4. Registration Validation (Schema Verification)
    it('POST /api/auth/register with missing data should return validation errors', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({});

        expect(res.status).toBe(400);
        // Expect validation error format
        expect(res.body).toHaveProperty('error');
    });
});
