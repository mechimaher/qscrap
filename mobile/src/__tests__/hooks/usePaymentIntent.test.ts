import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePaymentIntent } from '../../hooks/usePaymentIntent';
import { api } from '../../services/api';

jest.mock('../../services/api', () => ({
    api: {
        createFullPaymentIntent: jest.fn(),
        createDeliveryFeeIntent: jest.fn()
    }
}));
jest.mock('../../utils/logger');
jest.mock('../../utils/errorHandler');

describe('usePaymentIntent', () => {
    const mockT = jest.fn((key) => key);
    const mockToast = { error: jest.fn(), success: jest.fn(), info: jest.fn() };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should do nothing if orderId is null', () => {
        const { result } = renderHook(() =>
            usePaymentIntent({
                orderId: null,
                paymentType: 'full',
                applyDiscount: false,
                payNowAmount: 100,
                discountOnTotal: 0,
                discountOnPart: 0,
                deliveryFee: 20,
                t: mockT,
                toast: mockToast
            })
        );

        expect(result.current.isCreatingOrder).toBe(false);
        expect(result.current.clientSecret).toBeNull();
    });

    it('should create FREE_ORDER if payNowAmount is 0', async () => {
        const { result } = renderHook(() =>
            usePaymentIntent({
                orderId: 'order-123',
                paymentType: 'full',
                applyDiscount: true,
                payNowAmount: 0,
                discountOnTotal: 100,
                discountOnPart: 0,
                deliveryFee: 20,
                t: mockT,
                toast: mockToast
            })
        );

        expect(result.current.isCreatingOrder).toBe(true);

        act(() => {
            jest.advanceTimersByTime(400);
        });

        await waitFor(() => {
            expect(result.current.clientSecret).toBe('FREE_ORDER');
            expect(result.current.paymentAmount).toBe(0);
            expect(result.current.isCreatingOrder).toBe(false);
        });
    });

    it('should call createFullPaymentIntent when paymentType is full', async () => {
        (api.createFullPaymentIntent as jest.Mock).mockResolvedValue({
            intent: { clientSecret: 'secret_full' },
            breakdown: { total: 100 }
        });

        const { result } = renderHook(() =>
            usePaymentIntent({
                orderId: 'order-123',
                paymentType: 'full',
                applyDiscount: false,
                payNowAmount: 100,
                discountOnTotal: 0,
                discountOnPart: 0,
                deliveryFee: 20,
                t: mockT,
                toast: mockToast
            })
        );

        act(() => {
            jest.advanceTimersByTime(400);
        });

        await waitFor(() => {
            expect(api.createFullPaymentIntent).toHaveBeenCalledWith('order-123', 0);
            expect(result.current.clientSecret).toBe('secret_full');
            expect(result.current.paymentAmount).toBe(100);
        });
    });

    it('should call createDeliveryFeeIntent when paymentType is delivery_only', async () => {
        (api.createDeliveryFeeIntent as jest.Mock).mockResolvedValue({
            intent: { clientSecret: 'secret_delivery' },
            breakdown: { total: 20 }
        });

        const { result } = renderHook(() =>
            usePaymentIntent({
                orderId: 'order-123',
                paymentType: 'delivery_only',
                applyDiscount: false,
                payNowAmount: 20,
                discountOnTotal: 0,
                discountOnPart: 0,
                deliveryFee: 20,
                t: mockT,
                toast: mockToast
            })
        );

        act(() => {
            jest.advanceTimersByTime(400);
        });

        await waitFor(() => {
            expect(api.createDeliveryFeeIntent).toHaveBeenCalledWith('order-123', 0);
            expect(result.current.clientSecret).toBe('secret_delivery');
            expect(result.current.paymentAmount).toBe(20);
        });
    });
});
