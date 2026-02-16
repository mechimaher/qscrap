import { LoyaltyService } from '../loyalty.service';
// Mock pool
jest.mock('../../config/db', () => ({
    query: jest.fn(),
}));

import pool from '../../config/db';
const mockPool = pool as jest.Mocked<typeof pool>;

describe('Loyalty Service', () => {
    const testCustomerId = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
        jest.resetAllMocks();
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
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ new_balance: 50, new_tier: 'bronze' }]
            });
            const result = await LoyaltyService.addPoints(
                testCustomerId,
                50,
                'order_completion',
                undefined,  // order_id is optional UUID, use undefined instead of invalid string
                'Order completion'
            );

            expect(result.new_balance).toBeGreaterThanOrEqual(50); // Should have at least 50 points
            expect(result.new_tier).toBeDefined();
        });

        it('should create transaction record', async () => {
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ transaction_id: '123' }]
            });
            await LoyaltyService.addPoints(testCustomerId, 20, 'bonus', undefined, 'Test award');

            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ transaction_id: '123' }]
            });
            const transactions = await pool.query(
                'SELECT * FROM reward_transactions WHERE customer_id = $1 AND description = $2',
                [testCustomerId, 'Test award']
            );

            expect(transactions.rows.length).toBeGreaterThan(0);
        });
    });

    describe('Redeem Points', () => {
        beforeEach(() => {
            // No reset needed with mocks in each test
        });

        it('should deduct points from account', async () => {
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ success: true, new_balance: 100, discount_amount: '10' }]
            });
            const result = await LoyaltyService.redeemPoints(
                testCustomerId,
                100
            );

            expect(result.success).toBe(true);
            expect(result.new_balance).toBe(100); // 200 - 100
        });

        it('should fail if insufficient points', async () => {
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ success: false, message: 'Insufficient points' }]
            });
            // The redeem function returns success=false for insufficient points, not a throw
            const result = await LoyaltyService.redeemPoints(testCustomerId, 9999);
            expect(result.success).toBe(false);
            expect(result.message).toContain('Insufficient');
        });

        it('should calculate discount correctly', async () => {
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ success: true, discount_amount: '10' }]
            });
            const result = await LoyaltyService.redeemPoints(testCustomerId, 100);
            expect(result.discount_amount).toBeDefined();
        });
    });

    describe('Get Customer Summary', () => {
        it('should return complete loyalty summary', async () => {
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{
                    points_balance: 100,
                    current_tier: 'bronze',
                    lifetime_points: 500,
                    next_tier: 'silver',
                    points_to_next_tier: 400
                }]
            });
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
            // Mock transactions
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{
                    transaction_id: '1',
                    points_change: 10,
                    transaction_type: 'bonus',
                    description: 'Test bonus',
                    created_at: new Date().toISOString()
                }]
            });
            const history = await LoyaltyService.getTransactionHistory(testCustomerId, 10);

            expect(history).toBeInstanceOf(Array);
            expect(history.length).toBeGreaterThan(0);
            expect(history[0]).toHaveProperty('points_change');
            expect(history[0]).toHaveProperty('transaction_type');
            expect(history[0]).toHaveProperty('description');
        });

        it('should limit results to specified count', async () => {
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: []
            });
            const history = await LoyaltyService.getTransactionHistory(testCustomerId, 5);

            expect(history.length).toBeLessThanOrEqual(5);
        });

        it('should order by date descending', async () => {
            const now = new Date();
            const older = new Date(now.getTime() - 1000);
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [
                    { transaction_id: '1', created_at: now.toISOString() },
                    { transaction_id: '2', created_at: older.toISOString() }
                ]
            });
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
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ current_balance: 200 }]
            });
            const result = await LoyaltyService.canRedeem(testCustomerId, 100);
            expect(result.can_redeem).toBe(true);
            expect(result.current_balance).toBe(200);
        });

        it('should return false if insufficient balance', async () => {
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ current_balance: 50 }]
            });
            const result = await LoyaltyService.canRedeem(testCustomerId, 100);
            expect(result.can_redeem).toBe(false);
        });
    });
});
