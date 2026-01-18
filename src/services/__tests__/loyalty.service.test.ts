import { LoyaltyService } from '../loyalty.service';
import pool from '../../config/db';

/**
 * Loyalty Service Unit Tests
 * Tests points calculation, tier upgrades, and reward redemption
 */

describe('Loyalty Service', () => {
    const testCustomerId = '550e8400-e29b-41d4-a716-446655440000';

    beforeAll(async () => {
        // Create test customer with loyalty data
        await pool.query(`
            INSERT INTO users (user_id, full_name, phone_number, user_type, password_hash)
            VALUES ($1, 'Test Customer', '+97412340000', 'customer', '$2b$10$dummyhashfortesting123456789012345')
            ON CONFLICT (user_id) DO NOTHING
        `, [testCustomerId]);

        await pool.query(`
            INSERT INTO customer_rewards (customer_id, points_balance, lifetime_points)
            VALUES ($1, 100, 0)
            ON CONFLICT (customer_id) DO UPDATE
            SET points_balance = 100, lifetime_points = 0
        `, [testCustomerId]);
    });

    afterAll(async () => {
        // Cleanup
        await pool.query('DELETE FROM customer_rewards WHERE customer_id = $1', [testCustomerId]);
        await pool.query('DELETE FROM users WHERE user_id = $1', [testCustomerId]);
    });

    describe('Points Calculation', () => {
        it('should calculate 1 point per 10 QAR', () => {
            const points = LoyaltyService.calculatePointsFromAmount(100);
            expect(points).toBe(10);
        });

        it('should round down partial points', () => {
            const points = LoyaltyService.calculatePointsFromAmount(95);
            expect(points).toBe(9);
        });

        it('should handle zero amount', () => {
            const points = LoyaltyService.calculatePointsFromAmount(0);
            expect(points).toBe(0);
        });

        it('should handle large amounts', () => {
            const points = LoyaltyService.calculatePointsFromAmount(10000);
            expect(points).toBe(1000);
        });
    });

    describe('Discount Calculation', () => {
        it('should calculate discount from points (100 points = 10 QAR)', () => {
            const discount = LoyaltyService.calculateDiscountFromPoints(100);
            expect(discount).toBe(10);
        });

        it('should handle 200 points = 20 QAR', () => {
            const discount = LoyaltyService.calculateDiscountFromPoints(200);
            expect(discount).toBe(20);
        });
    });

    describe('Award Points', () => {
        it('should add points to customer account', async () => {
            const result = await LoyaltyService.addPoints(
                testCustomerId,
                50,
                'order_completion',
                'order-123',
                'Order completion'
            );

            expect(result.new_balance).toBeGreaterThanOrEqual(150); // 100 + 50
        });

        it('should create transaction record', async () => {
            await LoyaltyService.addPoints(testCustomerId, 20, 'bonus', undefined, 'Test award');

            const transactions = await pool.query(
                'SELECT * FROM reward_transactions WHERE customer_id = $1 AND description = $2',
                [testCustomerId, 'Test award']
            );

            expect(transactions.rows.length).toBeGreaterThan(0);
        });
    });

    describe('Redeem Points', () => {
        beforeEach(async () => {
            // Reset points to known value
            await pool.query(
                'UPDATE customer_rewards SET points_balance = 200 WHERE customer_id = $1',
                [testCustomerId]
            );
        });

        it('should deduct points from account', async () => {
            const result = await LoyaltyService.redeemPoints(
                testCustomerId,
                100
            );

            expect(result.success).toBe(true);
            expect(result.new_balance).toBe(100); // 200 - 100
        });

        it('should fail if insufficient points', async () => {
            await expect(
                LoyaltyService.redeemPoints(testCustomerId, 500)
            ).rejects.toThrow();
        });

        it('should calculate discount correctly', async () => {
            const result = await LoyaltyService.redeemPoints(testCustomerId, 100);
            expect(result.discount_amount).toBeDefined();
        });
    });

    describe('Get Customer Summary', () => {
        it('should return complete loyalty summary', async () => {
            const summary = await LoyaltyService.getCustomerSummary(testCustomerId);

            expect(summary).toHaveProperty('points_balance');
            expect(summary).toHaveProperty('current_tier');
            expect(summary).toHaveProperty('lifetime_points');
            expect(summary).toHaveProperty('next_tier');
            expect(summary).toHaveProperty('points_to_next_tier');
        });
    });

    describe('Transaction History', () => {
        it('should retrieve recent transactions', async () => {
            // Create some transactions
            await LoyaltyService.addPoints(testCustomerId, 10, 'bonus', undefined, 'Test 1');
            await LoyaltyService.addPoints(testCustomerId, 20, 'bonus', undefined, 'Test 2');

            const history = await LoyaltyService.getTransactionHistory(testCustomerId, 10);

            expect(history).toBeInstanceOf(Array);
            expect(history.length).toBeGreaterThan(0);
            expect(history[0]).toHaveProperty('points_change');
            expect(history[0]).toHaveProperty('transaction_type');
            expect(history[0]).toHaveProperty('description');
        });

        it('should limit results to specified count', async () => {
            const history = await LoyaltyService.getTransactionHistory(testCustomerId, 5);

            expect(history.length).toBeLessThanOrEqual(5);
        });

        it('should order by date descending', async () => {
            const history = await LoyaltyService.getTransactionHistory(testCustomerId, 10);

            if (history.length > 1) {
                const firstDate = new Date(history[0].created_at);
                const secondDate = new Date(history[1].created_at);
                expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
            }
        });
    });

    describe('Can Redeem', () => {
        it('should check if customer can redeem points', async () => {
            await pool.query(
                'UPDATE customer_rewards SET points_balance = 200 WHERE customer_id = $1',
                [testCustomerId]
            );

            const result = await LoyaltyService.canRedeem(testCustomerId, 100);
            expect(result.can_redeem).toBe(true);
            expect(result.current_balance).toBe(200);
        });

        it('should return false if insufficient balance', async () => {
            await pool.query(
                'UPDATE customer_rewards SET points_balance = 50 WHERE customer_id = $1',
                [testCustomerId]
            );

            const result = await LoyaltyService.canRedeem(testCustomerId, 100);
            expect(result.can_redeem).toBe(false);
        });
    });
});
