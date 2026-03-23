import { renderHook } from '@testing-library/react-native';
import { useLoyaltyCalculation } from '../../hooks/useLoyaltyCalculation';
import { useLoyalty } from '../../hooks/useLoyalty';

// Mock the dependency
jest.mock('../../hooks/useLoyalty');

describe('useLoyaltyCalculation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should calculate no discount when applyDiscount is false', () => {
        // Mock the loyalty response
        (useLoyalty as jest.Mock).mockReturnValue({
            loyalty: { points: 1000, tier: 'Gold', discountPercentage: 10 }
        });

        const { result } = renderHook(() =>
            useLoyaltyCalculation({
                partPrice: 100,
                deliveryFee: 20,
                paymentType: 'full',
                applyDiscount: false // Testing false branch
            })
        );

        expect(result.current.calculateDiscount).toEqual({ discountOnPart: 0, discountOnTotal: 0 });
        expect(result.current.totalAmount).toBe(120);
        expect(result.current.payNowAmount).toBe(120);
        expect(result.current.codAmount).toBe(0);
        expect(result.current.freeOrder).toBe(false);
    });

    it('should calculate 10% discount when applyDiscount is true on full payment type', () => {
        (useLoyalty as jest.Mock).mockReturnValue({
            loyalty: { points: 1000, tier: 'Gold', discountPercentage: 10 }
        });

        const { result } = renderHook(() =>
            useLoyaltyCalculation({
                partPrice: 100,
                deliveryFee: 20,
                paymentType: 'full',
                applyDiscount: true
            })
        );

        // 10% of 120 = 12 total discount // 10% of 100 = 10 part discount
        expect(result.current.calculateDiscount).toEqual({ discountOnPart: 10, discountOnTotal: 12 });
        expect(result.current.totalAmount).toBe(120);

        // payNow: 120 - 12 = 108
        expect(result.current.payNowAmount).toBe(108);
        expect(result.current.codAmount).toBe(0);
        expect(result.current.freeOrder).toBe(false);
    });

    it('should calculate 100% discount when VIP tier applies to full payment type', () => {
        (useLoyalty as jest.Mock).mockReturnValue({
            loyalty: { points: 5000, tier: 'Platinum', discountPercentage: 100 }
        });

        const { result } = renderHook(() =>
            useLoyaltyCalculation({
                partPrice: 100,
                deliveryFee: 20,
                paymentType: 'full',
                applyDiscount: true
            })
        );

        // 100% of 120 = 120
        expect(result.current.calculateDiscount).toEqual({ discountOnPart: 100, discountOnTotal: 120 });
        expect(result.current.totalAmount).toBe(120);

        // payNow: 120 - 120 = 0
        expect(result.current.payNowAmount).toBe(0);
        expect(result.current.codAmount).toBe(0);
        expect(result.current.freeOrder).toBe(true);
    });

    it('should calculate properly for delivery_only payment type', () => {
        (useLoyalty as jest.Mock).mockReturnValue({
            loyalty: { points: 1000, tier: 'Silver', discountPercentage: 10 }
        });

        const { result } = renderHook(() =>
            useLoyaltyCalculation({
                partPrice: 100,
                deliveryFee: 20,
                paymentType: 'delivery_only',
                applyDiscount: true
            })
        );

        // 10% of 120 = 12 total discount // 10% of 100 = 10 part discount
        expect(result.current.calculateDiscount).toEqual({ discountOnPart: 10, discountOnTotal: 12 });
        expect(result.current.totalAmount).toBe(120);

        // delivery_only calculates payNowAmount as strictly the deliveryFee (20)
        expect(result.current.payNowAmount).toBe(20);
        // codAmount is partPrice (100) - discountOnPart (10) = 90
        expect(result.current.codAmount).toBe(90);
        expect(result.current.freeOrder).toBe(false);
    });

    it('should handle null loyalty data correctly', () => {
        (useLoyalty as jest.Mock).mockReturnValue({
            loyalty: null
        });

        const { result } = renderHook(() =>
            useLoyaltyCalculation({
                partPrice: 200,
                deliveryFee: 50,
                paymentType: 'full',
                applyDiscount: true
            })
        );

        expect(result.current.loyaltyData).toBeNull();
        expect(result.current.calculateDiscount).toEqual({ discountOnPart: 0, discountOnTotal: 0 });
        expect(result.current.totalAmount).toBe(250);
        expect(result.current.payNowAmount).toBe(250);
        expect(result.current.codAmount).toBe(0);
        expect(result.current.freeOrder).toBe(false);
    });
});
