import request from 'supertest';
import app from '../../app';
import pool from '../../config/db';
import bcrypt from 'bcryptjs';

/**
 * Authentication API Integration Tests
 * Tests login, registration, and JWT token handling
 * Updated to match current API response format
 */

describe('Authentication API', () => {
    const testPhone = '+97433334444'; // Valid Qatar format: +974 + 8 digits
    const testPassword = 'TestPass123!';
    let testUserId: string;

    afterAll(async () => {
        // Cleanup test user
        await pool.query('DELETE FROM users WHERE phone_number = $1', [testPhone]);
        await pool.query('DELETE FROM users WHERE phone_number = $1', ['+97444445555']);
    });

    describe('POST /api/auth/register', () => {
        it('should register a new customer', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    full_name: 'Test Customer',
                    phone_number: testPhone,
                    password: testPassword,
                    user_type: 'customer'
                });

            if (response.status !== 201) {
                console.log('Registration error:', response.body);
            }

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('userId');
            expect(response.body.userType).toBe('customer');

            testUserId = response.body.userId;
        });

        it('should reject duplicate phone number', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    full_name: 'Another Customer',
                    phone_number: testPhone,
                    password: 'AnotherPass123',
                    user_type: 'customer'
                });

            expect(response.status).toBe(400);
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    full_name: 'Test User',
                    phone_number: '123', // Invalid
                    password: '123', // Too short
                    user_type: 'customer'
                });

            expect(response.status).toBe(400);
        });

        it('should hash password before storing', async () => {
            const user = await pool.query(
                'SELECT password_hash FROM users WHERE phone_number = $1',
                [testPhone]
            );

            expect(user.rows.length).toBeGreaterThan(0);
            expect(user.rows[0].password_hash).not.toBe(testPassword);
            expect(user.rows[0].password_hash).toMatch(/^\$2[aby]\$/); // bcrypt hash pattern
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
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('userId');
            expect(response.body.userType).toBe('customer');
        });

        it('should reject incorrect password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    phone_number: testPhone,
                    password: 'WrongPassword123'
                });

            expect(response.status).toBe(401);
        });

        it('should reject non-existent user', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    phone_number: '+97455556666',
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
                .get('/api/dashboard/profile')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).not.toBe(401);
        });

        it('should reject missing token', async () => {
            const response = await request(app)
                .get('/api/dashboard/profile');

            expect(response.status).toBe(401);
        });

        it('should reject invalid token format', async () => {
            const response = await request(app)
                .get('/api/dashboard/profile')
                .set('Authorization', 'Bearer invalidtoken123');

            expect(response.status).toBe(401);
        });
    });

    describe('Password Security', () => {
        it('should require minimum password length', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    full_name: 'Test User',
                    phone_number: '+97366667777',
                    password: '123', // Too short (less than 4)
                    user_type: 'customer'
                });

            expect(response.status).toBe(400);
        });

        it('should hash passwords with bcrypt', async () => {
            const testUser = await pool.query(
                'SELECT password_hash FROM users WHERE phone_number = $1',
                [testPhone]
            );

            expect(testUser.rows.length).toBeGreaterThan(0);
            const isValidHash = await bcrypt.compare(testPassword, testUser.rows[0].password_hash);
            expect(isValidHash).toBe(true);
        });
    });

    describe('Role-Based Access', () => {
        it('should set correct role on registration', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    full_name: 'Role Test',
                    phone_number: '+97444445555',
                    password: testPassword,
                    user_type: 'customer'
                });

            expect(response.status).toBe(201);
            expect(response.body.userType).toBe('customer');
        });
    });
});
