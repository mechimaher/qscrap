/**
 * PaymentTypeSelector Component Test
 * Tests the payment type toggle (Delivery Only vs Full Payment) with haptic feedback
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaymentTypeSelector } from '../../../components/payment/PaymentTypeSelector';

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
    const { View } = require('react-native');
    return { LinearGradient: View };
});

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    ImpactFeedbackStyle: {
        Light: 'light',
        Medium: 'medium',
        Heavy: 'heavy',
    },
}));

describe('PaymentTypeSelector', () => {
    const defaultProps = {
        paymentType: 'delivery_only' as const,
        setPaymentType: jest.fn(),
        deliveryFee: 50,
        totalAmount: 550,
        isRTL: false,
        t: (key: string) => {
            const translations: Record<string, string> = {
                'payment.payDeliveryOnly': 'Pay Delivery Only',
                'payment.cashOnDeliveryForPart': 'Cash on delivery for part',
                'payment.payFullOption': 'Pay Full Amount',
                'payment.noCashAtDelivery': 'No cash needed at delivery',
                'common.currency': 'QAR',
            };
            return translations[key] || key;
        },
        setClientSecret: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render both payment options', () => {
        render(<PaymentTypeSelector {...defaultProps} />);
        
        expect(screen.getByText('Pay Delivery Only')).toBeTruthy();
        expect(screen.getByText('Pay Full Amount')).toBeTruthy();
    });

    it('should display delivery fee for delivery_only option', () => {
        render(<PaymentTypeSelector {...defaultProps} />);
        
        expect(screen.getByText('50 QAR')).toBeTruthy();
    });

    it('should display total amount for full payment option', () => {
        render(<PaymentTypeSelector {...defaultProps} />);
        
        expect(screen.getByText('550 QAR')).toBeTruthy();
    });

    it('should highlight selected payment type', () => {
        render(<PaymentTypeSelector {...defaultProps} paymentType="delivery_only" />);
        
        const deliveryOption = screen.getByText('Pay Delivery Only').parent?.parent;
        expect(deliveryOption).toBeTruthy();
    });

    it('should call setPaymentType when delivery_only is selected', () => {
        const setPaymentTypeMock = jest.fn();
        render(<PaymentTypeSelector {...defaultProps} setPaymentType={setPaymentTypeMock} paymentType="full" />);
        
        const deliveryOption = screen.getByText('Pay Delivery Only').parent?.parent?.parent;
        if (deliveryOption) {
            fireEvent.press(deliveryOption);
        }
        
        expect(setPaymentTypeMock).toHaveBeenCalledWith('delivery_only');
    });

    it('should call setPaymentType when full payment is selected', () => {
        const setPaymentTypeMock = jest.fn();
        render(<PaymentTypeSelector {...defaultProps} setPaymentType={setPaymentTypeMock} paymentType="delivery_only" />);
        
        const fullOption = screen.getByText('Pay Full Amount').parent?.parent?.parent;
        if (fullOption) {
            fireEvent.press(fullOption);
        }
        
        expect(setPaymentTypeMock).toHaveBeenCalledWith('full');
    });

    it('should call setClientSecret when switching payment types', () => {
        const setClientSecretMock = jest.fn();
        render(<PaymentTypeSelector {...defaultProps} setClientSecret={setClientSecretMock} paymentType="delivery_only" />);
        
        const fullOption = screen.getByText('Pay Full Amount').parent?.parent?.parent;
        if (fullOption) {
            fireEvent.press(fullOption);
        }
        
        expect(setClientSecretMock).toHaveBeenCalledWith(null);
    });

    it('should trigger haptic feedback on selection', () => {
        const { impactAsync } = require('expo-haptics');
        render(<PaymentTypeSelector {...defaultProps} paymentType="full" />);
        
        const deliveryOption = screen.getByText('Pay Delivery Only').parent?.parent?.parent;
        if (deliveryOption) {
            fireEvent.press(deliveryOption);
        }
        
        expect(impactAsync).toHaveBeenCalled();
    });

    it('should not trigger callback when already selected', () => {
        const setPaymentTypeMock = jest.fn();
        render(<PaymentTypeSelector {...defaultProps} setPaymentType={setPaymentTypeMock} paymentType="delivery_only" />);
        
        const deliveryOption = screen.getByText('Pay Delivery Only').parent?.parent?.parent;
        if (deliveryOption) {
            fireEvent.press(deliveryOption);
        }
        
        expect(setPaymentTypeMock).not.toHaveBeenCalled();
    });

    it('should support RTL layout', () => {
        const { rerender } = render(<PaymentTypeSelector {...defaultProps} isRTL={false} />);
        expect(screen.getByText('Pay Delivery Only')).toBeTruthy();
        
        rerender(<PaymentTypeSelector {...defaultProps} isRTL={true} />);
        expect(screen.getByText('Pay Delivery Only')).toBeTruthy();
    });

    it('should display correct icons for each option', () => {
        render(<PaymentTypeSelector {...defaultProps} />);
        
        // Icons should be present (car for delivery, card for full)
        expect(screen.getByTestId('car-sport')).toBeTruthy();
        expect(screen.getByTestId('card')).toBeTruthy();
    });
});
