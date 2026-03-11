/**
 * VehicleIdPhotosStep Component Test
 * Tests the vehicle ID photos wizard step with front and rear photo upload
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
    useTheme: () => ({ colors: { surface: '#fff', text: '#000', textSecondary: '#666', background: '#fff', primary: '#3B82F6', border: '#E5E7EB' }, isDark: false, setTheme: jest.fn() }),
}));

import VehicleIdPhotosStep from '../../../components/request/VehicleIdPhotosStep';

describe('VehicleIdPhotosStep', () => {
    const defaultProps = {
        colors: {
            surface: '#FFFFFF',
            text: '#1F2937',
            textSecondary: '#6B7280',
        },
        t: (key: string) => {
            const translations: Record<string, string> = {
                'newRequest.vehicleIdPhotos': 'Vehicle ID Photos',
                'newRequest.helpGaragesIdentify': 'Help garages identify your vehicle',
                'newRequest.frontView': 'Front View',
                'newRequest.rearView': 'Rear View',
            };
            return translations[key] || key;
        },
        isRTL: false,
        rtlFlexDirection: (isRTL: boolean) => isRTL ? 'row-reverse' : 'row',
        rtlTextAlign: (isRTL: boolean) => isRTL ? 'right' : 'left',
        carFrontImage: null as string | null,
        carRearImage: null as string | null,
        handlePickCarFrontImage: jest.fn(),
        handlePickCarRearImage: jest.fn(),
        handleTakeCarFrontPhoto: jest.fn(),
        handleTakeCarRearPhoto: jest.fn(),
        setCarFrontImage: jest.fn(),
        setCarRearImage: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render step header with title', () => {
        render(<VehicleIdPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('Vehicle ID Photos')).toBeTruthy();
    });

    it('should render step subtitle', () => {
        render(<VehicleIdPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('Help garages identify your vehicle')).toBeTruthy();
    });

    it('should display step number badge', () => {
        render(<VehicleIdPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('4')).toBeTruthy();
    });

    it('should render front view label', () => {
        render(<VehicleIdPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('Front View')).toBeTruthy();
    });

    it('should render rear view label', () => {
        render(<VehicleIdPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('Rear View')).toBeTruthy();
    });

    it('should render gallery buttons when no images', () => {
        render(<VehicleIdPhotosStep {...defaultProps} />);
        
        // PhotoUploadSection renders gallery/camera buttons using context t()
        // Context mock returns keys, so we look for 'common.gallery' and 'common.camera'
        expect(screen.getAllByText('common.gallery').length).toBe(2); // front + rear
        expect(screen.getAllByText('common.camera').length).toBe(2);
    });

    it('should support RTL layout', () => {
        const { rerender } = render(<VehicleIdPhotosStep {...defaultProps} isRTL={false} />);
        expect(screen.getByText('Vehicle ID Photos')).toBeTruthy();
        
        rerender(<VehicleIdPhotosStep {...defaultProps} isRTL={true} />);
        expect(screen.getByText('Vehicle ID Photos')).toBeTruthy();
    });

    it('should hide gallery buttons when images are provided', () => {
        render(<VehicleIdPhotosStep {...defaultProps} carFrontImage="front.jpg" carRearImage="rear.jpg" />);
        
        expect(screen.queryByText('common.gallery')).toBeNull();
    });
});
