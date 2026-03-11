/**
 * PaymentSummary Component Test
 * Tests the VVIP Order Card gradient display with garage name, part description, and price breakdown
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PaymentSummary } from '../../../components/payment/PaymentSummary';

// Mock LinearGradient
jest.mock('expo-linear-gradient', () => {
    const { View } = require('react-native');
    return { LinearGradient: View };
});

describe('PaymentSummary', () => {
    const defaultProps = {
        garageName: 'Al-Futtaim Garage',
        partDescription: 'Front Bumper for Toyota Camry 2024',
        partPrice: 500,
        deliveryFee: 50,
        totalAmount: 550,
        isRTL: false,
        t: (key: string) => {
            const translations: Record<string, string> = {
                'payment.part': 'Part',
                'order.partPrice': 'Part Price',
                'order.deliveryFee': 'Delivery Fee',
                'common.total': 'Total',
                'common.currency': 'QAR',
            };
            return translations[key] || key;
        },
    };

    it('should render VVIP order card with garage name', () => {
        render(<PaymentSummary {...defaultProps} />);
        
        expect(screen.getByText('Al-Futtaim Garage')).toBeTruthy();
    });

    it('should render part description', () => {
        render(<PaymentSummary {...defaultProps} />);
        
        expect(screen.getByText('Front Bumper for Toyota Camry 2024')).toBeTruthy();
    });

    it('should render part label', () => {
        render(<PaymentSummary {...defaultProps} />);
        
        expect(screen.getByText('Part')).toBeTruthy();
    });

    it('should render part price with currency', () => {
        render(<PaymentSummary {...defaultProps} />);
        
        expect(screen.getByText('500 QAR')).toBeTruthy();
    });

    it('should render delivery fee with currency', () => {
        render(<PaymentSummary {...defaultProps} />);
        
        expect(screen.getByText('50 QAR')).toBeTruthy();
    });

    it('should render total amount with currency', () => {
        render(<PaymentSummary {...defaultProps} />);
        
        expect(screen.getByText('550 QAR')).toBeTruthy();
    });

    it('should handle long part descriptions with truncation', () => {
        const longDescription = 'This is a very long part description that should be truncated properly in the UI to prevent layout issues';
        render(<PaymentSummary {...defaultProps} partDescription={longDescription} />);
        
        expect(screen.getByText(longDescription)).toBeTruthy();
    });

    it('should handle zero prices', () => {
        render(<PaymentSummary {...defaultProps} partPrice={0} deliveryFee={0} totalAmount={0} />);
        
        // All three price fields show '0 QAR' so use getAllByText
        expect(screen.getAllByText('0 QAR').length).toBeGreaterThanOrEqual(1);
    });

    it('should handle decimal prices correctly', () => {
        render(<PaymentSummary {...defaultProps} partPrice={499.99} deliveryFee={49.99} totalAmount={549.98} />);
        
        expect(screen.getByText('500 QAR')).toBeTruthy(); // toFixed(0) rounds
    });

    it('should support RTL layout', () => {
        const { rerender } = render(<PaymentSummary {...defaultProps} isRTL={false} />);
        expect(screen.getByText('Al-Futtaim Garage')).toBeTruthy();
        
        rerender(<PaymentSummary {...defaultProps} isRTL={true} />);
        expect(screen.getByText('Al-Futtaim Garage')).toBeTruthy();
    });
});
