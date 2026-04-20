/**
 * PartDetailsStep Component Test
 * Tests the part specifications wizard step with category, condition, and quantity selectors
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import PartDetailsStep from '../../../components/request/PartDetailsStep';

describe('PartDetailsStep', () => {
    const defaultProps = {
        colors: {
            surface: '#FFFFFF',
            text: '#1F2937',
            textSecondary: '#6B7280',
        },
        t: (key: string) => {
            const translations: Record<string, string> = {
                'newRequest.partDetails': 'Part Details',
                'newRequest.specifyPartInfo': 'Specify part information',
                'newRequest.category': 'Category',
                'newRequest.selectCategory': 'Select category',
                'newRequest.condition': 'Condition',
                'newRequest.partNumber': 'Part Number (Optional)',
                'newRequest.enterPartNumber': 'Enter part number',
                'newRequest.quantity': 'Quantity',
                'newRequest.side': 'Side',
            };
            return translations[key] || key;
        },
        isRTL: false,
        rtlFlexDirection: (isRTL: boolean) => isRTL ? 'row-reverse' : 'row',
        rtlTextAlign: (isRTL: boolean) => isRTL ? 'right' : 'left',
        partCategory: '',
        partSubCategory: '',
        condition: 'any',
        quantity: 1,
        side: 'na' as const,
        setPartCategory: jest.fn(),
        setPartSubCategory: jest.fn(),
        setCondition: jest.fn(),
        setQuantity: jest.fn(),
        setSide: jest.fn(),
        availableSubCategories: ['Engine', 'Transmission', 'Suspension'],
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render step header with title', () => {
        render(<PartDetailsStep {...defaultProps} />);
        
        expect(screen.getByText('Part Details')).toBeTruthy();
    });

    it('should render step subtitle', () => {
        render(<PartDetailsStep {...defaultProps} />);
        
        expect(screen.getByText('Specify part information')).toBeTruthy();
    });

    it('should display step number badge', () => {
        render(<PartDetailsStep {...defaultProps} />);
        
        expect(screen.getByText('2')).toBeTruthy();
    });

    it('should render category dropdown label', () => {
        render(<PartDetailsStep {...defaultProps} />);
        
        expect(screen.getByText('Category')).toBeTruthy();
    });

    it('should render category placeholder', () => {
        render(<PartDetailsStep {...defaultProps} />);
        
        expect(screen.getByText('Select category')).toBeTruthy();
    });

    it('should call setPartCategory when category is selected', () => {
        const setPartCategoryMock = jest.fn();
        render(<PartDetailsStep {...defaultProps} setPartCategory={setPartCategoryMock} />);
        
        const categoryDropdown = screen.getByText('Select category');
        fireEvent.press(categoryDropdown);
        
        expect(setPartCategoryMock).toHaveBeenCalled();
    });

    it('should render condition selector', () => {
        render(<PartDetailsStep {...defaultProps} />);
        
        expect(screen.getByText('Condition')).toBeTruthy();
    });

    it('should display current condition value', () => {
        render(<PartDetailsStep {...defaultProps} condition="any" />);
        
        expect(screen.getByText('any')).toBeTruthy();
    });

    it('should call setCondition when condition is changed', () => {
        const setConditionMock = jest.fn();
        render(<PartDetailsStep {...defaultProps} setCondition={setConditionMock} />);
        
        const conditionSelector = screen.getByText('any');
        fireEvent.press(conditionSelector);
        
        expect(setConditionMock).toHaveBeenCalled();
    });

    it('should render quantity selector', () => {
        render(<PartDetailsStep {...defaultProps} />);
        
        expect(screen.getByText('Quantity')).toBeTruthy();
    });

    it('should display current quantity value', () => {
        render(<PartDetailsStep {...defaultProps} quantity={2} />);
        
        expect(screen.getByText('2')).toBeTruthy();
    });

    it('should call setQuantity when quantity is changed', () => {
        const setQuantityMock = jest.fn();
        render(<PartDetailsStep {...defaultProps} setQuantity={setQuantityMock} />);
        
        const incrementButton = screen.getByTestId('quantity-increment');
        if (incrementButton) {
            fireEvent.press(incrementButton);
        }
        
        expect(setQuantityMock).toHaveBeenCalled();
    });

    it('should render side selector', () => {
        render(<PartDetailsStep {...defaultProps} />);
        
        expect(screen.getByText('Side')).toBeTruthy();
    });

    it('should call setSide when side is changed', () => {
        const setSideMock = jest.fn();
        render(<PartDetailsStep {...defaultProps} setSide={setSideMock} />);
        
        const sideSelector = screen.getByText('na');
        fireEvent.press(sideSelector);
        
        expect(setSideMock).toHaveBeenCalled();
    });

    it('should render part number input', () => {
        render(<PartDetailsStep {...defaultProps} />);
        
        expect(screen.getByText('Part Number (Optional)')).toBeTruthy();
    });

    it('should support RTL layout', () => {
        const { rerender } = render(<PartDetailsStep {...defaultProps} isRTL={false} />);
        expect(screen.getByText('Part Details')).toBeTruthy();
        
        rerender(<PartDetailsStep {...defaultProps} isRTL={true} />);
        expect(screen.getByText('Part Details')).toBeTruthy();
    });

    it('should display subcategory dropdown when category is selected', () => {
        render(<PartDetailsStep {...defaultProps} partCategory="Engine" availableSubCategories={['Engine']} />);
        
        expect(screen.getByText('Engine')).toBeTruthy();
    });
});
