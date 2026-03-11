import request from 'supertest';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
process.env.NODE_ENV = 'test';

import app from '../app';
import pool from '../config/db';
import { EscrowService } from '../services/escrow.service';
import { createUser, createGarage, createOrder, resetEscrowFixtures } from './helpers/testDb';

const authHeader = (userId: string, userType: string) => ({
    Authorization: `Bearer test-${userId}-${userType}`
});

describe('Escrow Routes', () => {
    const escrowService = new EscrowService(pool);
    let escrowId: string;
    let orderId: string;
    const customerId = '11111111-1111-1111-1111-111111111111';
    const garageId = '22222222-2222-2222-2222-222222222222';

    beforeAll(async () => {
        await pool.query(`
            INSERT INTO users (user_id, phone_number, password_hash, user_type, full_name)
            VALUES ($1, '5551', 'x', 'customer', 'Test Customer')
            ON CONFLICT (user_id) DO NOTHING;
        `, [customerId]);
        await pool.query(`
            INSERT INTO users (user_id, phone_number, password_hash, user_type, full_name)
            VALUES ($1, '5552', 'x', 'garage', 'Test Garage')
            ON CONFLICT (user_id) DO NOTHING;
        `, [garageId]);

        await pool.query(`
            INSERT INTO garages (garage_id, garage_name, phone_number)
            VALUES ($1, 'Test Garage', '5552')
            ON CONFLICT (garage_id) DO NOTHING;
        `, [garageId]);

        // Minimal order row to satisfy FK
        orderId = '33333333-3333-3333-3333-333333333333';
        await pool.query(`
            INSERT INTO orders (
                order_id, order_number, customer_id, garage_id, part_price, commission_rate,
                platform_fee, delivery_fee, total_amount, garage_payout_amount, payment_method,
                payment_status, order_status
            )
            VALUES ($1, 'TEST-001', $2, $3, 90, 0.10, 9, 10, 109, 90, 'card', 'paid', 'confirmed')
            ON CONFLICT (order_id) DO NOTHING;
        `, [orderId, customerId, garageId]);

        await createUser(customerId, 'customer', '5551');
        await createUser(garageId, 'garage', '5552');
        await createGarage(garageId, 'Test Garage', '5552');

        orderId = '33333333-3333-3333-3333-333333333333';
        await createOrder({
            orderId,
            customerId,
            garageId,
            total: 109,
            deliveryFee: 10,
        });

        const escrow = await escrowService.createEscrow({
            orderId,
            customerId,
            sellerId: garageId,
            amount: 109,
            platformFeePercent: 10,
            deliveryFee: 10,
            inspectionWindowHours: 48,
        });
        escrowId = escrow.escrow_id;
    });

    afterAll(async () => {
        await resetEscrowFixtures(orderId, [customerId, garageId]);
        await pool.end();
    });

    it('returns escrow for order when customer is authorized', async () => {
        const res = await request(app)
            .get(`/api/v1/escrow/order/${orderId}`)
            .set(authHeader(customerId, 'customer'));
        // debug
        // eslint-disable-next-line no-console
        console.log('get escrow status', res.status, res.body);
        expect(res.status).toBe(200);
        expect(res.body.escrow_id).toBe(escrowId);
        expect(res.body.status).toBe('held');
    });

    it('forbids access when user is not part of the order', async () => {
        const res = await request(app)
            .get(`/api/v1/escrow/order/${orderId}`)
            .set(authHeader('someone-else', 'customer'));
        console.log('unauth get', res.status, res.body);
        expect(res.status).toBe(403);
    });

    it('raises dispute for customer', async () => {
        const res = await request(app)
            .post(`/api/v1/escrow/${escrowId}/dispute`)
            .send({ reason: 'defective' })
            .set(authHeader(customerId, 'customer'));
        console.log('dispute', res.status, res.body);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('disputed');
    });

    it('forbids dispute for garage role', async () => {
        const res = await request(app)
            .post(`/api/v1/escrow/${escrowId}/dispute`)
            .send({ reason: 'defective' })
            .set(authHeader(garageId, 'garage'));
        expect(res.status).toBe(403);
    });
});
