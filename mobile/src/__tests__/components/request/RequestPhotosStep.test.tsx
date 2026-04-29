/**
 * RequestPhotosStep Component Test
 * Tests the part damage photos wizard step with multi-image upload
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import RequestPhotosStep from '../../../components/request/RequestPhotosStep';

jest.mock('../../../contexts/LanguageContext', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'common.gallery': 'Gallery',
                'common.camera': 'Camera',
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
            textSecondary: '#6B7280',
        },
    }),
}));

describe('RequestPhotosStep', () => {
    const defaultProps = {
        colors: {
            surface: '#FFFFFF',
            text: '#1F2937',
            textSecondary: '#6B7280',
        },
        t: (key: string) => {
            const translations: Record<string, string> = {
                'newRequest.photosOptional': 'Part Photos',
                'newRequest.addUpTo5': 'Upload photos of part damage',
            };
            return translations[key] || key;
        },
        isRTL: false,
        rtlFlexDirection: (isRTL: boolean) => isRTL ? 'row-reverse' : 'row',
        rtlTextAlign: (isRTL: boolean) => isRTL ? 'right' : 'left',
        images: [],
        handlePickImage: jest.fn(),
        handleTakePhoto: jest.fn(),
        handleRemoveImage: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render step header with title', () => {
        render(<RequestPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('Part Photos')).toBeTruthy();
    });

    it('should render step subtitle', () => {
        render(<RequestPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('Upload photos of part damage')).toBeTruthy();
    });

    it('should display step number badge', () => {
        render(<RequestPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('3')).toBeTruthy();
    });

    it('should render add photo button when no images', () => {
        render(<RequestPhotosStep {...defaultProps} />);
        
        expect(screen.getByTestId('image-pick-image')).toBeTruthy();
    });

    it('should render take photo button', () => {
        render(<RequestPhotosStep {...defaultProps} />);
        
        expect(screen.getByTestId('image-take-photo')).toBeTruthy();
    });

    it('should call handlePickImage when add photo is pressed', () => {
        const handlePickImageMock = jest.fn();
        render(<RequestPhotosStep {...defaultProps} handlePickImage={handlePickImageMock} />);
        
        const addButton = screen.getByTestId('image-pick-image');
        fireEvent.press(addButton);
        
        expect(handlePickImageMock).toHaveBeenCalled();
    });

    it('should call handleTakePhoto when take photo is pressed', () => {
        const handleTakePhotoMock = jest.fn();
        render(<RequestPhotosStep {...defaultProps} handleTakePhoto={handleTakePhotoMock} />);
        
        const takeButton = screen.getByTestId('image-take-photo');
        fireEvent.press(takeButton);
        
        expect(handleTakePhotoMock).toHaveBeenCalled();
    });

    it('should display uploaded images', () => {
        const images = ['image1.jpg', 'image2.jpg'];
        render(<RequestPhotosStep {...defaultProps} images={images} />);
        
        expect(screen.getAllByTestId('image-preview').length).toBe(2);
    });

    it('should call removeImage when remove button is pressed', () => {
        const removeImageMock = jest.fn();
        const images = ['image1.jpg'];
        render(<RequestPhotosStep {...defaultProps} images={images} handleRemoveImage={removeImageMock} />);
        
        const removeButton = screen.getByTestId('remove-image-0');
        if (removeButton) {
            fireEvent.press(removeButton);
        }
        
        expect(removeImageMock).toHaveBeenCalledWith(0);
    });

    it('should show image count limit (max 5)', () => {
        const images = ['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg', 'img5.jpg'];
        render(<RequestPhotosStep {...defaultProps} images={images} />);
        
        // Add photo button should be disabled or hidden when max reached
        const addButton = screen.queryByTestId('image-pick-image');
        expect(addButton).toBeNull();
    });

    it('should support RTL layout', () => {
        const { rerender } = render(<RequestPhotosStep {...defaultProps} isRTL={false} />);
        expect(screen.getByText('Part Photos')).toBeTruthy();
        
        rerender(<RequestPhotosStep {...defaultProps} isRTL={true} />);
        expect(screen.getByText('Part Photos')).toBeTruthy();
    });

    it('should display empty state when no images', () => {
        render(<RequestPhotosStep {...defaultProps} />);
        
        expect(screen.queryByTestId('image-preview')).toBeNull();
    });
});
