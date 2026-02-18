/**
 * Subscription Service Tests
 * Tests for subscription.service.ts
 */

import pool from '../../config/db';
import { SubscriptionService } from '../subscription.service';

// Mock database pool
jest.mock('../../config/db');
const mockPool = pool as jest.Mocked<typeof pool>;

describe('Subscription Service', () => {
    const testGarageId = 'test-garage-id';
    const testPlanId = 'test-plan-id';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAvailablePlans', () => {
        const mockPlans = [
            {
                plan_id: 'starter-plan',
                plan_code: 'starter',
                plan_name: 'Starter Plan',
                monthly_price_qar: '99',
                annual_price_qar: '990',
                max_monthly_orders: 10,
                analytics_enabled: false,
                priority_support: false,
                api_access: true,
                ad_campaigns_allowed: false,
                max_team_members: 3,
                features_json: JSON.stringify(['Basic features', '10 bids/month'])
            },
            {
                plan_id: 'pro-plan',
                plan_code: 'pro',
                plan_name: 'Pro Plan',
                monthly_price_qar: '199',
                annual_price_qar: '1990',
                max_monthly_orders: 100,
                analytics_enabled: true,
                priority_support: false,
                api_access: true,
                ad_campaigns_allowed: true,
                max_team_members: 10,
                features_json: JSON.stringify(['All features', 'Unlimited bids'])
            }
        ];

        it('should return available subscription plans', async () => {
            (mockPool.query as jest.Mock).mockResolvedValue({ rows: mockPlans });

            const plans = await SubscriptionService.getAvailablePlans();

            expect(plans).toHaveLength(2);
            expect(plans[0]).toHaveProperty('plan_code', 'starter');
            expect(plans[1]).toHaveProperty('plan_code', 'pro');
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
            );
        });

        it('should handle empty plans list', async () => {
            (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

            const plans = await SubscriptionService.getAvailablePlans();

            expect(plans).toHaveLength(0);
        });

        it('should throw error on database failure', async () => {
            (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

            await expect(SubscriptionService.getAvailablePlans())
                .rejects.toThrow('Failed to fetch subscription plans');
        });
    });

    describe('getGarageSubscription', () => {
        const mockSubscription = {
            current_plan: 'starter',
            plan_name: 'Starter Plan',
            monthly_price: '99',
            annual_price: '990',
            billing_cycle: 'monthly',
            start_date: '2026-01-01',
            end_date: '2026-02-01',
            days_remaining: 14,
            analytics_enabled: false,
            priority_support: false,
            api_access: true,
            ad_campaigns_allowed: false,
            max_team_members: 3,
            features: ['Basic features']
        };

        it('should return active subscription for garage', async () => {
            (mockPool.query as jest.Mock).mockResolvedValue({ rows: [mockSubscription] });

            const subscription = await SubscriptionService.getGarageSubscription(testGarageId);

            expect(subscription).toBeDefined();
            expect(subscription?.current_plan).toBe('starter');
            expect(subscription?.plan_name).toBe('Starter Plan');
        });

        it('should return null for garage without subscription', async () => {
            (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

            const subscription = await SubscriptionService.getGarageSubscription(testGarageId);

            expect(subscription).toBeNull();
        });

        it('should throw error on database failure', async () => {
            (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

            await expect(SubscriptionService.getGarageSubscription(testGarageId))
                .rejects.toThrow('Failed to fetch subscription details');
        });

        it('should return subscription with plan details', async () => {
            (mockPool.query as jest.Mock).mockResolvedValue({ rows: [mockSubscription] });

            const subscription = await SubscriptionService.getGarageSubscription(testGarageId);

            expect(subscription).toHaveProperty('monthly_price', '99');
            expect(subscription).toHaveProperty('days_remaining', 14);
        });
    });

    describe('checkFeatureAccess', () => {
        it('should return true for feature access', async () => {
            (mockPool.query as jest.Mock).mockResolvedValue({
                rows: [{ has_access: true }]
            });

            const hasAccess = await SubscriptionService.checkFeatureAccess(testGarageId, 'analytics');

            expect(hasAccess).toBe(true);
        });

        it('should return false for no feature access', async () => {
            (mockPool.query as jest.Mock).mockResolvedValue({
                rows: [{ has_access: false }]
            });

            const hasAccess = await SubscriptionService.checkFeatureAccess(testGarageId, 'premium_feature');

            expect(hasAccess).toBe(false);
        });

        it('should return false on database error', async () => {
            (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

            const hasAccess = await SubscriptionService.checkFeatureAccess(testGarageId, 'analytics');

            expect(hasAccess).toBe(false);
        });
    });

    describe('changeSubscription', () => {
        const mockResult = {
            success: true,
            message: 'Subscription changed successfully',
            price: '199'
        };

        it('should change subscription successfully', async () => {
            (mockPool.query as jest.Mock).mockResolvedValue({ rows: [mockResult] });

            const result = await SubscriptionService.changeSubscription(
                testGarageId,
                'pro',
                'monthly',
                'admin-user'
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('Subscription changed');
        });

        it('should handle database errors', async () => {
            (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

            await expect(
                SubscriptionService.changeSubscription(testGarageId, 'pro', 'monthly', 'admin-user')
            ).rejects.toThrow('Failed to change subscription');
        });
    });

    describe('getSubscriptionHistory', () => {
        const mockHistory = [
            {
                old_plan: 'starter',
                new_plan: 'pro',
                created_at: new Date()
            }
        ];

        it('should get subscription history', async () => {
            (mockPool.query as jest.Mock).mockResolvedValue({ rows: mockHistory });

            const history = await SubscriptionService.getSubscriptionHistory(testGarageId);

            expect(history).toHaveLength(1);
            expect(history[0]).toHaveProperty('old_plan', 'starter');
        });

        it('should throw error on database failure', async () => {
            (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

            await expect(SubscriptionService.getSubscriptionHistory(testGarageId))
                .rejects.toThrow('Failed to fetch subscription history');
        });
    });

    describe('getRevenueStats', () => {
        const mockStats = [
            {
                total_revenue: '10000',
                active_subscriptions: 50
            }
        ];

        it('should get revenue stats', async () => {
            (mockPool.query as jest.Mock).mockResolvedValue({ rows: mockStats });

            const stats = await SubscriptionService.getRevenueStats();

            expect(stats).toHaveLength(1);
            expect(stats[0]).toHaveProperty('total_revenue', '10000');
        });

        it('should throw error on database failure', async () => {
            (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

            await expect(SubscriptionService.getRevenueStats())
                .rejects.toThrow('Failed to fetch revenue stats');
        });
    });

    describe('calculatePriceDifference', () => {
        const mockPrices = {
            rows: [{
                current_price: '99',
                new_price: '199'
            }]
        };

        it('should calculate price difference for upgrade', async () => {
            (mockPool.query as jest.Mock).mockResolvedValue(mockPrices);

            const result = await SubscriptionService.calculatePriceDifference(
                'starter',
                'pro',
                'monthly'
            );

            expect(result.current_price).toBe(99);
            expect(result.new_price).toBe(199);
            expect(result.difference).toBe(100);
            expect(result.is_upgrade).toBe(true);
        });

        it('should handle database errors', async () => {
            (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

            await expect(
                SubscriptionService.calculatePriceDifference('starter', 'pro', 'monthly')
            ).rejects.toThrow('Failed to calculate price difference');
        });
    });
});
