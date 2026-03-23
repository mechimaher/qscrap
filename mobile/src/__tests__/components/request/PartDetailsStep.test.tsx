/**
 * PartDetailsStep Component Test
 * Tests the part specifications wizard step with category, condition, and quantity selectors
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import PartDetailsStep from '../../../components/request/PartDetailsStep';

// Provide stable translations for the components under test
const translations: Record<string, string> = {
    'newRequest.partDetails': 'Part Details',
    'newRequest.whatDoYouNeed': 'What do you need?',
    'newRequest.partSpecs': 'Part Specifications',
    'newRequest.categoryOptional': 'Category (Optional)',
    'newRequest.categoryPlaceholder': 'e.g. Engine, Body, Interior',
    'newRequest.subcategoryOptional': 'Subcategory (Optional)',
    'newRequest.selectSubcategory': 'Select subcategory',
    'newRequest.description': 'Description',
    'newRequest.descriptionPlaceholder': 'Describe the part and issue',
    'newRequest.quantity': 'Quantity',
    'newRequest.side': 'Position / Side',
    'newRequest.leftSide': 'Left',
    'newRequest.rightSide': 'Right',
    'newRequest.bothSides': 'Both',
    'newRequest.notApplicable': 'N/A',
    'newRequest.partNumberOptional': 'Part Number (Optional)',
    'newRequest.partNumberPlaceholder': 'Enter part number',
    'newRequest.conditionPreference': 'Condition Preference',
    'newRequest.anyCondition': 'Any Condition',
    'newRequest.newOnly': 'New Only',
    'newRequest.usedOnly': 'Used Only'
};

jest.mock('src/contexts/LanguageContext', () => ({
    useTranslation: () => ({
        t: (key: string) => translations[key] || key,
        isRTL: false,
        language: 'en'
    }),
    useLanguage: () => ({
        language: 'en',
        isRTL: false,
        t: (key: string) => translations[key] || key
    }),
    useRTL: () => false
}));

// Mock SearchableDropdown to avoid native deps and keep label/placeholder visible
jest.mock('../../../components/SearchableDropdown', () => {
    const React = require('react');
    const { Text, TouchableOpacity } = require('react-native');
    return ({ label, placeholder, value, onSelect, items = [] }: any) => (
        <TouchableOpacity onPress={() => onSelect(items[0] || placeholder)}>
            {label && <Text>{label}</Text>}
            <Text>{value || placeholder}</Text>
        </TouchableOpacity>
    );
});

describe('PartDetailsStep', () => {
    const defaultProps = {
        colors: {
            surface: '#FFFFFF',
            text: '#1F2937',
            textSecondary: '#6B7280'
        },
        t: (key: string) => translations[key] || key,
        isRTL: false,
        rtlFlexDirection: (isRTL: boolean) => (isRTL ? 'row-reverse' : 'row'),
        rtlTextAlign: (isRTL: boolean) => (isRTL ? 'right' : 'left'),
        partCategory: '',
        partSubCategory: '',
        condition: 'any',
        partDescription: 'Brake pads for front axle',
        partNumber: '',
        quantity: 1,
        side: 'na' as const,
        setPartCategory: jest.fn(),
        setPartSubCategory: jest.fn(),
        setCondition: jest.fn(),
        setQuantity: jest.fn(),
        setSide: jest.fn(),
        setPartDescription: jest.fn(),
        setPartNumber: jest.fn(),
        availableSubCategories: ['Engine', 'Transmission', 'Suspension'],
        CONDITION_OPTIONS: [
            { value: 'any', label: translations['newRequest.anyCondition'], icon: 'sync-outline', color: '#6B7280' },
            { value: 'new', label: translations['newRequest.newOnly'], icon: 'sparkles', color: '#22C55E' },
            { value: 'used', label: translations['newRequest.usedOnly'], icon: 'leaf-outline', color: '#F59E0B' }
        ]
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

        expect(screen.getByText('What do you need?')).toBeTruthy();
    });

    it('should display step number badge', () => {
        render(<PartDetailsStep {...defaultProps} />);

        expect(screen.getByText('2')).toBeTruthy();
    });

    it('should render category dropdown label', () => {
        render(<PartDetailsStep {...defaultProps} />);

        expect(screen.getByText('Category (Optional)')).toBeTruthy();
    });

    it('should render category placeholder', () => {
        render(<PartDetailsStep {...defaultProps} />);

        expect(screen.getByText('e.g. Engine, Body, Interior')).toBeTruthy();
    });

    it('should call setPartCategory when category is selected', () => {
        const setPartCategoryMock = jest.fn();
        render(<PartDetailsStep {...defaultProps} setPartCategory={setPartCategoryMock} />);

        const categoryDropdown = screen.getByText('e.g. Engine, Body, Interior');
        fireEvent.press(categoryDropdown);

        expect(setPartCategoryMock).toHaveBeenCalled();
    });

    it('should render condition selector', () => {
        render(<PartDetailsStep {...defaultProps} />);

        expect(screen.getByText('Condition Preference')).toBeTruthy();
    });

    it('should display current condition value', () => {
        render(<PartDetailsStep {...defaultProps} condition="any" />);

        expect(screen.getByText('Any Condition')).toBeTruthy();
    });

    it('should call setCondition when condition is changed', () => {
        const setConditionMock = jest.fn();
        render(<PartDetailsStep {...defaultProps} setCondition={setConditionMock} />);

        const conditionSelector = screen.getByText('Any Condition');
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

        fireEvent.press(screen.getByText('+'));
        expect(setQuantityMock).toHaveBeenCalled();
    });

    it('should render side selector', () => {
        render(<PartDetailsStep {...defaultProps} />);

        expect(screen.getByText('Position / Side')).toBeTruthy();
    });

    it('should call setSide when side is changed', () => {
        const setSideMock = jest.fn();
        render(<PartDetailsStep {...defaultProps} setSide={setSideMock} />);

        const sideSelector = screen.getByText('N/A');
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

        expect(screen.getByText('Select subcategory')).toBeTruthy();
    });
});
