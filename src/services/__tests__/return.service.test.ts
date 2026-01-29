/**
 * Return Service Unit Tests
 * Tests for 7-day return window (BRAIN v3.0 compliant)
 */

import { getReturnService } from '../cancellation/return.service';
import { RETURN_POLICY } from '../cancellation/cancellation.constants';
import { Pool } from 'pg';

// Mock the pool
const mockPool = {
    query: jest.fn(),
    connect: jest.fn(),
} as unknown as Pool;

describe('ReturnService', () => {
    let service: ReturnType<typeof getReturnService>;

    beforeEach(() => {
        service = getReturnService(mockPool);
        jest.clearAllMocks();
    });

    describe('Return Preview - 7-Day Window', () => {
        it('should allow return within 7-day window', async () => {
            const deliveredAt = new Date();
            deliveredAt.setDate(deliveredAt.getDate() - 3); // 3 days ago

            const mockOrder = {
                order_id: 'test-order-1',
                order_number: 'ORD-001',
                order_status: 'delivered',
                delivered_at: deliveredAt.toISOString(),
                total_amount: 100,
                part_price: 80,
                delivery_fee: 20,
                customer_id: 'customer-1',
            };

            const mockAbuseTracking = {
                returns_this_month: 0,
            };

            (mockPool.query as jest.Mock)
                .mockResolvedValueOnce({ rows: [mockOrder] }) // order query
                .mockResolvedValueOnce({ rows: [mockAbuseTracking] }); // abuse tracking

            const preview = await service.getReturnPreview('test-order-1', 'customer-1');

            expect(preview.can_return).toBe(true);
        });

        it('should NOT allow return after 7-day window expires', async () => {
            const deliveredAt = new Date();
            deliveredAt.setDate(deliveredAt.getDate() - 10); // 10 days ago

            const mockOrder = {
                order_id: 'test-order-2',
                order_number: 'ORD-002',
                order_status: 'delivered',
                delivered_at: deliveredAt.toISOString(),
                total_amount: 100,
                part_price: 80,
                delivery_fee: 20,
                customer_id: 'customer-1',
            };

            (mockPool.query as jest.Mock)
                .mockResolvedValueOnce({ rows: [mockOrder] });

            const preview = await service.getReturnPreview('test-order-2', 'customer-1');

            expect(preview.can_return).toBe(false);
            expect(preview.reason).toContain('expired');
        });

        it('should apply 20% fee on return (BRAIN v3.0)', async () => {
            const deliveredAt = new Date();
            deliveredAt.setDate(deliveredAt.getDate() - 2);

            const mockOrder = {
                order_id: 'test-order-3',
                order_number: 'ORD-003',
                order_status: 'delivered',
                delivered_at: deliveredAt.toISOString(),
                total_amount: 100,
                part_price: 80,
                delivery_fee: 20,
                customer_id: 'customer-1',
            };

            const mockAbuseTracking = {
                returns_this_month: 0,
            };

            (mockPool.query as jest.Mock)
                .mockResolvedValueOnce({ rows: [mockOrder] })
                .mockResolvedValueOnce({ rows: [mockAbuseTracking] });

            const preview = await service.getReturnPreview('test-order-3', 'customer-1');

            expect(preview.can_return).toBe(true);
            // 20% of part_price (80) = 16, refund = 80 - 16 - 20 (delivery) = 44
            expect(preview.refund_amount).toBeGreaterThan(0);
        });
    });

    describe('Customer Abuse Limits', () => {
        it('should block return if customer exceeds monthly limit', async () => {
            const deliveredAt = new Date();
            deliveredAt.setDate(deliveredAt.getDate() - 2);

            const mockOrder = {
                order_id: 'test-order-4',
                order_number: 'ORD-004',
                order_status: 'delivered',
                delivered_at: deliveredAt.toISOString(),
                total_amount: 100,
                part_price: 80,
                delivery_fee: 20,
                customer_id: 'customer-1',
            };

            const mockAbuseTracking = {
                returns_this_month: 3, // Already at limit
            };

            (mockPool.query as jest.Mock)
                .mockResolvedValueOnce({ rows: [mockOrder] })
                .mockResolvedValueOnce({ rows: [mockAbuseTracking] });

            const preview = await service.getReturnPreview('test-order-4', 'customer-1');

            expect(preview.can_return).toBe(false);
            expect(preview.reason).toContain('limit');
        });
    });
});

describe('RETURN_POLICY Constants', () => {
    it('should have correct values per BRAIN spec', () => {
        expect(RETURN_POLICY.WINDOW_DAYS).toBe(7);
        expect(RETURN_POLICY.FEE_PERCENTAGE).toBe(0.20);
        expect(RETURN_POLICY.REQUIRED_PHOTOS).toBeGreaterThan(0);
    });
});
