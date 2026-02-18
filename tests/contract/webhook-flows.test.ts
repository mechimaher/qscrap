
import request from 'supertest';
import app from '../../src/app';
import { getWritePool } from '../../src/config/db';
import {
    createTestUserData, insertTestUser,
    cleanupTestData, generateTestId
} from '../../src/__tests__/utils/test-utils';
import { generateStripeSignature } from '../utils/webhook-test-helpers';

// Mock Stripe
// We need to mock the Stripe instance construction but allow the webhook payload to pass through
// The actual signature verification happens in the route handler using stripe.webhooks.constructEvent
jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        webhooks: {
            constructEvent: jest.fn((payload, sig, secret) => {
                // In a real mock, we might verify signature here, but for integration testing 
                // we want to verify that the route handler is checking signatures.
                // If signature contains 'invalid_signature', throw error to simulate failure
                if (sig && sig.includes('invalid_signature')) {
                    throw new Error('Invalid signature');
                }
                // Return the payload as the event object
                if (Buffer.isBuffer(payload)) {
                    return JSON.parse(payload.toString());
                }
                return payload;
            })
        },
        paymentIntents: {
            retrieve: jest.fn(() => ({ status: 'succeeded' }))
        }
    }));
});

describe('Webhook Integration Flows', () => {
    let customerUser: any;
    let garageUser: any;
    let orderId: string;
    let pool = getWritePool();
    const webhookSecret = 'wh_test_secret'; // Mock secret

    const testData: {
        orderId?: string,
        garageId?: string,
        customerId?: string
    } = {};

    beforeAll(async () => {
        // Set env var for testing
        process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
        process.env.STRIPE_SECRET_KEY = 'sk_test_key';

        // Setup customer user
        const customerData = createTestUserData({ userType: 'customer' });
        await insertTestUser(customerData);
        customerUser = { userId: customerData.user_id, ...customerData };

        // Setup garage user (garage_id must be a valid user_id due to FK constraint)
        const garageUserData = createTestUserData({ userType: 'garage' });
        await insertTestUser(garageUserData);
        garageUser = { userId: garageUserData.user_id, ...garageUserData };

        // Create garage record (garage_id = user_id due to FK constraint)
        await pool.query(
            `INSERT INTO garages (garage_id, garage_name, approval_status, location_lat, location_lng, phone_number)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (garage_id) DO NOTHING`,
            [garageUser.userId, 'Test Garage LLC', 'approved', 25.276987, 51.520008, garageUserData.phone_number]
        );

        testData.customerId = customerUser.userId;
        testData.garageId = garageUser.userId; // garage_id = user_id
    });

    afterAll(async () => {
        // Cleanup in correct order (child tables first)
        if (testData.orderId) {
            await pool.query('DELETE FROM support_tickets WHERE order_id = $1', [testData.orderId]);
            await pool.query('DELETE FROM payment_intents WHERE order_id = $1', [testData.orderId]);
            await pool.query('DELETE FROM order_status_history WHERE order_id = $1', [testData.orderId]);
            await pool.query('DELETE FROM orders WHERE order_id = $1', [testData.orderId]);
        }
        if (testData.garageId) {
            await pool.query('DELETE FROM garages WHERE garage_id = $1', [testData.garageId]);
        }
        if (testData.customerId) {
            await pool.query('DELETE FROM users WHERE user_id = $1', [testData.customerId]);
        }
        if (garageUser && garageUser.userId) {
            await pool.query('DELETE FROM users WHERE user_id = $1', [garageUser.userId]);
        }
        delete process.env.STRIPE_WEBHOOK_SECRET;
        delete process.env.STRIPE_SECRET_KEY;
    });

    it('should confirm order when payment_intent.succeeded webhook is received', async () => {
        // 1. Create an order in 'pending_payment' status
        // Part Price is required (80)
        const result = await pool.query(`
            INSERT INTO orders 
            (customer_id, garage_id, order_status, deposit_status, payment_method, total_amount, commission_rate, platform_fee, delivery_fee, garage_payout_amount, part_price)
            VALUES ($1, $2, 'pending_payment', 'pending', 'card', 100, 0.1, 10, 10, 80, 80)
            RETURNING order_id
        `, [customerUser.userId, garageUser.garageId]);

        orderId = result.rows[0].order_id;
        testData.orderId = orderId;

        // 2. Create a payment intent record linked to this order
        const providerIntentId = `pi_${Date.now()}`; // Shorter provider ID

        await pool.query(`
            INSERT INTO payment_intents
            (intent_id, order_id, customer_id, amount, currency, status, provider, provider_intent_id, intent_type)
            VALUES (gen_random_uuid(), $1, $2, 100, 'usd', 'pending', 'stripe', $3, 'deposit')
        `, [orderId, customerUser.userId, providerIntentId]);

        // 3. Simulate Stripe Webhook
        const payload = {
            id: 'evt_test_123',
            type: 'payment_intent.succeeded',
            data: {
                object: {
                    id: providerIntentId,
                    amount: 10000,
                    currency: 'qar',
                    metadata: {
                        orderId: orderId,
                        type: 'delivery_fee_deposit'
                    }
                }
            }
        };

        const payloadString = JSON.stringify(payload);
        const signature = generateStripeSignature(payloadString, webhookSecret);

        const response = await request(app)
            .post('/api/stripe/webhook')
            .set('Stripe-Signature', signature)
            .set('Content-Type', 'application/json')
            .send(payload);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ received: true });

        // 4. Verify DB updates
        const orderCheck = await pool.query('SELECT order_status, deposit_status FROM orders WHERE order_id = $1', [orderId]);
        expect(orderCheck.rows[0].order_status).toBe('confirmed');
        expect(orderCheck.rows[0].deposit_status).toBe('paid');

        const intentCheck = await pool.query('SELECT status FROM payment_intents WHERE provider_intent_id = $1', [providerIntentId]);
        expect(intentCheck.rows[0].status).toBe('succeeded');
    });

    it('should reject webhook with invalid signature', async () => {
        const payload = { type: 'payment_intent.succeeded' };
        // We explicitly use 'invalid_signature' in the signature string to trigger the mock's error
        const signature = `t=${Math.floor(Date.now() / 1000)},v1=invalid_signature`;

        const response = await request(app)
            .post('/api/stripe/webhook')
            .set('Stripe-Signature', signature)
            .set('Content-Type', 'application/json')
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.text).toContain('Webhook Error');
    });

    it('should handle payment_intent.payment_failed', async () => {
        const providerIntentId = `pi_fail_${Date.now()}`;
        const intentId = generateTestId();

        // Create intent record
        await pool.query(`
            INSERT INTO payment_intents 
            (intent_id, order_id, customer_id, amount, currency, status, provider, provider_intent_id, intent_type)
            VALUES ($1, $2, $3, 100, 'QAR', 'processing', 'stripe', $4, 'deposit')
        `, [intentId, orderId, customerUser.userId, providerIntentId]);

        const payload = {
            id: 'evt_fail_123',
            type: 'payment_intent.payment_failed',
            data: {
                object: {
                    id: providerIntentId,
                    last_payment_error: { message: 'Insufficient funds' }
                }
            }
        };

        const payloadString = JSON.stringify(payload);
        const signature = generateStripeSignature(payloadString, webhookSecret);

        const response = await request(app)
            .post('/api/stripe/webhook')
            .set('Stripe-Signature', signature)
            .set('Content-Type', 'application/json')
            .send(payload);

        expect(response.status).toBe(200);

        const intentCheck = await pool.query('SELECT status, failure_reason FROM payment_intents WHERE provider_intent_id = $1', [providerIntentId]);
        expect(intentCheck.rows[0].status).toBe('failed');
        expect(intentCheck.rows[0].failure_reason).toBe('Insufficient funds');
    });
});
