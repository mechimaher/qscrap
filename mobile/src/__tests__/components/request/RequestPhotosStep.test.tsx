/**
 * RequestPhotosStep Component Test
 * Tests the part damage photos wizard step with multi-image upload
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

import RequestPhotosStep from '../../../components/request/RequestPhotosStep';

describe('RequestPhotosStep', () => {
    const defaultProps = {
        colors: {
            surface: '#FFFFFF',
            text: '#1F2937',
            textSecondary: '#6B7280',
        },
        t: (key: string) => {
            const translations: Record<string, string> = {
                'newRequest.photosOptional': 'Photos (Optional)',
                'newRequest.addUpTo5': 'Add up to 5 photos of the part',
            };
            return translations[key] || key;
        },
        isRTL: false,
        rtlFlexDirection: (isRTL: boolean) => isRTL ? 'row-reverse' : 'row',
        rtlTextAlign: (isRTL: boolean) => isRTL ? 'right' : 'left',
        images: [] as string[],
        handlePickImage: jest.fn(),
        handleTakePhoto: jest.fn(),
        handleRemoveImage: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render step header with title', () => {
        render(<RequestPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('Photos (Optional)')).toBeTruthy();
    });

    it('should render step subtitle', () => {
        render(<RequestPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('Add up to 5 photos of the part')).toBeTruthy();
    });

    it('should display step number badge', () => {
        render(<RequestPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('3')).toBeTruthy();
    });

    it('should render gallery button when no images', () => {
        render(<RequestPhotosStep {...defaultProps} />);
        
        // PhotoUploadSection renders buttons with context t() which returns raw keys
        expect(screen.getByText('common.gallery')).toBeTruthy();
    });

    it('should render camera button when no images', () => {
        render(<RequestPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('common.camera')).toBeTruthy();
    });

    it('should support RTL layout', () => {
        const { rerender } = render(<RequestPhotosStep {...defaultProps} isRTL={false} />);
        expect(screen.getByText('Photos (Optional)')).toBeTruthy();
        
        rerender(<RequestPhotosStep {...defaultProps} isRTL={true} />);
        expect(screen.getByText('Photos (Optional)')).toBeTruthy();
    });

    it('should hide add buttons when max images reached', () => {
        const images = ['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg', 'img5.jpg'];
        render(<RequestPhotosStep {...defaultProps} images={images} />);
        
        // When 5 images are loaded, gallery/camera buttons should not appear
        expect(screen.queryByText('common.gallery')).toBeNull();
        expect(screen.queryByText('common.camera')).toBeNull();
    });

    it('should show gallery and camera when under limit', () => {
        const images = ['img1.jpg', 'img2.jpg'];
        render(<RequestPhotosStep {...defaultProps} images={images} />);
        
        expect(screen.getByText('common.gallery')).toBeTruthy();
        expect(screen.getByText('common.camera')).toBeTruthy();
    });
});
