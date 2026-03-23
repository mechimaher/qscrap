import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import { compressImage } from '../utils/imageCompressor';

export function useRequestImages(t: any, toast: any) {
    // Photos - Split into Part Damage and Vehicle ID
    const [images, setImages] = useState<string[]>([]); // Part damage photos
    const [carFrontImage, setCarFrontImage] = useState<string | null>(null); // Vehicle front ID
    const [carRearImage, setCarRearImage] = useState<string | null>(null); // Vehicle rear ID

    const MAX_BYTES = 10 * 1024 * 1024; // 10MB per file

    const validateAndCompress = async (uri: string) => {
        try {
            const info = await FileSystem.getInfoAsync(uri);
            if (info.size && info.size > MAX_BYTES) {
                // Attempt compression to reduce below threshold
                const compressed = await compressImage(uri, {
                    maxWidth: 1920,
                    quality: 0.6,
                    format: 'jpeg'
                });
                const compressedInfo = await FileSystem.getInfoAsync(compressed);
                if (compressedInfo.size && compressedInfo.size > MAX_BYTES) {
                    toast.error(t('common.error'), t('common.imageTooLarge'));
                    return null;
                }
                return compressed;
            }
            return uri;
        } catch (error) {
            // Fallback to original if FileSystem fails
            return uri;
        }
    };

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
            selectionLimit: 5 - images.length
        });

        if (!result.canceled && result.assets) {
            const processedImages = await Promise.all(
                result.assets.map(async (asset) => {
                    const validUri = await validateAndCompress(asset.uri);
                    if (!validUri) return null;
                    try {
                        return await compressImage(validUri, {
                            maxWidth: 1920,
                            quality: 0.7,
                            format: 'jpeg'
                        });
                    } catch (error) {
                        return validUri; // Fallback to validated uri
                    }
                })
            );
            setImages((prev) => [...prev, ...processedImages.filter(Boolean) as string[]].slice(0, 5));
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
            allowsEditing: true
        });

        if (!result.canceled && result.assets[0]) {
            const validUri = await validateAndCompress(result.assets[0].uri);
            if (!validUri) return;
            try {
                const compressed = await compressImage(validUri, {
                    maxWidth: 1920,
                    quality: 0.7,
                    format: 'jpeg'
                });
                setImages((prev) => [...prev, compressed].slice(0, 5));
            } catch (error) {
                setImages((prev) => [...prev, validUri].slice(0, 5));
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handleRemoveImage = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setImages((prev) => prev.filter((_, i) => i !== index));
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
            allowsEditing: true
        });
        if (!result.canceled && result.assets[0]) {
            const validUri = await validateAndCompress(result.assets[0].uri);
            if (!validUri) return;
            try {
                const compressed = await compressImage(validUri, {
                    maxWidth: 1920,
                    quality: 0.7,
                    format: 'jpeg'
                });
                setter(compressed);
            } catch (error) {
                setter(validUri);
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
            const validUri = await validateAndCompress(result.assets[0].uri);
            if (!validUri) return;
            try {
                const compressed = await compressImage(validUri, {
                    maxWidth: 1920,
                    quality: 0.7,
                    format: 'jpeg'
                });
                setter(compressed);
            } catch (error) {
                setter(validUri);
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
        handleTakeCarRearPhoto
    };
}
