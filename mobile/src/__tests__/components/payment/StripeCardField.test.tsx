/**
 * StripeCardField Component Test
 * Tests the Stripe card input wrapper with completion callback
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { StripeCardField } from '../../../components/payment/StripeCardField';

// Mock Stripe provider and CardField
const mockSetCardComplete = jest.fn();
jest.mock('@stripe/stripe-react-native', () => ({
    CardField: ({ onCardChange, ...props }: any) => {
        const React = require('react');
        const { View } = require('react-native');

        return (
            <View
                {...props}
                onChange={(cardDetails: any) => onCardChange(cardDetails)}
            />
        );
    },
}));

describe('StripeCardField', () => {
    const defaultProps = {
        colors: {
            text: '#1F2937',
            textSecondary: '#6B7280',
        },
        t: (key: string) => {
            const translations: Record<string, string> = {
                'payment.cardDetails': 'Card Details',
                'payment.enterCardInfo': 'Enter your card information',
                'payment.cardSecure': 'Your card information is secure',
            };
            return translations[key] || key;
        },
        setCardComplete: mockSetCardComplete,
        isRTL: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render card details section title', () => {
        render(<StripeCardField {...defaultProps} />);
        
        expect(screen.getByText('Card Details')).toBeTruthy();
    });

    it('should render card input label', () => {
        render(<StripeCardField {...defaultProps} />);
        
        expect(screen.getByText('Enter your card information')).toBeTruthy();
    });

    it('should render Stripe CardField component', () => {
        render(<StripeCardField {...defaultProps} />);
        
        expect(screen.getByTestId('card-field')).toBeTruthy();
    });

    it('should render security indicator with lock icon', () => {
        render(<StripeCardField {...defaultProps} />);
        
        expect(screen.getByTestId('lock-closed')).toBeTruthy();
    });

    it('should render security text', () => {
        render(<StripeCardField {...defaultProps} />);
        
        expect(screen.getByText('Your card information is secure')).toBeTruthy();
    });

    it('should call setCardComplete when card details change', () => {
        render(<StripeCardField {...defaultProps} />);
        
        const cardField = screen.getByTestId('card-field');
        fireEvent(cardField, 'onChange', { complete: true });
        
        expect(mockSetCardComplete).toHaveBeenCalledWith(true);
    });

    it('should use correct text colors from theme', () => {
        const { getByText } = render(<StripeCardField {...defaultProps} />);
        
        const title = getByText('Card Details');
        expect(title.props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    color: '#1F2937',
                }),
            ])
        );
    });

    it('should support RTL layout', () => {
        const { rerender } = render(<StripeCardField {...defaultProps} isRTL={false} />);
        expect(screen.getByText('Card Details')).toBeTruthy();
        
        rerender(<StripeCardField {...defaultProps} isRTL={true} />);
        expect(screen.getByText('Card Details')).toBeTruthy();
    });

    it('should have proper card field styling', () => {
        render(<StripeCardField {...defaultProps} />);
        
        const cardField = screen.getByTestId('card-field');
        expect(cardField.props.cardStyle).toEqual(
            expect.objectContaining({
                backgroundColor: '#FFFFFF',
                textColor: '#1F2937',
            })
        );
    });

    it('should display placeholder text for card number', () => {
        render(<StripeCardField {...defaultProps} />);
        
        // CardField should have placeholder configured
        const cardField = screen.getByTestId('card-field');
        expect(cardField.props.placeholders).toEqual({
            number: '1234 1234 1234 1234',
            expiration: 'MM/YY',
            cvc: 'CVC',
        });
    });

    it('should not include postal code field', () => {
        render(<StripeCardField {...defaultProps} />);
        
        const cardField = screen.getByTestId('card-field');
        expect(cardField.props.postalCodeEnabled).toBe(false);
    });
});
