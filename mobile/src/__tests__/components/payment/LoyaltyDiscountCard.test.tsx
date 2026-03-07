/**
 * LoyaltyDiscountCard Component Test
 * Tests the loyalty tier display, discount toggle, and free order banner
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { LoyaltyDiscountCard } from '../../../components/payment/LoyaltyDiscountCard';

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
    const { View } = require('react-native');
    return { LinearGradient: View };
});

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    ImpactFeedbackStyle: {
        Medium: 'medium',
    },
}));

describe('LoyaltyDiscountCard', () => {
    const defaultLoyaltyData = {
        tier: 'platinum',
        discountPercentage: 10,
    };

    const defaultProps = {
        loyaltyData: defaultLoyaltyData,
        freeOrder: false,
        applyDiscount: false,
        setApplyDiscount: jest.fn(),
        paymentType: 'full' as const,
        calculateDiscount: { discountOnPart: 50, discountOnTotal: 55 },
        partPrice: 500,
        codAmount: 450,
        totalAmount: 550,
        payNowAmount: 495,
        discountAmount: 55,
        isRTL: false,
        t: (key: string, params?: any) => {
            const translations: Record<string, string> = {
                'payment.off': 'OFF',
                'payment.save': 'Save {{amount}} QAR',
                'payment.tapToApply': 'Tap to apply discount',
                'payment.freeOrderBanner': 'FREE ORDER! Loyalty covers everything!',
            };
            let text = translations[key] || key;
            if (params?.amount) {
                text = text.replace('{{amount}}', params.amount.toString());
            }
            return text;
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should not render when no loyalty data', () => {
        const { container } = render(<LoyaltyDiscountCard {...defaultProps} loyaltyData={null} />);
        
        expect(container.children.length).toBe(0);
    });

    it('should not render when discount percentage is 0', () => {
        const { container } = render(
            <LoyaltyDiscountCard {...defaultProps} loyaltyData={{ tier: 'bronze', discountPercentage: 0 }} />
        );
        
        expect(container.children.length).toBe(0);
    });

    it('should render loyalty tier and discount percentage', () => {
        render(<LoyaltyDiscountCard {...defaultProps} />);
        
        expect(screen.getByText('PLATINUM • 10% OFF')).toBeTruthy();
    });

    it('should display correct icon for platinum tier', () => {
        render(<LoyaltyDiscountCard {...defaultProps} />);
        
        expect(screen.getByTestId('diamond')).toBeTruthy();
    });

    it('should display trophy icon for gold tier', () => {
        render(<LoyaltyDiscountCard {...defaultProps} loyaltyData={{ tier: 'gold', discountPercentage: 8 }} />);
        
        expect(screen.getByTestId('trophy')).toBeTruthy();
    });

    it('should display medal icon for silver tier', () => {
        render(<LoyaltyDiscountCard {...defaultProps} loyaltyData={{ tier: 'silver', discountPercentage: 5 }} />);
        
        expect(screen.getByTestId('medal')).toBeTruthy();
    });

    it('should show savings amount when discount is applied', () => {
        render(<LoyaltyDiscountCard {...defaultProps} applyDiscount={true} />);
        
        expect(screen.getByText('Save 55 QAR')).toBeTruthy();
    });

    it('should show "Tap to apply" when discount is not applied', () => {
        render(<LoyaltyDiscountCard {...defaultProps} applyDiscount={false} />);
        
        expect(screen.getByText('Tap to apply discount')).toBeTruthy();
    });

    it('should call setApplyDiscount when toggle is switched', () => {
        const setApplyDiscountMock = jest.fn();
        render(<LoyaltyDiscountCard {...defaultProps} applyDiscount={false} setApplyDiscount={setApplyDiscountMock} />);
        
        const toggle = screen.getByRole('switch');
        fireEvent(toggle, 'valueChange', true);
        
        expect(setApplyDiscountMock).toHaveBeenCalledWith(true);
    });

    it('should trigger haptic feedback on toggle', () => {
        const { impactAsync } = require('expo-haptics');
        render(<LoyaltyDiscountCard {...defaultProps} applyDiscount={false} />);
        
        const toggle = screen.getByRole('switch');
        fireEvent(toggle, 'valueChange', true);
        
        expect(impactAsync).toHaveBeenCalled();
    });

    it('should display free order banner when freeOrder is true', () => {
        render(<LoyaltyDiscountCard {...defaultProps} freeOrder={true} applyDiscount={true} />);
        
        expect(screen.getByText('FREE ORDER! Loyalty covers everything!')).toBeTruthy();
    });

    it('should not display free order banner when freeOrder is false', () => {
        render(<LoyaltyDiscountCard {...defaultProps} freeOrder={false} />);
        
        expect(screen.queryByText('FREE ORDER! Loyalty covers everything!')).toBeNull();
    });

    it('should have green border when free order', () => {
        const { getByTestId } = render(<LoyaltyDiscountCard {...defaultProps} freeOrder={true} applyDiscount={true} />);
        
        const card = getByTestId('loyalty-card');
        expect(card.props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    borderColor: '#22C55E',
                    borderWidth: 2,
                }),
            ])
        );
    });

    it('should support RTL layout', () => {
        const { rerender } = render(<LoyaltyDiscountCard {...defaultProps} isRTL={false} />);
        expect(screen.getByText('PLATINUM • 10% OFF')).toBeTruthy();
        
        rerender(<LoyaltyDiscountCard {...defaultProps} isRTL={true} />);
        expect(screen.getByText('PLATINUM • 10% OFF')).toBeTruthy();
    });

    it('should calculate savings for delivery_only payment type', () => {
        render(
            <LoyaltyDiscountCard 
                {...defaultProps} 
                paymentType="delivery_only"
                calculateDiscount={{ discountOnPart: 50, discountOnTotal: 55 }}
                applyDiscount={true}
            />
        );
        
        expect(screen.getByText('Save 50 QAR')).toBeTruthy(); // Uses discountOnPart for delivery_only
    });
});
