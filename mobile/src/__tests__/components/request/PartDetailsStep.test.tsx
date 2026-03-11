/**
 * PartDetailsStep Component Test
 * Tests the part specifications wizard step with category, condition, and quantity selectors
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

// Mock contexts before component imports
jest.mock('../../../contexts/LanguageContext', () => ({
    useTranslation: () => ({ t: (key: string) => key, language: 'en', isRTL: false }),
    useLanguage: () => ({ language: 'en', isRTL: false, setLanguage: jest.fn(), t: (key: string) => key, translations: {} }),
    useRTL: () => false,
}));
jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: null, isAuthenticated: false }),
}));
jest.mock('../../../contexts/ThemeContext', () => ({
    useTheme: () => ({ colors: { surface: '#fff', text: '#000', textSecondary: '#666', textMuted: '#999', background: '#fff', primary: '#3B82F6', border: '#E5E7EB' }, isDark: false, setTheme: jest.fn() }),
}));
// Also mock barrel export (PartSpecsCard imports from '../../contexts')
jest.mock('../../../contexts', () => ({
    useAuth: () => ({ user: null, isAuthenticated: false }),
    useTheme: () => ({ colors: { surface: '#fff', text: '#000', textSecondary: '#666', textMuted: '#999', background: '#fff', primary: '#3B82F6', border: '#E5E7EB' }, isDark: false, setTheme: jest.fn() }),
    useTranslation: () => ({ t: (key: string) => key, language: 'en', isRTL: false }),
    useLanguage: () => ({ language: 'en', isRTL: false, setLanguage: jest.fn(), t: (key: string) => key, translations: {} }),
    useRTL: () => false,
    LanguageProvider: ({ children }: any) => children,
}));
// Mock SearchableDropdown to avoid complex internal rendering
jest.mock('../../../components/SearchableDropdown', () => {
    const React = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');
    return {
        __esModule: true,
        default: ({ label, placeholder, value, onSelect }: any) => (
            React.createElement(View, { testID: 'searchable-dropdown' },
                label ? React.createElement(Text, null, label) : null,
                React.createElement(TouchableOpacity, { onPress: () => onSelect('test') },
                    React.createElement(Text, null, value || placeholder)
                )
            )
        ),
    };
});

import PartDetailsStep from '../../../components/request/PartDetailsStep';

describe('PartDetailsStep', () => {
    const defaultProps = {
        colors: {
            surface: '#FFFFFF',
            text: '#1F2937',
            textSecondary: '#6B7280',
            textMuted: '#9CA3AF',
            background: '#F9FAFB',
            border: '#E5E7EB',
        },
        t: (key: string) => {
            const translations: Record<string, string> = {
                'newRequest.partDetails': 'Part Details',
                'newRequest.whatDoYouNeed': 'What part do you need?',
                'newRequest.categoryOptional': 'Category (Optional)',
                'newRequest.categoryPlaceholder': 'Select a category',
                'newRequest.subcategoryOptional': 'Subcategory (Optional)',
                'newRequest.selectSubcategory': 'Select subcategory',
                'newRequest.description': 'Description',
                'newRequest.descriptionPlaceholder': 'Describe the part you need...',
            };
            return translations[key] || key;
        },
        isRTL: false,
        rtlFlexDirection: (isRTL: boolean) => isRTL ? 'row-reverse' : 'row',
        rtlTextAlign: (isRTL: boolean) => isRTL ? 'right' : 'left',
        partCategory: '',
        partSubCategory: '',
        partDescription: '',
        setPartDescription: jest.fn(),
        condition: 'any',
        quantity: 1,
        side: 'na' as const,
        partNumber: '',
        setPartCategory: jest.fn(),
        setPartSubCategory: jest.fn(),
        setCondition: jest.fn(),
        setQuantity: jest.fn(),
        setSide: jest.fn(),
        setPartNumber: jest.fn(),
        availableSubCategories: [],
        CONDITION_OPTIONS: ['any', 'new', 'used'],
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
        
        expect(screen.getByText('What part do you need?')).toBeTruthy();
    });

    it('should display step number badge', () => {
        render(<PartDetailsStep {...defaultProps} />);
        
        expect(screen.getByText('2')).toBeTruthy();
    });

    it('should render category dropdown label', () => {
        render(<PartDetailsStep {...defaultProps} />);
        
        expect(screen.getByText('Category (Optional)')).toBeTruthy();
    });

    it('should render description label', () => {
        render(<PartDetailsStep {...defaultProps} />);
        
        // Component renders "Description *" (with asterisk for required)
        expect(screen.getByText(/Description/)).toBeTruthy();
    });

    it('should render description input with placeholder', () => {
        render(<PartDetailsStep {...defaultProps} />);
        
        expect(screen.getByPlaceholderText('Describe the part you need...')).toBeTruthy();
    });

    it('should display character count', () => {
        render(<PartDetailsStep {...defaultProps} partDescription="test" />);
        
        expect(screen.getByText('4/500')).toBeTruthy();
    });

    it('should support RTL layout', () => {
        const { rerender } = render(<PartDetailsStep {...defaultProps} isRTL={false} />);
        expect(screen.getByText('Part Details')).toBeTruthy();
        
        rerender(<PartDetailsStep {...defaultProps} isRTL={true} />);
        expect(screen.getByText('Part Details')).toBeTruthy();
    });

    it('should show subcategory dropdown when category is selected', () => {
        render(<PartDetailsStep {...defaultProps} partCategory="Engine" availableSubCategories={['Oil Filter', 'Spark Plug']} />);
        
        expect(screen.getByText('Subcategory (Optional)')).toBeTruthy();
    });

    it('should hide subcategory when no category selected', () => {
        render(<PartDetailsStep {...defaultProps} partCategory="" availableSubCategories={[]} />);
        
        expect(screen.queryByText('Subcategory (Optional)')).toBeNull();
    });
});
