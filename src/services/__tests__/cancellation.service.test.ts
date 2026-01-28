/**
 * Cancellation Service Unit Tests
 * Tests for BRAIN v3.0 compliant fee calculation
 */

import { CancellationService } from '../cancellation/cancellation.service';
import {
    CANCELLATION_FEES,
    STATUS_TO_STAGE
} from '../cancellation/cancellation.constants';
import { Pool } from 'pg';

// Mock the pool
const mockPool = {
    query: jest.fn(),
    connect: jest.fn(),
} as unknown as Pool;

describe('CancellationService', () => {
    let service: CancellationService;

    beforeEach(() => {
        service = new CancellationService(mockPool);
        jest.clearAllMocks();
    });

    describe('Fee Calculation - BRAIN v3.0 Compliance', () => {
        it('should return 0% fee before payment (pending_payment status)', async () => {
            const mockOrder = {
                order_id: 'test-order-1',
                order_status: 'pending_payment',
                total_amount: 100,
                part_price: 80,
                delivery_fee: 20,
            };

            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [mockOrder]
            });

            const preview = await service.getCancellationPreview('test-order-1', 'user-1');

            expect(preview.can_cancel).toBe(true);
            expect(preview.cancellation_fee_rate).toBe(0);
            expect(preview.cancellation_fee).toBe(0);
            expect(preview.cancellation_stage).toBe('BEFORE_PAYMENT');
        });

        it('should return 5% fee after payment (confirmed status)', async () => {
            const mockOrder = {
                order_id: 'test-order-2',
                order_number: 'ORD-001',
                order_status: 'confirmed',
                total_amount: 100,
                part_price: 80,
                delivery_fee: 20,
            };

            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [mockOrder]
            });

            const preview = await service.getCancellationPreview('test-order-2', 'user-1');

            expect(preview.can_cancel).toBe(true);
            expect(preview.cancellation_fee_rate).toBe(CANCELLATION_FEES.AFTER_PAYMENT); // 0.05
            expect(preview.cancellation_fee).toBe(4); // 5% of 80 (part price only)
            expect(preview.cancellation_stage).toBe('AFTER_PAYMENT');
        });

        it('should return 10% fee during preparation', async () => {
            const mockOrder = {
                order_id: 'test-order-3',
                order_number: 'ORD-002',
                order_status: 'preparing',
                total_amount: 100,
                part_price: 80,
                delivery_fee: 20,
            };

            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [mockOrder]
            });

            const preview = await service.getCancellationPreview('test-order-3', 'user-1');

            expect(preview.can_cancel).toBe(true);
            expect(preview.cancellation_fee_rate).toBe(CANCELLATION_FEES.DURING_PREPARATION); // 0.10
            expect(preview.cancellation_fee).toBe(8); // 10% of 80
            expect(preview.cancellation_stage).toBe('DURING_PREPARATION');
        });

        it('should return 10% + full delivery fee when in delivery', async () => {
            const mockOrder = {
                order_id: 'test-order-4',
                order_number: 'ORD-003',
                order_status: 'in_transit',
                total_amount: 100,
                part_price: 80,
                delivery_fee: 20,
            };

            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [mockOrder]
            });

            const preview = await service.getCancellationPreview('test-order-4', 'user-1');

            expect(preview.can_cancel).toBe(true);
            expect(preview.cancellation_fee_rate).toBe(CANCELLATION_FEES.IN_DELIVERY); // 0.10
            expect(preview.cancellation_fee).toBe(8); // 10% of 80
            expect(preview.delivery_fee_retained).toBe(20); // 100% delivery fee
            expect(preview.cancellation_stage).toBe('IN_DELIVERY');

            // Refund should be: 80 (part) - 8 (10% fee) - 20 (delivery) = 52
            expect(preview.refund_amount).toBe(52);
        });

        it('should NOT allow cancellation after delivery (use return flow)', async () => {
            const mockOrder = {
                order_id: 'test-order-5',
                order_number: 'ORD-004',
                order_status: 'delivered',
                total_amount: 100,
                part_price: 80,
                delivery_fee: 20,
            };

            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [mockOrder]
            });

            const preview = await service.getCancellationPreview('test-order-5', 'user-1');

            expect(preview.can_cancel).toBe(false);
            expect(preview.cancellation_stage).toBe('AFTER_DELIVERY');
            expect(preview.reason).toContain('return request');
        });

        it('should NOT allow cancellation of already cancelled orders', async () => {
            const mockOrder = {
                order_id: 'test-order-6',
                order_number: 'ORD-005',
                order_status: 'cancelled_by_customer',
                total_amount: 100,
                part_price: 80,
                delivery_fee: 20,
            };

            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [mockOrder]
            });

            const preview = await service.getCancellationPreview('test-order-6', 'user-1');

            expect(preview.can_cancel).toBe(false);
            expect(preview.reason).toContain('already cancelled');
        });
    });

    describe('Status to Stage Mapping', () => {
        it('should correctly map pending_payment to BEFORE_PAYMENT', () => {
            expect(STATUS_TO_STAGE['pending_payment']).toBe('BEFORE_PAYMENT');
        });

        it('should correctly map confirmed to AFTER_PAYMENT', () => {
            expect(STATUS_TO_STAGE['confirmed']).toBe('AFTER_PAYMENT');
        });

        it('should correctly map preparing to DURING_PREPARATION', () => {
            expect(STATUS_TO_STAGE['preparing']).toBe('DURING_PREPARATION');
        });

        it('should correctly map in_transit to IN_DELIVERY', () => {
            expect(STATUS_TO_STAGE['in_transit']).toBe('IN_DELIVERY');
        });

        it('should correctly map delivered to AFTER_DELIVERY', () => {
            expect(STATUS_TO_STAGE['delivered']).toBe('AFTER_DELIVERY');
        });
    });

    describe('Fee Breakdown', () => {
        it('should split fee 50/50 between platform and garage', async () => {
            const mockOrder = {
                order_id: 'test-order-7',
                order_number: 'ORD-006',
                order_status: 'preparing',
                total_amount: 100,
                part_price: 80,
                delivery_fee: 20,
            };

            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [mockOrder]
            });

            const preview = await service.getCancellationPreview('test-order-7', 'user-1');

            // 10% of 80 = 8, split 50/50 = 4 each
            expect(preview.fee_breakdown.platform_fee).toBe(4);
            expect(preview.fee_breakdown.garage_compensation).toBe(4);
        });
    });
});

describe('CANCELLATION_FEES Constants', () => {
    it('should have correct values per BRAIN spec', () => {
        expect(CANCELLATION_FEES.BEFORE_PAYMENT).toBe(0);
        expect(CANCELLATION_FEES.AFTER_PAYMENT).toBe(0.05);
        expect(CANCELLATION_FEES.DURING_PREPARATION).toBe(0.10);
        expect(CANCELLATION_FEES.IN_DELIVERY).toBe(0.10);
        expect(CANCELLATION_FEES.AFTER_DELIVERY).toBe(0.20);
    });
});
