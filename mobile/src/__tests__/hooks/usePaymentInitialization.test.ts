import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePaymentInitialization } from '../../hooks/usePaymentInitialization';
import { api } from '../../services/api';

jest.mock('../../services/api', () => ({
    api: {
        acceptBid: jest.fn(),
        createFullPaymentIntent: jest.fn(),
        createDeliveryFeeIntent: jest.fn(),
    }
}));
jest.mock('../../utils/errorHandler');

describe('usePaymentInitialization', () => {
    const mockT = jest.fn((key) => key);
    const mockToast = { error: jest.fn(), success: jest.fn() };
    const mockNavigation = { goBack: jest.fn() };
    const mockSetClientSecret = jest.fn();
    const mockSetPaymentAmount = jest.fn();
    const mockSetDiscountAmount = jest.fn();

    const baseParams = {
        bidId: 'bid-123',
        paymentType: 'full' as 'full' | 'delivery_only',
        applyDiscount: false,
        loyaltyData: null,
        totalAmount: 100,
        partPrice: 80,
        deliveryFee: 20,
        setClientSecret: mockSetClientSecret,
        setPaymentAmount: mockSetPaymentAmount,
        setDiscountAmount: mockSetDiscountAmount,
        t: mockT,
        toast: mockToast,
        navigation: mockNavigation,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should initialize with existing order ID and create full payment intent', async () => {
        (api.createFullPaymentIntent as jest.Mock).mockResolvedValue({
            intent: { clientSecret: 'secret_123' },
            breakdown: { total: 100 },
        });

        const { result } = renderHook(() =>
            usePaymentInitialization({
                ...baseParams,
                existingOrderId: 'order-123',
            })
        );

        act(() => {
            result.current.initializePayment();
        });

        await waitFor(() => {
            expect(api.createFullPaymentIntent).toHaveBeenCalledWith('order-123', false);
            expect(mockSetClientSecret).toHaveBeenCalledWith('secret_123');
            expect(mockSetPaymentAmount).toHaveBeenCalledWith(100);
            expect(mockSetDiscountAmount).toHaveBeenCalledWith(0);
            expect(result.current.intentError).toBeNull();
        });
    });

    it('should create new order via acceptBid if existingOrderId is not provided', async () => {
        (api.acceptBid as jest.Mock).mockResolvedValue({ order_id: 'new-order-456' });
        (api.createFullPaymentIntent as jest.Mock).mockResolvedValue({
            intent: { clientSecret: 'secret_456' },
            breakdown: { total: 100 },
        });

        const { result } = renderHook(() =>
            usePaymentInitialization({
                ...baseParams,
                existingOrderId: undefined,
            })
        );

        act(() => {
            result.current.initializePayment();
        });

        await waitFor(() => {
            expect(api.acceptBid).toHaveBeenCalledWith('bid-123', 'card');
            expect(api.createFullPaymentIntent).toHaveBeenCalledWith('new-order-456', false);
            expect(mockSetClientSecret).toHaveBeenCalledWith('secret_456');
            expect(result.current.orderId).toBe('new-order-456');
        });
    });

    it('should create delivery fee intent for delivery_only payment type', async () => {
        (api.createDeliveryFeeIntent as jest.Mock).mockResolvedValue({
            intent: { clientSecret: 'secret_delivery' },
            breakdown: { total: 20 },
        });

        const { result } = renderHook(() =>
            usePaymentInitialization({
                ...baseParams,
                existingOrderId: 'order-123',
                paymentType: 'delivery_only',
            })
        );

        act(() => {
            result.current.initializePayment();
        });

        await waitFor(() => {
            expect(api.createDeliveryFeeIntent).toHaveBeenCalledWith('order-123', false);
            expect(mockSetClientSecret).toHaveBeenCalledWith('secret_delivery');
            expect(mockSetPaymentAmount).toHaveBeenCalledWith(20);
        });
    });

    it('should apply loyalty discount correctly during full payment', async () => {
        (api.createFullPaymentIntent as jest.Mock).mockResolvedValue({
            intent: { clientSecret: 'secret_discounted' },
            breakdown: { total: 90, loyaltyDiscount: 10 },
        });

        const { result } = renderHook(() =>
            usePaymentInitialization({
                ...baseParams,
                existingOrderId: 'order-123',
                applyDiscount: true,
                loyaltyData: { discountPercentage: 10 },
            })
        );

        act(() => {
            result.current.initializePayment();
        });

        await waitFor(() => {
            expect(api.createFullPaymentIntent).toHaveBeenCalledWith('order-123', true);
            expect(mockSetClientSecret).toHaveBeenCalledWith('secret_discounted');
            expect(mockSetPaymentAmount).toHaveBeenCalledWith(90);
            expect(mockSetDiscountAmount).toHaveBeenCalledWith(10);
        });
    });

    it('should handle API errors gracefully', async () => {
        (api.createFullPaymentIntent as jest.Mock).mockRejectedValue(new Error('Network Error'));

        const { result } = renderHook(() =>
            usePaymentInitialization({
                ...baseParams,
                existingOrderId: 'order-123',
            })
        );

        act(() => {
            result.current.initializePayment();
        });

        await waitFor(() => {
            expect(result.current.intentError).toBe('Network Error');
            expect(mockToast.error).toHaveBeenCalledWith('common.error', 'Network Error');
        });
    });
});
