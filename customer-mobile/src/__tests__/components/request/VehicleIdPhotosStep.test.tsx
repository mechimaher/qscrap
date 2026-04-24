import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import VehicleIdPhotosStep from '../../../components/request/VehicleIdPhotosStep';

jest.mock('../../../components/request/PhotoUploadSection', () => {
    const React = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');

    return function MockPhotoUploadSection({
        images,
        onPickImage,
        onTakePhoto,
        onRemoveImage,
    }: any) {
        return (
            <View testID="photo-upload-section">
                {images.length > 0 ? (
                    <TouchableOpacity testID="remove-photo-btn" onPress={() => onRemoveImage(0)}>
                        <Text>Remove Photo</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        <TouchableOpacity testID="add-photo-btn" onPress={onPickImage}>
                            <Text>Add Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity testID="take-photo-btn" onPress={onTakePhoto}>
                            <Text>Take Photo</Text>
                        </TouchableOpacity>
                    </>
                )}

                {images.map((uri: string, index: number) => (
                    <Text key={`${uri}-${index}`} testID="image-preview">
                        {uri}
                    </Text>
                ))}
            </View>
        );
    };
});

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
                'newRequest.helpGaragesIdentify': 'Upload front and rear vehicle photos',
                'newRequest.frontView': 'Front Photo',
                'newRequest.rearView': 'Rear Photo',
            };
            return translations[key] || key;
        },
        isRTL: false,
        rtlTextAlign: (isRTL: boolean) => (isRTL ? 'right' : 'left'),
        carFrontImage: null,
        carRearImage: null,
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

    it('renders step header and labels', () => {
        render(<VehicleIdPhotosStep {...defaultProps} />);

        expect(screen.getByText('Vehicle ID Photos')).toBeTruthy();
        expect(screen.getByText('Upload front and rear vehicle photos')).toBeTruthy();
        expect(screen.getByText('4')).toBeTruthy();
        expect(screen.getByText('Front Photo')).toBeTruthy();
        expect(screen.getByText('Rear Photo')).toBeTruthy();
    });

    it('calls front and rear gallery handlers', () => {
        const handlePickCarFrontImage = jest.fn();
        const handlePickCarRearImage = jest.fn();

        render(
            <VehicleIdPhotosStep
                {...defaultProps}
                handlePickCarFrontImage={handlePickCarFrontImage}
                handlePickCarRearImage={handlePickCarRearImage}
            />
        );

        const addButtons = screen.getAllByTestId('add-photo-btn');
        fireEvent.press(addButtons[0]);
        fireEvent.press(addButtons[1]);

        expect(handlePickCarFrontImage).toHaveBeenCalledTimes(1);
        expect(handlePickCarRearImage).toHaveBeenCalledTimes(1);
    });

    it('calls front and rear camera handlers', () => {
        const handleTakeCarFrontPhoto = jest.fn();
        const handleTakeCarRearPhoto = jest.fn();

        render(
            <VehicleIdPhotosStep
                {...defaultProps}
                handleTakeCarFrontPhoto={handleTakeCarFrontPhoto}
                handleTakeCarRearPhoto={handleTakeCarRearPhoto}
            />
        );

        const takeButtons = screen.getAllByTestId('take-photo-btn');
        fireEvent.press(takeButtons[0]);
        fireEvent.press(takeButtons[1]);

        expect(handleTakeCarFrontPhoto).toHaveBeenCalledTimes(1);
        expect(handleTakeCarRearPhoto).toHaveBeenCalledTimes(1);
    });

    it('shows previews and remove actions when images exist', () => {
        const setCarFrontImage = jest.fn();
        const setCarRearImage = jest.fn();

        render(
            <VehicleIdPhotosStep
                {...defaultProps}
                carFrontImage="front.jpg"
                carRearImage="rear.jpg"
                setCarFrontImage={setCarFrontImage}
                setCarRearImage={setCarRearImage}
            />
        );

        expect(screen.getAllByTestId('image-preview')).toHaveLength(2);
        expect(screen.queryByTestId('add-photo-btn')).toBeNull();

        const removeButtons = screen.getAllByTestId('remove-photo-btn');
        fireEvent.press(removeButtons[0]);
        fireEvent.press(removeButtons[1]);

        expect(setCarFrontImage).toHaveBeenCalledWith(null);
        expect(setCarRearImage).toHaveBeenCalledWith(null);
    });

    it('supports RTL layout', () => {
        const { rerender } = render(<VehicleIdPhotosStep {...defaultProps} isRTL={false} />);
        expect(screen.getByText('Vehicle ID Photos')).toBeTruthy();

        rerender(<VehicleIdPhotosStep {...defaultProps} isRTL={true} />);
        expect(screen.getByText('Vehicle ID Photos')).toBeTruthy();
    });
});
