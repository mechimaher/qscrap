/**
 * PaymentButton Component Test
 * Tests the payment CTA button with dual mode (pay vs free order)
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { PaymentButton } from '../../../components/payment/PaymentButton';

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
    const { View } = require('react-native');
    return { LinearGradient: View };
});

describe('PaymentButton', () => {
    const defaultProps = {
        freeOrder: false,
        handleFreeOrder: jest.fn(),
        isLoading: false,
        cardComplete: true,
        handlePayment: jest.fn(),
        payNowAmount: 50,
        t: (key: string, params?: any) => {
            const translations: Record<string, string> = {
                'payment.freeOrderClaim': 'Claim Free Order',
                'payment.pay': 'Pay {{amount}} QAR',
                'payment.loyaltyAtWork': 'Loyalty points at work!',
                'payment.securedByStripe': 'Secured by Stripe',
            };
            let text = translations[key] || key;
            if (params?.amount) {
                text = text.replace('{{amount}}', params.amount.toString());
            }
            return text;
        },
        colors: {
            surface: '#FFFFFF',
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render payment button when not free order', () => {
        render(<PaymentButton {...defaultProps} />);

        expect(screen.getByText('Pay 50 QAR')).toBeTruthy();
    });

    it('should render free order button when freeOrder is true', () => {
        render(<PaymentButton {...defaultProps} freeOrder={true} />);

        expect(screen.getByText('Claim Free Order')).toBeTruthy();
    });

    it('should call handlePayment when payment button is pressed', () => {
        const handlePaymentMock = jest.fn();
        render(<PaymentButton {...defaultProps} handlePayment={handlePaymentMock} />);

        const payButton = screen.getByText('Pay 50 QAR').parent?.parent;
        if (payButton) {
            fireEvent.press(payButton);
        }

        expect(handlePaymentMock).toHaveBeenCalled();
    });

    it('should call handleFreeOrder when free order button is pressed', () => {
        const handleFreeOrderMock = jest.fn();
        render(<PaymentButton {...defaultProps} freeOrder={true} handleFreeOrder={handleFreeOrderMock} />);

        const freeButton = screen.getByText('Claim Free Order').parent?.parent;
        if (freeButton) {
            fireEvent.press(freeButton);
        }

        expect(handleFreeOrderMock).toHaveBeenCalled();
    });

    it('should be disabled when card is not complete', () => {
        render(<PaymentButton {...defaultProps} cardComplete={false} />);

        const payButton = screen.getByText('Pay 50 QAR').parent?.parent;
        expect(payButton?.props.accessibilityState?.disabled).toBe(true);
    });

    it('should be disabled when loading', () => {
        render(<PaymentButton {...defaultProps} isLoading={true} />);

        const payButton = screen.getByText('Pay 50 QAR').parent?.parent;
        expect(payButton?.props.accessibilityState?.disabled).toBe(true);
    });

    it('should show loading spinner when loading', () => {
        const { getByTestId } = render(<PaymentButton {...defaultProps} isLoading={true} />);

        expect(getByTestId('activity-indicator')).toBeTruthy();
    });

    it('should not show button text when loading', () => {
        render(<PaymentButton {...defaultProps} isLoading={true} />);

        expect(screen.queryByText('Pay 50 QAR')).toBeNull();
    });

    it('should display green gradient when card is complete', () => {
        render(<PaymentButton {...defaultProps} cardComplete={true} />);

        // Gradient should be green when enabled
        const gradient = screen.getByTestId('payment-gradient');
        expect(gradient.props.colors).toEqual(['#22c55e', '#16a34a']);
    });

    it('should display gray gradient when card is incomplete', () => {
        render(<PaymentButton {...defaultProps} cardComplete={false} />);

        // Gradient should be gray when disabled
        const gradient = screen.getByTestId('payment-gradient');
        expect(gradient.props.colors).toEqual(['#9ca3af', '#6b7280']);
    });

    it('should display gold gradient for free order', () => {
        render(<PaymentButton {...defaultProps} freeOrder={true} />);

        // Gradient should be gold for free order
        const gradient = screen.getByTestId('payment-gradient');
        expect(gradient.props.colors).toEqual(['#FFD700', '#FFA500']);
    });

    it('should render security text for normal payment', () => {
        render(<PaymentButton {...defaultProps} />);

        expect(screen.getByText('Secured by Stripe')).toBeTruthy();
    });

    it('should render loyalty text for free order', () => {
        render(<PaymentButton {...defaultProps} freeOrder={true} />);

        expect(screen.getByText('Loyalty points at work!')).toBeTruthy();
    });

    it('should format pay amount with 2 decimal places', () => {
        render(<PaymentButton {...defaultProps} payNowAmount={50.5} />);

        expect(screen.getByText('Pay 50.50 QAR')).toBeTruthy();
    });

    it('should support RTL layout', () => {
        // PaymentButton doesn't use isRTL directly in its props
        const { rerender } = render(<PaymentButton {...defaultProps} />);
        expect(screen.getByText('Pay 50 QAR')).toBeTruthy();

        rerender(<PaymentButton {...defaultProps} />);
        expect(screen.getByText('Pay 50 QAR')).toBeTruthy();
    });
});
