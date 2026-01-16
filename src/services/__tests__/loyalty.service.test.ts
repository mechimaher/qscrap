import { loyaltyService } from '../loyalty.service';
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
            INSERT INTO users (user_id, full_name, phone, role)
            VALUES ($1, 'Test Customer', '+97412340000', 'customer')
            ON CONFLICT (user_id) DO NOTHING
        `, [testCustomerId]);

        await pool.query(`
            INSERT INTO customer_loyalty (customer_id, points, current_tier, lifetime_spent)
            VALUES ($1, 100, 'bronze', 500)
            ON CONFLICT (customer_id) DO UPDATE
            SET points = 100, current_tier = 'bronze', lifetime_spent = 500
        `, [testCustomerId]);
    });

    afterAll(async () => {
        // Cleanup
        await pool.query('DELETE FROM customer_loyalty WHERE customer_id = $1', [testCustomerId]);
        await pool.query('DELETE FROM users WHERE user_id = $1', [testCustomerId]);
    });

    describe('Points Calculation', () => {
        it('should calculate 1 point per 10 QAR', () => {
            const points = loyaltyService.calculatePoints(100);
            expect(points).toBe(10);
        });

        it('should round down partial points', () => {
            const points = loyaltyService.calculatePoints(95);
            expect(points).toBe(9);
        });

        it('should handle zero amount', () => {
            const points = loyaltyService.calculatePoints(0);
            expect(points).toBe(0);
        });

        it('should handle large amounts', () => {
            const points = loyaltyService.calculatePoints(10000);
            expect(points).toBe(1000);
        });
    });

    describe('Tier Determination', () => {
        it('should return bronze for 0-999 QAR', () => {
            const tier = loyaltyService.getTierBySpending(500);
            expect(tier).toBe('bronze');
        });

        it('should return silver for 1000-4999 QAR', () => {
            const tier = loyaltyService.getTierBySpending(2500);
            expect(tier).toBe('silver');
        });

        it('should return gold for 5000-9999 QAR', () => {
            const tier = loyaltyService.getTierBySpending(7500);
            expect(tier).toBe('gold');
        });

        it('should return platinum for 10000+ QAR', () => {
            const tier = loyaltyService.getTierBySpending(15000);
            expect(tier).toBe('platinum');
        });

        it('should handle edge cases', () => {
            expect(loyaltyService.getTierBySpending(999)).toBe('bronze');
            expect(loyaltyService.getTierBySpending(1000)).toBe('silver');
            expect(loyaltyService.getTierBySpending(4999)).toBe('silver');
            expect(loyaltyService.getTierBySpending(5000)).toBe('gold');
        });
    });

    describe('Award Points', () => {
        it('should add points to customer account', async () => {
            const result = await loyaltyService.awardPoints(
                testCustomerId,
                50,
                'order-123',
                'Order completion'
            );

            expect(result.success).toBe(true);
            expect(result.new_balance).toBeGreaterThanOrEqual(150); // 100 + 50
        });

        it('should create transaction record', async () => {
            await loyaltyService.awardPoints(testCustomerId, 20, 'test-ref', 'Test award');

            const transactions = await pool.query(
                'SELECT * FROM loyalty_transactions WHERE customer_id = $1 AND reference_id = $2',
                [testCustomerId, 'test-ref']
            );

            expect(transactions.rows.length).toBe(1);
            expect(transactions.rows[0].points).toBe(20);
            expect(transactions.rows[0].type).toBe('earn');
        });
    });

    describe('Redeem Points', () => {
        beforeEach(async () => {
            // Reset points to known value
            await pool.query(
                'UPDATE customer_loyalty SET points = 200 WHERE customer_id = $1',
                [testCustomerId]
            );
        });

        it('should deduct points from account', async () => {
            const result = await loyaltyService.redeemPoints(
                testCustomerId,
                100,
                'reward-123',
                'Reward redemption'
            );

            expect(result.success).toBe(true);
            expect(result.new_balance).toBe(100); // 200 - 100
        });

        it('should fail if insufficient points', async () => {
            await expect(
                loyaltyService.redeemPoints(testCustomerId, 500, 'reward-456', 'Test')
            ).rejects.toThrow();
        });

        it('should create deduction transaction', async () => {
            await loyaltyService.redeemPoints(testCustomerId, 50, 'redeem-ref', 'Test');

            const transactions = await pool.query(
                'SELECT * FROM loyalty_transactions WHERE customer_id = $1 AND reference_id = $2',
                [testCustomerId, 'redeem-ref']
            );

            expect(transactions.rows.length).toBe(1);
            expect(transactions.rows[0].points).toBe(-50);
            expect(transactions.rows[0].type).toBe('redeem');
        });
    });

    describe('Tier Upgrade Detection', () => {
        it('should upgrade from bronze to silver at 1000 QAR', async () => {
            await pool.query(
                'UPDATE customer_loyalty SET lifetime_spent = 900 WHERE customer_id = $1',
                [testCustomerId]
            );

            const upgrade = await loyaltyService.checkAndUpgradeTier(testCustomerId, 200);

            expect(upgrade.upgraded).toBe(true);
            expect(upgrade.old_tier).toBe('bronze');
            expect(upgrade.new_tier).toBe('silver');
        });

        it('should not upgrade if threshold not met', async () => {
            await pool.query(
                'UPDATE customer_loyalty SET lifetime_spent = 900 WHERE customer_id = $1',
                [testCustomerId]
            );

            const upgrade = await loyaltyService.checkAndUpgradeTier(testCustomerId, 50);

            expect(upgrade.upgraded).toBe(false);
        });
    });

    describe('Get Customer Summary', () => {
        it('should return complete loyalty summary', async () => {
            const summary = await loyaltyService.getSummary(testCustomerId);

            expect(summary).toHaveProperty('points');
            expect(summary).toHaveProperty('current_tier');
            expect(summary).toHaveProperty('lifetime_spent');
            expect(summary).toHaveProperty('next_tier');
            expect(summary).toHaveProperty('points_to_next_tier');
        });

        it('should calculate points to next tier correctly', async () => {
            await pool.query(
                'UPDATE customer_loyalty SET lifetime_spent = 800 WHERE customer_id = $1',
                [testCustomerId]
            );

            const summary = await loyaltyService.getSummary(testCustomerId);

            expect(summary.current_tier).toBe('bronze');
            expect(summary.next_tier).toBe('silver');
            expect(summary.points_to_next_tier).toBe(200); // 1000 - 800
        });
    });

    describe('Transaction History', () => {
        it('should retrieve recent transactions', async () => {
            // Create some transactions
            await loyaltyService.awardPoints(testCustomerId, 10, 'tx1', 'Test 1');
            await loyaltyService.awardPoints(testCustomerId, 20, 'tx2', 'Test 2');

            const history = await loyaltyService.getTransactions(testCustomerId, 10);

            expect(history).toBeInstanceOf(Array);
            expect(history.length).toBeGreaterThan(0);
            expect(history[0]).toHaveProperty('points');
            expect(history[0]).toHaveProperty('type');
            expect(history[0]).toHaveProperty('description');
        });

        it('should limit results to specified count', async () => {
            const history = await loyaltyService.getTransactions(testCustomerId, 5);

            expect(history.length).toBeLessThanOrEqual(5);
        });

        it('should order by date descending', async () => {
            const history = await loyaltyService.getTransactions(testCustomerId, 10);

            if (history.length > 1) {
                const firstDate = new Date(history[0].created_at);
                const secondDate = new Date(history[1].created_at);
                expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
            }
        });
    });
});
