import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import PartDetailsStep from '../../../components/request/PartDetailsStep';

jest.mock('../../../components/SearchableDropdown', () => {
    const React = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');

    return function MockSearchableDropdown({
        label,
        placeholder,
        value,
        onSelect,
    }: any) {
        const suffix = String(label || placeholder).toLowerCase().replace(/\s+/g, '-');
        return (
            <View testID={`searchable-dropdown-${suffix}`}>
                {label ? <Text>{label}</Text> : null}
                <TouchableOpacity testID={`dropdown-trigger-${suffix}`} onPress={() => onSelect('Selected Value')}>
                    <Text>{value || placeholder}</Text>
                </TouchableOpacity>
            </View>
        );
    };
});

jest.mock('../../../components/request/PartSpecsCard', () => {
    const React = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');

    return function MockPartSpecsCard({
        quantity,
        onQuantityChange,
        side,
        onSideChange,
        partNumber,
        onPartNumberChange,
        condition,
        onConditionChange,
    }: any) {
        return (
            <View testID="part-specs-card">
                <Text>Quantity</Text>
                <Text>{quantity}</Text>
                <TouchableOpacity testID="quantity-increment" onPress={() => onQuantityChange(quantity + 1)}>
                    <Text>Increment</Text>
                </TouchableOpacity>

                <Text>Side</Text>
                <Text>{side}</Text>
                <TouchableOpacity testID="side-change" onPress={() => onSideChange('left')}>
                    <Text>Change Side</Text>
                </TouchableOpacity>

                <Text>Condition</Text>
                <Text>{condition}</Text>
                <TouchableOpacity testID="condition-change" onPress={() => onConditionChange('new')}>
                    <Text>Change Condition</Text>
                </TouchableOpacity>

                <Text>Part Number (Optional)</Text>
                <Text>{partNumber}</Text>
                <TouchableOpacity testID="part-number-change" onPress={() => onPartNumberChange('PN-123')}>
                    <Text>Set Part Number</Text>
                </TouchableOpacity>
            </View>
        );
    };
});

describe('PartDetailsStep', () => {
    const defaultProps = {
        colors: {
            surface: '#FFFFFF',
            text: '#1F2937',
            textSecondary: '#6B7280',
            background: '#F9FAFB',
            border: '#E5E7EB',
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
                'newRequest.descriptionPlaceholder': 'Describe the needed part',
            };
            return translations[key] || key;
        },
        isRTL: false,
        rtlFlexDirection: (isRTL: boolean) => (isRTL ? 'row-reverse' : 'row'),
        rtlTextAlign: (isRTL: boolean) => (isRTL ? 'right' : 'left'),
        partCategory: '',
        setPartCategory: jest.fn(),
        availableSubCategories: [] as string[],
        partSubCategory: '',
        setPartSubCategory: jest.fn(),
        partDescription: '',
        setPartDescription: jest.fn(),
        quantity: 1,
        setQuantity: jest.fn(),
        side: 'na' as const,
        setSide: jest.fn(),
        partNumber: '',
        setPartNumber: jest.fn(),
        condition: 'any',
        setCondition: jest.fn(),
        CONDITION_OPTIONS: [
            { value: 'any', label: 'Any', icon: 'help-circle-outline', color: '#9CA3AF' },
            { value: 'new', label: 'New', icon: 'checkmark-circle-outline', color: '#22C55E' },
        ],
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders step header and category selector', () => {
        render(<PartDetailsStep {...defaultProps} />);

        expect(screen.getByText('Part Details')).toBeTruthy();
        expect(screen.getByText('Specify part information')).toBeTruthy();
        expect(screen.getByText('2')).toBeTruthy();
        expect(screen.getByText('Category')).toBeTruthy();
        expect(screen.getByText('Select category')).toBeTruthy();
    });

    it('calls setPartCategory from category dropdown', () => {
        const setPartCategory = jest.fn();
        render(<PartDetailsStep {...defaultProps} setPartCategory={setPartCategory} />);

        fireEvent.press(screen.getByTestId('dropdown-trigger-category'));
        expect(setPartCategory).toHaveBeenCalledWith('Selected Value');
    });

    it('renders subcategory dropdown when category is selected', () => {
        render(
            <PartDetailsStep
                {...defaultProps}
                partCategory="Engine"
                availableSubCategories={['Engine', 'Cooling']}
            />
        );

        expect(screen.getByText('Subcategory')).toBeTruthy();
        expect(screen.getByText('Select subcategory')).toBeTruthy();
    });

    it('renders description field and character count', () => {
        render(<PartDetailsStep {...defaultProps} partDescription="Brake pad issue" />);

        expect(screen.getByText('Description *')).toBeTruthy();
        expect(screen.getByText('15/500')).toBeTruthy();
    });

    it('calls setPartDescription on text change', () => {
        const setPartDescription = jest.fn();
        render(<PartDetailsStep {...defaultProps} setPartDescription={setPartDescription} />);

        fireEvent.changeText(screen.getByPlaceholderText('Describe the needed part'), 'Need front bumper');
        expect(setPartDescription).toHaveBeenCalledWith('Need front bumper');
    });

    it('wires quantity, side, condition, and part number callbacks', () => {
        const setQuantity = jest.fn();
        const setSide = jest.fn();
        const setCondition = jest.fn();
        const setPartNumber = jest.fn();

        render(
            <PartDetailsStep
                {...defaultProps}
                setQuantity={setQuantity}
                setSide={setSide}
                setCondition={setCondition}
                setPartNumber={setPartNumber}
            />
        );

        fireEvent.press(screen.getByTestId('quantity-increment'));
        fireEvent.press(screen.getByTestId('side-change'));
        fireEvent.press(screen.getByTestId('condition-change'));
        fireEvent.press(screen.getByTestId('part-number-change'));

        expect(setQuantity).toHaveBeenCalledWith(2);
        expect(setSide).toHaveBeenCalledWith('left');
        expect(setCondition).toHaveBeenCalledWith('new');
        expect(setPartNumber).toHaveBeenCalledWith('PN-123');
    });

    it('supports RTL layout', () => {
        const { rerender } = render(<PartDetailsStep {...defaultProps} isRTL={false} />);
        expect(screen.getByText('Part Details')).toBeTruthy();

        rerender(<PartDetailsStep {...defaultProps} isRTL={true} />);
        expect(screen.getByText('Part Details')).toBeTruthy();
    });
});
