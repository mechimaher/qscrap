import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useStripeCheckout } from '../../hooks/useStripeCheckout';
import { api } from '../../services/api';
import { useStripe } from '@stripe/stripe-react-native';
import * as Haptics from 'expo-haptics';

jest.mock('../../services/api', () => ({
    api: {
        confirmDeliveryFeePayment: jest.fn(),
        confirmFreeOrder: jest.fn(),
    }
}));
jest.mock('@stripe/stripe-react-native', () => ({
    useStripe: jest.fn(),
}));
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    ImpactFeedbackStyle: { Medium: 'Medium' },
    NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('../../utils/logger');
jest.mock('../../utils/errorHandler');

describe('useStripeCheckout', () => {
    const mockT = jest.fn((key) => key);
    const mockToast = { error: jest.fn(), show: jest.fn() };
    const mockNavigation = { reset: jest.fn(), navigate: jest.fn() };
    const mockConfirmPayment = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        (useStripe as jest.Mock).mockReturnValue({
            confirmPayment: mockConfirmPayment,
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const baseParams = {
        clientSecret: 'secret_123',
        cardComplete: true,
        orderId: 'order-123',
        navigation: mockNavigation,
        t: mockT,
        toast: mockToast,
    };

    it('should show error if card is not complete', async () => {
        const { result } = renderHook(() =>
            useStripeCheckout({
                ...baseParams,
                cardComplete: false,
            })
        );

        act(() => {
            result.current.handlePayment();
        });

        expect(mockToast.error).toHaveBeenCalledWith('common.error', 'payment.enterCardDetails');
        expect(mockConfirmPayment).not.toHaveBeenCalled();
    });

    it('should show error if clientSecret is null', async () => {
        const { result } = renderHook(() =>
            useStripeCheckout({
                ...baseParams,
                clientSecret: null,
            })
        );

        act(() => {
            result.current.handlePayment();
        });

        expect(mockToast.error).toHaveBeenCalledWith('common.error', 'payment.enterCardDetails');
    });

    it('should handle successful payment confirmation', async () => {
        mockConfirmPayment.mockResolvedValue({
            paymentIntent: { status: 'succeeded', id: 'pi_123' },
            error: null,
        });
        (api.confirmDeliveryFeePayment as jest.Mock).mockResolvedValue({});

        const { result } = renderHook(() => useStripeCheckout(baseParams));

        act(() => {
            result.current.handlePayment();
        });

        await waitFor(() => {
            expect(mockConfirmPayment).toHaveBeenCalledWith('secret_123', { paymentMethodType: 'Card' });
            expect(api.confirmDeliveryFeePayment).toHaveBeenCalledWith('pi_123');
            expect(Haptics.notificationAsync).toHaveBeenCalledWith('Success');
            expect(mockToast.show).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
        });

        act(() => {
            jest.advanceTimersByTime(500);
        });

        expect(mockNavigation.reset).toHaveBeenCalled();
    });

    it('should handle Stripe error during confirmation', async () => {
        mockConfirmPayment.mockResolvedValue({
            paymentIntent: null,
            error: { message: 'Card declined' },
        });

        const { result } = renderHook(() => useStripeCheckout(baseParams));

        act(() => {
            result.current.handlePayment();
        });

        await waitFor(() => {
            expect(Haptics.notificationAsync).toHaveBeenCalledWith('Error');
            expect(mockToast.error).toHaveBeenCalledWith('common.error', 'Card declined');
            expect(result.current.isLoading).toBe(false);
        });
    });

    it('should handle FREE_ORDER execution', async () => {
        (api.confirmFreeOrder as jest.Mock).mockResolvedValue({});
        const { result } = renderHook(() => useStripeCheckout(baseParams));

        act(() => {
            result.current.handleFreeOrder();
        });

        await waitFor(() => {
            expect(api.confirmFreeOrder).toHaveBeenCalledWith('order-123', true);
            expect(Haptics.notificationAsync).toHaveBeenCalledWith('Success');
            expect(mockToast.show).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
        });

        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(mockNavigation.reset).toHaveBeenCalled();
    });
});
