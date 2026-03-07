import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { compressImage } from '../utils/imageCompressor';

export function useRequestImages(t: any, toast: any) {
    // Photos - Split into Part Damage and Vehicle ID
    const [images, setImages] = useState<string[]>([]);  // Part damage photos
    const [carFrontImage, setCarFrontImage] = useState<string | null>(null);  // Vehicle front ID
    const [carRearImage, setCarRearImage] = useState<string | null>(null);    // Vehicle rear ID

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            toast.error(t('common.permissionDenied'), t('common.galleryPermission'));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
            selectionLimit: 5 - images.length,
        });

        if (!result.canceled && result.assets) {
            const compressedImages = await Promise.all(
                result.assets.map(async asset => {
                    try {
                        return await compressImage(asset.uri, {
                            maxWidth: 1920,
                            quality: 0.7,
                            format: 'jpeg',
                        });
                    } catch (error) {
                        return asset.uri; // Fallback to original
                    }
                })
            );
            setImages(prev => [...prev, ...compressedImages].slice(0, 5));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            toast.error(t('common.permissionDenied'), t('common.cameraPermission'));
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
            allowsEditing: true,
        });

        if (!result.canceled && result.assets[0]) {
            try {
                const compressed = await compressImage(result.assets[0].uri, {
                    maxWidth: 1920,
                    quality: 0.7,
                    format: 'jpeg',
                });
                setImages(prev => [...prev, compressed].slice(0, 5));
            } catch (error) {
                setImages(prev => [...prev, result.assets[0].uri].slice(0, 5));
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handleRemoveImage = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const pickSingleImage = async (setter: (uri: string | null) => void) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            toast.error(t('common.permissionDenied'), t('common.galleryPermission'));
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: true,
        });
        if (!result.canceled && result.assets[0]) {
            try {
                const compressed = await compressImage(result.assets[0].uri, {
                    maxWidth: 1920,
                    quality: 0.7,
                    format: 'jpeg',
                });
                setter(compressed);
            } catch (error) {
                setter(result.assets[0].uri);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const takeSinglePhoto = async (setter: (uri: string | null) => void) => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            toast.error(t('common.permissionDenied'), t('common.cameraPermission'));
            return;
        }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
        if (!result.canceled && result.assets[0]) {
            try {
                const compressed = await compressImage(result.assets[0].uri, {
                    maxWidth: 1920,
                    quality: 0.7,
                    format: 'jpeg',
                });
                setter(compressed);
            } catch (error) {
                setter(result.assets[0].uri);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handlePickCarFrontImage = () => pickSingleImage(setCarFrontImage);
    const handlePickCarRearImage = () => pickSingleImage(setCarRearImage);
    const handleTakeCarFrontPhoto = () => takeSinglePhoto(setCarFrontImage);
    const handleTakeCarRearPhoto = () => takeSinglePhoto(setCarRearImage);

    return {
        images,
        carFrontImage,
        carRearImage,
        setCarFrontImage,
        setCarRearImage,
        handlePickImage,
        handleTakePhoto,
        handleRemoveImage,
        handlePickCarFrontImage,
        handlePickCarRearImage,
        handleTakeCarFrontPhoto,
        handleTakeCarRearPhoto,
    };
}
