/**
 * PartDetailsStep Component Test
 * Tests the part specifications wizard step with category, condition, and quantity selectors
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import PartDetailsStep from '../../../components/request/PartDetailsStep';

jest.mock('../../../contexts/LanguageContext', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, string>) => {
            const translations: Record<string, string> = {
                'newRequest.partSpecs': 'Part Specs',
                'newRequest.quantity': 'Quantity',
                'newRequest.side': 'Side',
                'newRequest.leftSide': 'Left',
                'newRequest.rightSide': 'Right',
                'newRequest.bothSides': 'Both',
                'newRequest.notApplicable': 'N/A',
                'newRequest.partNumberOptional': 'Part Number (Optional)',
                'newRequest.partNumberPlaceholder': 'Enter part number',
                'newRequest.conditionPreference': 'Condition',
                'common.other': 'Other',
                'common.searchPlaceholder': 'Search',
                'common.noMatches': 'No matches',
                'common.enterManually': 'Enter manually',
                'common.typeValue': `Type ${params?.label || 'value'}`,
                'common.confirm': 'Confirm',
                'common.backToList': 'Back to list',
            };
            return translations[key] || key;
        },
        isRTL: false,
    }),
}));

jest.mock('../../../contexts', () => ({
    useTheme: () => ({
        colors: {
            background: '#F9FAFB',
            border: '#E5E7EB',
            surface: '#FFFFFF',
            text: '#1F2937',
            textSecondary: '#6B7280',
            textMuted: '#9CA3AF',
        },
    }),
}));

jest.mock('../../../components/SearchableDropdown', () => {
    return function MockSearchableDropdown({ label, placeholder, value, onSelect, items }: any) {
        const React = require('react');
        const { View, Text, TouchableOpacity } = require('react-native');

        return (
            <View>
                {label && <Text>{label}</Text>}
                <TouchableOpacity onPress={() => onSelect(items?.[0] || 'Selected')}>
                    <Text>{value || placeholder}</Text>
                </TouchableOpacity>
            </View>
        );
    };
});

describe('PartDetailsStep', () => {
    const defaultProps = {
        colors: {
            surface: '#FFFFFF',
            background: '#F9FAFB',
            border: '#E5E7EB',
            text: '#1F2937',
            textSecondary: '#6B7280',
            textMuted: '#9CA3AF',
        },
        t: (key: string) => {
            const translations: Record<string, string> = {
                'newRequest.partDetails': 'Part Details',
                'newRequest.whatDoYouNeed': 'Specify part information',
                'newRequest.categoryOptional': 'Category',
                'newRequest.categoryPlaceholder': 'Select category',
                'newRequest.subcategoryOptional': 'Subcategory',
                'newRequest.selectSubcategory': 'Select subcategory',
                'newRequest.description': 'Description',
                'newRequest.descriptionPlaceholder': 'Describe the part',
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
        partDescription: '',
        condition: 'any',
        quantity: 1,
        side: 'na' as const,
        partNumber: '',
        setPartCategory: jest.fn(),
        setPartSubCategory: jest.fn(),
        setPartDescription: jest.fn(),
        setCondition: jest.fn(),
        setQuantity: jest.fn(),
        setSide: jest.fn(),
        setPartNumber: jest.fn(),
        availableSubCategories: ['Engine', 'Transmission', 'Suspension'],
        CONDITION_OPTIONS: [
            { value: 'any', label: 'Any', icon: 'help-circle-outline', color: '#6B7280' },
            { value: 'new', label: 'New', icon: 'sparkles-outline', color: '#22C55E' },
            { value: 'used', label: 'Used', icon: 'refresh-outline', color: '#F59E0B' },
        ],
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
        
        expect(screen.getByText('Any')).toBeTruthy();
    });

    it('should call setCondition when condition is changed', () => {
        const setConditionMock = jest.fn();
        render(<PartDetailsStep {...defaultProps} setCondition={setConditionMock} />);
        
        const conditionSelector = screen.getByTestId('condition-any');
        fireEvent.press(conditionSelector);
        
        expect(setConditionMock).toHaveBeenCalled();
    });

    it('should render quantity selector', () => {
        render(<PartDetailsStep {...defaultProps} />);
        
        expect(screen.getByText('Quantity')).toBeTruthy();
    });

    it('should display current quantity value', () => {
        render(<PartDetailsStep {...defaultProps} quantity={2} />);
        
        expect(screen.getAllByText('2').length).toBeGreaterThan(0);
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
        
        const sideSelector = screen.getByTestId('side-na');
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
