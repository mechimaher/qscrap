import request from 'supertest';
import app from '../app';
import pool from '../config/db';
import bcrypt from 'bcryptjs';

/**
 * Authentication API Integration Tests
 * Tests login, registration, and JWT token handling
 */

describe('Authentication API', () => {
    const testPhone = '+97499999999';
    const testPassword = 'TestPass123!';
    let testUserId: string;

    afterAll(async () => {
        // Cleanup test user
        await pool.query('DELETE FROM users WHERE phone = $1', [testPhone]);
    });

    describe('POST /api/auth/register/customer', () => {
        it('should register a new customer', async () => {
            const response = await request(app)
                .post('/api/auth/register/customer')
                .send({
                    full_name: 'Test Customer',
                    phone_number: testPhone,
                    password: testPassword
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toHaveProperty('user_id');
            expect(response.body.user.role).toBe('customer');

            testUserId = response.body.user.user_id;
        });

        it('should reject duplicate phone number', async () => {
            const response = await request(app)
                .post('/api/auth/register/customer')
                .send({
                    full_name: 'Another Customer',
                    phone_number: testPhone,
                    password: 'AnotherPass123'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/auth/register/customer')
                .send({
                    full_name: 'A', // Too short
                    phone_number: '123', // Invalid
                    password: '123' // Too short
                });

            expect(response.status).toBe(400);
        });

        it('should hash password before storing', async () => {
            const user = await pool.query(
                'SELECT password FROM users WHERE phone = $1',
                [testPhone]
            );

            expect(user.rows[0].password).not.toBe(testPassword);
            expect(user.rows[0].password).toMatch(/^\$2[aby]\$/); // bcrypt hash pattern
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login with correct credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    phone_number: testPhone,
                    password: testPassword
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toHaveProperty('user_id');
            expect(response.body.user.phone).toBe(testPhone);
        });

        it('should reject incorrect password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    phone_number: testPhone,
                    password: 'WrongPassword123'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        it('should reject non-existent user', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    phone_number: '+97488888888',
                    password: testPassword
                });

            expect(response.status).toBe(401);
        });

        it('should return valid JWT token', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    phone_number: testPhone,
                    password: testPassword
                });

            const token = response.body.token;
            expect(token).toBeTruthy();
            expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
        });
    });

    describe('JWT Token Validation', () => {
        let validToken: string;

        beforeAll(async () => {
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    phone_number: testPhone,
                    password: testPassword
                });

            validToken = loginRes.body.token;
        });

        it('should accept valid token for protected routes', async () => {
            const response = await request(app)
                .get('/api/profile')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).not.toBe(401);
        });

        it('should reject missing token', async () => {
            const response = await request(app)
                .get('/api/profile');

            expect(response.status).toBe(401);
        });

        it('should reject invalid token format', async () => {
            const response = await request(app)
                .get('/api/profile')
                .set('Authorization', 'Bearer invalidtoken123');

            expect(response.status).toBe(401);
        });

        it('should reject expired token', async () => {
            // This would require mocking time or using a pre-generated expired token
            // Skipping for now, but important for production
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce login rate limits', async () => {
            const promises = Array(10).fill(null).map(() =>
                request(app)
                    .post('/api/auth/login')
                    .send({
                        phone_number: testPhone,
                        password: 'wrong'
                    })
            );

            const responses = await Promise.all(promises);

            // Some should be rate limited
            const rateLimited = responses.filter(r => r.status === 429);
            expect(rateLimited.length).toBeGreaterThan(0);
        }, 30000);
    });

    describe('Password Security', () => {
        it('should require minimum password length', async () => {
            const response = await request(app)
                .post('/api/auth/register/customer')
                .send({
                    full_name: 'Test User',
                    phone_number: '+97477777777',
                    password: '12345' // Too short
                });

            expect(response.status).toBe(400);
        });

        it('should hash passwords with bcrypt', async () => {
            const testUser = await pool.query(
                'SELECT password FROM users WHERE phone = $1',
                [testPhone]
            );

            const isValidHash = await bcrypt.compare(testPassword, testUser.rows[0].password);
            expect(isValidHash).toBe(true);
        });
    });

    describe('Role-Based Access', () => {
        it('should set correct role on registration', async () => {
            const response = await request(app)
                .post('/api/auth/register/customer')
                .send({
                    full_name: 'Role Test',
                    phone_number: '+97466666666',
                    password: testPassword
                });

            expect(response.body.user.role).toBe('customer');

            // Cleanup
            await pool.query('DELETE FROM users WHERE phone = $1', ['+97466666666']);
        });
    });
});
