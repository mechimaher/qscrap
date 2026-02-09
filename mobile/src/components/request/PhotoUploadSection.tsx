import { log } from '../../utils/logger';
/**
 * PhotoUploadSection - Extracted from NewRequestScreen
 * Reusable photo upload grid with gallery + camera buttons
 */
import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes } from '../../constants/theme';
import { useTranslation } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';

interface PhotoUploadSectionProps {
    /** Array of image URIs */
    images: string[];
    /** Max number of images allowed */
    maxImages: number;
    /** Called when user wants to pick from gallery */
    onPickImage: () => void;
    /** Called when user wants to take a photo */
    onTakePhoto: () => void;
    /** Called to remove an image at given index */
    onRemoveImage: (index: number) => void;
    /** Optional: show full-width images instead of grid */
    fullWidth?: boolean;
}

function PhotoUploadSection({
    images,
    maxImages,
    onPickImage,
    onTakePhoto,
    onRemoveImage,
    fullWidth = false,
}: PhotoUploadSectionProps) {
    const { t, isRTL } = useTranslation();
    const { colors } = useTheme();

    if (fullWidth) {
        // Single image mode (e.g., vehicle front/rear photos)
        return (
            <>
                {images.length > 0 ? (
                    <View style={{ marginBottom: 16 }}>
                        <Image source={{ uri: images[0] }} style={styles.fullWidthImage} />
                        <TouchableOpacity
                            onPress={() => onRemoveImage(0)}
                            style={[styles.removePhotoButton, { top: 8, right: 8 }]}
                        >
                            <Text style={styles.removePhotoIcon}>✕</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                        <TouchableOpacity
                            onPress={onPickImage}
                            style={[styles.addPhotoButton, { flex: 1, backgroundColor: colors.background, borderColor: colors.border }]}
                        >
                            <Text style={styles.addPhotoIcon}>📁</Text>
                            <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>{t('common.gallery')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onTakePhoto}
                            style={[styles.addPhotoButton, { flex: 1, backgroundColor: colors.background, borderColor: colors.border }]}
                        >
                            <Text style={styles.addPhotoIcon}>📸</Text>
                            <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>{t('common.camera')}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </>
        );
    }

    // Grid mode (multi-image)
    return (
        <View style={[styles.photoGrid, { flexDirection: rtlFlexDirection(isRTL) }]}>
            {images.map((uri, index) => (
                <View key={index} style={styles.photoWrapper}>
                    <Image source={{ uri }} style={styles.photo} />
                    <TouchableOpacity
                        onPress={() => onRemoveImage(index)}
                        style={styles.removePhotoButton}
                    >
                        <Text style={styles.removePhotoIcon}>✕</Text>
                    </TouchableOpacity>
                </View>
            ))}

            {images.length < maxImages && (
                <TouchableOpacity
                    onPress={onPickImage}
                    style={[styles.addPhotoButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                    <Text style={styles.addPhotoIcon}>📁</Text>
                    <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>
                        {t('common.gallery')}
                    </Text>
                </TouchableOpacity>
            )}

            {images.length < maxImages && (
                <TouchableOpacity
                    onPress={onTakePhoto}
                    style={[styles.addPhotoButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                    <Text style={styles.addPhotoIcon}>📸</Text>
                    <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>
                        {t('common.camera')}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

export default memo(PhotoUploadSection);

const styles = StyleSheet.create({
    photoGrid: {
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    photoWrapper: {
        width: 100,
        height: 100,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    removePhotoButton: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removePhotoIcon: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    addPhotoButton: {
        width: 100,
        height: 100,
        borderRadius: BorderRadius.lg,
        borderWidth: 2,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addPhotoIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    addPhotoText: {
        fontSize: FontSizes.xs,
        fontWeight: '500',
    },
    fullWidthImage: {
        width: '100%',
        height: 200,
        borderRadius: 12,
    },
});
