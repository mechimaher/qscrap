import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import RequestPhotosStep from '../../../components/request/RequestPhotosStep';

jest.mock('../../../components/request/PhotoUploadSection', () => {
    const React = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');

    return function MockPhotoUploadSection({
        images,
        maxImages,
        onPickImage,
        onTakePhoto,
        onRemoveImage,
    }: any) {
        return (
            <View testID="photo-upload-section">
                {images.map((uri: string, index: number) => (
                    <View key={`${uri}-${index}`}>
                        <Text testID="image-preview">{uri}</Text>
                        <TouchableOpacity testID={`remove-image-${index}`} onPress={() => onRemoveImage(index)}>
                            <Text>Remove</Text>
                        </TouchableOpacity>
                    </View>
                ))}

                {images.length < maxImages && (
                    <>
                        <TouchableOpacity testID="add-photo-btn" onPress={onPickImage}>
                            <Text>Add Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity testID="take-photo-btn" onPress={onTakePhoto}>
                            <Text>Take Photo</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        );
    };
});

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
        rtlTextAlign: (isRTL: boolean) => (isRTL ? 'right' : 'left'),
        images: [] as string[],
        handlePickImage: jest.fn(),
        handleTakePhoto: jest.fn(),
        handleRemoveImage: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders step header and subtitle', () => {
        render(<RequestPhotosStep {...defaultProps} />);

        expect(screen.getByText('Part Photos')).toBeTruthy();
        expect(screen.getByText('Upload photos of part damage')).toBeTruthy();
        expect(screen.getByText('3')).toBeTruthy();
    });

    it('calls gallery and camera handlers', () => {
        const handlePickImage = jest.fn();
        const handleTakePhoto = jest.fn();

        render(
            <RequestPhotosStep
                {...defaultProps}
                handlePickImage={handlePickImage}
                handleTakePhoto={handleTakePhoto}
            />
        );

        fireEvent.press(screen.getByTestId('add-photo-btn'));
        fireEvent.press(screen.getByTestId('take-photo-btn'));

        expect(handlePickImage).toHaveBeenCalledTimes(1);
        expect(handleTakePhoto).toHaveBeenCalledTimes(1);
    });

    it('renders uploaded images and removes by index', () => {
        const handleRemoveImage = jest.fn();
        render(
            <RequestPhotosStep
                {...defaultProps}
                images={['image1.jpg', 'image2.jpg']}
                handleRemoveImage={handleRemoveImage}
            />
        );

        expect(screen.getAllByTestId('image-preview')).toHaveLength(2);
        fireEvent.press(screen.getByTestId('remove-image-0'));
        expect(handleRemoveImage).toHaveBeenCalledWith(0);
    });

    it('hides add/take controls at max image count', () => {
        render(
            <RequestPhotosStep
                {...defaultProps}
                images={['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg']}
            />
        );

        expect(screen.queryByTestId('add-photo-btn')).toBeNull();
        expect(screen.queryByTestId('take-photo-btn')).toBeNull();
    });

    it('supports RTL layout', () => {
        const { rerender } = render(<RequestPhotosStep {...defaultProps} isRTL={false} />);
        expect(screen.getByText('Part Photos')).toBeTruthy();

        rerender(<RequestPhotosStep {...defaultProps} isRTL={true} />);
        expect(screen.getByText('Part Photos')).toBeTruthy();
    });
});
