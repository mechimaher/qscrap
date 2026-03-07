/**
 * VehicleIdPhotosStep Component Test
 * Tests the vehicle ID photos wizard step with front and rear photo upload
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
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
                'newRequest.uploadFrontRearPhotos': 'Upload front and rear vehicle photos',
                'newRequest.frontPhoto': 'Front Photo',
                'newRequest.rearPhoto': 'Rear Photo',
                'newRequest.addFrontPhoto': 'Add Front Photo',
                'newRequest.addRearPhoto': 'Add Rear Photo',
                'newRequest.takeFrontPhoto': 'Take Front Photo',
                'newRequest.takeRearPhoto': 'Take Rear Photo',
            };
            return translations[key] || key;
        },
        isRTL: false,
        rtlFlexDirection: (isRTL: boolean) => isRTL ? 'row-reverse' : 'row',
        rtlTextAlign: (isRTL: boolean) => isRTL ? 'right' : 'left',
        carFrontImage: null,
        carRearImage: null,
        handlePickCarFrontImage: jest.fn(),
        handlePickCarRearImage: jest.fn(),
        handleTakeCarFrontPhoto: jest.fn(),
        handleTakeCarRearPhoto: jest.fn(),
        removeCarFrontImage: jest.fn(),
        removeCarRearImage: jest.fn(),
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
        
        expect(screen.getByText('Upload front and rear vehicle photos')).toBeTruthy();
    });

    it('should display step number badge', () => {
        render(<VehicleIdPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('4')).toBeTruthy();
    });

    it('should render front photo section', () => {
        render(<VehicleIdPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('Front Photo')).toBeTruthy();
    });

    it('should render rear photo section', () => {
        render(<VehicleIdPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('Rear Photo')).toBeTruthy();
    });

    it('should render add front photo button', () => {
        render(<VehicleIdPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('Add Front Photo')).toBeTruthy();
    });

    it('should render add rear photo button', () => {
        render(<VehicleIdPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('Add Rear Photo')).toBeTruthy();
    });

    it('should call handlePickCarFrontImage when add front photo is pressed', () => {
        const handlePickCarFrontImageMock = jest.fn();
        render(<VehicleIdPhotosStep {...defaultProps} handlePickCarFrontImage={handlePickCarFrontImageMock} />);
        
        const addButton = screen.getByText('Add Front Photo');
        fireEvent.press(addButton);
        
        expect(handlePickCarFrontImageMock).toHaveBeenCalled();
    });

    it('should call handlePickCarRearImage when add rear photo is pressed', () => {
        const handlePickCarRearImageMock = jest.fn();
        render(<VehicleIdPhotosStep {...defaultProps} handlePickCarRearImage={handlePickCarRearImageMock} />);
        
        const addButton = screen.getByText('Add Rear Photo');
        fireEvent.press(addButton);
        
        expect(handlePickCarRearImageMock).toHaveBeenCalled();
    });

    it('should render take front photo button', () => {
        render(<VehicleIdPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('Take Front Photo')).toBeTruthy();
    });

    it('should render take rear photo button', () => {
        render(<VehicleIdPhotosStep {...defaultProps} />);
        
        expect(screen.getByText('Take Rear Photo')).toBeTruthy();
    });

    it('should call handleTakeCarFrontPhoto when take front photo is pressed', () => {
        const handleTakeCarFrontPhotoMock = jest.fn();
        render(<VehicleIdPhotosStep {...defaultProps} handleTakeCarFrontPhoto={handleTakeCarFrontPhotoMock} />);
        
        const takeButton = screen.getByText('Take Front Photo');
        fireEvent.press(takeButton);
        
        expect(handleTakeCarFrontPhotoMock).toHaveBeenCalled();
    });

    it('should call handleTakeCarRearPhoto when take rear photo is pressed', () => {
        const handleTakeCarRearPhotoMock = jest.fn();
        render(<VehicleIdPhotosStep {...defaultProps} handleTakeCarRearPhoto={handleTakeCarRearPhotoMock} />);
        
        const takeButton = screen.getByText('Take Rear Photo');
        fireEvent.press(takeButton);
        
        expect(handleTakeCarRearPhotoMock).toHaveBeenCalled();
    });

    it('should display front photo preview when carFrontImage is provided', () => {
        render(<VehicleIdPhotosStep {...defaultProps} carFrontImage="front.jpg" />);
        
        expect(screen.getByTestId('front-image-preview')).toBeTruthy();
    });

    it('should display rear photo preview when carRearImage is provided', () => {
        render(<VehicleIdPhotosStep {...defaultProps} carRearImage="rear.jpg" />);
        
        expect(screen.getByTestId('rear-image-preview')).toBeTruthy();
    });

    it('should call removeCarFrontImage when remove front is pressed', () => {
        const removeCarFrontImageMock = jest.fn();
        render(<VehicleIdPhotosStep {...defaultProps} carFrontImage="front.jpg" removeCarFrontImage={removeCarFrontImageMock} />);
        
        const removeButton = screen.getByTestId('remove-front-image');
        if (removeButton) {
            fireEvent.press(removeButton);
        }
        
        expect(removeCarFrontImageMock).toHaveBeenCalled();
    });

    it('should call removeCarRearImage when remove rear is pressed', () => {
        const removeCarRearImageMock = jest.fn();
        render(<VehicleIdPhotosStep {...defaultProps} carRearImage="rear.jpg" removeCarRearImage={removeCarRearImageMock} />);
        
        const removeButton = screen.getByTestId('remove-rear-image');
        if (removeButton) {
            fireEvent.press(removeButton);
        }
        
        expect(removeCarRearImageMock).toHaveBeenCalled();
    });

    it('should support RTL layout', () => {
        const { rerender } = render(<VehicleIdPhotosStep {...defaultProps} isRTL={false} />);
        expect(screen.getByText('Vehicle ID Photos')).toBeTruthy();
        
        rerender(<VehicleIdPhotosStep {...defaultProps} isRTL={true} />);
        expect(screen.getByText('Vehicle ID Photos')).toBeTruthy();
    });

    it('should hide add buttons when images are provided', () => {
        render(<VehicleIdPhotosStep {...defaultProps} carFrontImage="front.jpg" carRearImage="rear.jpg" />);
        
        expect(screen.queryByText('Add Front Photo')).toBeNull();
        expect(screen.queryByText('Add Rear Photo')).toBeNull();
    });
});
