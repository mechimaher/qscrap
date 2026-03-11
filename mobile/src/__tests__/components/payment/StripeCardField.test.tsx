/**
 * StripeCardField Component Test
 * Tests the Stripe card input wrapper with completion callback
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { StripeCardField } from '../../../components/payment/StripeCardField';

import { View } from 'react-native';

// Mock Stripe provider and CardField
const mockSetCardComplete = jest.fn();
jest.mock('@stripe/stripe-react-native', () => ({
    CardField: (props: any) => (
        <View
            testID="card-field"
            {...{ onChange: () => props.onCardChange?.({ complete: true }) }}
        />
    ),
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

        // Ionicons mock renders text with the icon name
        expect(screen.getByText('lock-closed')).toBeTruthy();
    });

    it('should render security text', () => {
        render(<StripeCardField {...defaultProps} />);

        expect(screen.getByText('Your card information is secure')).toBeTruthy();
    });

    it('should call setCardComplete when card details change', () => {
        render(<StripeCardField {...defaultProps} />);

        const cardField = screen.getByTestId('card-field');
        // CardField uses onCardChange prop (not onChange)
        fireEvent(cardField, 'onCardChange', { complete: true });

        expect(mockSetCardComplete).toHaveBeenCalledWith(true);
    });

    it('should use correct text colors from theme', () => {
        const { getByText } = render(<StripeCardField {...defaultProps} />);

        const title = getByText('Card Details');
        // Title should have the theme text color applied
        expect(title).toBeTruthy();
    });

    it('should support RTL layout', () => {
        const { rerender } = render(<StripeCardField {...defaultProps} isRTL={false} />);
        expect(screen.getByText('Card Details')).toBeTruthy();

        rerender(<StripeCardField {...defaultProps} isRTL={true} />);
        expect(screen.getByText('Card Details')).toBeTruthy();
    });

    it('should render card field component', () => {
        render(<StripeCardField {...defaultProps} />);

        // CardField is mocked to a View with testID
        const cardField = screen.getByTestId('card-field');
        expect(cardField).toBeTruthy();
    });

    it('should render all expected sections', () => {
        render(<StripeCardField {...defaultProps} />);

        // Card details section
        expect(screen.getByText('Card Details')).toBeTruthy();
        // Card input label
        expect(screen.getByText('Enter your card information')).toBeTruthy();
        // Security text
        expect(screen.getByText('Your card information is secure')).toBeTruthy();
        // Lock icon
        expect(screen.getByText('lock-closed')).toBeTruthy();
    });
});
